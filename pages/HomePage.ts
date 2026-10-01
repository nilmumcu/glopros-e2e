import { Page, Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly vacancySearchLink: Locator;

  constructor(page: Page) {
    this.page = page;
    // Exact name: "Find Vacancies" points to the same URL and "Search vacancies"
    // points off-site, so a loose regex or href match is ambiguous.
    this.vacancySearchLink = page.getByRole('link', { name: 'Vacancy search', exact: true });
  }

  async open() {
    await this.page.goto('/');
    await expect(this.page).toHaveTitle(/GloPros/i);
  }

  async goToVacancySearch() {
    await this.vacancySearchLink.click();
    await expect(this.page).toHaveURL(/\/search\/?\?.*type=vacancies/);
  }
}
