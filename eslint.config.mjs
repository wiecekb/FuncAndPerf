import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
    extends: [
        eslint.configs.recommended,
        tseslint.configs.recommended,
    ],
    rules: {
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
        'no-console': 'off',
    },
    ignores: [
        'dist/',
        'node_modules/',
        'allure-results/',
        '**/allure-results/**',
        'allure-report/',
        '**/allure-report/**',
        'playwright-report/',
        '**/playwright-report/**',
        'playwright-report-unit/',
        '**/playwright-report-unit/**',
        'test-results/',
        '**/test-results/**',
        'test-results-parsed.json',
        'test-scenarios-temp.json',
        'scripts/performance-test.js',
        'performance_scripts/',
        '**/performance_scripts/**',
        'gatling/',
        'gatling-results/',
        '**/gatling-results/**',
        'target/',
        '**/target/**',
        'results/',
        '**/results/**',
    ],
});
