import { AuthorizedCalcResponse } from './response';
import { assertValidation, type BaseValidation, validateApiResponse } from '../../common/validations';

export type AuthorizedCalcValidateResponse = BaseValidation & {
  validatedParameter?: 'result' | 'operation';
  validatedParameterValue: string;
};

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
