import { test, expect, note } from '../fixtures';
import { searchData } from '../data/testData';

// Each test.step mirrors a Gherkin step in features/vacancy-search.feature;
// the @VS-xx tag links the test to its scenario (see README traceability table).
test.describe('Vacancy search', () => {
  test.beforeEach(async ({ homePage }) => {
    await test.step('Given I am on the GloPros review app homepage', async () => {
      await homePage.open();
    });

    await test.step('And I open "Vacancy search"', async () => {
      await homePage.goToVacancySearch();
    });
  });

  test(
    'user finds vacancies by main job title',
    { tag: ['@smoke', '@VS-01'] },
    async ({ vacancySearchPage }) => {
      const title = searchData.jobTitle;

      const result =
        await test.step(`When I search for "${title}" (default distance, no location/dates)`, () =>
          vacancySearchPage.searchByJobTitle(title));

      note('search', `"${title}": API total ${result.totalCount}`);

      await test.step('Then the URL keeps type=vacancies and the job title', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And a non-zero match count equal to the search API total is shown', async () => {
        await vacancySearchPage.expectMatchCount(result);
      });

      await test.step('And at least one vacancy card shows title, location and match %', async () => {
        const card = await vacancySearchPage.expectVacancyCardWithMetadata();
        note('first card', `${card.title} · ${card.location} · ${card.matchPercent}`);
      });
    },
  );

  test(
    'search with a title that matches nothing shows the empty state',
    { tag: ['@negative', '@VS-02'] },
    async ({ vacancySearchPage }) => {
      const title = searchData.noResultsJobTitle;

      const result = await test.step(`When I search for "${title}"`, () =>
        vacancySearchPage.searchByJobTitle(title));

      note('search', `"${title}": API total ${result.totalCount}`);

      await test.step('Then the URL keeps type=vacancies and the job title', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And zero API matches, the empty state, no cards and no match count', async () => {
        await vacancySearchPage.expectNoResults(result);
      });
    },
  );

  test(
    'results are ordered by match %, highest first',
    { tag: ['@VS-11'] },
    async ({ vacancySearchPage }) => {
      const title = searchData.jobTitle;

      await test.step(`When I search for "${title}"`, () =>
        vacancySearchPage.searchByJobTitle(title));

      await test.step('Then every card on the first page shows a match %', async () => {
        await vacancySearchPage.readMatchPercents();
      });

      await test.step('And the cards are ordered by match %, highest first', async () => {
        const percents = await vacancySearchPage.expectSortedByMatchPercent();
        note('match % order', percents.map((p) => `${p}%`).join(', '));
      });
    },
  );

  test.describe('equivalent job titles return the same results', { tag: ['@VS-12'] }, () => {
    for (const variant of searchData.equivalentTitles) {
      test(`"${variant}" matches "${searchData.jobTitle}"`, async ({ vacancySearchPage }) => {
        const baseline = await test.step(`Given I search for "${searchData.jobTitle}"`, () =>
          vacancySearchPage.searchByJobTitle(searchData.jobTitle));

        const result = await test.step(`When I search for "${variant}"`, () =>
          vacancySearchPage.searchByJobTitle(variant));

        note('totals', `baseline ${baseline.totalCount}, variant ${result.totalCount}`);

        await test.step('Then the API returns the same total, ranking and scores', () => {
          expect(result).toEqual(baseline);
        });

        await test.step('And the UI shows that same count', async () => {
          await vacancySearchPage.expectMatchCount(result);
        });
      });
    }

    test(`"${searchData.knownBugTitle}" (extra inner spaces) matches "${searchData.jobTitle}"`, async ({
      vacancySearchPage,
    }) => {
      test.fail(true, 'Known bug: three inner spaces return 511 matches with different scores');
      note('known bug', 'Expected to fail until whitespace inside the title is normalised');

      const baseline = await test.step(`Given I search for "${searchData.jobTitle}"`, () =>
        vacancySearchPage.searchByJobTitle(searchData.jobTitle));

      const result = await test.step(`When I search for "${searchData.knownBugTitle}"`, () =>
        vacancySearchPage.searchByJobTitle(searchData.knownBugTitle));

      note('totals', `baseline ${baseline.totalCount}, variant ${result.totalCount}`);

      await test.step('Then the API returns the same total, ranking and scores', () => {
        expect(result).toEqual(baseline);
      });
    });
  });
});
