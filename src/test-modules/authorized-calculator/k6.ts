import type { StepData } from '../../scenario/loader';
import type { ModifyRequest } from '../../scenario/modify';
import type { DefaultPayloadResult, K6GeneratorContext, K6StepGenerator } from '../../k6/interface';
import {
  escapeJsString,
  generateModification as generateCommonModification,
  generateValidationCheck,
} from '../../k6/common';
import { AUTHORIZED_CALC_OPERATION_TO_ENDPOINT, resolveAuthorizedCalcConfigForStep } from './config';
import { resolveAuthorizedCalcBaseExpr } from './resolve-host-ref';
import { getStepInstanceName } from '../../scenario/instances';
import type { AuthorizedCalcValidateResponse as ValidateResponse } from './validations';

const VALIDATE_TO_JSON_PATH: Record<string, string> = {
  result: '$.result',
  operation: '$.operation',
};

export class AuthorizedCalculatorK6Generator implements K6StepGenerator {
  readonly stepType: string;

  constructor(stepType: string) {
    this.stepType = stepType;
  }

  getEndpoint(step: StepData): string {
    const operation: string | undefined = step.additionalData?.operation as string | undefined;
    const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
    return '`' + resolveAuthorizedCalcBaseExpr(step).replace(/`/g, '') + endpoint + '`';
  }

  generateDefaultPayload(_step: StepData, _ctx: K6GeneratorContext): DefaultPayloadResult {
    return { payloadVarName: 'payload', code: ['const payload = { a: 0, b: 0 };'] };
  }

  generateModification(mod: ModifyRequest, payloadVarName: string): string[] {
    return generateCommonModification(mod, payloadVarName, (v: unknown): string => {
      const rawValue: string = typeof v === 'string' ? v : String(v);
      const numValue: number = parseInt(rawValue, 10);
      return isNaN(numValue) ? `'${escapeJsString(rawValue)}'` : String(numValue);
    });
  }

  generateValidationCheck(
    v: ValidateResponse,
    _responseVarName: string,
    _step: StepData,
    _ctx: K6GeneratorContext
  ): string | null {
    return generateValidationCheck(v, VALIDATE_TO_JSON_PATH);
  }

  generateHttpCall(payloadVarName: string, step: StepData, ctx: K6GeneratorContext): string[] {
    const operation: string | undefined = step.additionalData?.operation as string | undefined;
    const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
    const { tokenTtlSeconds, tokenRefreshSkewSeconds } = resolveAuthorizedCalcConfigForStep(step);
    const instanceName: string = getStepInstanceName(step);
    return [
      `const baseUrl = \`${resolveAuthorizedCalcBaseExpr(step, ctx)}\`;`,
      `const configuredTokenTtlSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_TTL_SECONDS || '${tokenTtlSeconds}', 10);`,
      `const configuredTokenRefreshSkewSeconds = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS || '${tokenRefreshSkewSeconds}', 10);`,
      'const tokenTtlMs = Math.max(configuredTokenTtlSeconds, 1) * 1000;',
      'const tokenRefreshSkewMs = Math.max(configuredTokenRefreshSkewSeconds, 0) * 1000;',
      "const configuredTokenCacheSlots = parseInt(__ENV.AUTHORIZED_CALC_TOKEN_CACHE_SLOTS || __ENV.K6_VUS || '5', 10);",
      'const tokenCacheSlots = Math.max(configuredTokenCacheSlots, 1);',
      "const usersRaw = __ENV.AUTHORIZED_CALC_USERS || '';",
      'const userPairs = usersRaw',
      "  .split(',')",
      '  .map((x) => x.trim())',
      '  .filter((x) => x.length > 0)',
      '  .map((x) => {',
      "    const [username, password] = x.split(':');",
      "    return { username: (username || '').trim(), password: (password || '').trim() };",
      '  })',
      '  .filter((u) => u.username && u.password);',
      'const fallbackUser = {',
      "  username: __ENV.AUTHORIZED_CALC_USERNAME || 'demo',",
      "  password: __ENV.AUTHORIZED_CALC_PASSWORD || 'demo'",
      '};',
      'const users = userPairs.length > 0 ? userPairs : [fallbackUser];',
      'const userSlot = ((__VU - 1) % tokenCacheSlots);',
      'const selectedUser = users[userSlot % users.length];',
      'const tokenCache = globalThis.__authorizedTokenCache || (globalThis.__authorizedTokenCache = {});',
      `const cacheKey = \`${'${baseUrl}'}::${'${selectedUser.username}'}::${'${userSlot}'}::${instanceName}\`;`,
      'const nowMs = Date.now();',
      'const cachedToken = tokenCache[cacheKey];',
      'let accessToken = cachedToken && cachedToken.expiresAtMs > nowMs + tokenRefreshSkewMs ? cachedToken.accessToken : "";',
      'if (!accessToken) {',
      '  const tokenRes = http.post(`${baseUrl}/oauth/token`, JSON.stringify({',
      "    grant_type: 'password',",
      "    client_id: 'funcandperf',",
      '    username: selectedUser.username,',
      '    password: selectedUser.password',
      '  }), {',
      '    headers: {',
      "      'Content-Type': 'application/json'",
      '    }',
      '  });',
      '  const tokenSuccess = check(tokenRes, {',
      "    'authorized token status is 200': (r) => r.status === 200,",
      "    'authorized token contains access_token': (r) => Boolean(r.json('access_token'))",
      '  });',
      '  if (!tokenSuccess) {',
      '    throw new Error(`Failed to fetch authorized calculator token: status=${tokenRes.status}, body=${tokenRes.body}`);',
      '  }',
      '  const tokenJson = tokenRes.json();',
      '  accessToken = tokenJson && tokenJson.access_token ? tokenJson.access_token : "";',
      '  if (accessToken) {',
      '    tokenCache[cacheKey] = {',
      '      accessToken,',
      '      expiresAtMs: Date.now() + tokenTtlMs',
      '    };',
      '  }',
      '}',
      `const url = \`${'${baseUrl}'}${endpoint}\`;`,
      '',
      `const res = http.post(url, JSON.stringify(${payloadVarName}), {`,
      '  headers: {',
      "    'Content-Type': 'application/json',",
      "    'Authorization': `Bearer ${accessToken}`",
      '  }',
      '});',
    ];
  }
}
