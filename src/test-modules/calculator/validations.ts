import { CalcResponse } from './response';
import { assertValidation, type BaseValidation, validateApiResponse } from '../../common/validations';

/**
 * Named response fields that can be validated by the calculator test module.
 */
export enum CalcValidatedParameter {
  RESULT = 'result',
  OPERATION = 'operation',
}

/**
 * Validation descriptor for the calculator, constraining `validatedParameter`
 * to a {@link CalcValidatedParameter}.
 */
export type CalcValidateResponse = BaseValidation & {
  validatedParameter?: CalcValidatedParameter;
};

/**
 * Runs all declared validations against a calculator response.
 *
 * Delegates to {@link validateApiResponse} with a module-specific parameter
 * resolver that supports `result` and `operation`.
 *
 * @param validateResponse - Validation entries declared on the step.
 * @param apiResponse - Parsed response wrapper to validate.
 * @throws {Error} When a validation declares an unsupported `validatedParameter`.
 */
export async function validateCalcApiResponse(
  validateResponse: CalcValidateResponse[],
  apiResponse: CalcResponse
): Promise<void> {
  await validateApiResponse(
    validateResponse,
    apiResponse,
    (r: CalcResponse) => r.toJson(),
    async (
      validatedParameter: string,
      validatedParameterValue: string,
      description: string | undefined,
      validationType: 'equal' | 'include'
    ): Promise<void> => {
      const desc: string = description || `Validating ${validatedParameter}`;
      switch (validatedParameter as CalcValidatedParameter) {
        case CalcValidatedParameter.RESULT:
          await assertValidation(apiResponse.result, parseInt(validatedParameterValue, 10), desc, validationType);
          break;
        case CalcValidatedParameter.OPERATION:
          await assertValidation(apiResponse.operation, validatedParameterValue, desc, validationType);
          break;
        default:
          throw new Error(`Unsupported validatedParameter: ${validatedParameter}`);
      }
    }
  );
}
