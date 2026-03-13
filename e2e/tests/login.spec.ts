import { test, expect } from '@playwright/test';

// Use a known demo/admin account if exists, or mock if we want pure E2E isolation
const TEST_EMAIL = 'admin@haemilife.com';
const TEST_PASSWORD = '123456';

test.describe('Authentication E2E Lifecycle', () => {

    test.beforeEach(async ({ page }) => {
        // Clear storage to ensure isolated tests
        await page.goto('/login');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await page.reload();
    });

    // TEST CASE 1
    test('Valid Login, Redirect & Reload Persistence', async ({ page }) => {
        // Find email and password fields generically
        await page.locator('input[placeholder*="example"], input[type="text"], input[type="email"]').first().fill(TEST_EMAIL);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();

        // Wait for redirect to dashboard or admin
        await expect(page).toHaveURL(/.*admin|.*dashboard/, { timeout: 25000 });
        await expect(page.locator('text=/Welcome/i').first()).toBeVisible();

        // Reload page
        await page.reload();

        // Confirm still authenticated
        await expect(page).toHaveURL(/.*admin|.*dashboard/, { timeout: 25000 });
        await expect(page.locator('text=/Welcome/i').first()).toBeVisible();
    });

    // TEST CASE 2
    test('Invalid credentials display error & block redirect', async ({ page }) => {
        await page.locator('input[placeholder*="example"], input[type="text"], input[type="email"]').first().fill('wrong@user.com');
        await page.locator('input[type="password"]').fill('badpass');
        await page.getByRole('button', { name: /sign in/i }).click();

        // Should see an error message in an alert
        const alert = page.locator('[role="alert"]');
        await expect(alert).toBeVisible({ timeout: 15000 });
        await expect(alert).toContainText(/invalid|failed/i);

        // URL should still be /login
        expect(page.url()).toContain('/login');
    });

    // TEST CASE 3 & 6: Expired access token auto-refresh
    test('Simulate Expired Access Token (Auto-Refresh)', async ({ page }) => {
        // Login first
        await page.locator('input[placeholder*="example"], input[type="text"], input[type="email"]').first().fill(TEST_EMAIL);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*admin|.*dashboard/, { timeout: 25000 });

        // Intercept an API call (e.g. fetching profile/dash data) to return 401
        await page.route('**/api/auth/me', route => {
            route.fulfill({
                status: 401,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Token expired' })
            });
        }, { times: 1 }); // Only intercept ONCE to simulate expired token, so refresh resolves it

        // Reload page to trigger auth checks (which will hit /auth/me and get 401, triggering refresh)
        await page.reload();

        // It should seamlessly recover using the refresh token
        await expect(page).toHaveURL(/.*admin|.*dashboard/, { timeout: 25000 });
    });

    // TEST CASE 4: Expired refresh token forces logout
    test('Simulate Expired Refresh Token (Forced Logout)', async ({ page }) => {
        // Login first
        await page.locator('input[placeholder*="example"], input[type="text"], input[type="email"]').first().fill(TEST_EMAIL);
        await page.locator('input[type="password"]').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/.*admin|.*dashboard/, { timeout: 25000 });

        // Intercept BOTH the api call and the refresh-token endpoint to return 401
        await page.route('**/api/auth/me', route => {
            route.fulfill({ status: 401, body: '{}' });
        });
        await page.route('**/api/auth/refresh-token', route => {
            route.fulfill({ status: 401, body: '{}' });
        });

        // Trigger interaction or reload
        await page.reload();

        // Should redirect to login
        await expect(page).toHaveURL(/.*login/, { timeout: 15000 });
    });

    // TEST CASE 5: Backend restart / unreachable
    test('Simulate Backend Unreachable (Health Poll Safety)', async ({ page }) => {
        // Start intercepting /health to simulate backend offline
        await page.route('**/health', route => {
            route.fulfill({ status: 500, body: '{}' });
        }, { times: 2 }); // Offline twice

        // The 3rd time let it pass through (backend "recovered")

        await page.goto('/login');

        // Wait for page to finish loading
        // We shouldn't crash or get stuck in a white screen.
        await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 20000 });
    });

});
