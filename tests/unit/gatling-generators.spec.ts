import { expect, test } from '@playwright/test';
import type { StepData } from '../../src/scenario/loader';
import type { GatlingGeneratorContext } from '../../src/gatling/interface';
import { ScenarioType } from '../../src/scenario/types';
import { gatlingGeneratorRegistry } from '../../src/gatling/registry';
import { k6GeneratorRegistry } from '../../src/k6/registry';
import { CalculatorGatlingGenerator } from '../../src/test-modules/calculator/gatling';
import { AuthorizedCalculatorGatlingGenerator } from '../../src/test-modules/authorized-calculator/gatling';

function createContext(): GatlingGeneratorContext {
  return {
    declaredAttachments: new Set<string>(),
    stepVarName: (stepIndex: number): string => `step${stepIndex}`,
    currentHostRef: 'calcApi',
    stepInstanceHostRefs: new Map<string, string>(),
  };
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

test.describe('Gatling step generators', (): void => {
  test('calculator Gatling generator emits expected HTTP call shape', (): void => {
    const generator = new CalculatorGatlingGenerator(ScenarioType.CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.CALCULATOR,
      stepName: 'calculator add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };

    const code: string = generator
      .generateHttpCall('step0', ['      const payload = {a: 1, b: 2};'], step, createContext())
      .join('\n');

    assertGeneratedGatlingCodeDoesNotContainAccidentalTypeScriptAnnotations(code);
    expect(code).toContain("http('calculator add')");
    expect(code).toContain('.post(');
    expect(code).toContain('/api/calc/add`');
    expect(code).toContain(".header('Content-Type', 'application/json')");
    expect(code).toContain('.body(StringBody((step0) => {');
    expect(code).toContain('return JSON.stringify(payload);');
    expect(code).toContain('.asJson()');
  });

  test('authorized calculator Gatling generator emits token request and authorized resource call', (): void => {
    const generator = new AuthorizedCalculatorGatlingGenerator(ScenarioType.AUTHORIZED_CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepName: 'authorized add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };

    const code: string = generator
      .generateHttpCall('step0', ['      const payload = {a: 1, b: 2};'], step, createContext())
      .join('\n');

    assertGeneratedGatlingCodeDoesNotContainAccidentalTypeScriptAnnotations(code);
    expect(code).toContain("http('authorized add token')");
    expect(code).toContain('/oauth/token`');
    expect(code).toContain("client_id: 'funcandperf'");
    expect(code).toContain(".check(jsonPath('$.access_token').saveAs('authorizedAccessToken'))");
    expect(code).toContain("http('authorized add')");
    expect(code).toContain('/authorized/api/calc/add`');
    expect(code).toContain(".header('Authorization', (step0) => `Bearer ${step0.get('authorizedAccessToken')}`)");
    expect(code).toContain('return JSON.stringify(payload);');
  });

  test('authorized calculator generateHttpCallWithChecks caches token with TTL and places checks on the business request', (): void => {
    const generator = new AuthorizedCalculatorGatlingGenerator(ScenarioType.AUTHORIZED_CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepName: 'authorized add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };

    const checkLines: string[] = [
      `.check(status().is(200))`,
      `.check(jsonPath('$.result').ofString().is('15'))`,
      `.check(jsonPath('$.operation').ofString().is('add'))`,
      `.check(bodyString().saveAs('resBody0'))`,
    ];

    const code: string = generator
      .generateHttpCallWithChecks('step0', ['      const payload = {a: 10, b: 5};'], step, createContext(), checkLines)
      .join('\n');

    assertGeneratedGatlingCodeDoesNotContainAccidentalTypeScriptAnnotations(code);

    // Token request must still have its own checks and be conditional
    expect(code).toContain(
      "const configuredTokenTtlSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_TTL_SECONDS') || '3600', 10);"
    );
    expect(code).toContain(
      "const configuredTokenRefreshSkewSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS') || '30', 10);"
    );
    expect(code).toContain(
      "const configuredTokenCacheSlots = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_CACHE_SLOTS') || getEnvironmentVariable('GATLING_USERS_PER_SEC') || '5', 10);"
    );
    expect(code).toContain("const usersRaw = getEnvironmentVariable('AUTHORIZED_CALC_USERS') || '';");
    expect(code).toContain('const userSlot = (Number(step0.userId()) - 1) % tokenCacheSlots;');
    expect(code).toContain('const selectedUser = users[userSlot % users.length];');
    expect(code).toContain(
      'const tokenCache = (globalThis as any).__authorizedGatlingTokenCache || ((globalThis as any).__authorizedGatlingTokenCache = {});'
    );
    expect(code).toContain("+ '::' + selectedUser.username + '::slot-' + userSlot + '::' + \"default\"");
    expect(code).toContain('const cachedToken = tokenCache[cacheKey];');
    expect(code).toContain(
      "const accessToken = cachedToken && cachedToken.expiresAtMs > nowMs + tokenRefreshSkewMs ? cachedToken.accessToken : '';"
    );
    expect(code).toContain("nextSession = nextSession.set('authorizedCalcUsername', selectedUser.username);");
    expect(code).toContain("nextSession = nextSession.set('authorizedCalcPassword', selectedUser.password);");
    expect(code).toContain("return nextSession.set('shouldRefreshAuthorizedAccessToken', !accessToken);");
    expect(code).toContain(".doIf((step0) => step0.get('shouldRefreshAuthorizedAccessToken') === true)");
    expect(code).toContain("username: step0.get('authorizedCalcUsername')");
    expect(code).toContain("password: step0.get('authorizedCalcPassword')");
    expect(code).toContain('tokenCache[cacheKey] = { accessToken, expiresAtMs };');
    expect(code).toContain("return step0.set('authorizedAccessTokenExpiresAtMs', expiresAtMs);");
    expect(code).toContain(".check(jsonPath('$.access_token').saveAs('authorizedAccessToken'))");

    // The business request must contain the validation checks
    expect(code).toContain(".check(jsonPath('$.result').ofString().is('15'))");
    expect(code).toContain(".check(jsonPath('$.operation').ofString().is('add'))");
    expect(code).toContain(".check(bodyString().saveAs('resBody0'))");
    expect(code).toContain('.check(status().is(200))');

    // The validation checks must appear after the business request http('authorized add'), not inside the conditional token request
    const businessRequestStart: number = code.indexOf("http('authorized add')");
    const checksAfterBusinessRequest: string = code.substring(businessRequestStart);
    expect(checksAfterBusinessRequest).toContain(".check(jsonPath('$.result').ofString().is('15'))");
    expect(checksAfterBusinessRequest).toContain(".check(bodyString().saveAs('resBody0'))");
  });
});

test.describe('Generator registries', (): void => {
  test('k6 registry exposes calculator and authorized calculator generators', (): void => {
    expect(k6GeneratorRegistry.has(ScenarioType.CALCULATOR)).toBe(true);
    expect(k6GeneratorRegistry.has(ScenarioType.AUTHORIZED_CALCULATOR)).toBe(true);
    expect(k6GeneratorRegistry.get(ScenarioType.CALCULATOR)?.stepType).toBe(ScenarioType.CALCULATOR);
    expect(k6GeneratorRegistry.get(ScenarioType.AUTHORIZED_CALCULATOR)?.stepType).toBe(
      ScenarioType.AUTHORIZED_CALCULATOR
    );
  });

  test('Gatling registry exposes calculator and authorized calculator generators', (): void => {
    expect(gatlingGeneratorRegistry.has(ScenarioType.CALCULATOR)).toBe(true);
    expect(gatlingGeneratorRegistry.has(ScenarioType.AUTHORIZED_CALCULATOR)).toBe(true);
    expect(gatlingGeneratorRegistry.get(ScenarioType.CALCULATOR)?.stepType).toBe(ScenarioType.CALCULATOR);
    expect(gatlingGeneratorRegistry.get(ScenarioType.AUTHORIZED_CALCULATOR)?.stepType).toBe(
      ScenarioType.AUTHORIZED_CALCULATOR
    );
  });
});
