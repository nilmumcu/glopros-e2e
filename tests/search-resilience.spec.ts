import { test, expect, note } from '../fixtures';
import { searchData } from '../data/testData';

// VS-13: the search API is stubbed to fail with page.route, so these tests
// don't depend on live data. Nothing on the real environment is affected.
test.describe('Search API failure', { tag: ['@VS-13'] }, () => {
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

  test(
    'user is told the search failed',
    { tag: ['@extended', '@suspected'] },
    async ({ vacancySearchPage }) => {
      const response = await test.step(`When I search for "${searchData.jobTitle}"`, () =>
        vacancySearchPage.submitSearch(searchData.jobTitle));

      await test.step('Then the request really failed (the stub was hit)', () => {
        expect(response.status()).toBe(500);
      });

      // Suspected issue: the results area goes blank with no message. The
      // expected wording isn't specified, so the locator accepts common
      // phrasings. Marked as an expected failure only after the setup above
      // passed. When this turns red, the app shows a message: remove test.fail().
      test.fail(true, 'Suspected issue: no error message after a failed search');
      note('suspected issue', 'Expected to fail while no error message is shown');

      await test.step('Then an error message is shown', async () => {
        await vacancySearchPage.expectErrorMessage();
      });
    },
  );
});
