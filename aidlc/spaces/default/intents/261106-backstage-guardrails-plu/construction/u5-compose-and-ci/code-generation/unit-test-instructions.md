# Unit Test Instructions — u5-compose-and-ci

## Framework and Setup

TypeScript with Jest through Backstage's test runner (`backstage-cli package test`), the same as u1 to u4. The new workspace package is `packages/e2e`; its unit tests live beside the code in `packages/e2e/src` and run without Docker. The live checks (Playwright specs under `packages/e2e/specs`, named `*.spec.ts` so the root Jest run does not pick them up) run against the running sample and are not unit tests.

Prerequisites: Node 22 or later, `yarn install` at the repository root. For the live checks only: Docker with Compose v2, and the browsers installed once with `yarn workspace e2e playwright install chrome firefox`.

## Commands

Unit tests of this unit only (no Docker):

```bash
yarn workspace e2e test --watchAll=false
```

With coverage (the 85% line threshold is in the package settings and is never lowered):

```bash
yarn workspace e2e test --watchAll=false --coverage
```

A single file while working: `yarn workspace e2e test --watchAll=false src/percentile.test.ts`.

Live checks (start the sample first with `yarn compose:up`; they start from `yarn compose:reset` in the pipeline):

```bash
yarn e2e
yarn e2e:timing
```

`yarn e2e` runs the flows, accessibility, keyboard, accessibility-tree, header, token, audit and repeatability specs in Chrome and Firefox. `yarn e2e:timing` runs the 20-load timing in Chrome and exits non-zero when any view's 95th percentile is over 5000 ms.

## What Is Tested

| Area | Tests | Notes |
|---|---|---|
| `percentile`, `composeArgs`, `ensureEnvFile`, `refuseOtherSeed`, `checkDocker`, `scanOutputs`, allow-list check | about 30 | Edge cases: equal values, wrong sample count, existing env file, volume without file, token in a zip entry, clean folder |
| Compose file, Dockerfile, ignore files | about 18 | Read as data; assert the properties of the design (one loopback port, rights, health checks, start order, equal base URLs, limits, seed literal, copied files resolve) |
| Workflow | about 12 | Read-only token, time limits, no push or login, no `secrets.`, `ci-ok` covers every job, exact PostgreSQL tag, named exemption |
| Live specs | about 30 checks | Run against the stack; not counted in coverage |

## Expected Coverage

Line coverage of `packages/e2e/src` at least 85%. The `.mjs` entries and the Playwright specs are excluded, each for the reason in the requirements. The coverage threshold is a global floor; Build and Test checks it on the full suite, and a unit-scoped run that fails only on that threshold with every selected test passing is recorded as such, not as a failed test.

## Mocking and Stubbing

Time, randomness and the file system are passed in or use temporary folders created by the test (inside the repository's ignored output folders, not `/tmp`); no test starts Docker. The `docker` and `docker compose` commands are called through one small function that tests replace with a recorder. No real secret is used; test passwords and tokens are made-up strings.

## Test Data

The compose file, Dockerfile, ignore files and workflow under test are the real files in the repository; fixture variants (a file with a second published port, a missing health check, a literal password) live under `packages/e2e/src/testing/fixtures/` and prove the checks fail when they should.
