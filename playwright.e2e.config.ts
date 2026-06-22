import { defineConfig, devices } from '@playwright/test';
import { config } from './src';

/**
 * Frontend base URL resolved from `config.hosts.frontendMain`.
 *
 * Falls back to the public Playwright site when no host is configured.
 */
const frontendBaseUrl: string = config.hosts.frontendMain || 'https://playwright.dev';

/**
 * Playwright configuration dedicated to classic (TypeScript-driven) E2E tests.
 *
 * Runs in isolation from the scenario runner (`playwright.config.ts`): it scans only
 * `tests/e2e/`, configures browser projects, retry policy, capture options and routes
 * Allure output to the shared `allure-results/` directory so classic and scenario tests
 * share a single report when executed together.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 30000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['html', { outputFolder: 'playwright-report-e2e', open: 'never' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
  ],
  use: {
    baseURL: frontendBaseUrl,
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
