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
data/       Test data (search terms)
.github/    CI workflow: typecheck, lint, format check, tests, report artifact
```

Specs import `test`/`expect` from `fixtures/`, not from `@playwright/test`, and get
page objects injected:

```ts
test('...', async ({ vacancySearchPage }) => { ... });
```

## Coverage and traceability

| ID    | Scenario (`features/vacancy-search.feature`) | Status    | Test (`tests/vacancy-search.spec.ts`)                            |
| ----- | -------------------------------------------- | --------- | ---------------------------------------------------------------- |
| VS-01 | Search by main job title (happy path)        | Automated | `user finds vacancies by main job title` `@smoke`                |
| VS-02 | Search with a title that matches nothing     | Automated | `search with a title that matches nothing shows the empty state` |
| VS-03 | Search with an empty job title               | Manual    | –                                                                |
| VS-04 | Special characters and whitespace in title   | Manual    | –                                                                |
| VS-05 | Very long job title                          | Manual    | –                                                                |
| VS-06 | Submit with the Enter key                    | Manual    | –                                                                |
| VS-07 | Change the distance filter                   | Manual    | –                                                                |
| VS-08 | Deep link to a search URL                    | Manual    | –                                                                |
| VS-09 | Browser back keeps search state              | Manual    | –                                                                |
| VS-10 | Mobile viewport                              | Manual    | –                                                                |

Run a single scenario by ID: `npx playwright test --grep @VS-01`.

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
- **CI:** 2 retries, 1 worker, trace on first retry, screenshot/video on failure,
  report uploaded as an artifact.

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
- **Chromium desktop only.** One project keeps runs fast on a shared env. Mobile is
  covered as a manual scenario (VS-10).
- **Gherkin is documentation, not executable.** The steps are mirrored in `test.step`
  with no Cucumber layer. That's less tooling, at the cost of keeping both in sync by hand
  (the `@VS-xx` tags make drift easy to spot).

## Troubleshooting

| Symptom                                      | Fix                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Playwright requires Node.js 20 or higher`   | `nvm install && nvm use` (reads `.nvmrc`)                                              |
| `Executable doesn't exist ... chromium`      | `npx playwright install chromium`                                                      |
| `bad CPU type in executable` (Apple Silicon) | Your Node or Homebrew is x86_64-only. Install an arm64 Node 20 (nvm or nodejs.org)     |
| VS-02: `search API returned matches`         | Env data changed; pick a new zero-result title in `data/testData.ts`                   |
| Locator timeouts after an app release        | `npm run codegen`, inspect the markup, update `pages/` (the only place with selectors) |
| Flaky in CI only                             | Download the `playwright-report` artifact and open the trace from the retried run      |

## AI usage note

- **Used AI for:** scaffolding, drafting page objects, Gherkin edge cases, CI workflow.
- **Kept:** page-object structure, web-first assertions, a URL check that doesn't assume the query param name.
- **Changed/verified by me:** selectors against the real DOM, card-metadata assertions, retry/worker settings, pruning of scenarios.
- **Why:** AI is fast at boilerplate; selectors, assertions and trade-offs must be verified against the real app.
