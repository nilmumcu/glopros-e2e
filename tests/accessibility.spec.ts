import { test, expect, note } from '../fixtures';
import { searchData, knownA11yViolations } from '../data/testData';
import { scanA11y } from '../support/a11y';

const known = Object.keys(knownA11yViolations);

test.describe('Accessibility', { tag: ['@VS-14', '@a11y'] }, () => {
  test.beforeEach(async ({ vacancySearchPage }) => {
    await test.step(`Given I have searched for "${searchData.jobTitle}"`, async () => {
      await vacancySearchPage.open();
      await vacancySearchPage.searchByJobTitle(searchData.jobTitle);
      await vacancySearchPage.readMatchPercents(); // results fully rendered
    });
  });

  test('no new critical or serious violations on the results page', async ({ page }, testInfo) => {
    const violations = await test.step('When I run axe (WCAG 2.1 A/AA)', () =>
      scanA11y(page, testInfo));

    for (const v of violations) note(`a11y ${v.impact}`, `${v.id} (${v.nodes}): ${v.help}`);

    await test.step('Then every critical/serious violation is a known, tracked issue', () => {
      const unknown = violations.filter((v) => !known.includes(v.id));
      expect(
        unknown,
        'new accessibility violations; fix them or add to knownA11yViolations',
      ).toEqual([]);
    });
  });

  test('search form has no critical or serious violations', async ({ page }, testInfo) => {
    test.fail(true, `Known bugs: ${known.slice(0, 3).join(', ')} in the search form`);
    note('known bug', 'Expected to fail until the search form issues are fixed');

    const violations = await test.step('When I run axe on the search form only', () =>
      scanA11y(page, testInfo, '[data-testid="desktop-search-layout"]'));

    await test.step('Then there are no violations', () => {
      expect(violations).toEqual([]);
    });
  });
});
