import type { StepData } from '../../scenario/loader';
import type { ModifyRequest } from '../../scenario/modify';
import type { CalcValidateResponse as ValidateResponse } from './validations';
import type { GatlingGeneratorContext, GatlingPayloadResult, GatlingStepGenerator } from '../../gatling/interface';
import {
  escapeJsString,
  generateGatlingCheck,
  generateModification as generateCommonModification,
} from '../../gatling/common';
import { OPERATION_TO_ENDPOINT, PARAMETER_TO_JSON_PATH } from './config';
import { resolveCalcBaseExpr } from './resolve-host-ref';

const VALIDATE_TO_JSON_PATH: Record<string, string> = {
  result: '$.result',
  operation: '$.operation',
};

/**
 * Gatling generator for (unauthenticated) calculator steps.
 *
 * Emits Scala DSL fragments that build the payload and perform the POST request
 * against the calculator endpoint inside a Gatling `http(...)` chain.
 */
export class CalculatorGatlingGenerator implements GatlingStepGenerator {
  readonly stepType: string;

  /**
   * @param stepType - Discriminator value (typically `CALCULATOR`).
   */
  constructor(stepType: string) {
    this.stepType = stepType;
  }

  /**
   * Returns the full endpoint expression (base + operation path) for the step.
   *
   * @param step - Step being generated.
   */
  getEndpoint(step: StepData): string {
    const operation = step.additionalData?.operation as string | undefined;
    const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
    return '`' + resolveCalcBaseExpr(step) + endpoint + '`';
  }

  generateDefaultPayload(_step: StepData, _ctx: GatlingGeneratorContext): GatlingPayloadResult {
    const payloadJson = '{"a":0,"b":0}';
    return {
      payloadVarName: 'payload',
      code: [`const payload = ${payloadJson};`],
      payloadJson,
    };
  }

  generateModification(
    mod: ModifyRequest,
    payloadVarName: string,
    _step: StepData,
    _ctx: GatlingGeneratorContext
  ): string[] {
    return generateCommonModification(mod, payloadVarName, (v: unknown): string => {
      const rawValue: string = typeof v === 'string' ? v : String(v);
      const numValue: number = parseInt(rawValue, 10);
      return isNaN(numValue) ? `'${escapeJsString(rawValue)}'` : String(numValue);
    }, PARAMETER_TO_JSON_PATH);
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
    const operation = step.additionalData?.operation as string | undefined;
    const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''] || '/api/calc/add';
    const url = `\`${resolveCalcBaseExpr(step, ctx)}${endpoint}\``;
    const stepName: string = escapeJsString(step.stepName || step.stepType);
    return [
      `http('${stepName}')`,
      `  .post(${url})`,
      `  .header('Content-Type', 'application/json')`,
      `  .body(StringBody((${sessionFnParam}) => {`,
      ...sessionFnBody,
      `      return JSON.stringify(payload);`,
      `  }))`,
      `  .asJson()`,
    ];
  }
}
