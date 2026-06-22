import type { BrowserSelectorInput } from './types';
import { resolveBrowserSelector } from './selectors';
import { escapeJsString } from '../../common/codegen';

/**
 * Translates a {@link BrowserSelectorInput} into a Playwright/k6 locator
 * expression (e.g. `page.getByRole('button', { ... })`).
 *
 * Named references are resolved first via {@link resolveBrowserSelector}.
 *
 * @param selector - Inline selector or named reference.
 * @returns Generated locator expression.
 */
export function selectorToLocatorExpr(selector: BrowserSelectorInput): string {
  const resolvedSelector = resolveBrowserSelector(selector);
  switch (resolvedSelector.kind) {
    case 'role':
      return `page.getByRole('${escapeJsString(resolvedSelector.role)}', { name: ${resolvedSelector.name ? `'${escapeJsString(resolvedSelector.name)}'` : 'undefined'}, exact: ${resolvedSelector.exact ?? false} })`;
    case 'label':
      return `page.getByLabel('${escapeJsString(resolvedSelector.text)}', { exact: ${resolvedSelector.exact ?? false} })`;
    case 'testId':
      return `page.getByTestId('${escapeJsString(resolvedSelector.value)}')`;
    case 'text':
      return `page.getByText('${escapeJsString(resolvedSelector.value)}', { exact: ${resolvedSelector.exact ?? false} })`;
    case 'css':
      return `page.locator('${escapeJsString(resolvedSelector.value)}')`;
    case 'xpath':
      return `page.locator('xpath=${escapeJsString(resolvedSelector.value)}')`;
  }
}
