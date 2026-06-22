import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  testIgnore: ['tests/e2e/**'],
  timeout: 60000,
  workers: 5,
  fullyParallel: true,
  use: {
    headless: true,
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['allure-playwright', { outputFolder: 'allure-results' }],
    ['junit', { outputFile: 'test-results/results.xml' }],
  ],
});
