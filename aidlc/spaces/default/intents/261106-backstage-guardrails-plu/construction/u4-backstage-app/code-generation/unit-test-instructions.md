# Unit Test Instructions — u4-backstage-app

Sources: the test strategy (Standard), the Testing Contract in `code-generation-plan.md` (test-driven, 85% line floor), `tech-stack-decisions.md` (NFR2.1 to NFR2.5, NFR2.10), `security-design.md`, `reliability-design.md` and `cicd-pipeline.md`.

## Framework and Setup

- Runner: Backstage's Jest runner (`backstage-cli package test`) in `packages/app` and `packages/backend`, set up in plan Step 2.
- Libraries: React Testing Library with its user-event helper, `jest-axe`, `msw` for the stand-in backend in the browser tests, `@backstage/backend-test-utils` for the start-up test, `yaml` for the settings and catalog checks.
- Node 22 or later, `yarn install` once at the repository root. No Docker is needed.

## Commands for This Unit

Run from the repository root.

| Purpose | Command |
|---|---|
| Frontend package tests | `yarn workspace app test --watchAll=false` |
| Backend package tests, except the start-up test | `yarn workspace backend test --watchAll=false --testPathIgnorePatterns startup` |
| Start-up test only | `yarn workspace backend test --watchAll=false startup` |
| Catalog drift check | `yarn workspace backend catalog:check` |
| Settings and allow-list checks | `yarn workspace backend check:settings` and `yarn workspace app check:packages` and `yarn workspace backend check:packages` |
| Lint and type check for the two packages | `yarn workspace app lint` and `yarn workspace backend lint` |

Coverage runs are commands of their own, because a coverage threshold can fail the exit code with every test passing:

| Purpose | Command |
|---|---|
| Frontend coverage | `yarn workspace app test --watchAll=false --coverage` |
| Backend coverage | `yarn workspace backend test --watchAll=false --coverage --testPathIgnorePatterns startup` |

## Expected Coverage

- At least 85% line coverage on the app's own code (sign-in page, identity handling, catalog script logic, settings check). Excluded, as written in each package's Jest settings: `index.ts`, the bootstrap entry file, type declaration files, test files and purely declarative configuration.
- Build and Test checks the floor on the full suite. A unit-scoped coverage run that fails only on the threshold, with every selected test passing, is recorded as such and is not a failed test. The threshold is never lowered.

## Expected Test Volume (Standard)

| Component | Tests | Kind |
|---|---|---|
| `buildCatalog` and the catalog script | 7 | unit, file comparison |
| `checkShippedSettings` | 8 | unit with bad fixtures |
| `signInState` | 6 | unit, table |
| `signInClient` | 7 | unit, fake timers |
| `IdentityHolder` | 5 | unit |
| `SignInPage` | 10 | component, accessibility, keyboard, hostile text |
| App wiring and sign-out | 4 | component |
| `backendFeatures` and the start-up test | 8 | integration with the test backend |
| `check-packages`, source scan, lint fixtures | 6 | unit |

## Mocking and Stubbing

- Browser tests stand in for the backend with `msw` handlers for the user list and the start address; time-dependent behavior uses fake timers, never wall-clock waits.
- The start-up test uses a stand-in guardrails server (a small local HTTP server started in the test), in-memory SQLite and a logger service that records its lines. Credentials for the three kinds of caller are built with the test backend's credential helpers.
- The real `authModuleDemoSignIn` is used, not a stand-in.

## Test Data

- The catalog tests use the u1 generator with the default seed 20261106; fake tokens and passwords are fixed strings that exist only inside tests.
- Hostile text fixtures (`<img src=x onerror=...>`) live in one test data file.

## Not Run in This Unit

The real-browser checks, the 20-load timing, the end-to-end token verification with the real auth backend and, if the test backend does not apply them, the CORS and content-policy header checks are built and run by u5.
