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
      env: { DATABASE_URL: E2E_DATABASE_URL, WEB_INTERNAL_URL: 'http://localhost:5173', REVALIDATE_SECRET: 'e2e-revalidate-secret' },
      timeout: 60_000,
    },
    {
      // Never reuse: must be the production build carrying REVALIDATE_SECRET —
      // a stale dev server already on :5173 would otherwise be silently reused
      // and wouldn't have the secret the /internal/revalidate route checks, so
      // the admin API's fire-and-forget revalidate calls would 401 silently.
      command: 'npm run build && npm run start',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      env: { API_INTERNAL_URL: 'http://localhost:4000', REVALIDATE_SECRET: 'e2e-revalidate-secret' },
      timeout: 240_000,
    },
  ],
});
