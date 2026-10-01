import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { VacancySearchPage } from '../pages/VacancySearchPage';

type Fixtures = {
  homePage: HomePage;
  vacancySearchPage: VacancySearchPage;
  /** Attaches a full-page screenshot of the final state, pass or fail. */
  finalScreenshot: void;
};

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    // The app loads Cookiebot. Its dialog doesn't show on the review domain
    // today, but if it ever does it would cover the search form. The handler
    // only runs when the dialog is visible, so there is no conditional wait.
    // Decline = necessary cookies only.
    await page.addLocatorHandler(page.locator('#CybotCookiebotDialog'), async () => {
      await page.locator('#CybotCookiebotDialogBodyButtonDecline').click();
    });
    await use(page);
  },
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  vacancySearchPage: async ({ page }, use) => {
    await use(new VacancySearchPage(page));
  },
  finalScreenshot: [
    async ({ page }, use, testInfo) => {
      await use();
      await testInfo.attach('final state', {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });
    },
    { auto: true },
  ],
});

/** Adds a line to the test's header in the HTML report (shown for passed tests too). */
export function note(type: string, description: string) {
  test.info().annotations.push({ type, description });
}

export { expect };
