// Turns Playwright's JSON report into a Markdown summary for the GitHub
// Actions run page ($GITHUB_STEP_SUMMARY), or prints it locally.
//   node scripts/ci-summary.mjs [reports/results.json] [title]
import { readFileSync, appendFileSync } from 'node:fs';

const [file = 'reports/results.json', title = 'E2E results'] = process.argv.slice(2);

function output(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  else console.log(markdown);
}

let report;
try {
  report = JSON.parse(readFileSync(file, 'utf8'));
} catch {
  output(`### ${title}\n\nNo results at \`${file}\`: the run did not reach the tests.\n`);
  process.exit(0);
}

const collect = (suite, path = []) => [
  ...(suite.specs ?? []).flatMap((spec) =>
    spec.tests.map((test) => ({ path: [...path, spec.title], spec, test })),
  ),
  ...(suite.suites ?? []).flatMap((child) =>
    collect(child, child.title.endsWith('.ts') ? path : [...path, child.title]),
  ),
];
const tests = report.suites.flatMap((suite) => collect(suite));

const outcome = ({ test }) => {
  if (test.status === 'flaky') return 'flaky';
  if (test.status === 'skipped') return 'skipped';
  if (test.status === 'unexpected') return 'failed';
  return test.expectedStatus === 'failed' ? 'known-bug' : 'passed';
};
const icon = { passed: '✅', 'known-bug': '🐞', flaky: '⚠️', failed: '❌', skipped: '⏭️' };
const count = (o) => tests.filter((t) => outcome(t) === o).length;

const ran = tests.length - count('skipped');
const ok = count('passed') + count('known-bug');
const rate = ran ? ((ok / ran) * 100).toFixed(1) : '0.0';

const notes = ({ test }) => {
  const all = [...(test.annotations ?? []), ...test.results.flatMap((r) => r.annotations ?? [])];
  const seen = new Set();
  return all
    .filter((a) => a.type !== 'fail' && a.description)
    .map((a) => `${a.type}: ${a.description}`)
    .filter((n) => !seen.has(n) && seen.add(n))
    .join('<br>');
};
const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

const rows = tests.map((t) => {
  const last = t.test.results.at(-1);
  const tags = (t.spec.tags ?? []).map((tag) => `\`@${tag}\``).join(' ');
  return `| ${icon[outcome(t)]} | ${cell(t.path.join(' › '))} ${tags} | ${((last?.duration ?? 0) / 1000).toFixed(1)}s | ${cell(notes(t))} |`;
});

output(
  [
    `### ${title}`,
    '',
    `**Pass rate: ${rate}%** (${ok}/${ran}): ✅ ${count('passed')} passed · 🐞 ${count('known-bug')} known bugs (expected failures) · ⚠️ ${count('flaky')} flaky · ❌ ${count('failed')} failed · ⏭️ ${count('skipped')} skipped`,
    '',
    process.env.REPORT_URL ? `Full HTML report: ${process.env.REPORT_URL}\n` : '',
    '| | Test | Time | Notes |',
    '|---|---|---|---|',
    ...rows,
    '',
  ].join('\n'),
);
