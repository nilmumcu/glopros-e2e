import { Page, Locator, Response, expect } from '@playwright/test';

/** Search endpoint the vacancy form posts to: { main_job_title: string[] }. */
const SEARCH_API = '/v1/search/search_job_description/';

export interface SearchResult {
  totalCount: number;
}

/**
 * All selectors live here. If the app's markup differs from these
 * assumptions, this is the only file to touch (see README "Tuning selectors").
 *
 * Verified against the live review env. The app renders a hidden mobile copy of
 * the search form, so form locators are scoped to the desktop layout. Card
 * internals have no roles/test ids and only hashed emotion classes (css-xxxx),
 * so card fields use the few stable hooks available: .vacancyCard,
 * svg.locationIcon and the MUI progressbar ring next to the title.
 */
export class VacancySearchPage {
  readonly page: Page;
  readonly jobTitleInput: Locator;
  readonly searchButton: Locator;
  readonly matchCount: Locator;
  readonly vacancyCards: Locator;
  readonly emptyState: Locator;

  constructor(page: Page) {
    this.page = page;
    const searchForm = page.getByTestId('desktop-search-layout');

    // No <label>; the placeholder is the accessible name.
    this.jobTitleInput = searchForm.getByPlaceholder('Main job title', { exact: true });

    // Icon-only submit with no accessible name. The "Search vacancies" tab also
    // carries a search-icon svg, but it sits outside the desktop layout.
    this.searchButton = searchForm
      .getByRole('button')
      .filter({ has: page.getByTestId('search-icon') });

    // <h5>510 matches</h5>; not rendered at all when there are no results.
    this.matchCount = page.getByRole('heading', { name: /^\d[\d.,]*\s+match(es)?$/i });

    this.vacancyCards = page.locator('.vacancyCard');

    this.emptyState = page.getByText('No vacancies match your criteria', { exact: true });
  }

  /** Title, match % and location of a single vacancy card. */
  cardFields(card: Locator) {
    return {
      // Title is the sibling rendered before the match-% ring.
      title: card.locator('div:has(> div > div > [role="progressbar"]) > div:first-child'),
      // Match % is only rendered once a job-title search has run.
      matchPercent: card.getByText(/^\d{1,3}%$/),
      location: card.locator('div:has(> svg.locationIcon)'),
    };
  }

  /**
   * Submits the search and waits for the search API response for this title.
   * The page also calls the endpoint on load (without a title), so the
   * predicate matches on the request body, not only the URL.
   */
  async searchByJobTitle(title: string): Promise<SearchResult> {
    await expect(this.jobTitleInput).toBeVisible();
    await this.jobTitleInput.fill(title);

    const responsePromise = this.page.waitForResponse((res) => this.isSearchFor(res, title));
    await this.searchButton.click();
    const response = await responsePromise;

    expect(response.ok(), `search API returned HTTP ${response.status()}`).toBe(true);
    const body = (await response.json()) as { pagination: { total_count: number } };
    return { totalCount: body.pagination.total_count };
  }

  private isSearchFor(res: Response, title: string): boolean {
    const req = res.request();
    if (req.method() !== 'POST' || !res.url().includes(SEARCH_API)) return false;
    const payload = req.postDataJSON() as { main_job_title?: string[] } | null;
    return payload?.main_job_title?.includes(title) ?? false;
  }

  /** URL keeps type=vacancies and carries the title in some query param. */
  async expectUrlReflectsSearch(title: string) {
    await expect
      .poll(() => {
        const url = new URL(this.page.url());
        const values = [...url.searchParams.values()].map((v) => v.toLowerCase());
        return {
          type: url.searchParams.get('type'),
          hasTitle: values.some((v) => v.includes(title.toLowerCase())),
        };
      })
      .toEqual({ type: 'vacancies', hasTitle: true });
  }

  /**
   * Count shown in the UI must be > 0 and equal the API's total for this
   * search. Comparing with the API also rules out reading the pre-search count
   * that is still on screen while results re-render.
   */
  async expectMatchCount(result: SearchResult) {
    expect(result.totalCount, 'search API should report matches').toBeGreaterThan(0);
    await expect
      .poll(async () => {
        const text = (await this.matchCount.textContent()) ?? '';
        return Number(text.match(/\d[\d.,]*/)?.[0].replace(/[.,]/g, '') ?? NaN);
      })
      .toBe(result.totalCount);
  }

  async expectVacancyCardWithMetadata() {
    const first = this.vacancyCards.first();
    await expect(first).toBeVisible();
    const { title, matchPercent, location } = this.cardFields(first);

    // Match % first: it only appears on post-search cards, so this also waits
    // out any pre-search cards still on screen.
    await expect(matchPercent).toBeVisible();
    await expect
      .poll(async () => Number((await matchPercent.textContent())?.replace('%', '')))
      .toBeLessThanOrEqual(100);

    await expect(title).toBeVisible();
    await expect(title).toHaveText(/\S/);

    await expect(location).toBeVisible();
    await expect(location).toHaveText(/\S/);
  }

  async expectNoResults(result: SearchResult) {
    expect(
      result.totalCount,
      'search API returned matches; test data in data/testData.ts needs a new zero-result title',
    ).toBe(0);
    await expect(this.emptyState).toBeVisible();
    await expect(this.vacancyCards).toHaveCount(0);
    await expect(this.matchCount).toBeHidden();
  }
}
