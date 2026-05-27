import {APIResponse, test} from '@playwright/test';
import {config} from '../../config';
import type {StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import {resolveModifyReferences} from '../../scenario/data/resolve';
import {CalcResponse} from './response';
import {type CalcValidateResponse, validateCalcApiResponse} from './validations';
import {applyCalcJsonPathModifications, applyCalcModifications, splitCalcModifyRequests} from './modifications';
import {CalcRequestBuilder} from './builder';
import {expectWithDescription} from '../../utils/logging-expect';
import {attachApiRequest, attachApiResponse} from '../../allure/helpers';

import {OPERATION_TO_ENDPOINT} from './config';

const CALC_BASE_URL: string = config.calculator.url;

type RequestHeadersMap = Record<string, string>;

export async function executeCalcStep(
    step: StepData,
    stepIndex: number,
    stepName: string,
    request: import('@playwright/test').APIRequestContext
): Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }> {
    const apiUrl: string = CALC_BASE_URL;
    const operation = step.additionalData?.operation as string | undefined;
    const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''];

    if (!endpoint) {
        throw new Error(`Unsupported calculator operation: ${operation}`);
    }

    if (!apiUrl) {
        throw new Error('calculator.url is not configured (set in config.yaml or calculator.url env var)');
    }


    const resolvedModifyRequests: ModifyRequest[] = step.modifyRequests
        ? resolveModifyReferences(step.modifyRequests)
        : [];


    const {builderMods, jsonPathMods} = splitCalcModifyRequests(resolvedModifyRequests);

    const builder = new CalcRequestBuilder();
    applyCalcModifications(builderMods, builder);

    const requestBody = builder.build() as Record<string, unknown>;

    if (jsonPathMods.length > 0) {
        applyCalcJsonPathModifications(jsonPathMods, requestBody);
    }

    const headers: RequestHeadersMap = {
        'Content-Type': 'application/json'
    };

    const fullUrl = `${apiUrl}${endpoint}`;

    await test.step('Attach request details to Allure', async ():Promise<void> => {
        await attachApiRequest(
            `${stepName} - ${step.stepType} API`,
            fullUrl,
            'POST',
            headers,
            {
                metadata: {
                    name: 'body',
                    mimeType: 'application/json',
                    content: requestBody
                }
            }
        );
    });

    const response: APIResponse = await request.fetch(fullUrl, {
        method: 'POST',
        headers,
        data: requestBody
    });

    const responseText: string = await response.text();

    let responseData: { result: number; operation: string } | null = null;
    let isJson: boolean = true;
    try {
        responseData = JSON.parse(responseText);
    } catch {
        isJson = false;
    }

    const hasValidations: boolean = !!(step.validateResponse && step.validateResponse.length > 0);

    if (!isJson && hasValidations) {
        throw new Error(
            `Step ${stepIndex + 1}: Response is not valid JSON, but scenario defines ` +
            `${step.validateResponse!.length} validation(s). ` +
            `Response starts with: ${responseText.substring(0, 200)}`
        );
    }

    await attachApiResponse(
        `${stepName} - ${step.stepType} API`,
        response.status(),
        response.statusText(),
        response.headers(),
        responseText
    );

    const expectedCode: number = step.returnCode;
    await expectWithDescription(`Step ${stepIndex + 1}: Response status code validation`, response.status()).toBe(expectedCode);

    if (responseData && hasValidations) {
        const apiResponse: CalcResponse = CalcResponse.fromJson(responseData as import('./types').CalcResponseJson);
        await validateCalcApiResponse((step.validateResponse ?? []) as CalcValidateResponse[], apiResponse);
    }

    return {
        requestBody,
        responseBody: (responseData ?? {}) as Record<string, unknown>
    };
}
