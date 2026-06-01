import {expect as pwExpect, Locator, Page} from '@playwright/test';
import type {StepData} from '../../scenario/loader';
import type {BrowserAdditionalData, BrowserInstruction, BrowserSelector, BrowserScreenshotConfig} from './types';
import {stepDataRegistry} from '../../scenario/data/registry';
import {isReference, resolveReference} from '../../scenario/data/resolve';
import {attachScreenshot} from '../../allure/helpers';
import {config} from '../../config';
import {resolveHostRef} from '../../scenario/loader';

function resolveString(value?: string): string | undefined {
    if (!value) {
        return value;
    }
    return isReference(value) ? String(resolveReference(value)) : value;
}

function toLocator(page: Page, selector: BrowserSelector):Locator {
    switch (selector.kind) {
        case 'role':
            return page.getByRole(selector.role as never, {name: selector.name, exact: selector.exact});
        case 'label':
            return page.getByLabel(selector.text, {exact: selector.exact});
        case 'testId':
            return page.getByTestId(selector.value);
        case 'text':
            return page.getByText(selector.value, {exact: selector.exact});
        case 'css':
            return page.locator(selector.value);
        case 'xpath':
            return page.locator(`xpath=${selector.value}`);
    }
}

function parseAdditionalData(step: StepData): BrowserAdditionalData {
    const data = step.additionalData as BrowserAdditionalData | undefined;
    if (!data || !Array.isArray(data.instructions)) {
        throw new Error('BROWSER step requires additionalData.instructions array');
    }
    return data;
}

function resolveBrowserUrl(target: string, step: StepData, additionalData: BrowserAdditionalData): string {
    if (/^https?:\/\//.test(target)) {
        return target;
    }
    const hostFromRef: string | undefined = resolveHostRef(step.hostRef, config);
    const baseUrl: string | undefined = hostFromRef ?? additionalData.baseUrl;
    return baseUrl ? `${baseUrl}${target}` : target;
}

function getScreenshotConfig(data: BrowserAdditionalData): Required<BrowserScreenshotConfig> {
    return {
        enabled: data.screenshot?.enabled ?? false,
        mode: data.screenshot?.mode ?? 'manualOnly',
        fullPage: data.screenshot?.fullPage ?? false,
        namePrefix: data.screenshot?.namePrefix ?? 'browser'
    };
}

async function captureAndAttachScreenshot(
    page: Page,
    title: string,
    fullPage: boolean
): Promise<void> {
    const screenshot: Buffer<ArrayBufferLike> = await page.screenshot({fullPage});
    await attachScreenshot(title, screenshot);
}

export async function executeBrowserStep(
    step: StepData,
    stepIndex: number,
    stepName: string,
    _request: import('@playwright/test').APIRequestContext,
    page?: Page
): Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }> {
    if (!page) {
        throw new Error('BROWSER step requires Playwright page context');
    }
    const additionalData: BrowserAdditionalData = parseAdditionalData(step);
    const screenshotConfig: Required<BrowserScreenshotConfig> = getScreenshotConfig(additionalData);
    const extractedValues: Record<string, unknown> = {};

    for (let idx = 0; idx < additionalData.instructions.length; idx++) {
        const instruction = additionalData.instructions[idx] as BrowserInstruction;
        if (instruction.kind === 'action') {
            switch (instruction.action) {
                case 'goto': {
                    const target: string | undefined = resolveString(instruction.value);
                    if (!target) throw new Error(`Step ${stepIndex + 1} (${stepName}): goto requires value`);
                    const url: string = resolveBrowserUrl(target, step, additionalData);
                    await page.goto(url);
                    break;
                }
                case 'click': {
                    if (!instruction.selector) throw new Error('click requires selector');
                    await toLocator(page, instruction.selector).click({timeout: instruction.timeoutMs});
                    break;
                }
                case 'fill': {
                    if (!instruction.selector) throw new Error('fill requires selector');
                    await toLocator(page, instruction.selector).fill(resolveString(instruction.value) ?? '', {timeout: instruction.timeoutMs});
                    break;
                }
                case 'press': {
                    if (!instruction.selector || !instruction.key) throw new Error('press requires selector and key');
                    await toLocator(page, instruction.selector).press(instruction.key, {timeout: instruction.timeoutMs});
                    break;
                }
                case 'waitFor': {
                    if (!instruction.selector) throw new Error('waitFor requires selector');
                    await toLocator(page, instruction.selector).waitFor({timeout: instruction.timeoutMs});
                    break;
                }
                case 'screenshot': {
                    if (screenshotConfig.enabled) {
                        await captureAndAttachScreenshot(
                            page,
                            `${screenshotConfig.namePrefix} | ${stepName} | instruction-${idx + 1}`,
                            screenshotConfig.fullPage
                        );
                    }
                    break;
                }
            }
            continue;
        }

        if (instruction.kind === 'assertion') {
            switch (instruction.assertion) {
                case 'toHaveURL': {
                    const expectedTarget: string = resolveString(instruction.expected) ?? '';
                    const expectedUrl: string = resolveBrowserUrl(expectedTarget, step, additionalData);
                    try {
                        await pwExpect(page).toHaveURL(expectedUrl, {timeout: instruction.timeoutMs});
                    } catch (error) {
                        if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
                            await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`, screenshotConfig.fullPage);
                        }
                        throw error;
                    }
                    break;
                }
                case 'toBeVisible': {
                    if (!instruction.selector) throw new Error('toBeVisible requires selector');
                    try {
                        await pwExpect(toLocator(page, instruction.selector)).toBeVisible({timeout: instruction.timeoutMs});
                    } catch (error) {
                        if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
                            await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`, screenshotConfig.fullPage);
                        }
                        throw error;
                    }
                    break;
                }
                case 'toHaveText': {
                    if (!instruction.selector) throw new Error('toHaveText requires selector');
                    try {
                        await pwExpect(toLocator(page, instruction.selector)).toHaveText(resolveString(instruction.expected) ?? '', {timeout: instruction.timeoutMs});
                    } catch (error) {
                        if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
                            await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`, screenshotConfig.fullPage);
                        }
                        throw error;
                    }
                    break;
                }
                case 'toContainText': {
                    if (!instruction.selector) throw new Error('toContainText requires selector');
                    try {
                        await pwExpect(toLocator(page, instruction.selector)).toContainText(resolveString(instruction.expected) ?? '', {timeout: instruction.timeoutMs});
                    } catch (error) {
                        if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
                            await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`, screenshotConfig.fullPage);
                        }
                        throw error;
                    }
                    break;
                }
                case 'toHaveValue': {
                    if (!instruction.selector) throw new Error('toHaveValue requires selector');
                    try {
                        await pwExpect(toLocator(page, instruction.selector)).toHaveValue(resolveString(instruction.expected) ?? '', {timeout: instruction.timeoutMs});
                    } catch (error) {
                        if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
                            await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`, screenshotConfig.fullPage);
                        }
                        throw error;
                    }
                    break;
                }
            }
            continue;
        }

        if (instruction.kind === 'extract') {
            switch (instruction.extract) {
                case 'url':
                    extractedValues[instruction.saveAs] = page.url();
                    break;
                case 'textContent': {
                    if (!instruction.selector) throw new Error('textContent extract requires selector');
                    extractedValues[instruction.saveAs] = await toLocator(page, instruction.selector).textContent();
                    break;
                }
                case 'inputValue': {
                    if (!instruction.selector) throw new Error('inputValue extract requires selector');
                    extractedValues[instruction.saveAs] = await toLocator(page, instruction.selector).inputValue();
                    break;
                }
                case 'href': {
                    if (!instruction.selector) throw new Error('href extract requires selector');
                    extractedValues[instruction.saveAs] = await toLocator(page, instruction.selector).getAttribute('href');
                    break;
                }
            }
        }
    }

    if (screenshotConfig.enabled && screenshotConfig.mode === 'onStepEnd') {
        await captureAndAttachScreenshot(page, `${screenshotConfig.namePrefix} | ${stepName} | step-end`, screenshotConfig.fullPage);
    }

    return {
        requestBody: {
            instructionsCount: additionalData.instructions.length
        },
        responseBody: {
            currentUrl: page.url(),
            extracted: extractedValues
        }
    };
}

export function storeBrowserStepDataIfNeeded(step: StepData, result: { requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }): void {
    if (step.dataHandlerName) {
        stepDataRegistry.set(step.dataHandlerName, {
            requestBody: result.requestBody,
            responseBody: result.responseBody
        });
    }
}
