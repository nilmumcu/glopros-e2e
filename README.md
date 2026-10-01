# GloPros vacancy search – E2E (Playwright + TypeScript)

End-to-end tests for the vacancy search journey on the GloPros review environment.
Read-only: no login, no accounts, no applications submitted.

## Prerequisites

- **Node.js 20+** (`.nvmrc` pins 20; `engines` enforces `>=20`). Playwright does not run on Node 16/18.
  With nvm: `nvm use`.
- Network access to `https://review-chore-qa-i-lgtytk.dev.glopros.com` (or your own `BASE_URL`).

## Install

```bash
npm ci
npx playwright install chromium
```

## Run

| Command                                       | What it does                                       |
| --------------------------------------------- | -------------------------------------------------- |
| `npm test`                                    | All tests, headless                                |
| `npm run test:headed`                         | Watch the browser                                  |
| `npm run test:ui`                             | Playwright UI mode                                 |
| `npm run test:evidence`                       | Record a trace for every test, passed ones too     |
| `npx playwright test --grep @known-bug`       | Only the tests that track known app bugs           |
| `npx playwright test --grep @smoke`           | Smoke subset (or `--grep @VS-02` for one scenario) |
| `npx playwright test --repeat-each=20`        | Flakiness check                                    |
| `CI=true npx playwright test`                 | Run with CI settings (retries, 1 worker)           |
| `npm run report`                              | Open the last HTML report                          |
| `npm run typecheck` / `lint` / `format:check` | Static checks (all run in CI)                      |

Target another environment with `BASE_URL=https://... npm test`.

## Structure

```
features/   Gherkin scenarios; @VS-xx IDs link each one to its test
tests/      Specs; each test.step mirrors a Gherkin step
pages/      Page objects; all selectors and assertions live here
fixtures/   test.extend: provides homePage / vacancySearchPage, cookie-banner handler
data/       Test data (search terms) and the accessibility baseline
support/    Helpers (axe accessibility scan)
scripts/    ci-summary.mjs: results table for the GitHub Actions run page
.github/    CI pipeline (see "CI pipeline")
```

Specs import `test`/`expect` from `fixtures/`, not from `@playwright/test`, and get
page objects injected:

```ts
test('...', async ({ vacancySearchPage }) => { ... });
```

## Viewing results

`npm run report` opens the HTML report. Click **Passed** to filter. For every test,
passed or failed, the report shows:

- **Steps** named after the Gherkin steps.
- **Annotations** with what was actually checked, for example
  `search: "Software Engineer": API total 510`,
  `first card: 9 · Netherlands · 96%`, and the match % order.
- **A full-page screenshot of the final state** (fixture `finalScreenshot`).
- For accessibility tests, the full **axe results** as a JSON attachment.

Traces are only recorded on retry by default, to keep runs fast. Use
`npm run test:evidence` for a run where every test gets a trace (timeline, DOM
snapshots, network), or `npm run test:ui` to step through tests live.

## CI pipeline

`.github/workflows/e2e.yml` runs on every push to `main`, on pull requests,
manually (**Run workflow**), and **nightly at 03:00 UTC**.

```
quality ──► smoke ──► e2e ──► publish-report
typecheck   @smoke    full     HTML report → GitHub Pages
lint        only      suite    (main only, also when tests fail)
format
```

| Stage            | Why it's separate                                                                       |
| ---------------- | --------------------------------------------------------------------------------------- |
| `quality`        | Fails in ~30s without installing a browser                                              |
| `smoke`          | If the env is down or the happy path broke, stop before spending time on the full suite |
| `e2e`            | Full suite with CI settings (2 retries, 1 worker); uploads the report and raw results   |
| `publish-report` | Puts the HTML report at a link, so nobody has to download and unzip an artifact         |

- **Run page summary:** each test job writes a results table to the run page with
  the pass rate, a split into passed / known bugs / flaky / failed, and each test's
  notes (made by `scripts/ci-summary.mjs` from the JSON reporter).
- **Live report:** https://nilmumcu.github.io/glopros-e2e/ (latest `main` or nightly run).
- **Nightly run:** the review env is shared and its data changes. A nightly run catches
  breakage, such as the VS-02 zero-result term gaining matches, on days nobody pushes.
- **Concurrency:** a newer push cancels the older run on the same branch.

One-time setup for the live report: **Settings → Pages → Build and deployment →
Source: GitHub Actions**.

## Coverage and traceability

| ID    | Scenario (`features/vacancy-search.feature`) | Status                  | Test                                                                                        |
| ----- | -------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------- |
| VS-01 | Search by main job title (happy path)        | Automated               | `vacancy-search.spec.ts` › `user finds vacancies by main job title` `@smoke`                |
| VS-02 | Search with a title that matches nothing     | Automated               | `vacancy-search.spec.ts` › `search with a title that matches nothing shows the empty state` |
| VS-11 | Results ordered by match %                   | Automated               | `vacancy-search.spec.ts` › `results are ordered by match %, highest first`                  |
| VS-12 | Case/whitespace variants give same results   | Automated (+ known bug) | `vacancy-search.spec.ts` › `equivalent job titles return the same results` (4 tests)        |
| VS-13 | Search API failure (stubbed HTTP 500)        | Automated (+ known bug) | `search-resilience.spec.ts` (2 tests)                                                       |
| VS-14 | Accessibility (axe, WCAG 2.1 A/AA)           | Automated (+ known bug) | `accessibility.spec.ts` (2 tests)                                                           |
| VS-03 | Search with an empty job title               | Manual                  | –                                                                                           |
| VS-04 | Special characters in title                  | Manual                  | –                                                                                           |
| VS-05 | Very long job title                          | Manual                  | –                                                                                           |
| VS-06 | Submit with the Enter key                    | Manual                  | –                                                                                           |
| VS-07 | Change the distance filter                   | Manual                  | –                                                                                           |
| VS-08 | Deep link to a search URL                    | Manual                  | –                                                                                           |
| VS-09 | Browser back keeps search state              | Manual                  | –                                                                                           |
| VS-10 | Mobile viewport                              | Manual                  | –                                                                                           |

Run a single scenario by ID: `npx playwright test --grep @VS-01`.

### Known bugs (tracked as expected failures)

These tests assert the **correct** behaviour and are marked `test.fail()`. They
show as passed ("expected to fail") while the bug exists. Once the app is fixed
they turn red, which tells you to remove the `test.fail()` line. The expectation
itself is never weakened.

| ID    | Bug                                                                                                            |
| ----- | -------------------------------------------------------------------------------------------------------------- |
| VS-12 | "Software Engineer" (3 inner spaces) returns 511 matches with lower scores (top 86% vs 96%); 2 spaces are fine |
| VS-13 | When the search API fails, the results area goes blank with no error message                                   |
| VS-14 | Search form: icon-only search button has no accessible name, distance `<select>` has no label, icons lack alt  |

The results-page accessibility test uses a **baseline** (`knownA11yViolations` in
`data/testData.ts`). It fails only on violations that are not in that list, so the
page can't get worse while the known issues wait for a fix.

### Other observations (not automated)

- The top result for "Software Engineer" is a vacancy titled "9" (96% match). This
  is a possible relevance problem, or test data ranking above real vacancies.
- Search is very loose: "zzzqqqxxx123" returns 336 matches, and several unrelated
  terms return exactly 500 (possibly a cap on the count).
- One card lists masked email addresses as skills. That's a data-quality issue and
  possibly personal data shown publicly.

## Stability approach

- **Wait on the network, not on time.** `searchByJobTitle` waits for the
  `POST /v1/search/search_job_description/` response whose body contains the
  searched title. The page also calls this endpoint on load, so matching the URL alone
  would pick up the wrong response.
- **Check the UI against the API.** The match count must equal the API's `total_count`.
  This also catches a count left on screen from before the search (the page shows
  "864 matches" before any search).
- **Web-first assertions only** (`toBeVisible`, `toHaveText`, `toHaveCount`, `expect.poll`).
  There are no `waitForTimeout` calls and no `force: true`. ESLint enforces both
  (`playwright/no-wait-for-timeout`, `playwright/no-force-option`), along with
  `no-floating-promises` to catch a missing `await`.
- **Order matters on re-render.** The card check looks for the match % first. It
  only appears on post-search cards, so it waits out stale pre-search cards.
- **Cookie banner.** The app loads Cookiebot. Its dialog doesn't currently show on
  the review domain, so the fixture registers `page.addLocatorHandler` for it. The
  handler declines non-essential cookies only if the dialog appears, without any
  conditional waits.
- **Strict, scoped locators.** The app renders a hidden mobile copy of the search form,
  so form locators are scoped to `data-testid="desktop-search-layout"`. There are
  no `.first()` calls to hide ambiguity.
- **No hard-coded result counts or ranking**, since data on a shared review env changes.
- **CI:** 2 retries, 1 worker, trace on first retry, screenshot/video on failure.
  Retries never hide problems: a test that passes only on retry is reported as
  **flaky** in the run summary and the report.

## Trade-offs

- **Card fields use the page structure.** Card internals have no roles, test ids
  or stable class names, only hashed emotion classes like `css-ag4k76`. The title is
  found as the element before the match-% ring, and the location by `svg.locationIcon`.
  A `data-testid` on these from the app team would make them solid.
- **The zero-results term depends on data.** Search is semantic, so random strings
  (`zzzqqqxxx123`, `qxjzv`) return hundreds of fuzzy matches. VS-02 uses
  "Underwater basket weaver", which is verified to return 0. If the shared data ever
  matches it, VS-02 fails with a message pointing to `data/testData.ts` rather than
  passing silently. Mocking the API would remove the dependency but would no longer
  test the real search.
- **The first card is checked strictly.** VS-01 asserts title, location and match %
  on the first card. Some vacancies on the env have no location ("Test 123"), so if
  one ranks first for "Software Engineer", VS-01 fails. Accepting any card would hide
  regressions on the top result.
- **VS-13 stubs the API.** `page.route` is the only safe way to test failure handling on
  a shared environment. It tests the UI's reaction, not the backend. The error message
  wording isn't specified, so the locator accepts common phrasings.
- **Accessibility uses a baseline, not zero violations.** Requiring zero violations
  would fail permanently on existing issues and get ignored. The baseline catches new
  issues today, and the separate known-bug test keeps the existing ones visible.
- **Chromium desktop only.** One project keeps runs fast on a shared env. Mobile is
  covered as a manual scenario (VS-10).
- **Gherkin is documentation, not executable.** The steps are mirrored in `test.step`
  with no Cucumber layer. That's less tooling, at the cost of keeping both in sync by hand
  (the `@VS-xx` tags make drift easy to spot).

## Troubleshooting

| Symptom                                         | Fix                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Playwright requires Node.js 20 or higher`      | `nvm install && nvm use` (reads `.nvmrc`)                                              |
| `Executable doesn't exist ... chromium`         | `npx playwright install chromium`                                                      |
| `bad CPU type in executable` (Apple Silicon)    | Your Node or Homebrew is x86_64-only. Install an arm64 Node 20 (nvm or nodejs.org)     |
| VS-02: `search API returned matches`            | Env data changed; pick a new zero-result title in `data/testData.ts`                   |
| Locator timeouts after an app release           | `npm run codegen`, inspect the markup, update `pages/` (the only place with selectors) |
| Flaky in CI only                                | Open the live report (or the `playwright-report` artifact) and the retried run's trace |
| `publish-report` fails: "Get Pages site failed" | Enable Pages once: Settings → Pages → Source: GitHub Actions                           |

## AI usage note

- **Used AI for:** scaffolding, drafting page objects, Gherkin edge cases, CI workflow.
- **Kept:** page-object structure, web-first assertions, a URL check that doesn't assume the query param name.
- **Changed/verified by me:** selectors against the real DOM, card-metadata assertions, retry/worker settings, pruning of scenarios.
- **Why:** AI is fast at boilerplate; selectors, assertions and trade-offs must be verified against the real app.
