import type { StepData } from '../scenario/loader';
import type { ModifyRequest } from '../scenario/modify';
import type { BaseValidation as ValidateResponse } from '../common/validations';

/**
 * Mutable context passed to k6 API step generators while emitting code for a
 * scenario.
 */
export interface K6GeneratorContext {
  /** Names of attachments already declared, to avoid duplicate declarations. */
  declaredAttachments: Set<string>;

  /** Returns the generated variable name for the step at `stepIndex`. */
  stepVarName(stepIndex: number): string;
  /** Host alias currently in effect for the emitted step. */
  currentHostRef?: string;
  /** Optional map of step-instance key to resolved host reference. */
  stepInstanceHostRefs?: Map<string, string>;
}

/**
 * Result of generating a default payload: the emitted code lines and the name
 * of the payload variable they initialise.
 */
export interface DefaultPayloadResult {
  code: string[];
  payloadVarName: string;
}

/**
 * Contract implemented by every k6 API step generator.
 *
 * A generator is responsible for translating one {@link ScenarioType} of step
 * into the k6 JavaScript fragments that build, modify, send and validate a
 * request. Generators register themselves into {@link k6GeneratorRegistry}.
 */
export interface K6StepGenerator {
  /** Discriminator value matching {@link StepData.stepType}. */
  readonly stepType: string;

  /**
   * Optional lines emitted once, before the step body, to declare helpers or
   * constants specific to the step type.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generatePreamble?(step: StepData, ctx: K6GeneratorContext): string[];

  /**
   * Emits the code building the default request payload for the step.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   * @returns Emitted lines and the payload variable name.
   */
  generateDefaultPayload(step: StepData, ctx: K6GeneratorContext): DefaultPayloadResult;

  /**
   * Emits the code applying a single {@link ModifyRequest} to the payload.
   *
   * @param mod - Modification to apply.
   * @param payloadVarName - Name of the payload variable to mutate.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateModification(mod: ModifyRequest, payloadVarName: string, step: StepData, ctx: K6GeneratorContext): string[];

  /**
   * Emits a k6 check callback for a single response validation, or `null` when
   * the validation cannot be translated.
   *
   * @param v - Validation descriptor.
   * @param responseVarName - Name of the response variable (`r` in k6 checks).
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateValidationCheck(
    v: ValidateResponse,
    responseVarName: string,
    step: StepData,
    ctx: K6GeneratorContext
  ): string | null;

  /**
   * Emits the k6 `http.*` call performing the request for the step.
   *
   * @param payloadVarName - Name of the payload variable to send.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateHttpCall(payloadVarName: string, step: StepData, ctx: K6GeneratorContext): string[];

  /**
   * Optional resolver returning the endpoint path for the step.
   *
   * @param step - Step being generated.
   */
  getEndpoint?(step: StepData): string;
}

/**
 * Mutable context passed to k6 browser step generators. Mirrors
 * {@link K6GeneratorContext} for the browser code path.
 */
export interface K6BrowserGeneratorContext {
  /** Names of attachments already declared, to avoid duplicate declarations. */
  declaredAttachments: Set<string>;
  /** Returns the generated variable name for the step at `stepIndex`. */
  stepVarName(stepIndex: number): string;
  /** Host alias currently in effect for the emitted step. */
  currentHostRef?: string;
  /** Optional map of step-instance key to resolved host reference. */
  stepInstanceHostRefs?: Map<string, string>;
}

/**
 * Contract implemented by every k6 browser step generator. Browser generators
 * translate UI steps into k6 browser-API instructions rather than HTTP calls.
 */
export interface K6BrowserStepGenerator {
  /** Discriminator value matching {@link StepData.stepType}. */
  readonly stepType: string;

  /**
   * Optional lines emitted once, before the step body, to declare helpers or
   * constants specific to the step type.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generatePreamble?(step: StepData, ctx: K6BrowserGeneratorContext): string[];

  /**
   * Emits the k6 browser instructions performing the UI actions for the step.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateBrowserInstructions(step: StepData, ctx: K6BrowserGeneratorContext): string[];
}
