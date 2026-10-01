import { Page, Locator, Response, expect } from '@playwright/test';

/** Search endpoint the vacancy form posts to: { main_job_title: string[] }. */
const SEARCH_API = '/v1/search/search_job_description/';

export interface SearchResult {
  totalCount: number;
  /** First page of results in API order, enough to compare rankings. */
  results: { id: number; score: number }[];
}

type SearchResponseBody = {
  pagination: { total_count: number };
  results: { id: number; score: number }[];
};

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
  readonly errorMessage: Locator;

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

    // The app has no error state today (VS-13 is a known bug), so this is the
    // generic wording we'd accept. Not getByRole('alert'): Next.js's route
    // announcer is an always-present role="alert" holding the page title.
    this.errorMessage = page.getByText(
      /something went wrong|please try again|(could not|couldn't|failed to) load|unavailable/i,
    );
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

  /** Opens vacancy search directly, for specs that don't cover navigation. */
  async open() {
    await this.page.goto('/search/?type=vacancies');
    await expect(this.jobTitleInput).toBeVisible();
  }

  /**
   * Fills the title, submits, and waits for the search API response for this
   * title. The page also calls the endpoint on load (without a title), so the
   * predicate matches on the request body, not only the URL.
   */
  async submitSearch(title: string): Promise<Response> {
    await expect(this.jobTitleInput).toBeVisible();
    await this.jobTitleInput.fill(title);

    const responsePromise = this.page.waitForResponse((res) => this.isSearchFor(res, title));
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
      results: body.results.map(({ id, score }) => ({ id, score })),
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

  /** Match % of every card on the current page, top to bottom. */
  async readMatchPercents(): Promise<number[]> {
    const percents = this.vacancyCards.getByText(/^\d{1,3}%$/);
    // Pre-search cards have no %, so this waits for the post-search render,
    // then checks every card has one.
    await expect(percents.first()).toBeVisible();
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

  /** Returns the checked fields so specs can record them in the report. */
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

    return {
      title: (await title.innerText()).trim(),
      location: (await location.innerText()).trim(),
      matchPercent: (await matchPercent.innerText()).trim(),
    };
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
   * After a failed search the page must not present anything as if it were a
   * real answer: no stale cards or count, and no "no vacancies" message (an
   * outage is not an empty result). The typed title stays so the user can retry.
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
