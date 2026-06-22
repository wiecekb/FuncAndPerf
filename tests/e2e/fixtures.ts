import {
  expect,
  test as base,
  type Page,
  TestType,
  PlaywrightTestArgs,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs, PlaywrightWorkerOptions
} from '@playwright/test';
import { config } from '../../src';
import { attachScreenshot } from '../../src';
import { expectWithDescription } from '../../src';

type LoggedExpect = typeof expectWithDescription;

/**
 * Strategy controlling when screenshots are captured and attached to Allure.
 *
 * - `'always'` — every call to {@link CaptureScreenshot} captures and attaches the image.
 * - `'never'`  — calls are ignored (no I/O, no Allure attachment).
 */
export type ScreenshotStrategy = 'always' | 'never';

/**
 * Resolves the screenshot strategy for the current run.
 *
 * The strategy is derived, in priority order, from:
 * 1. `E2E_SCREENSHOTS` environment variable (explicit override).
 * 2. Playwright debug flags (`PWDEBUG`/`HEADED`) — set automatically by `--debug`/`--headed`.
 * 3. Default: `'never'` (headless runs produce no screenshots).
 *
 * @returns Resolved screenshot strategy.
 */
export function resolveScreenshotStrategy(): ScreenshotStrategy {
  const explicitOverride: string | undefined = process.env.E2E_SCREENSHOTS;
  if (explicitOverride !== undefined) {
    const normalized: string = explicitOverride.toLowerCase();
    if (normalized === 'on' || normalized === 'always' || normalized === '1' || normalized === 'true') {
      return 'always';
    }
    return 'never';
  }

  const debugActive: boolean = process.env.PWDEBUG === '1' || process.env.PWDEBUG === 'true';
  const headedActive: boolean = process.env.HEADED === '1' || process.env.HEADED === 'true';
  return debugActive || headedActive ? 'always' : 'never';
}

/**
 * Builds a screenshot helper bound to `page` that honours `strategy`.
 *
 * @param page - Playwright page used to capture screenshots.
 * @param strategy - Screenshot strategy controlling whether captures are attached.
 * @returns Function attaching (or skipping) the screenshot in the Allure report.
 */
export function buildScreenshotHelper(
  page: Page,
  strategy: ScreenshotStrategy
): (name: string, fullPage?: boolean) => Promise<void> {
  return async (name: string, fullPage: boolean = true): Promise<void> => {
    if (strategy === 'never') {
      return;
    }
    const screenshot: Buffer = await page.screenshot({ fullPage });
    await attachScreenshot(name, screenshot);
  };
}

/** Fixture exposing the resolved frontend base URL taken from `config.hosts.frontendMain`. */
export type FrontendBaseUrlFixture = string;

/** Fixture exposing the assertion logger shared with scenario-driven tests. */
export type LoggedExpectFixture = LoggedExpect;

/** Function attached to {@link CaptureScreenshotFixture}; captures only when the strategy is active. */
export type CaptureScreenshot = (name: string, fullPage?: boolean) => Promise<void>;

/** Fixture exposing a screenshot capture helper bound to the current page. */
export type CaptureScreenshotFixture = CaptureScreenshot;

/**
 * Custom fixtures shared by classic E2E tests.
 */
type E2EFixtures = {
  frontendBaseUrl: FrontendBaseUrlFixture;
  loggedExpect: LoggedExpectFixture;
  captureScreenshot: CaptureScreenshotFixture;
};

function resolveFrontendBaseUrl(): string {
  return config.hosts.frontendMain || 'https://playwright.dev';
}

export const test: TestType<PlaywrightTestArgs & PlaywrightTestOptions & E2EFixtures, PlaywrightWorkerArgs & PlaywrightWorkerOptions> = base.extend<E2EFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture factories must use object destructuring.
  frontendBaseUrl: async ({}, use): Promise<void> => {
    await use(resolveFrontendBaseUrl());
  },
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture factories must use object destructuring.
  loggedExpect: async ({}, use): Promise<void> => {
    await use(expectWithDescription);
  },
  captureScreenshot: async ({ page }, use): Promise<void> => {
    await use(buildScreenshotHelper(page, resolveScreenshotStrategy()));
  },
});

export { expect };
