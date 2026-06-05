import { expect as pwExpect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

export async function assertLocatorVisible(locator: Locator, description: string, timeoutMs?: number): Promise<void> {
  void description;
  await pwExpect(locator).toBeVisible({ timeout: timeoutMs });
}

export async function assertLocatorText(
  locator: Locator,
  expected: string,
  description: string,
  timeoutMs?: number
): Promise<void> {
  void description;
  await pwExpect(locator).toHaveText(expected, { timeout: timeoutMs });
}

export async function assertLocatorContainsText(
  locator: Locator,
  expected: string,
  description: string,
  timeoutMs?: number
): Promise<void> {
  void description;
  await pwExpect(locator).toContainText(expected, { timeout: timeoutMs });
}

export async function assertLocatorValue(
  locator: Locator,
  expected: string,
  description: string,
  timeoutMs?: number
): Promise<void> {
  void description;
  await pwExpect(locator).toHaveValue(expected, { timeout: timeoutMs });
}

export async function assertPageUrl(
  page: Page,
  expected: string,
  description: string,
  timeoutMs?: number
): Promise<void> {
  void description;
  await pwExpect(page).toHaveURL(expected, { timeout: timeoutMs });
}
