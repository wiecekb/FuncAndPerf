import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: './tests/unit',
    testMatch: '**/*.spec.ts',
    timeout: 30000,
    workers: 1,
    fullyParallel: false,
    use: {
        headless: true
    },
    reporter: [
        ['list'],
        ['html', {outputFolder: 'playwright-report-unit', open: 'never'}]
    ]
});