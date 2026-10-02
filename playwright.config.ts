import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'https://review-chore-qa-i-lgtytk.dev.glopros.com';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0, // absorbs infra blips on a shared review env
  workers: process.env.CI ? 1 : undefined, // gentle on a shared env
  timeout: 60_000,
  expect: { timeout: 15_000 }, // review envs can be slow; assertions auto-wait
  reporter: process.env.CI
    ? [
        ['github'],
        // Each CI job writes a blob; the report job merges them into one HTML report.
        ['blob', { fileName: `report-${process.env.TEST_TIER ?? 'all'}.zip` }],
      ]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Videos can't be masked and the CI report is public; traces cover CI.
    video: process.env.CI ? 'off' : 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
