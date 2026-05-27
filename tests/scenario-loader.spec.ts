import {test, TestInfo} from '@playwright/test';
import {hasStepAttachments, loadScenarios, Scenario, StepData, ScenarioData} from '../src/scenario/loader';
import {executeCalcStep} from '../src/test-modules/calculator/generator';
import {ScenarioType} from '../src/scenario/types';
import {attachScenarioInfo} from '../src/allure/helpers';
import {stepDataRegistry} from '../src/scenario/data/registry';
import {config} from '../src/config';

const scenarios: Scenario[] = loadScenarios();

const stepHandlers: Record<string, (
    step: import('../src/scenario/loader').StepData,
    stepIndex: number,
    stepName: string,
    request: import('@playwright/test').APIRequestContext
) => Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }>> = {
    [ScenarioType.CALCULATOR]: executeCalcStep
};

test.describe('All Tests', (): void => {
    test.beforeAll(async (): Promise<void> => {
        const scenariosData: ScenarioData[] = scenarios.map(s => s.rawData);
        await attachScenarioInfo(scenariosData as unknown as Record<string, unknown>[], true);
    });

    scenarios.forEach((scenario: Scenario) => {
        const steps: StepData[] = scenario.steps;
        const testNamePrefix = 'API';

        const testName = `${testNamePrefix} - ${scenario.scenarioName}`;

        test(testName, async ({request}, testInfo: TestInfo):Promise<void> => {
            testInfo.setTimeout(config.test.timeout_ms);

            stepDataRegistry.clear();

            await test.step('Attach Scenario JSON', async ():Promise<void> => {
                await attachScenarioInfo([scenario.rawData as unknown as Record<string, unknown>], false);
            });

            testInfo.annotations.push(
                {type: 'feature', description: 'API Tests'},
                {type: 'story', description: 'Calculator Endpoint'},
                {type: 'parameter', description: JSON.stringify({name: 'scenarioName', value: scenario.scenarioName})},
                {type: 'parameter', description: JSON.stringify({name: 'stepsCount', value: String(steps.length)})}
            );

            for (let stepIndex = 0; stepIndex < steps.length; stepIndex++) {
                const step: StepData = steps[stepIndex];
                const stepName: string = step.stepName || `Step ${stepIndex + 1}`;
                const handler: (step: import('../src/scenario/loader').StepData, stepIndex: number, stepName: string, request: import('@playwright/test').APIRequestContext) => Promise<{
                    requestBody: Record<string, unknown>;
                    responseBody: Record<string, unknown>
                }> = stepHandlers[step.stepType];

                if (!handler) {
                    throw new Error(`Unsupported stepType in step ${stepIndex + 1}: ${step.stepType}`);
                }

                await test.step(`Step ${stepIndex + 1}: ${stepName}`, async ():Promise<void> => {
                    testInfo.annotations.push(
                        {
                            type: 'parameter',
                            description: JSON.stringify({name: `step${stepIndex + 1}_type`, value: step.stepType})
                        },
                        {
                            type: 'parameter',
                            description: JSON.stringify({
                                name: `step${stepIndex + 1}_returnCode`,
                                value: String(step.returnCode)
                            })
                        },
                        {
                            type: 'parameter',
                            description: JSON.stringify({
                                name: `step${stepIndex + 1}_hasAttachment`,
                                value: String(hasStepAttachments(step))
                            })
                        },
                        {
                            type: 'parameter',
                            description: JSON.stringify({
                                name: `step${stepIndex + 1}_dataHandlerName`,
                                value: step.dataHandlerName ?? 'none'
                            })
                        }
                    );

                    const result: { requestBody: Record<string, unknown>; responseBody: Record<string, unknown> } = await handler(step, stepIndex, stepName, request);

                    if (step.dataHandlerName) {
                        stepDataRegistry.set(step.dataHandlerName, {
                            requestBody: result.requestBody,
                            responseBody: result.responseBody
                        });
                    }
                });
            }
        });
    });
});
