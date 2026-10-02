import { Page, Locator, Response, expect } from '@playwright/test';

/** Search endpoint the vacancy form posts to: { main_job_title: string[] }. */
const SEARCH_API = '/v1/search/search_job_description/';

/** One result as the API returns it; card n on the page shows result n. */
export interface SearchHit {
  id: number;
  title: string;
  score: number;
  country: string | null;
}

export interface SearchResult {
  totalCount: number;
  /** First page of results in API order. */
  results: SearchHit[];
}

type SearchResponseBody = {
  pagination: { total_count: number };
  results: {
    id: number;
    score: number;
    job_title: string;
    location?: { main?: { country?: string | null } };
  }[];
};

/**
 * All selectors live here.
 *
 * Verified against the live review env. The app renders a hidden mobile copy of
 * the search form, so form locators are scoped to the desktop layout. Card
 * internals have no roles or test ids, so card fields are matched against the
 * search API response instead of the page structure.
 */
export class VacancySearchPage {
  readonly page: Page;
  readonly jobTitleInput: Locator;
  readonly locationInput: Locator;
  readonly distanceSelect: Locator;
  readonly startDate: Locator;
  readonly endDate: Locator;
  readonly searchButton: Locator;
  readonly matchCount: Locator;
  readonly vacancyCards: Locator;
  readonly emptyState: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    const searchForm = page.getByTestId('desktop-search-layout');

    // No <label>s; the placeholders are the accessible names.
    this.jobTitleInput = searchForm.getByPlaceholder('Main job title', { exact: true });
    this.locationInput = searchForm.getByPlaceholder('Add work location', { exact: true });
    // The only native <select> in the form. Not getByRole('combobox'): the
    // location autocomplete is a combobox too.
    this.distanceSelect = searchForm.locator('select');
    // Unset dates show these placeholders; a picked date replaces them.
    this.startDate = searchForm.getByText('Start', { exact: true });
    this.endDate = searchForm.getByText('End', { exact: true });

    // Icon-only button with no accessible name. The "Search vacancies" tab also
    // carries a search-icon svg, but it sits outside the desktop layout.
    this.searchButton = searchForm
      .getByRole('button')
      .filter({ has: page.getByTestId('search-icon') });

    // <h5>510 matches</h5>; not rendered at all when there are no results.
    this.matchCount = page.getByRole('heading', { name: /^\d[\d.,]*\s+match(es)?$/i });

    this.vacancyCards = page.locator('.vacancyCard');

    this.emptyState = page.getByText('No vacancies match your criteria', { exact: true });

    // The app shows no error message today and the wording isn't specified, so
    // this accepts common phrasings (VS-13, suspected issue). Not
    // getByRole('alert'): Next.js's route announcer is an always-present
    // role="alert" holding the page title.
    this.errorMessage = page.getByText(
      /something went wrong|please try again|(could not|couldn't|failed to) load|unavailable/i,
    );
  }

  /** Opens vacancy search directly, for specs that don't cover navigation. */
  async open() {
    await this.page.goto('/search/?type=vacancies');
    await expect(this.jobTitleInput).toBeVisible();
  }

  /** Location and dates empty, distance at the default 100km (brief step 3). */
  async expectDefaultFilters() {
    await expect(this.locationInput).toHaveValue('');
    await expect(this.startDate).toBeVisible();
    await expect(this.endDate).toBeVisible();
    await expect(this.distanceSelect).toHaveValue('100');
  }

  /**
   * Fills the title, clicks the search icon, and waits for the search API
   * response for this title. The page also calls the endpoint on load
   * (without a title), so the predicate matches on the request body.
   *
   * Observed: typing alone triggers this request after ~0.6s; the click does
   * not send a second one.
   */
  async submitSearch(title: string): Promise<Response> {
    await expect(this.jobTitleInput).toBeVisible();
    const responsePromise = this.page.waitForResponse((res) => this.isSearchFor(res, title));
    await this.jobTitleInput.fill(title);
    await this.searchButton.click();
    return responsePromise;
  }

  /** submitSearch for the happy path: the API must succeed. */
  async searchByJobTitle(title: string): Promise<SearchResult> {
    const response = await this.submitSearch(title);
    expect(response.ok(), `search API returned HTTP ${response.status()}`).toBe(true);
    const body = (await response.json()) as SearchResponseBody;
    return {
      totalCount: body.pagination.total_count,
      results: body.results.map((r) => ({
        id: r.id,
        title: r.job_title,
        score: r.score,
        country: r.location?.main?.country ?? null,
      })),
    };
  }

  /** Makes every search request fail with the given HTTP status. */
  async mockSearchFailure(status = 500) {
    await this.page.route(`**${SEARCH_API}**`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status, json: { detail: 'Injected failure (test)' } })
        : route.fallback(),
    );
  }

  private isSearchFor(res: Response, title: string): boolean {
    const req = res.request();
    if (req.method() !== 'POST' || !res.url().includes(SEARCH_API)) return false;
    const payload = req.postDataJSON() as { main_job_title?: string[] } | null;
    return payload?.main_job_title?.includes(title) ?? false;
  }

  /** URL keeps type=vacancies and main_job_title[0] holds the searched title. */
  async expectUrlReflectsSearch(title: string) {
    await expect
      .poll(() => {
        const params = new URL(this.page.url()).searchParams;
        return { type: params.get('type'), title: params.get('main_job_title[0]') };
      })
      .toEqual({ type: 'vacancies', title });
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

  /** Match % of every card on the current page, top to bottom. */
  async readMatchPercents(): Promise<number[]> {
    const percents = this.vacancyCards.getByText(/^\d{1,3}%$/);
    // Pre-search cards have no %, so this waits for the post-search render,
    // then checks every card has one.
    await expect.poll(() => percents.count()).toBeGreaterThan(0);
    await expect(percents).toHaveCount(await this.vacancyCards.count());
    return (await percents.allTextContents()).map((t) => Number(t.replace('%', '')));
  }

  async expectSortedByMatchPercent(): Promise<number[]> {
    const percents = await this.readMatchPercents();
    expect(percents.length, 'need at least 2 cards to check ordering').toBeGreaterThan(1);
    expect(percents, 'cards should be ordered by match %, highest first').toEqual(
      [...percents].sort((a, b) => b - a),
    );
    return percents;
  }

  /**
   * The top card shows the top API result's title, location and match %.
   * Deliberately the first card ("the top result"), not any card.
   */
  async expectTopCardMatches(result: SearchResult) {
    const top = result.results[0];
    expect(top, 'search API returned no results').toBeDefined();
    expect(top.country, 'top result has no location in the API').toBeTruthy();

    const card = this.vacancyCards.first();
    const expectedPercent = `${Math.round(top.score * 100)}%`;
    // The % only appears on post-search cards, so this also waits out any
    // pre-search cards still on screen.
    await expect(card.getByText(expectedPercent, { exact: true })).toBeVisible();
    await expect(card.getByText(top.title, { exact: true })).toBeVisible();
    await expect(card.locator('div:has(> svg.locationIcon)')).toHaveText(top.country ?? '');

    return { title: top.title, location: top.country, matchPercent: expectedPercent };
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

  /**
   * After a failed search nothing is presented as if it were a real answer:
   * no stale cards or count, and no "no vacancies" message (an outage is not an
   * empty result). The typed title stays so the user can retry. This is the
   * observed behaviour, kept as a regression check.
   */
  async expectNoMisleadingResults(title: string) {
    await expect(this.vacancyCards).toHaveCount(0);
    await expect(this.matchCount).toBeHidden();
    await expect(this.emptyState).toBeHidden();
    await expect(this.jobTitleInput).toHaveValue(title);
    await expect(this.searchButton).toBeEnabled();
  }

  async expectErrorMessage() {
    await expect(this.errorMessage).toBeVisible();
  }
}
