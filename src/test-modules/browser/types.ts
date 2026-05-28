export type BrowserSelector =
    | { kind: 'role'; role: string; name?: string; exact?: boolean }
    | { kind: 'label'; text: string; exact?: boolean }
    | { kind: 'testId'; value: string }
    | { kind: 'text'; value: string; exact?: boolean }
    | { kind: 'css'; value: string }
    | { kind: 'xpath'; value: string };

export type BrowserActionInstruction = {
    kind: 'action';
    action: 'goto' | 'click' | 'fill' | 'press' | 'waitFor' | 'screenshot';
    selector?: BrowserSelector;
    value?: string;
    timeoutMs?: number;
    key?: string;
};

export type BrowserAssertionInstruction = {
    kind: 'assertion';
    assertion: 'toBeVisible' | 'toHaveText' | 'toHaveValue' | 'toContainText' | 'toHaveURL';
    selector?: BrowserSelector;
    expected?: string;
    timeoutMs?: number;
};

export type BrowserExtractInstruction = {
    kind: 'extract';
    extract: 'textContent' | 'inputValue' | 'href' | 'url';
    selector?: BrowserSelector;
    saveAs: string;
};

export type BrowserInstruction =
    | BrowserActionInstruction
    | BrowserAssertionInstruction
    | BrowserExtractInstruction;

export type BrowserScreenshotMode = 'manualOnly' | 'onStepEnd' | 'onAssertionFail';

export type BrowserScreenshotConfig = {
    enabled: boolean;
    mode?: BrowserScreenshotMode;
    fullPage?: boolean;
    namePrefix?: string;
};

export type BrowserAdditionalData = {
    instructions: BrowserInstruction[];
    baseUrl?: string;
    screenshot?: BrowserScreenshotConfig;
};
