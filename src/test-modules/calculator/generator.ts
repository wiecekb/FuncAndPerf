import { APIResponse, test } from '@playwright/test';
import { config } from '../../config';
import { resolveHostRef, type StepData } from '../../scenario/loader';
import type { ModifyRequest } from '../../scenario/modify';
import { resolveModifyReferences } from '../../scenario/data/resolve';
import { CalcResponse } from './response';
import type { CalcResponseJson } from './types';
import { type CalcValidateResponse, validateCalcApiResponse } from './validations';
import { applyCalcJsonPathModifications, applyCalcModifications, splitCalcModifyRequests } from './modifications';
import { CalcRequestBuilder } from './builder';
import { expectWithDescription } from '../../utils/logging-expect';
import { attachApiRequest, attachApiResponse } from '../../allure/helpers';
import type { ScenarioExecutionContext } from '../../scenario/execution-context';
import { parseJsonResponseOrThrow } from '../../common/api-response';

import { OPERATION_TO_ENDPOINT } from './config';

type RequestHeadersMap = Record<string, string>;

export function resetCalcHostRef(): void {}

function resolveCalcBaseUrl(step: StepData, executionContext?: ScenarioExecutionContext): string {
  if (step.hostRef) {
    executionContext?.setCurrentHostRef(step, step.hostRef);
    const resolved: string | undefined = resolveHostRef(step.hostRef, config);
    if (!resolved) {
      throw new Error(
        `hostRef "${step.hostRef}" not found in config.yaml hosts. ` +
          `Step "${step.stepName || step.stepType}" has an invalid hostRef.`
      );
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

  throw new Error(
    `No hostRef defined for step "${step.stepName || step.stepType}". ` +
      'The first calculator step must have a hostRef set in config.yaml hosts.'
  );
}

export async function executeCalcStep(
  step: StepData,
  stepIndex: number,
  stepName: string,
  request: import('@playwright/test').APIRequestContext,
  executionContext?: ScenarioExecutionContext
): Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }> {
  const apiUrl: string = resolveCalcBaseUrl(step, executionContext);
  const operation = step.additionalData?.operation as string | undefined;
  const endpoint: string = OPERATION_TO_ENDPOINT[operation || ''];

  if (!endpoint) {
    throw new Error(`Unsupported calculator operation: ${operation}`);
  }

  const resolvedModifyRequests: ModifyRequest[] = step.modifyRequests
    ? resolveModifyReferences(step.modifyRequests)
    : [];

  const { builderMods, jsonPathMods } = splitCalcModifyRequests(resolvedModifyRequests);

  const builder = new CalcRequestBuilder();
  applyCalcModifications(builderMods, builder);

  const requestBody = builder.build() as Record<string, unknown>;

  if (jsonPathMods.length > 0) {
    applyCalcJsonPathModifications(jsonPathMods, requestBody);
  }

  const headers: RequestHeadersMap = {
    'Content-Type': 'application/json',
  };

  const fullUrl = `${apiUrl}${endpoint}`;

  await test.step('Attach request details to Allure', async (): Promise<void> => {
    await attachApiRequest(`${stepName} - ${step.stepType} API`, fullUrl, 'POST', headers, {
      metadata: {
        name: 'body',
        mimeType: 'application/json',
        content: requestBody,
      },
    });
  });

  const response: APIResponse = await request.post(fullUrl, {
    data: requestBody,
    headers,
  });

  const responseBody: Record<string, unknown> = await parseJsonResponseOrThrow(
    response,
    `Calculator endpoint: ${fullUrl}`
  );

  await test.step('Attach response details to Allure', async (): Promise<void> => {
    await attachApiResponse(
      `${stepName} - ${step.stepType} API`,
      response.status(),
      response.statusText(),
      { 'Content-Type': 'application/json' },
      JSON.stringify(responseBody)
    );
  });

  const calcResponse: CalcResponse = CalcResponse.fromJson(responseBody as unknown as CalcResponseJson);
  await validateCalcApiResponse((step.validateResponse ?? []) as CalcValidateResponse[], calcResponse);

  const body: Record<string, unknown> = responseBody as Record<string, unknown>;

  await test.step('Validate status code and response', async (): Promise<void> => {
    await expectWithDescription(
      `Expected status code ${step.returnCode}, but got ${response.status()}. Step: ${stepName}`,
      response.status()
    ).toBe(step.returnCode);
  });

  return {
    requestBody,
    responseBody: body,
  };
}
