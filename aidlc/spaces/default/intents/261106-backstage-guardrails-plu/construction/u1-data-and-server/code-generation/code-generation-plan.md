# Code Generation Plan — u1-data-and-server

## Summary

- Builds: the synthetic guardrails server (four MCP tools, health route), its seeded data generator, a container image, and the shared workspace and CI pipeline they need
- Touches: new workspace at the project root (`package.json`, `tsconfig.json`, `packages/guardrails-server/`, `.github/workflows/ci.yml`) and one appended block in your existing `.gitignore`
- Tests: about 45 tests written before the code (unit per component, integration at the HTTP and MCP boundary, performance, repeatability, contract), at least 85% line coverage

Sources: `functional-spec.md`, `rules.md`, `entities.md` (u1 functional design), the NFR design and infrastructure design documents for this unit, `contract-summary.md` (contracts C2 and C4), `unit-of-work.md`, `requirements.md` and `bolt-plan.md` (this is the first Bolt built, so it also creates the workspace and pipeline). Stories: US6.1, US1.1, US1.2, US3.3 (server side).

## Decisions in This Plan You Should Know About

| Decision | Choice | Why |
|---|---|---|
| Workspace shape | A Yarn workspace at the project root with `packages/*`, using Backstage's command-line tool for test, lint and formatting settings. It does **not** run Backstage's app scaffolder now: u4-backstage-app adds the app and backend packages later | The Bolt plan keeps the workspace bare so u4 can wire the app; running the full scaffolder now would add an app this Bolt does not need |
| Package manager | Yarn classic (1.x), which Backstage's tooling expects. Yarn is not installed on this machine, so Step 1 installs it globally with npm | Backstage's usual settings (team practice) |
| Node.js | Code targets the current long-term-support line and the image uses it; this machine has a newer release, which is accepted by the engines range | NFR2.1 |
| Your `.gitignore` | One appended block for `node_modules`, build output and coverage output; nothing of yours is changed | The work cannot commit cleanly without it |
| Contract spec copy | The C2 tool spec is kept as a machine-readable file in this unit (`packages/guardrails-server/contract/c2-tools.json`), owned by u1, so u2 and this unit can check against the same file | Contract ownership rules |

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

Layers that do not apply to this unit: **Frontend behavior** (no screens; delivered by u3-plugin-ui) and **Database behavior** (no database; the data set is in memory), so the data-model layer here means the entity types and the data generator.

## Steps

Each step names the story it serves: US6.1 server and repeatable data, US1.1 upgrade plan data, US1.2 failed CI run data, US3.3 retry (forced failure and safe repeats). Test steps are Red (write failing tests, run them, record the failing output), Green (smallest code to pass), Refactor (clean up while green).

- [x] **Step 1 — Workspace and package skeleton (US6.1).** Install Yarn classic globally with npm. Create the root `package.json` (private, workspaces `packages/*`, engines range for the long-term-support Node.js line), `tsconfig.json`, Prettier and ESLint configuration using Backstage's usual settings, and `packages/guardrails-server/` with its `package.json` (role node-library, scripts for test, lint, build and the generator command) and empty `src/` and `contract/`. Append the ignore block to `.gitignore`. Install dependencies (the official MCP TypeScript kit, Backstage's command-line tool, TypeScript types) and commit the lock file.
- [x] **Step 2 — Test runner ready (US6.1).** Configure the test runner and coverage report through Backstage's command-line tool. Record the exact unit-scoped command in `unit-test-instructions.md` and prove it runs with one trivial test that is replaced in Step 3. Set the coverage floor at 85% lines for the server and generator code, and do not lower it.
- [x] **Step 3 — Data model: Red (US6.1, US1.1, US1.2).** Write failing tests for the entity types and the generator: same seed gives identical bytes (BR1.1); default sizes within the limits (BR1.2); the required cases are present (BR1.3: a service with no dependencies, a service with no failed runs, two dependencies already current, four failure causes); names, versions and the synthetic marker (BR1.4); key shapes and uniqueness (BR1.5); recommended never below current (BR1.6); a stored copy of the default data set that the output must equal; the test-only size factor producing about ten times the data; a build-time test. Record the failing output.
- [x] **Step 4 — Data model: Green (US6.1).** Implement the entity types, the seeded whole-number random generator, the builders, the required-case adjustment, the fixed ordering and the fixed serialization, the default-size entry point (which checks the limits) and the test-only size entry point. Generate and store the default data set copy for the test.
- [x] **Step 5 — Data model: Refactor (US6.1).** Tidy the builders and the serializer while tests stay green.
- [x] **Step 6 — Data access: Red (US1.1, US1.2, US3.3).** Write failing tests for the data store and the overlay: prepared lists ordered by name and newest first; the overlay applied to the plan and the failed list; applying an upgrade and a re-run; repeats change nothing; a restart (new overlay) gives the seeded state (BR2.1–BR2.6, NFR7.3). Record the failing output.
- [x] **Step 7 — Data access: Green (US1.1, US1.2, US3.3).** Implement the read-only data store with prepared lists, and the overlay as two key sets with one-step insertions.
- [x] **Step 8 — Data access: Refactor.** Tidy while green.
- [x] **Step 9 — Business logic: Red (US6.1, US1.1, US1.2, US3.3).** Write failing tests for the settings reader (valid and invalid seed, failure mode and port; fixed sentence that names the setting; defaults), the four tool handlers (success paths, empty lists, UNKNOWN codes, INVALID_INPUT, idempotent apply and re-run), the failure gate first (FORCED_FAILURE before every other check, including bad input), the fixed check order, the error mapper (fixed messages; unexpected error becomes INTERNAL_ERROR), and the call logger (one line per call, a dash for an unknown service, no caller text, start line). Record the failing output.
- [x] **Step 10 — Business logic: Green.** Implement the settings reader, the handlers with the failure gate, input check and error mapper wrapped around each, and the call logger.
- [x] **Step 11 — Business logic: Refactor.** Tidy while green.
- [x] **Step 12 — API: Red (US6.1, US3.3).** Write failing tests that start the server on a free port and call it through the MCP kit's client over streamable HTTP: all four tools return data consistent with the seed; the health route answers not ready before the listening callback and ready after; any other path or method is refused with a fixed body; a call with the failure setting on fails every tool; the 200-call benchmark meets 200 ms at the 95th percentile; 10 simultaneous calls succeed and identical writes leave one change (NFR1.4); the NFR1.5 large-data server loads through the factory; no file is written during a full run; the tool list is exactly the four tools. Record the failing output.
- [x] **Step 13 — API: Green.** Implement the HTTP shell with the MCP route and health route, the route allowlist, the server factory that takes a ready data set, the ready flag set in the listening callback, and the main entry point (settings, generator, factory, start line).
- [x] **Step 14 — API: Refactor.** Tidy while green.
- [x] **Step 15 — Contract check (US6.1).** Write the machine-readable C2 spec file (`contract/c2-tools.json`) from the contract summary with this unit's changes, and a contract test that checks every tool's input and output shape and error codes against it. Include a test that a deliberately wrong stand-in fails the same check.
- [x] **Step 16 — Generator command (US6.1).** Add the command-line mode that prints the data set for the byte-for-byte comparison, with a test that two runs print identical output.
- [x] **Step 17 — Environment and build configuration.** Write the multi-stage `Dockerfile` (non-root user, one exposed port, production dependencies only), `.dockerignore`, and the health probe as a small Node.js script that reads the PORT setting and requests the health route (the image has no curl). Add the shared workflow `.github/workflows/ci.yml` with the jobs from the pipeline design: format, lint, type check, tests with coverage, repeatability, contract check, image build with a non-root check, and a container smoke test that also runs the container with a read-only root file system and no published port. Run what can be run locally (all but the hosted workflow itself).
- [x] **Step 18 — Carry the recorded changes into the design documents.** Write the changes noted during Functional Design and NFR Design into the contract and rules: add INVALID_INPUT and INTERNAL_ERROR to the error codes in the contract summary and in the u1 rules and entities, and replace the contract's "not idempotent" for the re-run tool with the safe-to-repeat rule. Name each change in `code-summary.md`.
- [x] **Step 19 — Documentation and traceability.** Short README for the package (how to run, test, generate and build), `code-summary.md`, the story-to-step map, and `traceability.json`.

## Story to Step Map

| Story | Steps |
|---|---|
| US6.1 | 1–5, 9–10, 12–13, 15–17 |
| US1.1 | 3–4, 6–7, 9–10, 12–13 |
| US1.2 | 3–4, 6–7, 9–10, 12–13 |
| US3.3 | 6–7, 9–10, 12–13 |

## Files

Created outside the unit directory: `package.json`, `tsconfig.json`, Prettier and ESLint configuration, `yarn.lock`, `.github/workflows/ci.yml`. Changed: `.gitignore` (one appended block). Everything else is under `packages/guardrails-server/`.
