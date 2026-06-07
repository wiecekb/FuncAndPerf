import type { StepData } from '../../scenario/loader';
import type { ModifyRequest } from '../../scenario/modify';
import type { GatlingGeneratorContext, GatlingPayloadResult, GatlingStepGenerator } from '../../gatling/interface';
import {
  escapeJsString,
  generateGatlingCheck,
  generateModification as generateCommonModification,
} from '../../gatling/common';
import { AUTHORIZED_CALC_OPERATION_TO_ENDPOINT, resolveAuthorizedCalcConfigForStep } from './config';
import { resolveAuthorizedCalcBaseExpr } from './resolve-host-ref';
import { getStepInstanceName } from '../../scenario/instances';
import type { AuthorizedCalcValidateResponse as ValidateResponse } from './validations';

const VALIDATE_TO_JSON_PATH: Record<string, string> = {
  result: '$.result',
  operation: '$.operation',
};

const AUTHORIZED_TOKEN_SESSION_KEY: string = 'authorizedAccessToken';
const AUTHORIZED_TOKEN_EXPIRES_AT_SESSION_KEY: string = 'authorizedAccessTokenExpiresAtMs';
const SHOULD_REFRESH_AUTHORIZED_TOKEN_SESSION_KEY: string = 'shouldRefreshAuthorizedAccessToken';
const AUTHORIZED_USERNAME_SESSION_KEY: string = 'authorizedCalcUsername';
const AUTHORIZED_PASSWORD_SESSION_KEY: string = 'authorizedCalcPassword';
const AUTHORIZED_USER_SLOT_SESSION_KEY: string = 'authorizedCalcUserSlot';

export class AuthorizedCalculatorGatlingGenerator implements GatlingStepGenerator {
  readonly stepType: string;

  constructor(stepType: string) {
    this.stepType = stepType;
  }

  getEndpoint(step: StepData): string {
    const operation: string | undefined = step.additionalData?.operation as string | undefined;
    const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
    const base: string = resolveAuthorizedCalcBaseExpr(step).replace(/`/g, '');
    return '`' + base + endpoint + '`';
  }

  generateDefaultPayload(_step: StepData, _ctx: GatlingGeneratorContext): GatlingPayloadResult {
    const payloadJson: string = '{"a":0,"b":0}';
    return {
      payloadVarName: 'payload',
      code: [`const payload = ${payloadJson};`],
      payloadJson,
    };
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
    _ctx: GatlingGeneratorContext
  ): string | null {
    return generateGatlingCheck(v, VALIDATE_TO_JSON_PATH);
  }

  generateHttpCall(
    sessionFnParam: string,
    sessionFnBody: string[],
    step: StepData,
    ctx: GatlingGeneratorContext
  ): string[] {
    const operation: string | undefined = step.additionalData?.operation as string | undefined;
    const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
    const stepName: string = escapeJsString(step.stepName || step.stepType);
    const baseExpr: string = resolveAuthorizedCalcBaseExpr(step, ctx).replace(/`/g, '');
    const tokenUrl: string = `\`${baseExpr}/oauth/token\``;
    const requestUrl: string = `\`${baseExpr}${endpoint}\``;

    return [
      `http('${stepName} token')`,
      `  .post(${tokenUrl})`,
      `  .header('Content-Type', 'application/json')`,
      `  .body(StringBody(() => JSON.stringify({`,
      `    grant_type: 'password',`,
      `    client_id: 'funcandperf',`,
      `    username: getEnvironmentVariable('AUTHORIZED_CALC_USERNAME') || 'demo',`,
      `    password: getEnvironmentVariable('AUTHORIZED_CALC_PASSWORD') || 'demo'`,
      `  })))`,
      `  .asJson()`,
      `  .check(status().is(200))`,
      `  .check(jsonPath('$.access_token').saveAs('authorizedAccessToken'))`,
      `  .resources(`,
      `    http('${stepName}')`,
      `      .post(${requestUrl})`,
      `      .header('Content-Type', 'application/json')`,
      `      .header('Authorization', (${sessionFnParam}) => \`Bearer \${${sessionFnParam}.get('authorizedAccessToken')}\`)`,
      `      .body(StringBody((${sessionFnParam}) => {`,
      ...sessionFnBody,
      `        return JSON.stringify(payload);`,
      `      }))`,
      `      .asJson()`,
      `  )`,
    ];
  }

  generateHttpCallWithChecks(
    sessionFnParam: string,
    sessionFnBody: string[],
    step: StepData,
    ctx: GatlingGeneratorContext,
    checkLines: string[]
  ): string[] {
    const operation: string | undefined = step.additionalData?.operation as string | undefined;
    const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
    const stepName: string = escapeJsString(step.stepName || step.stepType);
    const baseExpr: string = resolveAuthorizedCalcBaseExpr(step, ctx).replace(/`/g, '');
    const tokenUrl: string = `\`${baseExpr}/oauth/token\``;
    const requestUrl: string = `\`${baseExpr}${endpoint}\``;
    const { tokenTtlSeconds, tokenRefreshSkewSeconds } = resolveAuthorizedCalcConfigForStep(step);
    const instanceName: string = getStepInstanceName(step);

    // Build the resource (business) request with checks placed inside .resources()
    const resourceLines: string[] = [
      `http('${stepName}')`,
      `  .post(${requestUrl})`,
      `  .header('Content-Type', 'application/json')`,
      `  .header('Authorization', (${sessionFnParam}) => \`Bearer \${${sessionFnParam}.get('${AUTHORIZED_TOKEN_SESSION_KEY}')}\`)`,
      `  .body(StringBody((${sessionFnParam}) => {`,
      ...sessionFnBody,
      `    return JSON.stringify(payload);`,
      `  }))`,
      `  .asJson()`,
    ];
    // Attach checks (status, validation, bodyString.saveAs) to the business request
    for (const check of checkLines) {
      resourceLines.push(`  ${check.trim()}`);
    }

    return [
      `exec((${sessionFnParam}) => {`,
      `  const configuredTokenTtlSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_TTL_SECONDS') || '${tokenTtlSeconds}', 10);`,
      `  const configuredTokenRefreshSkewSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_REFRESH_SKEW_SECONDS') || '${tokenRefreshSkewSeconds}', 10);`,
      `  const tokenRefreshSkewMs = Math.max(configuredTokenRefreshSkewSeconds, 0) * 1000;`,
      `  const configuredTokenCacheSlots = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_CACHE_SLOTS') || getEnvironmentVariable('GATLING_USERS_PER_SEC') || '5', 10);`,
      `  const tokenCacheSlots = Math.max(configuredTokenCacheSlots, 1);`,
      `  const usersRaw = getEnvironmentVariable('AUTHORIZED_CALC_USERS') || '';`,
      `  const userPairs = usersRaw`,
      `    .split(',')`,
      `    .map((x) => x.trim())`,
      `    .filter((x) => x.length > 0)`,
      `    .map((x) => {`,
      `      const [username, password] = x.split(':');`,
      `      return { username: (username || '').trim(), password: (password || '').trim() };`,
      `    })`,
      `    .filter((u) => u.username && u.password);`,
      `  const fallbackUser = {`,
      `    username: getEnvironmentVariable('AUTHORIZED_CALC_USERNAME') || 'demo',`,
      `    password: getEnvironmentVariable('AUTHORIZED_CALC_PASSWORD') || 'demo'`,
      `  };`,
      `  const users = userPairs.length > 0 ? userPairs : [fallbackUser];`,
      `  const userSlot = (Number(${sessionFnParam}.userId()) - 1) % tokenCacheSlots;`,
      `  const selectedUser = users[userSlot % users.length];`,
      `  const nowMs = Date.now();`,
      `      const tokenCache = (globalThis as any).__authorizedGatlingTokenCache || ((globalThis as any).__authorizedGatlingTokenCache = {});`,
      `  const cacheKey = ${JSON.stringify(baseExpr)} + '::' + selectedUser.username + '::slot-' + userSlot + '::' + ${JSON.stringify(instanceName)};`,
      `  const cachedToken = tokenCache[cacheKey];`,
      `  const accessToken = cachedToken && cachedToken.expiresAtMs > nowMs + tokenRefreshSkewMs ? cachedToken.accessToken : '';`,
      `  let nextSession = ${sessionFnParam};`,
      `  nextSession = nextSession.set('${AUTHORIZED_USERNAME_SESSION_KEY}', selectedUser.username);`,
      `  nextSession = nextSession.set('${AUTHORIZED_PASSWORD_SESSION_KEY}', selectedUser.password);`,
      `  nextSession = nextSession.set('${AUTHORIZED_USER_SLOT_SESSION_KEY}', userSlot);`,
      `  if (accessToken) {`,
      `    nextSession = nextSession.set('${AUTHORIZED_TOKEN_SESSION_KEY}', accessToken);`,
      `    nextSession = nextSession.set('${AUTHORIZED_TOKEN_EXPIRES_AT_SESSION_KEY}', cachedToken.expiresAtMs);`,
      `  }`,
      `  return nextSession.set('${SHOULD_REFRESH_AUTHORIZED_TOKEN_SESSION_KEY}', !accessToken);`,
      `})`,
      `.doIf((${sessionFnParam}) => ${sessionFnParam}.get('${SHOULD_REFRESH_AUTHORIZED_TOKEN_SESSION_KEY}') === true)`,
      `.then(`,
      `  http('${stepName} token')`,
      `    .post(${tokenUrl})`,
      `    .header('Content-Type', 'application/json')`,
      `    .body(StringBody((${sessionFnParam}) => JSON.stringify({`,
      `      grant_type: 'password',`,
      `      client_id: 'funcandperf',`,
      `      username: ${sessionFnParam}.get('${AUTHORIZED_USERNAME_SESSION_KEY}'),`,
      `      password: ${sessionFnParam}.get('${AUTHORIZED_PASSWORD_SESSION_KEY}')`,
      `    })))`,
      `    .asJson()`,
      `    .check(status().is(200))`,
      `    .check(jsonPath('$.access_token').saveAs('${AUTHORIZED_TOKEN_SESSION_KEY}')),`,
      `  exec((${sessionFnParam}) => {`,
      `    const configuredTokenTtlSeconds = parseInt(getEnvironmentVariable('AUTHORIZED_CALC_TOKEN_TTL_SECONDS') || '${tokenTtlSeconds}', 10);`,
      `    const tokenTtlMs = Math.max(configuredTokenTtlSeconds, 1) * 1000;`,
      `    const expiresAtMs = Date.now() + tokenTtlMs;`,
      `    const accessToken = ${sessionFnParam}.get('${AUTHORIZED_TOKEN_SESSION_KEY}') || '';`,
      `    if (accessToken) {`,
      `      const tokenCache = (globalThis as any).__authorizedGatlingTokenCache || ((globalThis as any).__authorizedGatlingTokenCache = {});`,
      `      const selectedUsername = ${sessionFnParam}.get('${AUTHORIZED_USERNAME_SESSION_KEY}') || (getEnvironmentVariable('AUTHORIZED_CALC_USERNAME') || 'demo');`,
      `      const userSlot = ${sessionFnParam}.get('${AUTHORIZED_USER_SLOT_SESSION_KEY}') || 0;`,
      `      const cacheKey = ${JSON.stringify(baseExpr)} + '::' + selectedUsername + '::slot-' + userSlot + '::' + ${JSON.stringify(instanceName)};`,
      `      tokenCache[cacheKey] = { accessToken, expiresAtMs };`,
      `    }`,
      `    return ${sessionFnParam}.set('${AUTHORIZED_TOKEN_EXPIRES_AT_SESSION_KEY}', expiresAtMs);`,
      `  })`,
      `)`,
      `.exec(`,
      ...resourceLines,
      `)`,
    ];
  }
}
