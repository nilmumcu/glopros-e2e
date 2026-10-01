import { test, expect, note } from '../fixtures';
import { searchData } from '../data/testData';

// VS-13: the search API is stubbed to fail with page.route. Nothing on the
// real environment is affected.
test.describe('Search API failure', { tag: ['@VS-13', '@resilience'] }, () => {
  test.beforeEach(async ({ vacancySearchPage }) => {
    await test.step('Given I am on vacancy search and the search API returns HTTP 500', async () => {
      await vacancySearchPage.open();
      await vacancySearchPage.mockSearchFailure(500);
    });
  });

  test('page does not show misleading results', async ({ vacancySearchPage }) => {
    const title = searchData.jobTitle;

    const response = await test.step(`When I search for "${title}"`, () =>
      vacancySearchPage.submitSearch(title));

    note('stubbed response', `HTTP ${response.status()}`);

    await test.step('Then the request really failed (the stub was hit)', () => {
      expect(response.status()).toBe(500);
    });

    await test.step('And no stale results, count or "no vacancies" message is shown', async () => {
      await vacancySearchPage.expectNoMisleadingResults(title);
    });
  });

  test('user is told the search failed', async ({ vacancySearchPage }) => {
    test.fail(true, 'Known bug: on a 500 the results area goes blank with no message');
    note('known bug', 'Expected to fail until the app shows an error state');

    await test.step(`When I search for "${searchData.jobTitle}"`, () =>
      vacancySearchPage.submitSearch(searchData.jobTitle));

    await test.step('Then an error message is shown', async () => {
      await vacancySearchPage.expectErrorMessage();
    });
  });
});
