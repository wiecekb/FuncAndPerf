import type {
  BrowserActionInstruction,
  BrowserAssertionInstruction,
  BrowserExtractInstruction,
  BrowserInstruction,
} from './types';
import { escapeJsString } from '../../common/codegen';
import { selectorToLocatorExpr } from './codegen';

function timeout(instruction: { timeoutMs?: number }): number {
  return instruction.timeoutMs ?? 10000;
}

function resolveValueExpr(value: string | undefined): string {
  return `resolveValue('${escapeJsString(value || '')}')`;
}

function locatorCall(
  instruction: { selector?: BrowserActionInstruction['selector'] | BrowserAssertionInstruction['selector'] },
  methodCall: (locator: string) => string
): string[] {
  if (!instruction.selector) return [];
  return [methodCall(selectorToLocatorExpr(instruction.selector))];
}

function locatorLines(
  instruction: { selector?: BrowserActionInstruction['selector'] | BrowserAssertionInstruction['selector'] },
  buildLines: (locator: string) => string[]
): string[] {
  if (!instruction.selector) return [];
  return buildLines(selectorToLocatorExpr(instruction.selector));
}

function ctxAssignment(saveAs: string, valueExpression: string): string {
  return `ctx['${escapeJsString(saveAs)}'] = ${valueExpression};`;
}

function generateActionInstructionLines(
  instruction: BrowserActionInstruction,
  stepName: string,
  stepIndex: number,
  stepBaseUrlVarName: string
): string[] {
  switch (instruction.action) {
    case 'goto':
      return [`await page.goto(resolveUrl(${resolveValueExpr(instruction.value)}, ${stepBaseUrlVarName}));`];
    case 'click':
      return locatorCall(
        instruction,
        (locator: string): string => `await ${locator}.click({ timeout: ${timeout(instruction)} });`
      );
    case 'fill':
      return locatorCall(
        instruction,
        (locator: string): string =>
          `await ${locator}.fill(${resolveValueExpr(instruction.value)}, { timeout: ${timeout(instruction)} });`
      );
    case 'press': {
      if (!instruction.key) return [];
      const key: string = instruction.key;
      return locatorCall(
        instruction,
        (locator: string): string =>
          `await ${locator}.press('${escapeJsString(key)}', { timeout: ${timeout(instruction)} });`
      );
    }
    case 'waitFor':
      return locatorCall(
        instruction,
        (locator: string): string => `await ${locator}.waitFor({ timeout: ${timeout(instruction)} });`
      );
    case 'screenshot':
      return [
        'if (screenshotsEnabled()) {',
        `  await page.screenshot({ path: 'results/k6-browser/${stepIndex + 1}-${escapeJsString(stepName)}-manual.png' });`,
        '}',
      ];
  }
}

function generateAssertionInstructionLines(instruction: BrowserAssertionInstruction): string[] {
  switch (instruction.assertion) {
    case 'toHaveURL':
      return [
        'await page.waitForTimeout(300);',
        `check(page.url(), { 'url matches': (u) => urlMatches(u, ${resolveValueExpr(instruction.expected)}) });`,
      ];
    case 'toBeVisible':
      return locatorCall(
        instruction,
        (locator: string): string => `check(await ${locator}.isVisible(), { 'element visible': (v) => v === true });`
      );
    case 'toHaveText':
      return locatorCall(
        instruction,
        (locator: string): string =>
          `check(await ${locator}.textContent(), { 'text equals': (t) => (t || '').trim() === ${resolveValueExpr(instruction.expected)} });`
      );
    case 'toContainText':
      return locatorLines(instruction, (locator: string): string[] => [
        `await ${locator}.waitFor({ timeout: ${timeout(instruction)} });`,
        `check(await ${locator}.textContent(), { 'text contains': (t) => (t || '').includes(${resolveValueExpr(instruction.expected)}) });`,
      ]);
    case 'toHaveValue':
      return locatorCall(
        instruction,
        (locator: string): string =>
          `check(await ${locator}.inputValue(), { 'value equals': (v) => v === ${resolveValueExpr(instruction.expected)} });`
      );
  }
}

function generateExtractInstructionLines(instruction: BrowserExtractInstruction): string[] {
  switch (instruction.extract) {
    case 'url':
      return [ctxAssignment(instruction.saveAs, 'page.url()')];
    case 'textContent':
      return locatorCall(instruction, (locator: string): string =>
        ctxAssignment(instruction.saveAs, `await ${locator}.textContent()`)
      );
    case 'inputValue':
      return locatorCall(instruction, (locator: string): string =>
        ctxAssignment(instruction.saveAs, `await ${locator}.inputValue()`)
      );
    case 'href':
      return locatorCall(instruction, (locator: string): string =>
        ctxAssignment(instruction.saveAs, `await ${locator}.getAttribute('href')`)
      );
  }
}

/**
 * Translates a single {@link BrowserInstruction} into k6 browser-API code lines,
 * mirroring the behaviour of {@link executeBrowserStep} for the generated
 * performance scripts.
 *
 * @param instruction - Instruction to translate.
 * @param stepName
 * @param stepIndex
 * @param stepBaseUrlVarName
 * @returns Generated JavaScript code lines.
 */
export function generateInstructionLines(
  instruction: BrowserInstruction,
  stepName: string,
  stepIndex: number,
  stepBaseUrlVarName: string
): string[] {
  if (instruction.kind === 'action') {
    return generateActionInstructionLines(instruction, stepName, stepIndex, stepBaseUrlVarName);
  }

  if (instruction.kind === 'assertion') {
    return generateAssertionInstructionLines(instruction);
  }

  return generateExtractInstructionLines(instruction);
}
