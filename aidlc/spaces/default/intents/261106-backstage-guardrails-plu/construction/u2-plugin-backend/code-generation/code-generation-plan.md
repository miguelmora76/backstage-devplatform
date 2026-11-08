# Code Generation Plan — u2-plugin-backend

## Summary

- Builds: the guardrails plugin backend: demo sign-in and users, propose and decide (approve, reject, retry) flow with an atomic claim, the append-only audit log, and the plan and failed-run relay from the guardrails server
- Touches: a new package `packages/plugin-guardrails-backend/` (source, migrations, tests, contract file, local test compose file), the shared GitHub Actions workflow, `contract-summary.md`, `requirements.md` and `stories.md`
- Tests: about 90 tests in the Standard strategy (5 to 8 per component across 13 components, plus integration tests at the database, server and HTTP boundaries), written before their code; 85% line coverage enforced

Sources: `functional-spec.md`, `rules.md`, `entities.md`, `contract-summary.md`, `security-design.md`, `logical-components.md`, `tech-stack-decisions.md`, `security-requirements.md`, `cicd-pipeline.md` and `unit-of-work.md` for u2-plugin-backend. Stories implemented: US1.1, US1.2, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US5.1 and US5.2 (backend side).

## Decisions for This Plan

- **Package:** `packages/plugin-guardrails-backend` (name `plugin-guardrails-backend`, plugin id `guardrails`, role `backend-plugin`), inside the existing workspace (`packages/*`).
- **In-memory stand-in:** the design calls for an in-memory store behind the store interface. This plan uses Knex on in-memory SQLite (through Backstage's test database helper) as that stand-in, so there is one store implementation and one set of migrations. The rule tests (claim, release, repair, append-only trigger, concurrency, restart, 100,000 entries) run on real PostgreSQL. Please say at approval if you prefer a hand-written in-memory store.
- **Runner for PostgreSQL:** the test helper reads the connection string from `BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING`; a compose file in the package starts a throw-away PostgreSQL for it. Without that variable the PostgreSQL tests are skipped locally and reported as skipped in the code summary; CI sets it from its service container.
- **Frontend layer:** not applicable; this unit has no screens (u3 owns them).
- **Contract changes** from `functional-spec.md` and the NFR stages are written into `contract-summary.md` and the C1 interface file in the same pull request.

## Steps

- [x] **Step 1: Project structure and production configuration skeleton.** Create `packages/plugin-guardrails-backend/` with `package.json` (dependencies: `@backstage/backend-plugin-api`, `@backstage/plugin-auth-node`, `@backstage/errors`, `express`, `knex`, `pg`, `better-sqlite3` for tests, `zod`, `@modelcontextprotocol/sdk`; dev: `@backstage/backend-test-utils`, `supertest`), `tsconfig.json`, `config.d.ts` (the `guardrails.*` settings with visibility and types), `src/index.ts` and the empty plugin shell `src/plugin.ts`. Stories: all.
- [x] **Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.** Jest settings in `package.json` (coverage collected from `src`, 85% line threshold, 30 second timeout), one smoke test `src/plugin.test.ts` that loads the plugin, and the command in `unit-test-instructions.md`. NFR2.8.
- [x] **Step 3: Data model / database behavior - Red.** Write failing tests `src/database/migrations.test.ts` (tables `changes` and `audit_entries` exist with the columns of `entities.md`; unique `(change_id, decision_number)` for decisions; index on service and time; the audit trigger raises on update, delete and truncate; migrations are repeatable). Run on SQLite and PostgreSQL and record the failing output. Rules BR5.1, BR8.1; NFR5.5, NFR5.10, NFR1.4.
- [x] **Step 4: Data model / database behavior - Green.** Write the migrations `migrations/*.js` and `src/database/migrate.ts`; the append-only trigger (SQLite and PostgreSQL variants; truncate is blocked on PostgreSQL by a statement trigger).
- [x] **Step 5: Data model / database behavior - Refactor.** Name constants for table and column lists once; keep tests green.
- [x] **Step 6: Repository / data access - Red.** Failing tests: `src/store/changeStore.test.ts` (insert pending change; list by service with status filter, newest first, limit 200; read one; claim as one conditional update with exactly one winner; finish bound to the claim token; release of a claim older than 30 seconds with its audit entry in one transaction; reject claim released back to pending; repair of a missing latest entry) and `src/store/auditStore.test.ts` (append; duplicate `(changeId, decisionNumber)` has no effect; read newest first by time then entry id; filters from, to, actor, action, outcome; paging with default 20 and maximum 100; the store exposes no update or delete). Rules BR3.4, BR5.1–BR5.6, BR7.3, BR7.4, BR8.1; NFR1.7, NFR1.8, NFR5.7.
- [x] **Step 7: Repository / data access - Green.** Write `src/store/changeStore.ts`, `src/store/auditStore.ts` and `src/store/types.ts` with bound parameters only.
- [x] **Step 8: Repository / data access - Refactor.** Remove duplicated row mapping; keep tests green.
- [x] **Step 9: Business logic - Red.** Failing tests: `src/identity/demoUsers.test.ts` (three users, fixed roles), `src/rules/allowedActions.test.ts` (reason order SERVER_UNREACHABLE, AUDITOR_READ_ONLY, PROPOSER_CANNOT_DECIDE, IN_PROGRESS, NOT_PENDING, NOT_FAILED, ALREADY_CURRENT), `src/http/inputSchemas.test.ts` (known values, page ranges refused not clamped, reason over 2,000 characters refused, unknown fields removed, hostile text accepted as plain text), `src/server/guardrailsClient.test.ts` (against a stand-in MCP server built from the C2 spec: reads time out at 3 seconds and writes at 10 seconds with settings, no retry, unknown error code means failed write), `src/server/serverHealth.test.ts` (reuse for 5 seconds, concurrent reads share one probe, a forced-failure server counts as reachable), `src/workflow/changeWorkflow.test.ts` (propose paths W2; decide paths W3 and W4 including the check order of `security-design.md`, auditor and proposer refusals recorded with the reason as submitted, empty reason writes nothing, retry clears failure, second failed entry on repeated failure, CLAIM_RELEASED) and `src/workflow/recovery.test.ts` (release with a controllable clock, rebuild of missing proposal and decision entries). Rules BR1.2–BR1.4, BR2.1–BR2.6, BR3.1–BR3.9, BR4.1–BR4.3, BR6.1–BR6.5, BR7.1–BR7.7; NFR1.2, NFR1.3, NFR2.5, NFR5.4, NFR5.6, NFR5.9.
- [x] **Step 10: Business logic - Green.** Write `src/identity/demoUsers.ts`, `src/rules/allowedActions.ts`, `src/http/inputSchemas.ts`, `src/server/guardrailsClient.ts`, `src/server/serverHealth.ts`, `src/workflow/changeWorkflow.ts` and `src/workflow/recovery.ts`.
- [x] **Step 11: Business logic - Refactor.** Share the decision path between approve, reject and retry; keep tests green.
- [x] **Step 12: API / endpoint - Red.** Failing tests with supertest on the real router and a SQLite store: `src/http/router.test.ts` (every route of contract C1 including the open demo-user list; actor and role in the request are ignored; 401 for missing, malformed, unknown and service principals; 400 INVALID_INPUT and EMPTY_REASON write nothing; 403, 404, 409 and 503 codes and bodies; deciding never shown, previous status and IN_PROGRESS instead; plan and failed-run reads with allowed actions and 503 on outage; changes and audit reads work when the server is down), `src/http/requestLogger.test.ts` (one line with fixed fields; no reason, setting value or login in the log of a full run), `src/http/errorHandler.test.ts` (fixed 500 without detail), `src/auth/demoSignIn.test.ts` (provider and user list registered only when `guardrails.demoSignIn.enabled` is true; warning line when on; identity `user:default/<userId>`). Stories US1.1, US1.2, US2.1, US2.2, US3.1–US3.3, US4.1, US5.1, US5.2; NFR5.1–NFR5.3, NFR5.8.
- [x] **Step 13: API / endpoint - Green.** Write `src/http/router.ts`, `src/http/identityGuard.ts`, `src/http/errorHandler.ts`, `src/http/requestLogger.ts`, `src/auth/demoSignIn.ts` and wire everything in `src/plugin.ts` (settings reader, migrations at start-up, readiness).
- [x] **Step 14: API / endpoint - Refactor.** Keep route handlers thin; keep tests green.
- [x] **Step 15: Frontend behavior (Red, Green, Refactor).** Not applicable: this unit has no screens.
- [x] **Step 16: Rule tests on PostgreSQL.** Write `src/integration/postgres.rules.test.ts`: ten simultaneous decisions give one winner and nine ALREADY_DECIDED (NFR1.7); release after 30 seconds with a controlled clock (NFR1.8); forced failure after the claim (NFR5.9); restart against the same database (NFR5.10); 100,000 audit entries read within the target (NFR1.4); read and decision timings (NFR1.1, NFR1.2); hostile text (NFR5.7); concurrency of ten mixed requests and memory (NFR1.5, NFR1.6). Skipped locally when no PostgreSQL connection string is set.
- [x] **Step 17: Environment/build configuration.** Add `packages/plugin-guardrails-backend/compose.test.yaml` (throw-away PostgreSQL, one documented command), extend the shared GitHub Actions workflow with stages 4 to 8 of `cicd-pipeline.md` (create the workflow file with stages 1 to 3 if it does not exist), and add the contract check script that compares the stand-in server and the route list with the C2 spec and the C1 file. NFR6.1, NFR2.9.
- [x] **Step 18: Documentation and traceability.** Write `packages/plugin-guardrails-backend/README.md` (settings, how to run the tests, the demo sign-in switch and its accepted risk), `contract/c1-openapi.yaml`, update `contract-summary.md` with the additive changes (INVALID_INPUT, reason limit, NOT_ELIGIBLE, CLAIM_RELEASED, the reasons ALREADY_CURRENT and IN_PROGRESS, the open user-list route, `guardrails.demoSignIn.enabled`) and update `requirements.md` and `stories.md` for the proposed FR12.1 and the other points listed in `functional-spec.md` (delivery planning Q4: B). Then write `code-summary.md`, `source-manifest.json` and `traceability.json` in the record.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "For each layer, write a failing test before writing the code that makes it pass.",
  "scope": "mvp",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Ordering**: For each layer, write a failing test before writing the code that makes it pass.\n- **Methodology evidence**: The team chose test-first (test-driven) development in the interview (Q3: B); no existing code or history exists to suggest otherwise.\n- Coverage: at least 85% line coverage on the plugin code, and CI runs the tests before merge and must be green (Q4).\n- Build and Test may not weaken the coverage floor to pass."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:b4a8500ee06ca516328b6af1aaf731b1f118b83b754e86211c0928e7e4bd042e",
  "contract_sha256": "sha256:e296bbb8657fda2574bff860c37db41f575891b05caa066b632cf57f0a3659da"
}
```
