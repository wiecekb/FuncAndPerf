import type { StepData } from '../scenario/loader';
import type { ModifyRequest } from '../scenario/modify';
import type { BaseValidation as ValidateResponse } from '../common/validations';

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

  /**
   * Optional method for steps that emit inner resource calls (e.g., token + business call
   * via `.resources()`). When implemented, the caller passes the pre-built check lines
   * (status, validation, bodyString.saveAs) and the generator is responsible for attaching
   * them to the correct inner request, rather than having them appended after the outer
   * `.exec()` block.
   *
   * If not implemented, the caller falls back to the standard behavior: appending checks
   * after the entire `generateHttpCall()` output.
   */
  generateHttpCallWithChecks?(
    sessionFnParam: string,
    sessionFnBody: string[],
    step: StepData,
    ctx: GatlingGeneratorContext,
    checkLines: string[]
  ): string[];

  getEndpoint?(step: StepData): string;
}
