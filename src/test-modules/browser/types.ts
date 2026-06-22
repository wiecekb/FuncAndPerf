/**
 * Discriminated union describing a resolved browser selector.
 *
 * Each variant maps to a Playwright locator strategy (role, label, testId,
 * text, css or xpath).
 */
export type BrowserSelector =
  | { kind: 'role'; role: string; name?: string; exact?: boolean }
  | { kind: 'label'; text: string; exact?: boolean }
  | { kind: 'testId'; value: string }
  | { kind: 'text'; value: string; exact?: boolean }
  | { kind: 'css'; value: string }
  | { kind: 'xpath'; value: string };

/**
 * Dotted path referencing a selector declared under `config.browser.selectors`
 * (e.g. `login.usernameInput`).
 */
export type BrowserSelectorReference = string;

/** Selector value accepted by instructions: either inline or a named reference. */
export type BrowserSelectorInput = BrowserSelector | BrowserSelectorReference;

/**
 * Instruction performing an action on the page (navigation, click, fill, key
 * press, wait or screenshot).
 */
export type BrowserActionInstruction = {
  kind: 'action';
  action: 'goto' | 'click' | 'fill' | 'press' | 'waitFor' | 'screenshot';
  selector?: BrowserSelectorInput;
  value?: string;
  timeoutMs?: number;
  key?: string;
};

/**
 * Instruction asserting a condition on a locator or the page itself.
 */
export type BrowserAssertionInstruction = {
  kind: 'assertion';
  assertion: 'toBeVisible' | 'toHaveText' | 'toHaveValue' | 'toContainText' | 'toHaveURL';
  selector?: BrowserSelectorInput;
  expected?: string;
  timeoutMs?: number;
};

/**
 * Instruction extracting a value from the page into the step context under
 * `saveAs`.
 */
export type BrowserExtractInstruction = {
  kind: 'extract';
  extract: 'textContent' | 'inputValue' | 'href' | 'url';
  selector?: BrowserSelectorInput;
  saveAs: string;
};

/** Discriminated union of all browser instructions. */
export type BrowserInstruction =
  | BrowserActionInstruction
  | BrowserAssertionInstruction
  | BrowserExtractInstruction;

/** Strategy controlling when screenshots are captured during a browser step. */
export type BrowserScreenshotMode = 'manualOnly' | 'onStepEnd' | 'onAssertionFail';

/** Configuration of screenshot capture for a browser step. */
export type BrowserScreenshotConfig = {
  /** Whether screenshots are enabled at all. */
  enabled: boolean;
  /** When screenshots should be taken. */
  mode?: BrowserScreenshotMode;
  /** Whether to capture the full scrollable page. */
  fullPage?: boolean;
  /** Optional prefix applied to screenshot file names. */
  namePrefix?: string;
};

/** Additional data carried by a browser step. */
export type BrowserAdditionalData = {
  /** Ordered instructions to execute. */
  instructions: BrowserInstruction[];
  /** Optional base URL overriding the host reference for this step. */
  baseUrl?: string;
  /** Optional screenshot configuration. */
  screenshot?: BrowserScreenshotConfig;
};
