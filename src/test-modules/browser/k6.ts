import type { StepData } from '../../scenario/loader';
import type { K6BrowserStepGenerator, K6BrowserGeneratorContext } from '../../k6/interface';
import type { BrowserAdditionalData, BrowserInstruction } from './types';
import { escapeJsString } from '../../k6/common';
import { getStepInstanceName } from '../../scenario/instances';
import { selectorToLocatorExpr } from './codegen';

function generateInstructionLines(
  instruction: BrowserInstruction,
  stepName: string,
  stepIndex: number,
  stepBaseUrlVarName: string
): string[] {
  const lines: string[] = [];

  if (instruction.kind === 'action') {
    switch (instruction.action) {
      case 'goto': {
        lines.push(
          `await page.goto(resolveUrl(resolveValue('${escapeJsString(instruction.value || '')}'), ${stepBaseUrlVarName}));`
        );
        break;
      }
      case 'click': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.click({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'fill': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.fill(resolveValue('${escapeJsString(instruction.value || '')}'), { timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'press': {
        if (!instruction.selector || !instruction.key) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.press('${escapeJsString(instruction.key)}', { timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'waitFor': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        break;
      }
      case 'screenshot': {
        lines.push('if (screenshotsEnabled()) {');
        lines.push(
          `  await page.screenshot({ path: 'results/k6-browser/${stepIndex + 1}-${escapeJsString(stepName)}-manual.png' });`
        );
        lines.push('}');
        break;
      }
    }
    return lines;
  }

  if (instruction.kind === 'assertion') {
    switch (instruction.assertion) {
      case 'toHaveURL': {
        lines.push('await page.waitForTimeout(300);');
        lines.push(
          `check(page.url(), { 'url matches': (u) => urlMatches(u, resolveValue('${escapeJsString(instruction.expected || '')}')) });`
        );
        break;
      }
      case 'toBeVisible': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.isVisible(), { 'element visible': (v) => v === true });`
        );
        break;
      }
      case 'toHaveText': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text equals': (t) => (t || '').trim() === resolveValue('${escapeJsString(instruction.expected || '')}') });`
        );
        break;
      }
      case 'toContainText': {
        if (!instruction.selector) break;
        lines.push(
          `await ${selectorToLocatorExpr(instruction.selector)}.waitFor({ timeout: ${instruction.timeoutMs ?? 10000} });`
        );
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.textContent(), { 'text contains': (t) => (t || '').includes(resolveValue('${escapeJsString(instruction.expected || '')}')) });`
        );
        break;
      }
      case 'toHaveValue': {
        if (!instruction.selector) break;
        lines.push(
          `check(await ${selectorToLocatorExpr(instruction.selector)}.inputValue(), { 'value equals': (v) => v === resolveValue('${escapeJsString(instruction.expected || '')}') });`
        );
        break;
      }
    }
    return lines;
  }

  if (instruction.kind === 'extract') {
    switch (instruction.extract) {
      case 'url':
        lines.push(`ctx['${escapeJsString(instruction.saveAs)}'] = page.url();`);
        break;
      case 'textContent':
        if (instruction.selector) {
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.textContent();`
          );
        }
        break;
      case 'inputValue':
        if (instruction.selector) {
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.inputValue();`
          );
        }
        break;
      case 'href':
        if (instruction.selector) {
          lines.push(
            `ctx['${escapeJsString(instruction.saveAs)}'] = await ${selectorToLocatorExpr(instruction.selector)}.getAttribute('href');`
          );
        }
        break;
    }
  }

  return lines;
}

/**
 * k6 browser generator for browser steps.
 *
 * Emits the JavaScript fragments that resolve the page for the step instance,
 * compute the base URL and translate every {@link BrowserInstruction} into k6
 * browser-API calls using {@link selectorToLocatorExpr}.
 */
export class BrowserK6Generator implements K6BrowserStepGenerator {
  readonly stepType: string;

  /**
   * @param stepType - Discriminator value (typically {@link ScenarioType.BROWSER}).
   */
  constructor(stepType: string) {
    this.stepType = stepType;
  }

  /**
   * Emits the k6 browser instructions performing the UI actions for the step.
   *
   * @param step - Step being generated.
   * @param ctx - Active generation context.
   */
  generateBrowserInstructions(step: StepData, ctx: K6BrowserGeneratorContext): string[] {
    const additionalData = step.additionalData as BrowserAdditionalData | undefined;
    if (!additionalData?.instructions) return [];

    const stepName: string = step.stepName || `Step ${ctx.stepVarName(0)}`;
    const stepInstanceName: string = getStepInstanceName(step);
    const stepBaseUrlVarName = `currentStepBaseUrl_${ctx.stepVarName(0)}`;

    const lines: string[] = [];

    lines.push(`      console.log('Step: ${escapeJsString(stepName)} [${escapeJsString(stepInstanceName)}]');`);
    lines.push(`      const page = await getPageForStepInstance('${escapeJsString(stepInstanceName)}');`);
    const browserBaseUrlExpr: string = additionalData.baseUrl
      ? `'${escapeJsString(additionalData.baseUrl)}'`
      : step.hostRef
        ? `HOSTS['${escapeJsString(step.hostRef)}']`
        : 'undefined';
    lines.push(`      const ${stepBaseUrlVarName} = ${browserBaseUrlExpr};`);

    for (let ii = 0; ii < additionalData.instructions.length; ii++) {
      const instruction = additionalData.instructions[ii] as BrowserInstruction;
      const generated: string[] = generateInstructionLines(
        instruction,
        stepName,
        parseInt(ctx.stepVarName(0)),
        stepBaseUrlVarName
      );
      for (const line of generated) {
        lines.push(`      ${line}`);
      }
    }

    return lines;
  }
}
