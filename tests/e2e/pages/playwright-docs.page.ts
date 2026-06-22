import type { Locator, Page } from '@playwright/test';
import { BasePage } from './base.page';

/**
 * Page Object covering the Playwright documentation site (`playwright.dev`).
 *
 * Exposes locators and high-level navigation helpers used by classic E2E tests.
 */
export class PlaywrightDocsPage extends BasePage {
  /**
   * @param page - Playwright page controlled by the page object.
   * @param baseUrl - Absolute base URL of the documentation site.
   */
  constructor(page: Page, baseUrl: string) {
    super(page, baseUrl);
  }

  /** Locator for the primary `Docs` navigation link. */
  docsLink(): Locator {
    return this.page.getByRole('link', { name: 'Docs' }).first();
  }

  /** Opens the site home page and waits for it to become interactive. */
  async openHome(): Promise<void> {
    await this.goto('/');
    await this.waitForReady();
  }

  /** Clicks the `Docs` link and waits until the docs URL is active. */
  async openDocs(): Promise<void> {
    await this.docsLink().click();
    await this.page.waitForURL(/\/docs/);
    await this.waitForReady();
  }
}
