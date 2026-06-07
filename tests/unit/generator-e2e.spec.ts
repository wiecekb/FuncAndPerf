import { expect, test } from '@playwright/test';
import * as fs from 'fs';
import { Scenario, type ScenarioData } from '../../src/scenario/loader';
import { generateK6Script } from '../../scripts/generate-k6';
import { generateGatlingSimulation } from '../../scripts/generate-gatling';
import { generateScript } from '../../scripts/generate-k6-browser';

const TEST_DATA_PATH = 'tests/unit/data/generator-test-data.json';
const testDataRaw = JSON.parse(fs.readFileSync(TEST_DATA_PATH, 'utf-8')) as ScenarioData[];
const testScenarios: Scenario[] = testDataRaw.map((data: ScenarioData) => Scenario.fromJson(data));

function assertGeneratedJavaScriptDoesNotContainTypeScript(code: string): void {
  const forbiddenTypeScriptFragments: RegExp[] = [
    /:\s*string\b/,
    /:\s*number\b/,
    /:\s*boolean\b/,
    /:\s*Record\s*</,
    /:\s*Array\s*</,
    /\([^)]*:\s*string[^)]*\)\s*=>/,
    /\([^)]*:\s*number[^)]*\)\s*=>/,
    /\{\s*username:\s*string;\s*password:\s*string\s*}/,
  ];

  for (const forbidden of forbiddenTypeScriptFragments) {
    expect(code, `Generated JavaScript must not contain TypeScript syntax matching ${forbidden}`).not.toMatch(
      forbidden
    );
  }
}

function assertGeneratedGatlingCodeDoesNotContainAccidentalTypeScriptAnnotations(code: string): void {
  const forbiddenTypeScriptFragments: RegExp[] = [
    /const\s+\w+\s*:\s*string\b/,
    /let\s+\w+\s*:\s*string\b/,
    /const\s+\w+\s*:\s*number\b/,
    /let\s+\w+\s*:\s*number\b/,
    /:\s*Record\s*</,
    /:\s*Array\s*</,
    /\([^)]*:\s*string[^)]*\)\s*=>/,
    /\([^)]*:\s*number[^)]*\)\s*=>/,
  ];

  for (const forbidden of forbiddenTypeScriptFragments) {
    expect(
      code,
      `Generated Gatling code must not contain accidental TypeScript syntax matching ${forbidden}`
    ).not.toMatch(forbidden);
  }
}

test.describe('k6 script generator E2E', (): void => {
  test('generateK6Script produces a valid k6 script with all required sections', (): void => {
    const script: string = generateK6Script(testScenarios);

    assertGeneratedJavaScriptDoesNotContainTypeScript(script);

    // Header / imports
    expect(script).toContain("import http from 'k6/http'");
    expect(script).toContain("import { check, sleep, group } from 'k6'");
    expect(script).toContain("import { Rate, Trend, Counter } from 'k6/metrics'");

    // Options
    expect(script).toContain('export const options = {');
    expect(script).toContain('stages: [');
    expect(script).toContain('thresholds: {');

    // HOSTS from config
    expect(script).toContain('const HOSTS = ');
    expect(script).toContain('calcApi');

    // Default export
    expect(script).toContain('export default function () {');
    expect(script).toContain('sleep(1);');

    // Scenario metadata array includes all scenario names
    expect(script).toContain('const SCENARIO_METADATA = [');
    expect(script).toContain('Calculator: jsonPath modifications');
    expect(script).toContain('Calculator: parameter modifications');
    expect(script).toContain('Authorized Calculator: add');
    expect(script).toContain('Browser: basic actions');
    expect(script).toContain('Browser: assertions and extracts');
    expect(script).toContain('Browser: multi-step');
    expect(script).toContain('Multi-step with step data reference');
  });

  test('generateK6Script emits calculator step with jsonPath modifications and validations', (): void => {
    const script: string = generateK6Script(testScenarios);

    // Each scenario step index starts at 0, so jsonPath scenario (index 0) uses payload0
    expect(script).toContain("payload0['a'] = 3;");
    expect(script).toContain("payload0['b'] = 5;");

    // Validation checks for jsonPath style
    expect(script).toContain("'$.result equals 8'");
    expect(script).toContain("'$.operation includes add'");
  });

  test('generateK6Script emits calculator step with parameter modifications and validations', (): void => {
    const script: string = generateK6Script(testScenarios);

    // Parameter modifications scenario (index 1) also uses payload0 for its single step
    expect(script).toContain("payload0['a'] = 4;");
    expect(script).toContain("payload0['b'] = 3;");

    // Validation checks for parameter style
    expect(script).toContain("'result equals 12'");
    expect(script).toContain("'operation equals multiply'");
  });

  test('generateK6Script emits token authentication prelude for authorized calculator', (): void => {
    const script: string = generateK6Script(testScenarios);

    // Token cache preamble
    expect(script).toContain("const usersRaw = __ENV.AUTHORIZED_CALC_USERS || '';");
    expect(script).toContain(
      'const tokenCache = globalThis.__authorizedTokenCache || (globalThis.__authorizedTokenCache = {});'
    );
    expect(script).toContain(
      "const configuredTokenTtlSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_TTL_SECONDS || '3600', 10);"
    );
    expect(script).toContain(
      "const configuredTokenRefreshSkewSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS || '30', 10);"
    );

    // The business HTTP call for authorized calculator
    expect(script).toContain('/authorized/api/calc/add');
  });

  test('generateK6Script emits multi-step with step data references', (): void => {
    const script: string = generateK6Script(testScenarios);

    // The first step of multi-step scenario uses payload0
    expect(script).toContain("payload0['a'] = 10;");
    expect(script).toContain("payload0['b'] = 20;");

    // Validation checks
    expect(script).toContain("'result equals 30'");
    expect(script).toContain("'$.result equals 60'");
  });

  test('generateK6Script lists BROWSER scenarios in metadata but they have no supported steps', (): void => {
    const script: string = generateK6Script(testScenarios);

    // Browser scenarios are listed in SCENARIO_METADATA
    expect(script).toContain('Browser: basic actions');
    expect(script).toContain('Browser: assertions and extracts');
    expect(script).toContain('Browser: multi-step');

    // But they are skipped in generated functions — no browser-specific code
    expect(script).toContain('SKIPPED (no supported step types)');
  });
});

// ─────────────────────────────────────────────────────
// Gatling generator E2E
// ─────────────────────────────────────────────────────
test.describe('Gatling script generator E2E', (): void => {
  test('generateGatlingSimulation produces a valid Gatling simulation with all required sections', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    assertGeneratedGatlingCodeDoesNotContainAccidentalTypeScriptAnnotations(script);

    // Imports
    expect(script).toContain('@gatling.io/core');
    expect(script).toContain('@gatling.io/http');
    expect(script).toContain("import { http, status } from '@gatling.io/http'");

    // HOSTS
    expect(script).toContain('const HOSTS = ');
    expect(script).toContain('calcApi');

    // Scenario metadata
    expect(script).toContain('const SCENARIO_METADATA = [');
    expect(script).toContain('Calculator: jsonPath modifications');
    expect(script).toContain('Calculator: parameter modifications');
    expect(script).toContain('Authorized Calculator: add');
    expect(script).toContain('Browser: basic actions');
    expect(script).toContain('Multi-step with step data reference');

    // Simulation export
    expect(script).toContain('export default simulation((setUp) => {');
  });

  test('generateGatlingSimulation emits calculator step with correct HTTP call shape and checks', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    // Calculator HTTP call shape
    expect(script).toContain('.post(');
    expect(script).toContain('/api/calc/add');
    expect(script).toContain(".header('Content-Type', 'application/json')");
    expect(script).toContain('.body(StringBody((');
    expect(script).toContain('return JSON.stringify(payload);');
    expect(script).toContain('.asJson()');

    // Status check
    expect(script).toContain('.check(status().is(200))');

    // Validation checks — Gatling uses jsonPath expressions directly
    expect(script).toContain("jsonPath('$.result').ofString().is('8')");
    expect(script).toContain("jsonPath('$.operation').ofString().is('multiply')");

    // Body save
    expect(script).toContain(".check(bodyString().saveAs('resBody");
  });

  test('generateGatlingSimulation emits token authentication for authorized calculator', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    // Token cache preamble
    expect(script).toContain(
      "const configuredTokenTtlSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_TTL_SECONDS') || '3600', 10);"
    );
    expect(script).toContain(
      "const configuredTokenRefreshSkewSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS') || '30', 10);"
    );
    expect(script).toContain("const usersRaw = getEnvironmentVariable('AUTHORIZED_CALC_USERS') || '';");
    expect(script).toContain(".check(jsonPath('$.access_token').saveAs('authorizedAccessToken'))");

    // Token conditional
    expect(script).toContain('.doIf((');
    expect(script).toContain('shouldRefreshAuthorizedAccessToken');

    // Business request with authorization header
    expect(script).toContain('/authorized/api/calc/add');
    expect(script).toContain("'Authorization'");
    // Gatling uses template literal for Bearer token
    expect(script).toContain('Bearer ');
  });

  test('generateGatlingSimulation emits scenario functions for each scenario using zero-based index', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    // Gatling uses toValidFunctionName(si, name) where si is zero-based scenario index
    expect(script).toContain('export function scenario_0_Calculator__jsonPath_modifications() {');
    expect(script).toContain('export function scenario_1_Calculator__parameter_modifications() {');
    expect(script).toContain('export function scenario_2_Authorized_Calculator__add() {');
    expect(script).toContain('export function scenario_6_Multi_step_with_step_data_reference() {');
  });

  test('generateGatlingSimulation handles BROWSER-only scenarios as skipped with no supported step types', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    // BROWSER scenarios that have no supported step types are skipped entirely
    // The Gatling generator checks supportedSteps.length === 0 and emits a comment
    expect(script).toContain('SKIPPED (no supported step types)');
    expect(script).toContain('Browser: basic actions');
    expect(script).toContain("return scenario('Browser: basic actions');");
  });

  test('generateGatlingSimulation emits multi-step with data references', (): void => {
    const script: string = generateGatlingSimulation(testScenarios);

    // The step data reference "firstAdd.response.$.result" — Gatling resolves it via session .get()
    expect(script).toContain('.get(');
    expect(script).toContain('resBody0');
  });
});

test.describe('k6 browser script generator E2E', (): void => {
  test('generateScript produces a valid k6 browser script with all required sections', (): void => {
    const script: string = generateScript(testScenarios);

    assertGeneratedJavaScriptDoesNotContainTypeScript(script);

    // Imports
    expect(script).toContain('import { browser } from "k6/browser"');
    expect(script).toContain('import { check, sleep, group } from "k6"');

    // Options
    expect(script).toContain('export const options = {');
    expect(script).toContain("executor: 'shared-iterations'");
    expect(script).toContain('browser: { type: "chromium" }');

    // Helper functions
    expect(script).toContain('function resolveValue(value)');
    expect(script).toContain('function resolveUrl(value, stepBaseUrl)');
    expect(script).toContain('function urlMatches(actual, expected)');
    expect(script).toContain('function screenshotsEnabled()');

    // Default export async
    expect(script).toContain('export default async function ()');
    expect(script).toContain('sleep(1);');
  });

  test('generateScript includes only browser-only scenarios and emits their steps', (): void => {
    const script: string = generateScript(testScenarios);

    // Browser-only scenarios should have generated functions
    expect(script).toContain('async function browser_Browser__basic_actions()');
    expect(script).toContain('async function browser_Browser__assertions_and_extracts()');
    expect(script).toContain('async function browser_Browser__multi_step()');

    // Scenario metadata for browser-only scenarios
    expect(script).toContain("'Browser: basic actions'");
    expect(script).toContain("'Browser: assertions and extracts'");
    expect(script).toContain("'Browser: multi-step'");

    // The scenarios array should list exactly the three browser-only scenarios
    expect(script).toContain(
      'const scenarios = [browser_Browser__basic_actions, browser_Browser__assertions_and_extracts, browser_Browser__multi_step];'
    );
  });

  test('generateScript emits browser step with basic actions (goto, click, fill, press, waitFor, screenshot)', (): void => {
    const script: string = generateScript(testScenarios);

    // goto action
    expect(script).toContain("await page.goto(resolveUrl(resolveValue('/'), currentStepBaseUrl_0));");

    // click action with css selector
    expect(script).toContain(".locator('#submit').click({ timeout: 2500 });");

    // fill action with label selector
    expect(script).toContain(
      "getByLabel('Search', { exact: false }).fill(resolveValue('test query'), { timeout: 5000 });"
    );

    // press action with testId selector
    expect(script).toContain("getByTestId('search-input').press('Enter', { timeout: 10000 });");

    // waitFor action with text selector
    expect(script).toContain("getByText('Loading complete', { exact: false }).waitFor({ timeout: 5000 });");

    // screenshot action
    expect(script).toContain('await page.screenshot({ path:');
    expect(script).toContain('manual.png');
  });

  test('generateScript emits browser step with assertions and extracts', (): void => {
    const script: string = generateScript(testScenarios);

    // Assertions
    expect(script).toContain("'url matches'");
    expect(script).toContain("'element visible'");
    expect(script).toContain("'text equals'");
    expect(script).toContain("'text contains'");
    expect(script).toContain("'value equals'");

    // Extracts
    expect(script).toContain("ctx['currentUrl'] = page.url();");
    expect(script).toContain("ctx['title'] = await page.locator('h1').textContent();");
    expect(script).toContain("ctx['query'] = await page.getByLabel('Query', { exact: false }).inputValue();");
    expect(script).toContain("ctx['nextHref'] = await page.locator('a.next').getAttribute('href');");
  });

  test('generateScript emits baseUrl from step additionalData', (): void => {
    const script: string = generateScript(testScenarios);

    // The "Browser: assertions and extracts" step has baseUrl: "https://example.test"
    expect(script).toContain("const currentStepBaseUrl_0 = 'https://example.test';");
  });

  test('generateScript emits multi-step browser scenario with step instances (default instances)', (): void => {
    const script: string = generateScript(testScenarios);

    // Multi-step scenario uses default instance names (steps without stepInstanceName get 'default')
    expect(script).toContain("console.log('Step: Step 1: home and extract [default]');");
    expect(script).toContain("console.log('Step: Step 2: docs and verify [default]');");

    // Each step in multi-step browser scenario resolves its hostRef alias from HOSTS.
    expect(script).toContain("const currentStepBaseUrl_1 = HOSTS['frontendDocs'];");
  });

  test('generateScript filters out non-browser-only scenarios (calculator, authorized-calculator, mixed)', (): void => {
    const script: string = generateScript(testScenarios);

    // Calculator / Authorized scenarios should NOT appear in the generated browser script
    expect(script).not.toContain('Calculator: jsonPath modifications');
    expect(script).not.toContain('Calculator: parameter modifications');
    expect(script).not.toContain('Authorized Calculator: add');
    expect(script).not.toContain('Multi-step with step data reference');
  });
});
