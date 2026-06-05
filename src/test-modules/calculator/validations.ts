import { CalcResponse } from './response';
import { assertValidation, type BaseValidation, validateApiResponse } from '../../common/validations';

export enum CalcValidatedParameter {
  RESULT = 'result',
  OPERATION = 'operation',
}

export type CalcValidateResponse = BaseValidation & {
  validatedParameter?: CalcValidatedParameter;
};

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
