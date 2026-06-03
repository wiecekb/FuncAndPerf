import {APIResponse, test} from '@playwright/test';
import {config} from '../../config';
import {resolveHostRef, type StepData} from '../../scenario/loader';
import type {ModifyRequest} from '../../scenario/modify';
import {resolveModifyReferences} from '../../scenario/data/resolve';
import type {AuthorizedCalcValidateResponse} from './validations';
import {
    applyAuthorizedCalcJsonPathModifications,
    applyAuthorizedCalcModifications,
    splitAuthorizedCalcModifyRequests
} from './modifications';
import {AuthorizedCalcRequestBuilder} from './builder';
import {expectWithDescription} from '../../utils/logging-expect';
import {attachApiRequest, attachApiResponse} from '../../allure/helpers';
import {AUTHORIZED_CALC_OPERATION_TO_ENDPOINT} from './config';
import type {ScenarioExecutionContext} from '../../scenario/execution-context';

type RequestHeadersMap = Record<string, string>;
type AuthorizedCalcTokenResponse = {
    access_token: string;
    token_type?: string;
    expires_in?: number;
    scope?: string;
};

type AuthorizedCalcAdditionalData = {
    operation?: string;
    accessToken?: string;
};

export function resetAuthorizedCalcHostRef(): void {
}

function resolveAuthorizedCalcBaseUrl(step: StepData, executionContext?: ScenarioExecutionContext): string {
    if (step.hostRef) {
        executionContext?.setCurrentHostRef(step, step.hostRef);
        const resolved: string | undefined = resolveHostRef(step.hostRef, config);
        if (!resolved) {
            throw new Error(`hostRef "${step.hostRef}" not found in config.yaml hosts. Step "${step.stepName || step.stepType}" has an invalid hostRef.`);
        }
        return resolved;
    }

    const currentHostRef: string | undefined = executionContext?.getCurrentHostRef(step);
    if (currentHostRef) {
        const resolved: string | undefined = resolveHostRef(currentHostRef, config);
        if (!resolved) {
            throw new Error(`Previous hostRef "${currentHostRef}" is no longer valid in config.yaml hosts.`);
        }
        return resolved;
    }
    throw new Error(`No hostRef defined for step "${step.stepName || step.stepType}". The first authorized calculator step must have a hostRef set in config.yaml hosts.`);
}

async function parseJsonOrThrow(response: APIResponse, contextName: string): Promise<Record<string, unknown>> {
    const rawBody: string = await response.text();
    try {
        return JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
        const contentType: string = response.headers()['content-type'] || 'unknown';
        const preview: string = rawBody.slice(0, 300).replace(/\s+/g, ' ').trim();
        throw new Error(
            `${contextName} returned non-JSON response (status ${response.status()}, content-type: ${contentType}). ` +
            `Body preview: ${preview}`
        );
    }
}

async function acquireAccessToken(apiUrl: string, request: import('@playwright/test').APIRequestContext): Promise<string> {
    const credentialCandidates: Array<{ username: string; password: string }> = [
        {
            username: process.env.AUTHORIZED_CALC_USERNAME || 'user01',
            password: process.env.AUTHORIZED_CALC_PASSWORD || 'password01'
        },
        {username: 'demo', password: 'demo'}
    ];

    const uniqueCredentials: Array<{ username: string; password: string }> = credentialCandidates.filter(
        (candidate: { username: string; password: string }, index: number, all: Array<{
            username: string;
            password: string
        }>):boolean => all.findIndex((c: { username: string; password: string }) => c.username === candidate.username && c.password === candidate.password) === index
    );

    let lastPayload: Record<string, unknown> | null = null;

    for (const credentials of uniqueCredentials) {
        const tokenResponse: APIResponse = await request.post(`${apiUrl}/oauth/token`, {
            data: {
                grant_type: 'password',
                client_id: 'funcandperf',
                username: credentials.username,
                password: credentials.password
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const tokenJson: Record<string, unknown> = await parseJsonOrThrow(tokenResponse, 'OAuth token endpoint');
        lastPayload = tokenJson;
        const accessToken: string = (tokenJson as AuthorizedCalcTokenResponse).access_token;

        if (accessToken) {
            return accessToken;
        }
    }

    throw new Error(`OAuth token endpoint did not return valid access_token for available credentials. Last payload: ${JSON.stringify(lastPayload)}`);
}

export async function executeAuthorizedCalcStep(
    step: StepData,
    stepIndex: number,
    stepName: string,
    request: import('@playwright/test').APIRequestContext,
    executionContext?: ScenarioExecutionContext
): Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }> {
    const apiUrl: string = resolveAuthorizedCalcBaseUrl(step, executionContext);
    const additionalData: AuthorizedCalcAdditionalData = (step.additionalData || {}) as AuthorizedCalcAdditionalData;
    const operation: string | undefined = additionalData.operation;
    const endpoint: string | undefined = AUTHORIZED_CALC_OPERATION_TO_ENDPOINT[operation || ''];

    if (!endpoint) {
        throw new Error(`Unsupported authorized calculator operation: ${operation}`);
    }

    const resolvedModifyRequests: ModifyRequest[] = step.modifyRequests
        ? resolveModifyReferences(step.modifyRequests)
        : [];
    const {builderMods, jsonPathMods}: {
        builderMods: ModifyRequest[];
        jsonPathMods: ModifyRequest[]
    } = splitAuthorizedCalcModifyRequests(resolvedModifyRequests);
    const builder: AuthorizedCalcRequestBuilder = new AuthorizedCalcRequestBuilder();
    applyAuthorizedCalcModifications(builderMods, builder);
    const requestBody: Record<string, unknown> = builder.build() as Record<string, unknown>;
    if (jsonPathMods.length > 0) {
        applyAuthorizedCalcJsonPathModifications(jsonPathMods, requestBody);
    }

    const accessToken: string = additionalData.accessToken || await acquireAccessToken(apiUrl, request);
    const headers: RequestHeadersMap = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };
    const fullUrl: string = `${apiUrl}${endpoint}`;
    await test.step('Attach request details to Allure', async (): Promise<void> => {
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

    const response: APIResponse = await request.post(fullUrl, {
        data: requestBody,
        headers
    });
    const responseBody: Record<string, unknown> = await parseJsonOrThrow(response, `Authorized calculator endpoint: ${fullUrl}`);
    await test.step('Attach response details to Allure', async (): Promise<void> => {
        await attachApiResponse(
            `${stepName} - ${step.stepType} API`,
            response.status(),
            response.statusText(),
            {'Content-Type': 'application/json'},
            JSON.stringify(responseBody)
        );
    });

    if (step.validateResponse) {
        for (const _ of step.validateResponse as AuthorizedCalcValidateResponse[]) {
        }
    }

    await test.step('Validate status code and response', async (): Promise<void> => {
        await expectWithDescription(
            `Expected status code ${step.returnCode}, but got ${response.status()}. Step: ${stepName}`,
            response.status()
        ).toBe(step.returnCode);
    });
    return {
        requestBody,
        responseBody: responseBody as Record<string, unknown>
    };
}
