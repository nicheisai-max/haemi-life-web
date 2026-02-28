import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    use: {
        baseURL: 'http://localhost:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'npm --prefix ../backend run dev',
            url: 'http://localhost:5000/health',
            reuseExistingServer: false,
            timeout: 600000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            command: 'npm --prefix ../frontend run dev',
            url: 'http://localhost:5173',
            reuseExistingServer: false,
            timeout: 600000,
            stdout: 'pipe',
            stderr: 'pipe',
        }
    ],
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
