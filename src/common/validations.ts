import {JSONPath} from 'jsonpath-plus';
import {expectWithDescription} from '../utils/logging-expect';

export async function assertValidation(
    actual: unknown,
    expected: unknown,
    description: string,
    validationType: 'equal' | 'include' = 'equal'
): Promise<void> {
    const exp = expectWithDescription(description, actual);
    if (validationType === 'include') {
        await exp.toContain(expected);
    } else {
        await exp.toEqual(expected);
    }
}

export function validateJsonPath(jsonPath: string, json: object): unknown {
    let result: unknown;
    try {
        result = JSONPath({path: jsonPath, json, wrap: false});
    } catch (error) {
        const message: string = error instanceof Error ? error.message : String(error);
        throw new Error(`Invalid jsonPath "${jsonPath}": ${message}`, {cause: error});
    }

    if (result === undefined) {
        throw new Error(`jsonPath did not find any element: ${jsonPath}`);
    }

    return result;
}

export function valueToString(value: unknown): string {
    return value === null || value === undefined ? String(value) : String(value);
}

export type BaseValidation = {
    validatedParameter?: string;
    validatedParameterValue: string;
    validationType?: 'equal' | 'include';
    jsonPath?: string;
    validatedParameterDescription?: string;
};

export async function validateApiResponse<T extends BaseValidation, R>(
    validations: T[],
    apiResponse: R,
    toJson: (response: R) => object,
    validateParam: (validatedParameter: string, value: string, description: string | undefined, validationType: 'equal' | 'include') => Promise<void>
): Promise<void> {
    for (const validation of validations) {
        const validationType: "equal" | "include" = validation.validationType || 'equal';
        const description: string | undefined = validation.validatedParameterDescription;

        if (validation.jsonPath) {
            const result: unknown = validateJsonPath(validation.jsonPath, toJson(apiResponse));
            const resultAsString: string = valueToString(result);
            await assertValidation(
                resultAsString,
                validation.validatedParameterValue,
                description ? `Validating JSON Path: ${validation.jsonPath} (${description})` : `Validating JSON Path: ${validation.jsonPath}`,
                validationType
            );
            continue;
        }

        if (!validation.validatedParameter) {
            throw new Error('Either validatedParameter or jsonPath must be provided');
        }

        await validateParam(
            validation.validatedParameter,
            validation.validatedParameterValue,
            description,
            validationType
        );
    }
}
