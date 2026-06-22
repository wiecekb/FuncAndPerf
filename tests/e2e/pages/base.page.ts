import type { Locator, Page } from '@playwright/test';

/**
 * Base class for Page Objects used by classic E2E tests.
 *
 * Encapsulates URL resolution against a configured base URL and exposes small
 * helpers (navigation, wait, heading lookup) reused by concrete page classes.
 */
export class BasePage {
  /**
   * @param page - Playwright page controlled by the page object.
   * @param baseUrl - Absolute base URL used to resolve relative paths.
   */
  constructor(
    protected readonly page: Page,
    protected readonly baseUrl: string
  ) {}

  /**
   * Resolves `pathOrUrl` against the configured base URL.
   *
   * Absolute URLs (starting with `http:`/`https:`) are returned unchanged.
   *
   * @param pathOrUrl - Relative path or absolute URL to resolve.
   * @returns Absolute URL ready for `page.goto`.
   */
  protected resolveUrl(pathOrUrl: string): string {
    if (/^https?:\/\//.test(pathOrUrl)) {
      return pathOrUrl;
    }
    return new URL(pathOrUrl, this.baseUrl).toString();
  }

  /**
   * Navigates the page to `pathOrUrl` (resolved against the base URL).
   *
   * @param pathOrUrl - Relative path (default `/`) or absolute URL.
   */
  async goto(pathOrUrl: string = '/'): Promise<void> {
    await this.page.goto(this.resolveUrl(pathOrUrl));
  }

  /** Waits for the page to reach the `domcontentloaded` state. */
  async waitForReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Returns the first `h1` locator on the page. */
  heading(): Locator {
    return this.page.locator('h1').first();
  }

  /** Returns the trimmed text of the first `h1` element, or an empty string when absent. */
  async headingText(): Promise<string> {
    return (await this.heading().textContent())?.trim() ?? '';
  }
}
