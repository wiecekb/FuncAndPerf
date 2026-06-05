import { APIRequestContext, Browser, Page, test, TestInfo } from '@playwright/test';
import { hasStepAttachments, loadScenarios, Scenario, StepData, ScenarioData } from '../src/scenario/loader';
import { executeCalcStep, resetCalcHostRef } from '../src/test-modules/calculator/generator';
import {
  executeAuthorizedCalcStep,
  resetAuthorizedCalcHostRef,
} from '../src/test-modules/authorized-calculator/generator';
import { executeBrowserStep, storeBrowserStepDataIfNeeded } from '../src/test-modules/browser/generator';
import { ScenarioType } from '../src/scenario/types';
import { attachScenarioInfo } from '../src/allure/helpers';
import { stepDataRegistry } from '../src/scenario/data/registry';
import { config } from '../src/config';
import { ScenarioExecutionContext } from '../src/scenario/execution-context';
import { getStepInstanceName } from '../src/scenario/instances';

const scenarios: Scenario[] = loadScenarios();

const stepHandlers: Record<
  string,
  (
    step: import('../src/scenario/loader').StepData,
    stepIndex: number,
    stepName: string,
    request: import('@playwright/test').APIRequestContext,
    page: import('@playwright/test').Page,
    executionContext: ScenarioExecutionContext
  ) => Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }>
> = {
  [ScenarioType.CALCULATOR]: async (
    step: StepData,
    stepIndex: number,
    stepName: string,
    request: APIRequestContext,
    _page: Page,
    executionContext: ScenarioExecutionContext
  ) => executeCalcStep(step, stepIndex, stepName, request, executionContext),
  [ScenarioType.AUTHORIZED_CALCULATOR]: async (
    step: StepData,
    stepIndex: number,
    stepName: string,
    request: APIRequestContext,
    _page: Page,
    executionContext: ScenarioExecutionContext
  ) => executeAuthorizedCalcStep(step, stepIndex, stepName, request, executionContext),
  [ScenarioType.BROWSER]: executeBrowserStep,
};

test.describe('All Tests', (): void => {
  test.beforeAll(async (): Promise<void> => {
    const scenariosData: ScenarioData[] = scenarios.map((s: Scenario) => s.rawData);
    await attachScenarioInfo(scenariosData as unknown as Record<string, unknown>[], true);
  });

  scenarios.forEach((scenario: Scenario): void => {
    const steps: StepData[] = scenario.steps;
    const testNamePrefix = 'API';

    const testName = `${testNamePrefix} - ${scenario.scenarioName}`;

    test(
      testName,
      async (
        { request, page, browser }: { request: APIRequestContext; page: Page; browser: Browser },
        testInfo: TestInfo
      ): Promise<void> => {
        testInfo.setTimeout(config.test.timeout_ms);

        stepDataRegistry.clear();
        resetCalcHostRef();
        resetAuthorizedCalcHostRef();
        const executionContext = new ScenarioExecutionContext(browser, page);

        try {
          await test.step('Attach Scenario JSON', async (): Promise<void> => {
            await attachScenarioInfo([scenario.rawData as unknown as Record<string, unknown>], false);
          });

          testInfo.annotations.push(
            { type: 'feature', description: 'API Tests' },
            { type: 'story', description: 'Calculator Endpoint' },
            { type: 'parameter', description: JSON.stringify({ name: 'scenarioName', value: scenario.scenarioName }) },
            { type: 'parameter', description: JSON.stringify({ name: 'stepsCount', value: String(steps.length) }) }
          );

          for (let stepIndex: number = 0; stepIndex < steps.length; stepIndex++) {
            const step: StepData = steps[stepIndex];
            const stepName: string = step.stepName || `Step ${stepIndex + 1}`;
            const handler: (
              step: import('../src/scenario/loader').StepData,
              stepIndex: number,
              stepName: string,
              request: import('@playwright/test').APIRequestContext,
              page: import('@playwright/test').Page,
              executionContext: ScenarioExecutionContext
            ) => Promise<{
              requestBody: Record<string, unknown>;
              responseBody: Record<string, unknown>;
            }> = stepHandlers[step.stepType];

            if (!handler) {
              throw new Error(`Unsupported stepType in step ${stepIndex + 1}: ${step.stepType}`);
            }

            await test.step(`Step ${stepIndex + 1}: ${stepName}`, async (): Promise<void> => {
              testInfo.annotations.push(
                {
                  type: 'parameter',
                  description: JSON.stringify({ name: `step${stepIndex + 1}_type`, value: step.stepType }),
                },
                {
                  type: 'parameter',
                  description: JSON.stringify({
                    name: `step${stepIndex + 1}_instance`,
                    value: getStepInstanceName(step),
                  }),
                },
                {
                  type: 'parameter',
                  description: JSON.stringify({
                    name: `step${stepIndex + 1}_returnCode`,
                    value: String(step.returnCode),
                  }),
                },
                {
                  type: 'parameter',
                  description: JSON.stringify({
                    name: `step${stepIndex + 1}_hasAttachment`,
                    value: String(hasStepAttachments(step)),
                  }),
                },
                {
                  type: 'parameter',
                  description: JSON.stringify({
                    name: `step${stepIndex + 1}_dataHandlerName`,
                    value: step.dataHandlerName ?? 'none',
                  }),
                }
              );

              const result: { requestBody: Record<string, unknown>; responseBody: Record<string, unknown> } =
                await handler(step, stepIndex, stepName, request, page, executionContext);

              if (step.stepType === ScenarioType.BROWSER) {
                storeBrowserStepDataIfNeeded(step, result);
              } else if (step.dataHandlerName) {
                stepDataRegistry.set(step.dataHandlerName, {
                  sources: {
                    request: result.requestBody,
                    response: result.responseBody,
                  },
                });
              }
            });
          }
        } finally {
          await executionContext.cleanup();
        }
      }
    );
  });
});
