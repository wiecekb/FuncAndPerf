import type {StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import type {DefaultPayloadResult, K6GeneratorContext, K6StepGenerator} from '../../k6/interface';
import {escapeJsString, generateModification as generateCommonModification} from '../../k6/common';
import {AUTHORIZED_CALC_OPERATION_TO_ENDPOINT} from './config';
import {resolveAuthorizedCalcBaseExpr} from './resolve-host-ref';

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
        return {payloadVarName: 'payload', code: ['const payload = { a: 0, b: 0 };']};
    }

    generateModification(mod: ModifyRequest, payloadVarName: string): string[] {
        return generateCommonModification(mod, payloadVarName, (v: string): string => {
            const numValue: number = parseInt(v, 10);
            return isNaN(numValue) ? `'${escapeJsString(v)}'` : String(numValue);
        });
    }

    generateValidationCheck(): string | null {
        return null;
    }

    generateHttpCall(payloadVarName: string, step: StepData, ctx: K6GeneratorContext): string[] {
        const operation: string | undefined = step.additionalData?.operation as string | undefined;
        const endpoint: string = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''] || '/authorized/api/calc/add';
        return [
            `const baseUrl = ${resolveAuthorizedCalcBaseExpr(step, ctx)};`,
            "const usersRaw: string = __ENV.AUTHORIZED_CALC_USERS || '';",
            "const userPairs = usersRaw",
            "  .split(',')",
            "  .map((x: string) => x.trim())",
            "  .filter((x: string) => x.length > 0)",
            "  .map((x: string) => {",
            "    const [username, password] = x.split(':');",
            "    return { username: (username || '').trim(), password: (password || '').trim() };",
            "  })",
            "  .filter((u: { username: string; password: string }) => u.username && u.password);",
            "const fallbackUser: { username: string; password: string } = {",
            "  username: __ENV.AUTHORIZED_CALC_USERNAME || 'demo',",
            "  password: __ENV.AUTHORIZED_CALC_PASSWORD || 'demo'",
            "};",
            "const users: Array<{ username: string; password: string }> = userPairs.length > 0 ? userPairs : [fallbackUser];",
            'const userIndex: number = ((__VU - 1) + __ITER) % users.length;',
            "const selectedUser: { username: string; password: string } = users[userIndex];",
            'const tokenCache: Record<string, string> = globalThis.__authorizedTokenCache || (globalThis.__authorizedTokenCache = {});',
            "const cacheKey: string = `${baseUrl}::${selectedUser.username}`;",
            'let accessToken: string = tokenCache[cacheKey] || "";',
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
            '  const tokenJson = tokenRes.json();',
            '  accessToken = tokenJson && tokenJson.access_token ? tokenJson.access_token : "";',
            '  if (accessToken) {',
            '    tokenCache[cacheKey] = accessToken;',
            '  }',
            '}',
            `const url: string = \`${'${baseUrl}'}${endpoint}\`;`,
            '',
            `const res = http.post(url, JSON.stringify(${payloadVarName}), {`,
            '  headers: {',
            "    'Content-Type': 'application/json',",
            "    'Authorization': `Bearer ${accessToken}`",
            '  }',
            '});'
        ];
    }
}
