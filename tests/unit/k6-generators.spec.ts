import { expect, test } from '@playwright/test';
import type { StepData } from '../../src/scenario/loader';
import type { DefaultPayloadResult, K6GeneratorContext } from '../../src/k6/interface';
import { ScenarioType } from '../../src/scenario/types';
import { CalculatorK6Generator } from '../../src/test-modules/calculator/k6';
import { CalcValidatedParameter } from '../../src/test-modules/calculator/validations';
import { AuthorizedCalculatorK6Generator } from '../../src/test-modules/authorized-calculator/k6';

function createContext(): K6GeneratorContext {
  return {
    declaredAttachments: new Set<string>(),
    stepVarName: (stepIndex: number): string => `step${stepIndex}`,
    currentHostRef: 'calcApi',
    stepInstanceHostRefs: new Map<string, string>(),
  };
}

function assertGeneratedK6JavaScriptDoesNotContainTypeScript(code: string): void {
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
    expect(code, `Generated k6 JavaScript must not contain TypeScript syntax matching ${forbidden}`).not.toMatch(
      forbidden
    );
  }
}

test.describe('k6 step generators', (): void => {
  test('authorized calculator default payload, modification and validation generators emit expected JavaScript', (): void => {
    const generator = new AuthorizedCalculatorK6Generator(ScenarioType.AUTHORIZED_CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepName: 'authorized add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };
    const ctx: K6GeneratorContext = createContext();

    const payload: DefaultPayloadResult = generator.generateDefaultPayload(step, ctx);
    const modificationCode: string = generator
      .generateModification({ modifiedParameter: 'a', modifiedValue: '5' }, payload.payloadVarName)
      .join('\n');
    const validationCode: string | null = generator.generateValidationCheck(
      { validatedParameter: 'result', validatedParameterValue: '7' },
      'res0',
      step,
      ctx
    );

    expect(payload).toEqual({ payloadVarName: 'payload', code: ['const payload = { a: 0, b: 0 };'] });
    assertGeneratedK6JavaScriptDoesNotContainTypeScript(modificationCode);
    expect(modificationCode).toBe("payload['a'] = 5;");
    expect(validationCode).toContain("'result equals 7'");
    expect(validationCode).toContain("String(JSON.parse(r.body)?.['result']) === '7'");
  });

  test('authorized calculator HTTP call generator emits plain JavaScript without TypeScript annotations', (): void => {
    const generator = new AuthorizedCalculatorK6Generator(ScenarioType.AUTHORIZED_CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.AUTHORIZED_CALCULATOR,
      stepName: 'authorized add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };

    const code: string = generator.generateHttpCall('payload0', step, createContext()).join('\n');

    assertGeneratedK6JavaScriptDoesNotContainTypeScript(code);
    expect(code).toContain("const baseUrl = `${HOSTS['calcApi']}`;");
    expect(code).not.toContain("const baseUrl = ${HOSTS['calcApi']};");
    expect(code).toContain("const usersRaw = __ENV.AUTHORIZED_CALC_USERS || '';");
    expect(code).toContain(
      'const tokenCache = globalThis.__authorizedTokenCache || (globalThis.__authorizedTokenCache = {});'
    );
    expect(code).toContain(
      "const configuredTokenTtlSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_TTL_SECONDS || '3600', 10);"
    );
    expect(code).toContain(
      "const configuredTokenRefreshSkewSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS || '30', 10);"
    );
    expect(code).toContain(
      "const configuredTokenCacheSlots = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_CACHE_SLOTS || __ENV.K6_VUS || '5', 10);"
    );
    expect(code).toContain('const tokenCacheSlots = Math.max(configuredTokenCacheSlots, 1);');
    expect(code).toContain('const userSlot = ((__VU - 1) % tokenCacheSlots);');
    expect(code).toContain('const selectedUser = users[userSlot % users.length];');
    expect(code).toContain('const cacheKey = `${baseUrl}::${selectedUser.username}::${userSlot}::default`;');
    expect(code).toContain('const cachedToken = tokenCache[cacheKey];');
    expect(code).toContain(
      'let accessToken = cachedToken && cachedToken.expiresAtMs > nowMs + tokenRefreshSkewMs ? cachedToken.accessToken : "";'
    );
    expect(code).toContain('const tokenSuccess = check(tokenRes, {');
    expect(code).toContain("'authorized token status is 200': (r) => r.status === 200");
    expect(code).toContain("'authorized token contains access_token': (r) => Boolean(r.json('access_token'))");
    expect(code).toContain(
      'throw new Error(`Failed to fetch authorized calculator token: status=${tokenRes.status}, body=${tokenRes.body}`);'
    );
    expect(code).toContain('expiresAtMs: Date.now() + tokenTtlMs');
    expect(code).toContain('const url = `${baseUrl}/authorized/api/calc/add`;');
    expect(code).toContain('const res = http.post(url, JSON.stringify(payload0), {');
  });

  test('calculator default payload, modification and validation generators emit expected JavaScript', (): void => {
    const generator = new CalculatorK6Generator(ScenarioType.CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.CALCULATOR,
      stepName: 'calculator add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };
    const ctx: K6GeneratorContext = createContext();

    const payload: DefaultPayloadResult = generator.generateDefaultPayload(step, ctx);
    const modificationCode: string = generator
      .generateModification({ modifiedParameter: 'b', modifiedValue: '9' }, payload.payloadVarName, step, ctx)
      .join('\n');
    const validationCode: string | null = generator.generateValidationCheck(
      { validatedParameter: CalcValidatedParameter.OPERATION, validatedParameterValue: 'add' },
      'res0',
      step,
      ctx
    );

    expect(payload).toEqual({ payloadVarName: 'payload', code: ['const payload = { a: 0, b: 0 };'] });
    assertGeneratedK6JavaScriptDoesNotContainTypeScript(modificationCode);
    expect(modificationCode).toBe("payload['b'] = 9;");
    expect(validationCode).toContain("'operation equals add'");
    expect(validationCode).toContain("String(JSON.parse(r.body)?.['operation']) === 'add'");
  });

  test('calculator HTTP call generator emits plain JavaScript without TypeScript annotations', (): void => {
    const generator = new CalculatorK6Generator(ScenarioType.CALCULATOR);
    const step: StepData = {
      stepType: ScenarioType.CALCULATOR,
      stepName: 'calculator add',
      hostRef: 'calcApi',
      returnCode: 200,
      additionalData: { operation: 'add' },
    };

    const code: string = generator.generateHttpCall('payload0', step, createContext()).join('\n');

    assertGeneratedK6JavaScriptDoesNotContainTypeScript(code);
    expect(code).toContain('const url = `');
    expect(code).toContain('/api/calc/add`;');
    expect(code).toContain('const res = http.post(url, JSON.stringify(payload0), {');
  });
});
