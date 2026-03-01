import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1, // Sequential execution for stable auth race testing
    reporter: 'html',
    use: {
        baseURL: 'http://127.0.0.1:5173',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    webServer: [
        {
            command: 'npm --prefix ../backend run test:e2e:backend',
            url: 'http://127.0.0.1:5000/health',
            reuseExistingServer: true,
            timeout: 60000,
            stdout: 'pipe',
            stderr: 'pipe',
        },
        {
            command: 'npm --prefix ../frontend run dev',
            url: 'http://127.0.0.1:5173',
            reuseExistingServer: true,
            timeout: 60000,
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
