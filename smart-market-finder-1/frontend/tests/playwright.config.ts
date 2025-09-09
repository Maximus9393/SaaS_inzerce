import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    headless: true,
    baseURL: 'http://localhost:5000',
    viewport: { width: 1280, height: 800 },
  },
  projects: [ { name: 'chromium', use: { browserName: 'chromium' } } ],
});
