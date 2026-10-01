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
} as const;
