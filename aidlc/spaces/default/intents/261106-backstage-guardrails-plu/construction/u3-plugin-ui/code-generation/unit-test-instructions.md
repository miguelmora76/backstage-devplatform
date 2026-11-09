# Unit Test Instructions — u3-plugin-ui

Sources: `code-generation-plan.md`, `tech-stack-decisions.md` (NFR2.8, NFR2.9, NFR2.10), `performance-requirements.md`, `security-requirements.md`, `cicd-pipeline.md` and the Testing Contract (TDD, Standard strategy, 85% line floor).

## Framework and Setup

- Backstage's test runner (`backstage-cli package test`, Jest with jsdom) in the package `packages/plugin-guardrails`, set up in Step 2 of the plan with the 85% line threshold in the package's Jest settings. The threshold is never lowered.
- React Testing Library and its user-event helper drive the screens; `@backstage/test-utils` renders them inside a test app with the plugin's APIs; `msw` provides the stand-in backend; `jest-axe` scans each screen state.
- `src/setupTests.ts` pins the time zone (`TZ`) and uses fake timers for every timing test; no test waits in real time.
- Install once from the project root with the workspace's package manager (`yarn install`), which Step 1 of the plan prepares.

## Commands for This Unit Only

Run from the project root. The first is the command usable before the first test-first cycle, and runs every test of this unit:

```
yarn workspace plugin-guardrails test --watchAll=false
```

A single test file is run by adding its path after the command, for example `src/api/guardrailsApi.test.ts`.

The package allow-list check and the address and size checks (after a build):

```
yarn workspace plugin-guardrails build
yarn workspace plugin-guardrails check:packages
yarn workspace plugin-guardrails check:built
```

## Expected Coverage

At least 85% line coverage on the plugin code (`packages/plugin-guardrails/src`). The floor is a project-wide rule that Build and Test checks on the full suite; a run of one file does not judge it, and its threshold is never changed to make a run pass.

Command for the coverage report of this unit (a command of its own, since its threshold can fail the exit code):

```
yarn workspace plugin-guardrails test --watchAll=false --coverage
```

## Test Volume

Standard strategy: five to eight tests per part for about 25 parts (GuardrailsApi, DemoSession, Texts, formatTime, section hook, derive rules, plugin and routes, GuardedButton, StatusLabel, ReasonField, PagedTable, SectionState, ServerErrorPanel, banner and alert, card, header and switch, plan, CI, open changes, audit with filters, view, detail screen and its parts), unit tests plus tests at the boundaries (the stand-in backend, the extensions inside a test app), the contract test, and the cross-cutting security, accessibility, keyboard and performance tests. Each file covers the happy path and at least two error or edge cases (phase guardrail).

## Mocking and Stubbing

- Plugin backend: `msw` handlers in `src/testing/standIn/` answering the C1 calls with fixed data and switches for every state (empty, error, server unreachable, slow, never answers, each error code). `src/testing/standIn/contract.test.ts` reads `packages/plugin-guardrails-backend/contract/c1-openapi.yaml` and fails when a handler's answers differ.
- Sign-in start path: a handler answering with the Backstage sign-in shape (`backstageIdentity.token`); the fake token is a fixed string used only in tests.
- Discovery and fetch: stand-ins from `@backstage/test-utils`.
- Clock and time zone: pinned in the setup file; timing tests use fake timers.

## Test Data

Three demo users (sam, priya, alex) with their roles; two services with a few dependencies, failed runs and changes in each state; audit sets of 25 entries (three pages) and a seeded set of 200 open changes for the render guard. No real data; every value is invented, including hostile strings for the text-not-markup tests.

## Checks Left Open for u5 (Real Browser)

These cannot be made in a simulated browser and are built and run by u5 against the compose sample in Chrome and Firefox: colour contrast, real focus behavior, a screen-reader pass of walkthrough 1 (NFR3.4); the flows of FR1 to FR4 in both browsers (NFR4.1); the 20-load 95th percentile of each view within 5 seconds (NFR1.1); the real-browser tool itself (NFR2.11). Until then they are listed as open.
