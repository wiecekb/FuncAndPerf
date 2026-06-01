export type AuthorizedCalcValidateResponse = {
    validatedParameter?: 'result' | 'operation';
    validatedParameterValue?: string;
    validationType?: 'equal' | 'include';
    jsonPath?: string;
    validatedParameterDescription?: string;
};

