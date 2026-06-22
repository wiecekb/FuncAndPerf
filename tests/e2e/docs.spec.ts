import { test, expect } from './fixtures';
import { PlaywrightDocsPage } from './pages/playwright-docs.page';
/**
 * Verifies a user can navigate from the home page into the Docs section and
 * that the resulting page exposes a visible heading.
 */
test.describe('Classic Playwright frontend tests - docs', (): void => {
  test('user can navigate from homepage to docs', async ({ page, frontendBaseUrl, loggedExpect }): Promise<void> => {
    const docsPage = new PlaywrightDocsPage(page, frontendBaseUrl);
    await docsPage.openHome();
    await docsPage.openDocs();
    await expect(page).toHaveURL(/\/docs/);
    await loggedExpect('Docs URL contains docs path', page.url()).toContain('/docs');
    const heading: string = await docsPage.headingText();
    await loggedExpect('Docs page has a visible heading', heading.length > 0).toBe(true);
  });
});
