import type {StepData} from '../scenario/loader';
import type {ModifyRequest} from '../scenario/modify';
import type {BaseValidation as ValidateResponse} from '../common/validations';

export interface K6GeneratorContext {
    declaredAttachments: Set<string>;

    stepVarName(stepIndex: number): string;
}

export interface DefaultPayloadResult {
    code: string[];
    payloadVarName: string;
}

export interface K6StepGenerator {

    readonly stepType: string;

    generatePreamble?(step: StepData, ctx: K6GeneratorContext): string[];

    generateDefaultPayload(step: StepData, ctx: K6GeneratorContext): DefaultPayloadResult;

    generateModification(
        mod: ModifyRequest,
        payloadVarName: string,
        step: StepData,
        ctx: K6GeneratorContext
    ): string[];

    generateValidationCheck(
        v: ValidateResponse,
        responseVarName: string,
        step: StepData,
        ctx: K6GeneratorContext
    ): string | null;

    generateHttpCall(
        payloadVarName: string,
        step: StepData,
        ctx: K6GeneratorContext
    ): string[];

    getEndpoint?(step: StepData): string;
}