import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/HomePage';
import { VacancySearchPage } from '../pages/VacancySearchPage';

type Pages = {
  homePage: HomePage;
  vacancySearchPage: VacancySearchPage;
};

export const test = base.extend<Pages>({
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
});

export { expect };
