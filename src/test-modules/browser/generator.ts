import { expect as pwExpect, Locator, Page } from '@playwright/test';
import type { StepData } from '../../scenario/loader';
import type { BrowserAdditionalData, BrowserInstruction, BrowserSelectorInput, BrowserScreenshotConfig } from './types';
import { StepDataRecord, stepDataRegistry } from '../../scenario/data/registry';
import { isReference, resolveReference } from '../../scenario/data/resolve';
import { attachScreenshot } from '../../allure/helpers';
import { config } from '../../config';
import { resolveHostRef } from '../../scenario/loader';
import type { ScenarioExecutionContext } from '../../scenario/execution-context';
import { resolveBrowserSelector } from './selectors';

const BROWSER_CTX_HANDLER_NAME = '__browserCtx';

function resolveBrowserCtxReference(value: string): string | undefined {
  const match: RegExpMatchArray | null = value.match(/^\$\{ctx\.([a-zA-Z0-9_]+)}$/);
  if (!match) {
    return undefined;
  }

  const ctxRecord: StepDataRecord | undefined = stepDataRegistry.get(BROWSER_CTX_HANDLER_NAME);
  const ctx = ctxRecord?.sources.context as Record<string, unknown> | undefined;
  if (!ctx || !Object.prototype.hasOwnProperty.call(ctx, match[1])) {
    throw new Error(
      `Browser ctx reference "${value}" not found. Make sure a previous BROWSER extract saved "${match[1]}".`
    );
  }

  return String(ctx[match[1]]);
}

function storeBrowserCtxValues(values: Record<string, unknown>): void {
  const current = (stepDataRegistry.get(BROWSER_CTX_HANDLER_NAME)?.sources.context ?? {}) as Record<string, unknown>;
  stepDataRegistry.set(BROWSER_CTX_HANDLER_NAME, {
    sources: {
      context: {
        ...current,
        ...values,
      },
    },
  });
}

function resolveString(value?: string): string | undefined {
  if (!value) {
    return value;
  }
  const ctxValue: string | undefined = resolveBrowserCtxReference(value);
  if (ctxValue !== undefined) {
    return ctxValue;
  }
  return isReference(value) ? String(resolveReference(value)) : value;
}

function toLocator(page: Page, selector: BrowserSelectorInput): Locator {
  const resolvedSelector = resolveBrowserSelector(selector);
  switch (resolvedSelector.kind) {
    case 'role':
      return page.getByRole(resolvedSelector.role as never, {
        name: resolvedSelector.name,
        exact: resolvedSelector.exact,
      });
    case 'label':
      return page.getByLabel(resolvedSelector.text, { exact: resolvedSelector.exact });
    case 'testId':
      return page.getByTestId(resolvedSelector.value);
    case 'text':
      return page.getByText(resolvedSelector.value, { exact: resolvedSelector.exact });
    case 'css':
      return page.locator(resolvedSelector.value);
    case 'xpath':
      return page.locator(`xpath=${resolvedSelector.value}`);
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
    namePrefix: data.screenshot?.namePrefix ?? 'browser',
  };
}

async function captureAndAttachScreenshot(page: Page, title: string, fullPage: boolean): Promise<void> {
  const screenshot: Buffer<ArrayBufferLike> = await page.screenshot({ fullPage });
  await attachScreenshot(title, screenshot);
}

export async function executeBrowserStep(
  step: StepData,
  stepIndex: number,
  stepName: string,
  _request: import('@playwright/test').APIRequestContext,
  page?: Page,
  executionContext?: ScenarioExecutionContext
): Promise<{ requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }> {
  const activePage: Page | undefined = executionContext ? await executionContext.getBrowserPage(step) : page;
  if (!activePage) {
    throw new Error('BROWSER step requires Playwright page context');
  }
  const additionalData: BrowserAdditionalData = parseAdditionalData(step);
  const screenshotConfig: Required<BrowserScreenshotConfig> = getScreenshotConfig(additionalData);
  const extractedValues: Record<string, unknown> = {};

  for (let idx: number = 0; idx < additionalData.instructions.length; idx++) {
    const instruction = additionalData.instructions[idx] as BrowserInstruction;
    if (instruction.kind === 'action') {
      switch (instruction.action) {
        case 'goto': {
          const target: string | undefined = resolveString(instruction.value);
          if (!target) throw new Error(`Step ${stepIndex + 1} (${stepName}): goto requires value`);
          const url: string = resolveBrowserUrl(target, step, additionalData);
          await activePage.goto(url, { timeout: instruction.timeoutMs });
          break;
        }
        case 'click': {
          if (!instruction.selector) throw new Error('click requires selector');
          await toLocator(activePage, instruction.selector).click({ timeout: instruction.timeoutMs });
          break;
        }
        case 'fill': {
          if (!instruction.selector) throw new Error('fill requires selector');
          await toLocator(activePage, instruction.selector).fill(resolveString(instruction.value) ?? '', {
            timeout: instruction.timeoutMs,
          });
          break;
        }
        case 'press': {
          if (!instruction.selector || !instruction.key) throw new Error('press requires selector and key');
          await toLocator(activePage, instruction.selector).press(instruction.key, { timeout: instruction.timeoutMs });
          break;
        }
        case 'waitFor': {
          if (!instruction.selector) throw new Error('waitFor requires selector');
          await toLocator(activePage, instruction.selector).waitFor({ timeout: instruction.timeoutMs });
          break;
        }
        case 'screenshot': {
          if (screenshotConfig.enabled) {
            await captureAndAttachScreenshot(
              activePage,
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
            await pwExpect(activePage).toHaveURL(expectedUrl, { timeout: instruction.timeoutMs });
          } catch (error) {
            if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
              await captureAndAttachScreenshot(
                activePage,
                `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`,
                screenshotConfig.fullPage
              );
            }
            throw error;
          }
          break;
        }
        case 'toBeVisible': {
          if (!instruction.selector) throw new Error('toBeVisible requires selector');
          try {
            await pwExpect(toLocator(activePage, instruction.selector)).toBeVisible({ timeout: instruction.timeoutMs });
          } catch (error) {
            if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
              await captureAndAttachScreenshot(
                activePage,
                `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`,
                screenshotConfig.fullPage
              );
            }
            throw error;
          }
          break;
        }
        case 'toHaveText': {
          if (!instruction.selector) throw new Error('toHaveText requires selector');
          try {
            await pwExpect(toLocator(activePage, instruction.selector)).toHaveText(
              resolveString(instruction.expected) ?? '',
              { timeout: instruction.timeoutMs }
            );
          } catch (error) {
            if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
              await captureAndAttachScreenshot(
                activePage,
                `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`,
                screenshotConfig.fullPage
              );
            }
            throw error;
          }
          break;
        }
        case 'toContainText': {
          if (!instruction.selector) throw new Error('toContainText requires selector');
          try {
            await pwExpect(toLocator(activePage, instruction.selector)).toContainText(
              resolveString(instruction.expected) ?? '',
              { timeout: instruction.timeoutMs }
            );
          } catch (error) {
            if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
              await captureAndAttachScreenshot(
                activePage,
                `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`,
                screenshotConfig.fullPage
              );
            }
            throw error;
          }
          break;
        }
        case 'toHaveValue': {
          if (!instruction.selector) throw new Error('toHaveValue requires selector');
          try {
            await pwExpect(toLocator(activePage, instruction.selector)).toHaveValue(
              resolveString(instruction.expected) ?? '',
              { timeout: instruction.timeoutMs }
            );
          } catch (error) {
            if (screenshotConfig.enabled && screenshotConfig.mode === 'onAssertionFail') {
              await captureAndAttachScreenshot(
                activePage,
                `${screenshotConfig.namePrefix} | ${stepName} | assertion-fail-${idx + 1}`,
                screenshotConfig.fullPage
              );
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
          extractedValues[instruction.saveAs] = activePage.url();
          break;
        case 'textContent': {
          if (!instruction.selector) throw new Error('textContent extract requires selector');
          extractedValues[instruction.saveAs] = await toLocator(activePage, instruction.selector).textContent();
          break;
        }
        case 'inputValue': {
          if (!instruction.selector) throw new Error('inputValue extract requires selector');
          extractedValues[instruction.saveAs] = await toLocator(activePage, instruction.selector).inputValue();
          break;
        }
        case 'href': {
          if (!instruction.selector) throw new Error('href extract requires selector');
          extractedValues[instruction.saveAs] = await toLocator(activePage, instruction.selector).getAttribute('href');
          break;
        }
      }
    }
  }

  if (Object.keys(extractedValues).length > 0) {
    storeBrowserCtxValues(extractedValues);
  }

  if (screenshotConfig.enabled && screenshotConfig.mode === 'onStepEnd') {
    await captureAndAttachScreenshot(
      activePage,
      `${screenshotConfig.namePrefix} | ${stepName} | step-end`,
      screenshotConfig.fullPage
    );
  }

  return {
    requestBody: {
      instructionsCount: additionalData.instructions.length,
    },
    responseBody: {
      currentUrl: activePage.url(),
      extracted: extractedValues,
    },
  };
}

export function storeBrowserStepDataIfNeeded(
  step: StepData,
  result: { requestBody: Record<string, unknown>; responseBody: Record<string, unknown> }
): void {
  if (step.dataHandlerName) {
    stepDataRegistry.set(step.dataHandlerName, {
      sources: {
        request: result.requestBody,
        response: result.responseBody,
      },
    });
  }
}
