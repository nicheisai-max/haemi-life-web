import { test, expect } from '@playwright/test';

test.describe('UI Baseline Snapshots', () => {
    test('Login Page Baseline', async ({ page }) => {
        await page.goto('/login');
        // Wait for any animations to settle
        await page.waitForTimeout(1000);
        await expect(page).toHaveScreenshot('login-page.png', { fullPage: true });
    });

    test('Dashboard Baseline', async ({ page }) => {
        // Note: Assuming there's a way to bypass login or use a test account
        // For baseline system, we'll try to navigate and snapshot what's visible
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
    });

    test('Sidebar and Navigation Baseline', async ({ page }) => {
        await page.goto('/dashboard');
        const sidebar = page.locator('aside, .sidebar, nav');
        if (await sidebar.isVisible()) {
            await expect(sidebar).toHaveScreenshot('sidebar.png');
        }
    });

    test('Admin Panel Baseline', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForTimeout(2000);
        await expect(page).toHaveScreenshot('admin-panel.png', { fullPage: true });
    });
});
