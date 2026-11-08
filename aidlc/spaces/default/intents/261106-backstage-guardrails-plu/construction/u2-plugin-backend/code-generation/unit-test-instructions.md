# Unit Test Instructions — u2-plugin-backend

Sources: `code-generation-plan.md`, `tech-stack-decisions.md` (NFR2.8, NFR2.9), `cicd-pipeline.md` and the Testing Contract (TDD, Standard strategy, 85% line floor).

## Framework and Setup

- Backstage's test runner (`backstage-cli package test`, Jest) in the package `packages/plugin-guardrails-backend`, set up in Step 2 of the plan with the 85% line threshold in the package's Jest settings. The threshold is never lowered.
- Supertest drives the real router; `@backstage/backend-test-utils` provides the test database helper.
- Install once from the project root with the workspace's package manager (`yarn install`), which the plan's Step 1 prepares.

## Commands for This Unit Only

Run from the project root. The first is the command usable before the first test-first cycle and for the fast tests (in-memory SQLite stand-in; PostgreSQL tests are skipped when no connection string is set):

```
yarn workspace plugin-guardrails-backend test --watchAll=false
```

The rule tests on a real PostgreSQL (needs docker for the throw-away database):

```
docker compose -f packages/plugin-guardrails-backend/compose.test.yaml up -d --wait
BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING=postgresql://postgres:postgres@localhost:55432/postgres yarn workspace plugin-guardrails-backend test --watchAll=false src/integration/postgres.rules.test.ts
docker compose -f packages/plugin-guardrails-backend/compose.test.yaml down -v
```

A single test file is run by adding its path after the command, for example `src/rules/allowedActions.test.ts`.

## Expected Coverage

At least 85% line coverage on the plugin code (`packages/plugin-guardrails-backend/src`), from the fast tests and the PostgreSQL rule tests together. The floor is a project-wide rule that Build and Test checks on the full suite; a run of one file does not judge it, and its threshold is never changed to make a run pass.

Command for the coverage report of this unit (a command of its own, since its threshold can fail the exit code):

```
yarn workspace plugin-guardrails-backend test --watchAll=false --coverage
```

## Test Volume

Standard strategy: five to eight tests per component for 13 components (identity, input check, allowed-action rules, change workflow, change store, audit store, recovery, guardrails client, server health, request logger, error handler, demo sign-in, router), unit tests plus integration tests at the database, server and HTTP boundaries, and the PostgreSQL rule tests. Each file covers the happy path and at least two error or edge cases (phase guardrail).

## Mocking and Stubbing

- Guardrails server: a stand-in MCP server built from the C2 spec file kept by u1 (`packages/guardrails-server/contract/c2-tools.json`), started in the test process with a settable delay, failure mode and tool errors. The plugin never reads seeded data directly (FR6.2).
- Clock: an injectable clock; release tests move it past 30 seconds. No test waits in real time for the release.
- Identity: tests build credentials for the three demo users, a service principal and an unknown user.
- Database: in-memory SQLite for fast tests; real PostgreSQL for the rule tests.

## Test Data

Three demo users (sam, priya, alex); two services with a few dependencies and runs defined in the test stand-in; audit sets of 100,000 generated entries for the read-time test. No real data; every value is invented.
