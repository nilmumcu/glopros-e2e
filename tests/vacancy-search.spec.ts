import { test } from '../fixtures';
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

      await test.step('Then the URL keeps type=vacancies and the job title', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And a non-zero match count equal to the search API total is shown', async () => {
        await vacancySearchPage.expectMatchCount(result);
      });

      await test.step('And at least one vacancy card shows title, location and match %', async () => {
        await vacancySearchPage.expectVacancyCardWithMetadata();
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

      await test.step('Then the URL keeps type=vacancies and the job title', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And zero API matches, the empty state, no cards and no match count', async () => {
        await vacancySearchPage.expectNoResults(result);
      });
    },
  );
});
