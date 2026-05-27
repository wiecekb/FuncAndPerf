import type {StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import type {CalcValidateResponse as ValidateResponse} from './validations';
import type {DefaultPayloadResult, K6GeneratorContext, K6StepGenerator} from '../../k6/interface';
import {
    escapeJsString,
    generateModification as generateCommonModification,
    generateValidationCheck
} from '../../k6/common';
import {OPERATION_TO_ENDPOINT} from './config';

const VALIDATE_TO_JSON_PATH: Record<string, string> = {
    result: '$.result',
    operation: '$.operation',
};

export class CalculatorK6Generator implements K6StepGenerator {
    readonly stepType: string;

    constructor(stepType: string) {
        this.stepType = stepType;
    }

    getEndpoint(step: StepData): string {
        const operation = step.additionalData?.operation as string | undefined;
        const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
        return '`${CALC_BASE_URL}' + endpoint + '`';
    }

    generateDefaultPayload(_step: StepData, _ctx: K6GeneratorContext): DefaultPayloadResult {
        return {
            payloadVarName: 'payload',
            code: ['const payload = { a: 0, b: 0 };'],
        };
    }

    generateModification(
        mod: ModifyRequest,
        payloadVarName: string,
        _step: StepData,
        _ctx: K6GeneratorContext
    ): string[] {
        return generateCommonModification(mod, payloadVarName, (v) => {
            const numValue: number = parseInt(v, 10);
            return isNaN(numValue) ? `'${escapeJsString(v)}'` : String(numValue);
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

    generateHttpCall(payloadVarName: string, step: StepData, _ctx: K6GeneratorContext): string[] {
        const operation = step.additionalData?.operation as string | undefined;
        const endpoint = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
        const lines: string[] = [];
        lines.push(`const url = \`\${CALC_BASE_URL}${endpoint}\`;`);
        lines.push('');
        lines.push(`const res = http.post(url, JSON.stringify(${payloadVarName}), {`);
        lines.push('  headers: {');
        lines.push("    'Content-Type': 'application/json'");
        lines.push('  },');
        lines.push('  tags: {');
        lines.push(`    scenario: '${escapeJsString(step.stepName || step.stepType)}',`);
        lines.push(`    endpoint: '${endpoint}',`);
        lines.push(`    requestPayload: JSON.stringify(${payloadVarName})`);
        lines.push('  }');
        lines.push('});');
        return lines;
    }
}