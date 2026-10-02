/**
 * Search inputs used by the specs. The review env is shared and its data can
 * change, so nothing here pins a result count or ranking.
 */
export const searchData = {
  /** Common title with plenty of vacancies on the review env. */
  jobTitle: 'Software Engineer',

  /**
   * Title that currently returns zero vacancies. Search is semantic, so random
   * strings ("zzzqqqxxx123", "qxjzv") still return hundreds of fuzzy matches;
   * this phrase is verified to return total_count 0 from the search API.
   * If the env gains a matching vacancy, VS-02 fails with an explicit message.
   */
  noResultsJobTitle: 'Underwater basket weaver',

  /** Variants of jobTitle that must return the same results (VS-12). */
  equivalentTitles: ['software engineer', 'SOFTWARE ENGINEER', '  Software Engineer  '],

  /**
   * Suspected issue: three spaces between the words return 511 matches with
   * lower scores, while two spaces match "Software Engineer". Expected
   * behaviour isn't specified; VS-12 tracks it as an expected failure.
   */
  innerSpacesTitle: 'Software   Engineer',
} as const;

/**
 * WCAG 2.1 A/AA failures (axe, critical/serious) already present on the
 * search page. VS-14 fails on anything NOT in this list, so the page can't get
 * worse; remove an entry once the app team fixes it.
 */
export const knownA11yViolations: Record<string, string> = {
  'button-name': 'Search-icon submit button has no accessible name',
  'image-alt': 'Decorative icons in the search form have no alt text',
  'select-name': 'Distance <select> has no label',
  'aria-progressbar-name': 'Match-% rings on cards (role=progressbar) have no name',
  'link-name': 'Logo link has no accessible name',
};
