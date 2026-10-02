# GloPros vacancy search – E2E (Playwright + TypeScript)

[![E2E](https://github.com/nilmumcu/glopros-e2e/actions/workflows/e2e.yml/badge.svg?branch=main)](https://github.com/nilmumcu/glopros-e2e/actions/workflows/e2e.yml?query=branch%3Amain)

**Start here**

1. **What it tests:** the vacancy search happy path on the GloPros review app (homepage → Vacancy search → "Software Engineer" → results), read-only.
2. **Run it:** `nvm use && npm ci && npx playwright install chromium && npm test`
3. **Core vs extras:** untagged tests are the required core; tests tagged `@extended` (live-data checks, suspected issues) run in a separate, non-blocking CI job.
4. **Results:** `npm run report` locally, the [live report](https://nilmumcu.github.io/glopros-e2e/), or the [latest green run](https://github.com/nilmumcu/glopros-e2e/actions/workflows/e2e.yml?query=branch%3Amain+is%3Asuccess).
5. **Scenarios:** `features/vacancy-search.feature` (Gherkin); each `@VS-xx` tag matches a test.

## Run

Requires Node 20+ (`.nvmrc`).

| Command                                       | What it does                                |
| --------------------------------------------- | ------------------------------------------- |
| `npm test`                                    | All tests, headless                         |
| `npm run test:headed` / `npm run test:ui`     | Watch the browser / step through in UI mode |
| `npx playwright test --grep-invert @extended` | Core only (what decides a green CI run)     |
| `npx playwright test --grep @extended`        | Extended only                               |
| `npm run report`                              | Open the last HTML report                   |
| `npm run typecheck` / `lint` / `format:check` | Static checks                               |

Target another environment with `BASE_URL=https://... npm test`.

## Structure

```
features/   Gherkin scenarios (automated + manual)
tests/      Specs; each test.step mirrors a Gherkin step
pages/      Page objects; all selectors and assertions
fixtures/   Injects page objects, handles the cookie banner, attaches a final screenshot
data/       Search terms and the accessibility baseline
support/    axe accessibility scan helper
```

## Coverage

| ID              | Scenario                                                                                              | Tier                |
| --------------- | ----------------------------------------------------------------------------------------------------- | ------------------- |
| VS-01           | Search by main job title (the brief's happy path)                                                     | Core                |
| VS-13           | API failure shows no misleading results (stubbed)                                                     | Core                |
| VS-02           | Title that matches nothing → empty state                                                              | Extended            |
| VS-11           | Results ordered by match %                                                                            | Extended            |
| VS-12           | Case/whitespace variants give the same results                                                        | Extended            |
| VS-13           | API failure shows an error message                                                                    | Extended, suspected |
| VS-14           | Accessibility (axe, WCAG 2.1 A/AA)                                                                    | Extended            |
| VS-03–10, VS-15 | Empty title, special characters, long title, Enter key, distance, deep link, back, mobile, start date | Manual              |

VS-01 checks everything step 5 of the brief asks for: the default filters (100km, no location or dates), `type=vacancies` and `main_job_title[0]` in the URL, a match count equal to the search API total, and the top card's title, location and match % against the top API result. No count or ranking is hard-coded.

## Findings

Expected behaviour for these isn't specified, so they're labelled observed or suspected, not bugs.

| Finding                                                                                                        | Status                         | Where                |
| -------------------------------------------------------------------------------------------------------------- | ------------------------------ | -------------------- |
| "Software&nbsp;&nbsp;&nbsp;Engineer" (3 inner spaces) returns 511 matches with lower scores; 2 spaces are fine | Suspected                      | VS-12, `test.fail()` |
| When the search API fails, the results area goes blank with no message                                         | Suspected                      | VS-13, `test.fail()` |
| Search form: icon-only button without a name, unlabeled distance select, icons without alt text                | WCAG failure (axe)             | VS-14, `test.fail()` |
| Typing triggers the search (~0.6s debounce); the search icon and Enter send no extra request                   | Observed                       | VS-01, VS-06         |
| An empty title leaves the URL unchanged and sends no request                                                   | Observed                       | VS-03                |
| Start date is stored in the URL as UTC: 15 Oct in Amsterdam becomes `2026-10-14T22:00:00.000Z`                 | Observed, off-by-one suspected | VS-15                |
| Search is semantic: "zzzqqqxxx123" returns 336 matches                                                         | Observed                       | VS-02                |

`test.fail()` tests assert the correct behaviour. `test.fail()` is called only after setup has passed, so a page that fails to load can't hide as an "expected failure". When the app changes, the test turns red, and the marker should be removed.

## Stability and trade-offs

- **Waits:** the test waits on the search API response (matched by request body), never on time. Web-first assertions only; no `waitForTimeout` or `force`, enforced by ESLint.
- **UI is checked against the API:** the count and the top card are compared with the API response, which also rules out reading stale pre-search results.
- **Locators:** scoped to the desktop form (the app renders a hidden mobile copy). Card internals have no roles or test ids; checking against the API avoids structural CSS. A `data-testid` from the app team would help most.
- **Core vs extended:** extended tests depend on shared data or track suspected issues. They stay visible but can't turn a run red.
- **VS-01 checks the top card strictly:** a top result without a location would fail it. Accepting any card would hide regressions on the top result.
- **Privacy:** the report is public. Email-like text is masked in screenshots and CI records no video. Traces (only on retry) can't be masked.

## CI

`quality → core (required) → extended (non-blocking) → publish-report` on every push to `main`, on pull requests, and manually. The publish step merges both tiers into one HTML report on GitHub Pages; a Pages problem can't fail the run. CI uses 2 retries and 1 worker.

## TODO

- Nightly scheduled run, to catch data or app changes on days nobody pushes.
- Ask the app team for `data-testid`s on card fields and an accessible name for the search button.

## AI usage

I built this with Claude Code (an AI coding agent) doing most of the hands-on work, which the brief allows. How the work was split:

- **Claude:** inspected the live app's DOM and network calls, wrote the page objects, tests, CI workflow and docs, and ran the repeat runs.
- **Me:** set the scope and rules (follow the brief, no hard-coded counts, never loosen an assertion to get green, call unspecified behaviour "observed" or "suspected"), asked for the stability checks (20× repeats, CI-mode runs), reviewed the results and diffs, and decided what to keep and what to cut.
- **What I changed after review:** the first version grew past the brief, so I had it split into a small required core and a non-blocking extended tier, dropped a nightly job and a custom summary script, and shortened this README.
- **Why:** AI is fast at investigation. Deciding the scope, what counts as an issue, and which trade-offs to accept stayed with me.
