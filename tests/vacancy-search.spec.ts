import { test, expect, note } from '../fixtures';
import { searchData } from '../data/testData';

// Each test.step mirrors a Gherkin step in features/vacancy-search.feature;
// the @VS-xx tag links the test to its scenario. Untagged tests are core and
// must pass for a green run; @extended ones depend on live data or track
// suspected issues and run in a non-blocking CI job.
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

      await test.step('And location and dates are empty with the default distance of 100km', async () => {
        await vacancySearchPage.expectDefaultFilters();
      });

      const result =
        await test.step(`When I search for "${title}" with the search-icon button`, () =>
          vacancySearchPage.searchByJobTitle(title));

      note('search', `"${title}": API total ${result.totalCount}`);

      await test.step('Then the URL keeps type=vacancies and main_job_title[0]', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And a non-zero match count equal to the search API total is shown', async () => {
        await vacancySearchPage.expectMatchCount(result);
      });

      await test.step('And the top card shows the top result title, location and match %', async () => {
        const card = await vacancySearchPage.expectTopCardMatches(result);
        note('top card', `${card.title} · ${card.location} · ${card.matchPercent}`);
      });
    },
  );

  test(
    'search with a title that matches nothing shows the empty state',
    { tag: ['@extended', '@VS-02'] },
    async ({ vacancySearchPage }) => {
      const title = searchData.noResultsJobTitle;

      const result = await test.step(`When I search for "${title}"`, () =>
        vacancySearchPage.searchByJobTitle(title));

      note('search', `"${title}": API total ${result.totalCount}`);

      await test.step('Then the URL keeps type=vacancies and main_job_title[0]', async () => {
        await vacancySearchPage.expectUrlReflectsSearch(title);
      });

      await test.step('And zero API matches, the empty state, no cards and no match count', async () => {
        await vacancySearchPage.expectNoResults(result);
      });
    },
  );

  test(
    'results are ordered by match %, highest first',
    { tag: ['@extended', '@VS-11'] },
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

  test.describe(
    'equivalent job titles return the same results',
    { tag: ['@extended', '@VS-12'] },
    () => {
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

      test(
        `"${searchData.innerSpacesTitle}" (extra inner spaces) matches "${searchData.jobTitle}"`,
        { tag: '@suspected' },
        async ({ vacancySearchPage }) => {
          const baseline = await test.step(`Given I search for "${searchData.jobTitle}"`, () =>
            vacancySearchPage.searchByJobTitle(searchData.jobTitle));

          const result = await test.step(`When I search for "${searchData.innerSpacesTitle}"`, () =>
            vacancySearchPage.searchByJobTitle(searchData.innerSpacesTitle));

          note('totals', `baseline ${baseline.totalCount}, variant ${result.totalCount}`);

          // Suspected issue: three inner spaces currently return 511 matches
          // with lower scores. Marked as an expected failure only here, after
          // both searches succeeded, so a setup failure can't hide behind it.
          // When this turns red, the behaviour changed: remove test.fail().
          test.fail(true, 'Suspected issue: inner spaces change the results');
          note('suspected issue', 'Expected to fail while inner spaces change the results');

          await test.step('Then the API returns the same total, ranking and scores', () => {
            expect(result).toEqual(baseline);
          });
        },
      );
    },
  );
});
