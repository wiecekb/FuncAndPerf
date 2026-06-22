import { test, expect } from './fixtures';
import { PlaywrightDocsPage } from './pages/playwright-docs.page';

/**
 * Verifies the configured frontend host renders the Playwright home page with
 * the expected title, heading and Docs link.
 */
test.describe('Classic Playwright frontend tests - homepage', (): void => {
  test('homepage renders from configured frontend host', async ({ page, frontendBaseUrl, loggedExpect, captureScreenshot }): Promise<void> => {
    const homePage = new PlaywrightDocsPage(page, frontendBaseUrl);
    await homePage.openHome();
    await expect(page).toHaveTitle(/Playwright/);
    await expect(homePage.docsLink()).toBeVisible();
    const configuredHost: string = new URL(frontendBaseUrl).host;
    await loggedExpect('Homepage URL contains configured frontend host', page.url()).toContain(configuredHost);
    const heading: string = await homePage.headingText();
    await loggedExpect('Homepage heading contains Playwright', heading).toContain('Playwright');
    await captureScreenshot('Homepage loaded');
  });
});
