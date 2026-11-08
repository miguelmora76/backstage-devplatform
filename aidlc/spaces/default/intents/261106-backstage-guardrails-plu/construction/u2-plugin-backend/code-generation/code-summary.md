# Code Summary — u2-plugin-backend

## What Was Built

The guardrails plugin backend, as the package `packages/plugin-guardrails-backend` (plugin id `guardrails`, Backstage new backend system): the demo sign-in and demo users, propose and decide (approve, reject, retry) with an atomic claim, the append-only audit log, recovery of stuck claims and missing entries, and the relay of the upgrade plan and failed CI runs from the guardrails server.

## Files Created

All under `packages/plugin-guardrails-backend/` unless marked.

- **Package setup:** `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.js`, `config.d.ts`, `README.md`, `compose.test.yaml`, `migrations/20261106000000_init.js`, `contract/c1-openapi.yaml`
- **Source:** `src/index.ts`, `plugin.ts`, `settings.ts`, `clock.ts`, `ids.ts`, `errors.ts`; `src/auth/demoSignIn.ts`; `src/database/migrate.ts`, `tables.ts`; `src/http/router.ts`, `identityGuard.ts`, `inputSchemas.ts`, `requestLogger.ts`, `errorHandler.ts`; `src/identity/demoUsers.ts`; `src/rules/allowedActions.ts`; `src/server/guardrailsClient.ts`, `serverHealth.ts`; `src/store/types.ts`, `rows.ts`, `changeStore.ts`, `auditStore.ts`; `src/workflow/changeWorkflow.ts`, `recovery.ts`
- **Test support** (excluded from coverage and the build): `src/testing/testDatabases.ts`, `fakeClock.ts`, `standInServer.ts`, `harness.ts`
- **Tests:** 20 suites, covering every component, the C1 and C2 contract check, the PostgreSQL rule tests (`src/integration/postgres.rules.test.ts`) and the timing tests (`src/integration/timing.test.ts`)

## Files Modified

- `.github/workflows/ci.yml`: plugin lint and type-check steps added to the existing jobs, and jobs `plugin-unit` (stage 4), `plugin-rules` (stage 5, PostgreSQL service container), `plugin-coverage` (stage 6), `plugin-contract` (stage 7) and `plugin-build` (stage 8)
- `yarn.lock`: new dependencies
- In the record: `inception/contract-design/contract-summary.md` (new section "Changes made in u2 Code Generation", the `/demo-users` route, new reasons and codes, the 2,000-character reason limit, the C3 settings), `inception/requirements-analysis/requirements.md` (FR1.2, FR2.2, FR3.1, FR4.2, FR4.3, FR5.1, FR5.2, FR11.2 amended; FR12.1 added) and `inception/user-stories/stories.md` (new acceptance criteria AC2.1.3, AC2.1.4, AC2.2.3, AC3.2.4, AC3.2.5, AC4.1.6, AC5.1.3, AC5.2.4; AC3.1.1, AC5.1.1, AC5.2.2 amended)

## Key Implementation Decisions

- Express 4 with `express-promise-router`, matching Backstage's own backend packages.
- Fast tests use Knex on in-memory SQLite as the stand-in store (one implementation, one set of migrations); the rule tests use a real PostgreSQL 16.
- The demo sign-in start route is `GET /api/auth/demo/start?userId=<id>`, delivered as `authModuleDemoSignIn`; u4 must add this module to the backend (recorded in `contract-summary.md` and the README).
- Audit reads also run claim release and entry repair; a failure there is logged and the read carries on.

## Test and Coverage Summary

Run by the conductor on 2026-11-08 with `yarn workspace plugin-guardrails-backend test --watchAll=false --coverage` (no PostgreSQL connection string set): 19 suites passed and 1 skipped; 176 tests passed and 12 skipped; line coverage 98.67% (595 of 603), statements 97.99%, branches 94.44%, functions 100%. The 85% line threshold is set in the package and was not lowered. The developer's run with a real PostgreSQL 16 from `compose.test.yaml`: 20 suites, 289 tests passed, line coverage 98.67%. Package lint, root type check and Prettier check were reported clean, and the u1 suite still passed (138 tests); these were run by the developer, not again by the conductor.

## Tests Written but Not Executed in This Stage

- The 12 PostgreSQL cases skip when `BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING` is unset; the developer ran them against PostgreSQL 16 (289 tests passed), and the conductor's own run left them skipped. They also run in the `plugin-rules` CI job.
- The CI workflow itself was not run; only its YAML syntax and Prettier formatting were checked. It runs on the pull request.

## Deviations from the Plan

1. Step 16 (PostgreSQL rule tests) had no real Red: they exercise code that already existed and passed on first run.
2. `ids.test.ts` and the Step 17 contract test were written after the code they cover (the contract test first failed on missing exports, then passed).
3. Re-run proposals: the server's failed-runs tool lists only failed runs, so an unknown run key cannot be told from a run that is no longer failed; a re-run for a run not in the list is refused with NOT_ELIGIBLE, not NOT_FOUND. Unknown service or dependency still gives NOT_FOUND.
4. The demo-user list when the demo sign-in is off: with no sign-in it answers 401 (the identity check answers first) and with a sign-in it answers 404; it is never open. The design said it needs no sign-in while the switch is on; this build follows that when on.
5. CI stage 6 re-runs the full suite with the PostgreSQL service container and the 85% threshold instead of merging coverage from stages 4 and 5. CI stage 8 builds only the plugin, because the backend package that includes it belongs to u4.
6. Two extra dev dependencies: `guardrails-server` (to find the C2 spec file) and `yaml` (to read the C1 file).
7. The developer started Docker Desktop to run the PostgreSQL tests; it was left running and the throw-away container and volume were removed.
