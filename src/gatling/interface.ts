import type {StepData} from '../scenario/loader';
import type {ModifyRequest} from '../scenario/modify';
import type {BaseValidation as ValidateResponse} from '../common/validations';

export interface GatlingGeneratorContext {
    declaredAttachments: Set<string>;

    stepVarName(stepIndex: number): string;

    /** Tracks the current hostRef from the last step that declared one, for resolution by subsequent steps. */
    currentHostRef?: string;

    /** Tracks current hostRef per stepType + stepInstanceName. */
    stepInstanceHostRefs?: Map<string, string>;
}

export interface GatlingPayloadResult {
    code: string[];
    payloadVarName: string;
    payloadJson: string;
}

export interface GatlingStepGenerator {
    readonly stepType: string;

    generatePreamble?(step: StepData, ctx: GatlingGeneratorContext): string[];

    generateDefaultPayload(step: StepData, ctx: GatlingGeneratorContext): GatlingPayloadResult;

    generateModification(
        mod: ModifyRequest,
        payloadVarName: string,
        step: StepData,
        ctx: GatlingGeneratorContext
    ): string[];

    generateValidationCheck(
        v: ValidateResponse,
        responseVarName: string,
        step: StepData,
        ctx: GatlingGeneratorContext
    ): string | null;

    generateHttpCall(
        sessionFnParam: string,
        sessionFnBody: string[],
        step: StepData,
        ctx: GatlingGeneratorContext
    ): string[];

    getEndpoint?(step: StepData): string;
}
