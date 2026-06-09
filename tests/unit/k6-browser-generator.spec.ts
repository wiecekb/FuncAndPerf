import { expect, test } from '@playwright/test';
import { generateScript } from '../../scripts/generate-k6-browser';
import { generateInstructionLines, toValidFunctionName } from '../../scripts/shared';
import { selectorToLocatorExpr } from '../../src/test-modules/browser/codegen';
import { Scenario, type ScenarioData, type StepData } from '../../src/scenario/loader';
import { ScenarioType } from '../../src/scenario/types';
import type { BrowserInstruction, BrowserSelector } from '../../src/test-modules/browser/types';

function browserStep(overrides: Partial<StepData> = {}): StepData {
  return {
    stepType: ScenarioType.BROWSER,
    stepName: 'Browser step',
    returnCode: 200,
    additionalData: {
      instructions: [{ kind: 'action', action: 'goto', value: '/home' }],
    },
    ...overrides,
  };
}

function scenario(data: ScenarioData): Scenario {
  return Scenario.fromJson(data);
}

function assertGeneratedJavaScriptDoesNotContainTypeScript(code: string): void {
  const forbiddenTypeScriptFragments: RegExp[] = [
    /:\s*string\b/,
    /:\s*number\b/,
    /:\s*boolean\b/,
    /:\s*Record\s*</,
    /:\s*Array\s*</,
    /\([^)]*:\s*string[^)]*\)\s*=>/,
    /\([^)]*:\s*number[^)]*\)\s*=>/,
  ];

  for (const forbidden of forbiddenTypeScriptFragments) {
    expect(
      code,
      `Generated k6 browser JavaScript must not contain TypeScript syntax matching ${forbidden}`
    ).not.toMatch(forbidden);
  }
}

test.describe('k6 browser generator helpers', (): void => {
  test('toValidFunctionName sanitizes scenario names', (): void => {
    expect(toValidFunctionName('browser My Scenario #1')).toBe('browser_My_Scenario__1');
    expect(toValidFunctionName('123 start')).toBe('scenario_123_start');
    expect(toValidFunctionName('---')).toBe('scenario');
  });

  test('selectorToLocatorExpr generates Playwright locator expressions with escaping', (): void => {
    const selectors: Array<{ selector: BrowserSelector; expected: string }> = [
      {
        selector: { kind: 'role', role: 'button', name: "Save O'Neil", exact: true },
        expected: "page.getByRole('button', { name: 'Save O\\'Neil', exact: true })",
      },
      {
        selector: { kind: 'label', text: 'Email', exact: false },
        expected: "page.getByLabel('Email', { exact: false })",
      },
      {
        selector: { kind: 'testId', value: 'submit' },
        expected: "page.getByTestId('submit')",
      },
      {
        selector: { kind: 'text', value: 'Welcome', exact: true },
        expected: "page.getByText('Welcome', { exact: true })",
      },
      {
        selector: { kind: 'css', value: "input[name='q']" },
        expected: "page.locator('input[name=\\'q\\']')",
      },
      {
        selector: { kind: 'xpath', value: "//button[text()='Go']" },
        expected: "page.locator('xpath=//button[text()=\\'Go\\']')",
      },
    ];

    for (const { selector, expected } of selectors) {
      expect(selectorToLocatorExpr(selector)).toBe(expected);
    }
  });

  test('selectorToLocatorExpr resolves browser selector reference from config.yaml', (): void => {
    expect(selectorToLocatorExpr('mainPage.heading')).toBe("page.locator('h1')");
    expect(selectorToLocatorExpr('mainPage.docsLink')).toBe(
      "page.getByRole('link', { name: 'Docs', exact: false })"
    );
  });

  test('generateInstructionLines emits browser action lines', (): void => {
    const instructions: BrowserInstruction[] = [
      { kind: 'action', action: 'goto', value: '/dashboard' },
      { kind: 'action', action: 'click', selector: { kind: 'css', value: '#submit' }, timeoutMs: 2500 },
      { kind: 'action', action: 'fill', selector: { kind: 'label', text: 'Name' }, value: 'Alice' },
      { kind: 'action', action: 'press', selector: { kind: 'testId', value: 'search' }, key: 'Enter' },
      { kind: 'action', action: 'waitFor', selector: { kind: 'text', value: 'Loaded' }, timeoutMs: 5000 },
      { kind: 'action', action: 'screenshot' },
    ];

    const code: string = instructions
      .flatMap((instruction: BrowserInstruction): string[] =>
        generateInstructionLines(instruction, "Step O'Neil", 0, 'base0')
      )
      .join('\n');

    assertGeneratedJavaScriptDoesNotContainTypeScript(code);
    expect(code).toContain("await page.goto(resolveUrl(resolveValue('/dashboard'), base0));");
    expect(code).toContain("await page.locator('#submit').click({ timeout: 2500 });");
    expect(code).toContain(
      "await page.getByLabel('Name', { exact: false }).fill(resolveValue('Alice'), { timeout: 10000 });"
    );
    expect(code).toContain("await page.getByTestId('search').press('Enter', { timeout: 10000 });");
    expect(code).toContain("await page.getByText('Loaded', { exact: false }).waitFor({ timeout: 5000 });");
    expect(code).toContain("await page.screenshot({ path: 'results/k6-browser/1-Step O\\'Neil-manual.png' });");
  });

  test('generateInstructionLines emits assertion and extraction lines', (): void => {
    const instructions: BrowserInstruction[] = [
      { kind: 'assertion', assertion: 'toHaveURL', expected: '/dashboard' },
      { kind: 'assertion', assertion: 'toBeVisible', selector: { kind: 'role', role: 'heading', name: 'Dashboard' } },
      { kind: 'assertion', assertion: 'toHaveText', selector: { kind: 'css', value: 'h1' }, expected: 'Dashboard' },
      {
        kind: 'assertion',
        assertion: 'toContainText',
        selector: { kind: 'css', value: '.message' },
        expected: 'Ready',
      },
      { kind: 'assertion', assertion: 'toHaveValue', selector: { kind: 'label', text: 'Query' }, expected: 'k6' },
      { kind: 'extract', extract: 'url', saveAs: 'currentUrl' },
      { kind: 'extract', extract: 'textContent', selector: { kind: 'css', value: 'h1' }, saveAs: 'title' },
      { kind: 'extract', extract: 'inputValue', selector: { kind: 'label', text: 'Query' }, saveAs: 'query' },
      { kind: 'extract', extract: 'href', selector: { kind: 'css', value: 'a.next' }, saveAs: 'nextHref' },
    ];

    const code: string = instructions
      .flatMap((instruction: BrowserInstruction): string[] =>
        generateInstructionLines(instruction, 'Assert step', 1, 'base1')
      )
      .join('\n');

    assertGeneratedJavaScriptDoesNotContainTypeScript(code);
    expect(code).toContain("check(page.url(), { 'url matches': (u) => urlMatches(u, resolveValue('/dashboard')) });");
    expect(code).toContain(
      "check(await page.getByRole('heading', { name: 'Dashboard', exact: false }).isVisible(), { 'element visible': (v) => v === true });"
    );
    expect(code).toContain(
      "check(await page.locator('h1').textContent(), { 'text equals': (t) => (t || '').trim() === resolveValue('Dashboard') });"
    );
    expect(code).toContain(
      "check(await page.locator('.message').textContent(), { 'text contains': (t) => (t || '').includes(resolveValue('Ready')) });"
    );
    expect(code).toContain(
      "check(await page.getByLabel('Query', { exact: false }).inputValue(), { 'value equals': (v) => v === resolveValue('k6') });"
    );
    expect(code).toContain("ctx['currentUrl'] = page.url();");
    expect(code).toContain("ctx['title'] = await page.locator('h1').textContent();");
    expect(code).toContain("ctx['query'] = await page.getByLabel('Query', { exact: false }).inputValue();");
    expect(code).toContain("ctx['nextHref'] = await page.locator('a.next').getAttribute('href');");
  });
});

test.describe('k6 browser script generator', (): void => {
  test('generateScript includes browser-only scenarios and skips mixed scenarios', (): void => {
    const script: string = generateScript([
      scenario({
        scenarioName: 'Browser only',
        steps: [browserStep({ stepName: 'Open app', stepInstanceName: 'main' })],
      }),
      scenario({
        scenarioName: 'Mixed scenario',
        steps: [
          browserStep({ stepName: 'Browser part' }),
          {
            stepType: ScenarioType.CALCULATOR,
            stepName: 'API part',
            returnCode: 200,
            additionalData: { operation: 'add' },
          },
        ],
      }),
    ]);

    assertGeneratedJavaScriptDoesNotContainTypeScript(script);
    expect(script).toContain('async function browser_Browser_only()');
    expect(script).toContain("console.log('Step: Open app [main]');");
    expect(script).toContain('const scenarios = [browser_Browser_only];');
    expect(script).toContain('K6_BROWSER_SCENARIO_INDEX');
    expect(script).toContain('{"index":1,"name":"Browser only","stepCount":1}');
    expect(script).not.toContain('browser_Mixed_scenario');
    expect(script).not.toContain('API part');
  });

  test('generateScript emits fallback when no browser-only scenarios exist', (): void => {
    const script: string = generateScript([
      scenario({
        scenarioName: 'API only',
        steps: [
          {
            stepType: ScenarioType.CALCULATOR,
            stepName: 'API part',
            returnCode: 200,
            additionalData: { operation: 'add' },
          },
        ],
      }),
    ]);

    assertGeneratedJavaScriptDoesNotContainTypeScript(script);
    expect(script).toContain("console.warn('No BROWSER scenarios found.');");
    expect(script).not.toContain('const scenarios = [');
  });

  test('generateScript emits baseUrl-specific URL resolution and context value resolution', (): void => {
    const script: string = generateScript([
      scenario({
        scenarioName: 'Browser base url',
        steps: [
          browserStep({
            stepName: 'Open with base',
            additionalData: {
              baseUrl: 'https://example.test',
              instructions: [
                { kind: 'action', action: 'goto', value: '/login' },
                { kind: 'action', action: 'fill', selector: { kind: 'label', text: 'Token' }, value: '${ctx.token}' },
              ],
            },
          }),
        ],
      }),
    ]);

    assertGeneratedJavaScriptDoesNotContainTypeScript(script);
    expect(script).toContain("const currentStepBaseUrl_0 = 'https://example.test';");
    expect(script).toContain("await page.goto(resolveUrl(resolveValue('/login'), currentStepBaseUrl_0));");
    expect(script).toContain("fill(resolveValue('${ctx.token}'), { timeout: 10000 });");
    expect(script).toContain("const base = stepBaseUrl || __ENV.K6_BROWSER_BASE_URL || 'http://localhost:3000';");
  });

  test('generateScript resolves browser hostRef aliases', (): void => {
    const script: string = generateScript([
      scenario({
        scenarioName: 'Browser host ref',
        steps: [
          browserStep({
            stepName: 'Open host ref path',
            hostRef: 'docs',
            additionalData: {
              instructions: [{ kind: 'action', action: 'goto', value: '/docs' }],
            },
          }),
        ],
      }),
    ]);

    expect(script).toContain('const HOSTS =');
    expect(script).toContain("const currentStepBaseUrl_0 = HOSTS['docs'];");
  });
});
