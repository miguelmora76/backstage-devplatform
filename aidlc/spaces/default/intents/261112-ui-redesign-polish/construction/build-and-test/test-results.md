# Test Results: UI Redesign

Run on 2026-11-12, branch `u8-ui-redesign` at `4877f06`, on a freshly reset and rebuilt compose stack.

## Commands and results

| Command | Result |
|---|---|
| `yarn tsc` | exit 0 |
| `yarn lint` | exit 0 |
| `yarn prettier:check` | exit 0, all matched files use Prettier code style |
| `yarn test --watchAll=false --coverage --testPathIgnorePatterns packages/guardrails-server/src/performance.test.ts` | exit 0. 98 suites passed, 1 skipped; 1,073 tests passed, 12 skipped (skipped before this work). Lines 94.32%, statements 93.52%, branches 89.49%, functions 94.22% (project-wide) |
| `yarn workspace guardrails-server test --watchAll=false src/performance.test.ts` | exit 0, 1 suite, 4 tests passed |
| `yarn workspace e2e playwright test --project chrome --project firefox --no-deps layout a11y flows keyboard tree` | exit 0. 87 passed, 5 skipped, 0 failed |
| `yarn e2e checks` | exit 0 (published ports, missing-address start, output scan: all passed) |
| `yarn e2e:timing` | passed. p95 of 20 loads: sign-in 153 ms, catalog list 376 ms, service overview 362 ms, changes list 363 ms, change detail 259 ms, audit log 351 ms (limit 5 s) |

Counts are the same as the developer's own final run (1,077 tests, 99 suites with the performance suite), a re-run, not a copy.

## Where each check ran

- Unit and component tests: Node with a DOM emulator (jsdom). They cannot compute colour contrast, so contrast is covered by unit calculations and the real-browser scan.
- The layout, accessibility, flows, keyboard and tree specs, the live checks and the timing step: real browser engines (Chromium and Firefox through Playwright).
- Safari: by the person, by hand (below). Not a pipeline check.

## Skipped tests (not passes)

Five Firefox accessibility tests were skipped by the existing, annotated page-crash workaround on macOS arm64: service overview, changes list and audit log in the dark theme, and changes list and audit log in the light theme. Chrome ran every screen in both themes. The developer's earlier run skipped three; the set that crashes varies from run to run. The pipeline run on Linux (PR #9, run 43156229015, both `compose-e2e` and `minikube-e2e`) skipped the same five: dark theme service overview, changes list and audit log, and light theme service overview and audit log. So Firefox covers 9 of the 14 screen and theme combinations, and Chrome covers all 14.

## Pipeline run (PR #9)

The first run on the PR (run 43154499577 at `4877f06`) failed: `compose-e2e` and `minikube-e2e` each failed one spec, the catalog list at 1024 px (776 px of table in a 760 px container on Linux, wider fonts than macOS), and `ci-ok` failed with them. The fix (13 px table font, test first, `abd6899`) passed on this machine, and the second run (run 43156229015 at `d37a05b`) passed all 28 jobs including `ci-ok`: `compose-e2e` 99 passed and 5 skipped, `minikube-e2e` 99 passed and 5 skipped.

## Failures and flakes

None in this run. The developer's first browser batch had four failures (catalog at 1024 px and `flows.spec.ts`, in both browsers): the catalog ones were fixed by the 4 px cell padding, and `flows.spec.ts` failed only on a database holding earlier test data (fixed by `compose:reset`; the spec is unchanged). One guardrails-server timing test failed once during the developer's first full run while the stack was busy; it passed on the immediate re-run and on this run.

## Safari (FR5.1)

The person checked the compose run at `http://localhost:7007` in Safari on 2026-11-12 in the dark and the light theme and reported "all good in both themes": styled, nothing clipped, no sideways page scroll. This is the person's statement; there is no recording or screenshot.

## Failure predicate

No build or test command failed, and no applicable target is `Not Met` or `Unverified`. The stage result is successful, with one limitation named in the summary: five of fourteen Firefox accessibility screens are skipped by a known crash workaround, in the pipeline as well.
