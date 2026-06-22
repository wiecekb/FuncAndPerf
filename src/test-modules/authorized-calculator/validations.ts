import { AuthorizedCalcResponse } from './response';
import { assertValidation, type BaseValidation, validateApiResponse } from '../../common/validations';

/**
 * Validation descriptor for the authorized calculator, constraining
 * `validatedParameter` to the fields exposed by {@link AuthorizedCalcResponse}.
 */
export type AuthorizedCalcValidateResponse = BaseValidation & {
  /** Field of the response that can be validated. */
  validatedParameter?: 'result' | 'operation';
  /** Expected value, compared as a string (or parsed integer for `result`). */
  validatedParameterValue: string;
};

/**
 * Runs all declared validations against an authorized-calculator response.
 *
 * Delegates to {@link validateApiResponse} with a module-specific parameter
 * resolver that supports `result` and `operation`.
 *
 * @param validateResponse - Validation entries declared on the step.
 * @param apiResponse - Parsed response wrapper to validate.
 * @throws {Error} When a validation declares an unsupported `validatedParameter`.
 */
export async function validateAuthorizedCalcApiResponse(
  validateResponse: AuthorizedCalcValidateResponse[],
  apiResponse: AuthorizedCalcResponse
): Promise<void> {
  await validateApiResponse(
    validateResponse,
    apiResponse,
    (r: AuthorizedCalcResponse) => r.toJson(),
    async (
      validatedParameter: string,
      validatedParameterValue: string,
      description: string | undefined,
      validationType: 'equal' | 'include'
    ): Promise<void> => {
      const desc: string = description || `Validating ${validatedParameter}`;
      switch (validatedParameter) {
        case 'result':
          await assertValidation(apiResponse.result, parseInt(validatedParameterValue, 10), desc, validationType);
          break;
        case 'operation':
          await assertValidation(apiResponse.operation, validatedParameterValue, desc, validationType);
          break;
        default:
          throw new Error(`Unsupported validatedParameter: ${validatedParameter}`);
      }
    }
  );
}
