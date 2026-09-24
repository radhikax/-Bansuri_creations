import { defineConfig, devices } from '@playwright/test';
import { E2E_DATABASE_URL } from './e2e/env';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // Never reuse: a dev API already on :4000 would be pointed at ecommerce_dev,
      // and the admin test would change the dev admin's password. Playwright fails
      // fast on a busy port instead.
      command: 'npm run dev',
      cwd: 'server',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: false,
      env: { DATABASE_URL: E2E_DATABASE_URL },
      timeout: 60_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
