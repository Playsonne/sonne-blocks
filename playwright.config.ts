import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  expect: { timeout: 8000 },
  globalSetup: './tests/browser/setup.ts',
  use: {
    baseURL: 'http://localhost:4283',
    channel: process.env.PW_BROWSER_CHANNEL || 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
});
