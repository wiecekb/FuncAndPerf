import type { StepData } from '../scenario/loader';
import type { ModifyRequest } from '../scenario/modify';
import type { BaseValidation as ValidateResponse } from '../common/validations';

/**
 * Mutable context passed to Gatling step generators while emitting Scala code
 * for a scenario. Mirrors {@link K6GeneratorContext} for the Gatling code path.
 */
export interface GatlingGeneratorContext {
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
 * Result of generating a default payload for Gatling: emitted Scala lines, the
 * payload variable name and the payload rendered as a JSON string literal.
 */
export interface GatlingPayloadResult {
  code: string[];
  payloadVarName: string;
  payloadJson: string;
}

/**
 * Contract implemented by every Gatling step generator.
 *
 * A generator translates one {@link ScenarioType} of step into Scala fragments
 * compatible with the Gatling DSL. Generators register themselves into
 * {@link gatlingGeneratorRegistry}.
 */
export interface GatlingStepGenerator {
  /** Discriminator value matching {@link StepData.stepType}. */
  readonly stepType: string;

  /**
   * Optional lines emitted once, before the step body, to declare helpers or
   * constants specific to the step type.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generatePreamble?(step: StepData, ctx: GatlingGeneratorContext): string[];

  /**
   * Emits the code building the default request payload for the step.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   * @returns Emitted lines, payload variable name and JSON literal.
   */
  generateDefaultPayload(step: StepData, ctx: GatlingGeneratorContext): GatlingPayloadResult;

  /**
   * Emits the code applying a single {@link ModifyRequest} to the payload.
   *
   * @param mod - Modification to apply.
   * @param payloadVarName - Name of the payload variable to mutate.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateModification(
    mod: ModifyRequest,
    payloadVarName: string,
    step: StepData,
    ctx: GatlingGeneratorContext
  ): string[];

  /**
   * Emits a Gatling check fragment for a single response validation, or `null`
   * when the validation cannot be translated.
   *
   * @param v - Validation descriptor.
   * @param responseVarName - Name of the response variable in the generated code.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateValidationCheck(
    v: ValidateResponse,
    responseVarName: string,
    step: StepData,
    ctx: GatlingGeneratorContext
  ): string | null;

  /**
   * Emits the Gatling `http(...)` chain performing the request for the step.
   *
   * @param sessionFnParam - Parameter name of the session lambda (e.g. `session`).
   * @param sessionFnBody - Body lines of the session lambda building the request.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateHttpCall(
    sessionFnParam: string,
    sessionFnBody: string[],
    step: StepData,
    ctx: GatlingGeneratorContext
  ): string[];

  /**
   * Optional variant of {@link GatlingStepGenerator.generateHttpCall} that
   * appends the provided Gatling check lines to the request chain.
   *
   * @param sessionFnParam - Parameter name of the session lambda.
   * @param sessionFnBody - Body lines of the session lambda building the request.
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   * @param checkLines - Pre-generated check fragments to attach.
   */
  generateHttpCallWithChecks?(
    sessionFnParam: string,
    sessionFnBody: string[],
    step: StepData,
    ctx: GatlingGeneratorContext,
    checkLines: string[]
  ): string[];

  /**
   * Optional resolver returning the endpoint path for the step.
   *
   * @param step - Step being generated.
   */
  getEndpoint?(step: StepData): string;
}
