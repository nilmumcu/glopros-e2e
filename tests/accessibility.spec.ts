import { test, expect, note } from '../fixtures';
import { searchData, knownA11yViolations } from '../data/testData';
import { scanA11y } from '../support/a11y';

const known = Object.keys(knownA11yViolations);

// VS-14: axe with WCAG 2.1 A/AA rules, critical and serious impact only.
test.describe('Accessibility', { tag: ['@extended', '@VS-14'] }, () => {
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

  test(
    'search form has no critical or serious violations',
    { tag: '@suspected' },
    async ({ page }, testInfo) => {
      const violations = await test.step('When I run axe on the search form only', () =>
        scanA11y(page, testInfo, '[data-testid="desktop-search-layout"]'));

      // WCAG 2.1 failures reported by axe today: button-name (icon-only search
      // button), select-name (distance) and image-alt (form icons). Marked as
      // an expected failure only after the scan ran. When this turns red, the
      // form passes: remove test.fail().
      test.fail(true, `WCAG failures in the search form: ${known.slice(0, 3).join(', ')}`);
      note('WCAG failures', 'Expected to fail while the search form has axe violations');

      await test.step('Then there are no violations', () => {
        expect(violations).toEqual([]);
      });
    },
  );
});
