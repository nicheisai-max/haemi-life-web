import { test, expect } from '@playwright/test';

test.describe('UI Baseline Snapshots', () => {
    test('Login Page Baseline', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(1000);
        // Masking dynamic elements like timestamps or avatars
        await expect(page).toHaveScreenshot('login-page.png', {
            fullPage: true,
            mask: [
                page.locator('.timestamp'),
                page.locator('.user-avatar'),
                page.locator('.notification-badge')
            ]
        });
    });

    test('Dashboard Baseline', async ({ page }) => {
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        await expect(page).toHaveScreenshot('dashboard.png', {
            fullPage: true,
            mask: [
                page.locator('.crypto-chart'), // Charts are often dynamic
                page.locator('.balance-amount'),
                page.locator('.last-updated'),
                page.locator('time')
            ]
        });
    });

    test('Sidebar and Navigation Baseline', async ({ page }) => {
        await page.goto('/dashboard');
        const sidebar = page.locator('aside, .sidebar, nav');
        if (await sidebar.isVisible()) {
            await expect(sidebar).toHaveScreenshot('sidebar.png', {
                mask: [page.locator('.user-profile-summary')]
            });
        }
    });

    test('Admin Panel Baseline', async ({ page }) => {
        await page.goto('/admin');
        await page.waitForTimeout(2000);
        await expect(page).toHaveScreenshot('admin-panel.png', {
            fullPage: true,
            mask: [
                page.locator('.log-entry-time'),
                page.locator('.sys-resource-metrics')
            ]
        });
    });
});
