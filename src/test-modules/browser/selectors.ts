import { config } from '../../config';
import type { BrowserSelector, BrowserSelectorInput } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Returns whether `value` is a valid {@link BrowserSelector}.
 *
 * @param value - Candidate value to test.
 */
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

/**
 * Resolves a dotted selector reference into a concrete {@link BrowserSelector}
 * by walking the {@link AppConfig.browser.selectors} tree.
 *
 * @param reference - Dotted path (e.g. `login.usernameInput`).
 * @returns The resolved selector.
 * @throws {Error} When the reference is empty, not found, or does not point to a valid selector.
 */
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

/**
 * Resolves a {@link BrowserSelectorInput} into a concrete
 * {@link BrowserSelector}, dereferencing named references when needed.
 *
 * @param selector - Inline selector or named reference.
 * @returns The resolved selector.
 */
export function resolveBrowserSelector(selector: BrowserSelectorInput): BrowserSelector {
  return typeof selector === 'string' ? resolveBrowserSelectorReference(selector) : selector;
}
