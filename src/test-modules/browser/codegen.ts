import type { BrowserSelectorInput } from './types';
import { resolveBrowserSelector } from './selectors';
import { escapeJsString } from '../../common/codegen';

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
