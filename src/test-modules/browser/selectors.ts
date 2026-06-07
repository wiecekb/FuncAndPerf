import { config } from '../../config';
import type { BrowserSelector, BrowserSelectorInput } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isBrowserSelector(value: unknown): value is BrowserSelector {
  if (!isRecord(value)) {
    return false;
  }

  switch (value.kind) {
    case 'role':
      return typeof value.role === 'string';
    case 'label':
      return typeof value.text === 'string';
    case 'testId':
    case 'text':
    case 'css':
    case 'xpath':
      return typeof value.value === 'string';
    default:
      return false;
  }
}

export function resolveBrowserSelectorReference(reference: string): BrowserSelector {
  const parts: string[] = reference.split('.').filter(Boolean);
  if (parts.length === 0) {
    throw new Error('Browser selector reference cannot be empty');
  }

  let current: unknown = config.browser.selectors;
  for (const part of parts) {
    if (!isRecord(current) || !Object.prototype.hasOwnProperty.call(current, part)) {
      throw new Error(`Browser selector reference '${reference}' not found in config.yaml browser.selectors`);
    }
    current = current[part];
  }

  if (!isBrowserSelector(current)) {
    throw new Error(`Browser selector reference '${reference}' does not point to a valid browser selector`);
  }

  return current;
}

export function resolveBrowserSelector(selector: BrowserSelectorInput): BrowserSelector {
  return typeof selector === 'string' ? resolveBrowserSelectorReference(selector) : selector;
}
