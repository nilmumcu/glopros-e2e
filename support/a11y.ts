import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/**
 * Runs axe on the page (or one region of it), attaches the full result to the
 * report and returns the critical/serious violations.
 */
export async function scanA11y(page: Page, testInfo: TestInfo, include?: string) {
  const builder = new AxeBuilder({ page }).withTags(WCAG_TAGS);
  if (include) builder.include(include);
  const results = await builder.analyze();

  await testInfo.attach(`axe-results${include ? ' (' + include + ')' : ''}`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  return results.violations
    .filter((v) => v.impact === 'critical' || v.impact === 'serious')
    .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
}
