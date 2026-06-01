import type {StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import type {GatlingGeneratorContext, GatlingPayloadResult, GatlingStepGenerator} from '../../gatling/interface';
import {escapeJsString, generateModification as generateCommonModification} from '../../gatling/common';
import {AUTHORIZED_CALC_OPERATION_TO_ENDPOINT} from './config';
import {resolveAuthorizedCalcBaseExpr} from './resolve-host-ref';

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
            payloadJson
        };
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

        return [
            `http('${stepName} token')`,
            `  .post('${baseExpr}/oauth/token')`,
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
            `      .post('${baseExpr}${endpoint}')`,
            `      .header('Content-Type', 'application/json')`,
            `      .header('Authorization', (${sessionFnParam}) => \`Bearer \${${sessionFnParam}.get('authorizedAccessToken')}\`)`,
            `      .body(StringBody((${sessionFnParam}) => {`,
            ...sessionFnBody,
            `        return JSON.stringify(payload);`,
            `      }))`,
            `      .asJson()`,
            `  )`
        ];
    }
}
