import type {StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import type {CalcValidateResponse as ValidateResponse} from './validations';
import type {GatlingGeneratorContext, GatlingPayloadResult, GatlingStepGenerator} from '../../gatling/interface';
import {
    escapeJsString,
    generateGatlingCheck,
    generateModification as generateCommonModification
} from '../../gatling/common';
import {OPERATION_TO_ENDPOINT} from './config';

const VALIDATE_TO_JSON_PATH: Record<string, string> = {
    result: '$.result',
    operation: '$.operation',
};

export class CalculatorGatlingGenerator implements GatlingStepGenerator {
    readonly stepType: string;

    constructor(stepType: string) {
        this.stepType = stepType;
    }

    getEndpoint(step: StepData): string {
        const operation = step.additionalData?.operation as string | undefined;
        const endpoint = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
        return `\`\${CALC_BASE_URL}${endpoint}\``;
    }

    generateDefaultPayload(_step: StepData, _ctx: GatlingGeneratorContext): GatlingPayloadResult {
        const payloadJson = '{"a":0,"b":0}';
        return {
            payloadVarName: 'payload',
            code: [
                `const payload = ${payloadJson};`
            ],
            payloadJson
        };
    }

    generateModification(
        mod: ModifyRequest,
        payloadVarName: string,
        _step: StepData,
        _ctx: GatlingGeneratorContext
    ): string[] {
        return generateCommonModification(
            mod,
            payloadVarName,
            (v: string) => {
                const numValue: number = parseInt(v, 10);
                return isNaN(numValue) ? `'${escapeJsString(v)}'` : String(numValue);
            }
        );
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
        _ctx: GatlingGeneratorContext
    ): string[] {
        const operation = step.additionalData?.operation as string | undefined;
        const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
        const url = `\`\${CALC_BASE_URL}${endpoint}\``;
        const stepName: string = escapeJsString(step.stepName || step.stepType);
        return [
            `http('${stepName}')`,
            `  .post(${url})`,
            `  .header('Content-Type', 'application/json')`,
            `  .body(StringBody((${sessionFnParam}) => {`,
            ...sessionFnBody,
            `      return JSON.stringify(payload);`,
            `  }))`,
            `  .asJson()`
        ];
    }
}
