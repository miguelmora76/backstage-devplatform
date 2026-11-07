# Code Summary — u1-data-and-server

Built from the approved plan (19 steps, TDD, standard strategy, 85% line coverage, contract `sha256:e296bbb8657fda2574bff860c37db41f575891b05caa066b632cf57f0a3659da`). All 19 steps are done. Stories: US6.1, US1.1, US1.2, US3.3 (server side).

## What Was Built

A Yarn classic workspace at the project root with one package, `packages/guardrails-server`, holding:

- **Seeded generator** (`src/generator/`): whole-number mulberry32 random generator (`prng.ts`), builders with the required-case adjustment (`generator.ts`), fixed ordering by code units and fixed serialization (`serialize.ts`), a default-size entry point `generateDataSet` that enforces BR1.2 and BR1.3 (`verifyDefaultDataSet`), a separate test-only size-factor entry point (`scaled.ts`, not imported by the start-up path and left out of the build), and the command-line mode (`command.ts`, `cli.ts`). The default seed is `20261106`; the default data set is 6 services, 55 dependencies, 118 CI runs.
- **Data layer** (`src/store/`): read-only `DataStore` with prepared lists (plans ordered by name, failed runs newest first), `RuntimeOverlay` (two key sets, single synchronous insertions), and `GuardrailsData` combining them (plan and failed list with the overlay applied, apply, re-run, restart = a new instance).
- **Business logic**: `settings.ts` (GUARDRAILS_SEED / GUARDRAILS_FAILURE_MODE / PORT, fixed sentences naming the setting, never the value), `errors.ts` (six codes with fixed messages, error mapper, result builders), `logger.ts` (start line and one call line, a dash for anything that is not a known-looking service name), `tools/handlers.ts` (failure gate, input form, service, key, in that order; unexpected errors become INTERNAL_ERROR; one log line per call), `tools/register.ts` (four tools with permissive input shapes).
- **HTTP shell** (`src/app.ts`, `run.ts`, `main.ts`): `createApp` takes a ready data set; `POST /mcp` (stateless streamable HTTP, JSON responses) and `GET /healthz`; any other path or method gets a fixed body (`{"error":"not found"}` / `{"error":"method not allowed"}`); the ready flag is set only inside the listening callback; `run` does settings, data set, server, listen, start line; `main` handles SIGTERM/SIGINT.
- **Container probes** (`src/probe/`): `healthcheck.ts` (Node script reading PORT, used by the image health check, no curl) and `smoke.ts` (one tool call against the running server, used by the CI smoke stage).
- **Contract**: `contract/c2-tools.json` (machine-readable C2 with this unit's changes) and `src/testing/contractCheck.ts` (the spec check; u2 can run the same check on its stand-in).
- **Packaging and CI**: `packages/guardrails-server/Dockerfile` (multi-stage, `USER node`, one exposed port, production dependencies only, Node health check), `.dockerignore`, `.github/workflows/ci.yml` (format, lint, type check, tests with coverage, repeatability, contract, image build with non-root and one-port check, container smoke tests).

## How to Run, Test and Build

Run from the project root.

| Purpose | Command |
|---|---|
| Install | `yarn install` |
| Build | `yarn --cwd packages/guardrails-server build` |
| Run | `PORT=7007 node packages/guardrails-server/dist/main.js` |
| Print the data set | `node packages/guardrails-server/dist/generator/cli.js [--seed <n>]` |
| All tests | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false` |
| One file | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false src/generator/generator.test.ts` |
| Coverage | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false --coverage` |
| Lint / types / format | `yarn --cwd packages/guardrails-server backstage-cli package lint`, `yarn tsc -p packages/guardrails-server`, `yarn prettier:check` |
| Image | `docker build -f packages/guardrails-server/Dockerfile -t guardrails-server .` |

## Key Implementation Decisions

- **Stateless MCP per request.** Each `POST /mcp` builds a fresh protocol server and transport (kit's stateless mode, JSON responses) over the one shared data layer, so there is no session state and no event stream.
- **Permissive input shapes.** Each tool input is registered as an optional "unknown" value, so the kit rejects nothing before the handler; the handler's order then holds (FORCED_FAILURE, INVALID_INPUT, UNKNOWN_SERVICE, UNKNOWN_DEPENDENCY or UNKNOWN_RUN). A tool name outside the four is refused by the kit before any handler (no log line).
- **Required cases by adjustment.** The generator picks the service with no dependencies and the service with no failed runs from the seed, then adjusts deterministically (equal-version dependencies, at least four failed runs, at least four distinct causes) so every seed gives the cases BR1.3 needs.
- **Re-run of a run that was never failed** answers `rerun-started` and adds nothing to the overlay; a re-run of a failed run adds its key once.
- **The ready window.** `App.listen` sets the ready flag inside the listening callback and runs the `onListening` hook (the start line) right after; the test registers its own `listening` listener first and sees `isReady() === false` there.
- **Image PORT.** The server itself has no PORT default (BR3.2); the image sets `ENV PORT=7007` so `docker run` works and the exposed port matches.
- **Bootstrap code stays in the file that owns it** (`if (require.main === module)` in `main.ts`, `cli.ts`, `healthcheck.ts`, `smoke.ts`), so no file is excluded from coverage; those few guard lines are the only uncovered bootstrap lines.

## Files

Created at the project root: `package.json`, `tsconfig.json`, `yarn.lock`, `.prettierignore`, `.dockerignore`, `.github/workflows/ci.yml`. Changed: `.gitignore` (one appended block: `node_modules`, `dist`, `coverage`; nothing else touched). Everything else is under `packages/guardrails-server/`: `package.json`, `tsconfig.json`, `tsconfig.build.json`, `.eslintrc.js`, `Dockerfile`, `README.md`, `contract/c2-tools.json`, `test-data/default-data-set.json` and `test-data/README.md`, and the sources and tests listed above under `src/`. The full path list is in `source-manifest.json`.

## Commands Run and Results

TDD evidence. Every Red step ran before any production file of that layer existed, so each failed with "Cannot find module" (no stubs were written to force a different failure); Green ran the same command afterwards.

| Layer (plan steps) | Red command and failing result | Green result |
|---|---|---|
| Test runner (2) | `yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false` first failed with "Jest 30+ requires @jest/environment-jsdom-abstract and jsdom" (see Deviations), then passed with one trivial test | 1 passed (test deleted in Step 3) |
| Data model (3-5) | `... test --watchAll=false src/generator/generator.test.ts`: `Cannot find module './index'`, Test Suites 1 failed, Tests 0 total | 17 passed; after Refactor still 17 passed, lint clean |
| Data access (6-8) | `... src/store`: `Cannot find module './dataStore'`, 1 suite failed | 16 passed |
| Business logic (9-11) | `... src/settings.test.ts src/logger.test.ts src/tools`: `Cannot find module './logger'`, `'./settings'`, `'../errors'`, 3 suites failed | 56 passed in 3 suites |
| API (12-14) | `... src/app.test.ts src/run.test.ts src/performance.test.ts`: `Cannot find module './app'`, `'./run'`, `'../app'`, 3 suites failed | 28 passed in 3 suites |
| Contract (15) | `... src/contract.test.ts`: `Cannot find module './testing/contractCheck'`, 1 suite failed | 6 passed |
| Generator command (16) | `... src/generator/command.test.ts`: `Cannot find module './command'`, 1 suite failed | 9 passed |
| Container probes (17) | `... src/probe`: `Cannot find module './healthcheck'`, 1 suite failed | 6 passed |

Full unit run after the last change: 11 suites, **138 tests passed**. The plan said about 45 tests; the count is higher because the checks are table-driven and loop over several seeds (each loop is one test).

Other checks (all clean at the end): `yarn --cwd packages/guardrails-server backstage-cli package lint` (exit 0), `yarn tsc -p packages/guardrails-server` (exit 0), `yarn prettier:check` ("All matched files use Prettier code style!"), `yarn --cwd packages/guardrails-server build`.

### Measured coverage

`yarn --cwd packages/guardrails-server backstage-cli package test --watchAll=false --coverage`: **lines 92.78%** (489/527), statements 91.75%, branches 80.51%, functions 91.97%. The floor is 85% lines in `packages/guardrails-server/package.json` (`coverageThreshold.global.lines: 85`); it was not lowered. I checked it is enforced: a coverage run of `src/settings.test.ts` alone exits 1 with `Coverage for lines (10.56%) does not meet "global" threshold (85%)`. Uncovered lines are the bootstrap guards in `main.ts`, `cli.ts` and the two probe scripts, and a few defensive branches (`generator.ts` 225, 230, 293-299; `app.ts` 108-111, 134). Build and Test checks the floor on the full suite of the assembled project.

### 200-call benchmark (NFR1.1, NFR1.3)

Measured by `src/performance.test.ts` (the target is 200 ms at the 95th percentile; a result above it fails the test). Final run:

| Tool | In the handlers (200 calls) | Through the HTTP route with the MCP client (200 calls) |
|---|---|---|
| `list_upgrade_plan` | 0.010 ms | 1.195 ms |
| `list_failed_ci_runs` | 0.007 ms | 0.620 ms |
| `apply_dependency_upgrade` | 0.005 ms | 0.619 ms |
| `rerun_ci_job` | 0.012 ms | 0.568 ms |

Heap in use at the end of the HTTP benchmark: 143.9 MB (limit asserted: 256 MB). The default data set builds 20 times in well under the 1 second limit (asserted in `generator.test.ts`). The 10 simultaneous calls test passes (identical writes leave one change: `applied` + `already-current`, one overlay entry each), and the factor-10 data set (about 50 services, 500 dependencies, 1,000 runs) loads through the factory and answers within the target. The same measurement against the running container is repeated in u5.

### Built artifacts checked locally

- Built output twice through the generator command: `cmp` found the two outputs identical and identical to `test-data/default-data-set.json` (the CI repeatability stage).
- `node packages/guardrails-server/dist/main.js` with `GUARDRAILS_SEED=abc` and with `PORT=0` printed the fixed sentence and exited 1; with `PORT=7019` it started (start line printed), `healthcheck.js` exited 0, `smoke.js` printed `smoke ok: list_upgrade_plan catalog-portal returned 7 dependencies`, and SIGTERM stopped it with exit code 0.
- Docker (started Docker Desktop for this): `docker build -f packages/guardrails-server/Dockerfile -t guardrails-server:ci .` succeeded on `node:24.11.0-alpine3.22` (image about 64 MB). Image user `node`, exactly one exposed port. Started with `--read-only` and no published port: health ready on the third probe, smoke call ok, `id` showed `uid=1000(node)`. With `GUARDRAILS_FAILURE_MODE=on` the smoke call failed with `FORCED_FAILURE`. `docker run -e GUARDRAILS_SEED=bad` printed the sentence and exited 1. The local image was removed afterwards.

## Tests Written but Not Executed in This Stage

- **The hosted workflow `.github/workflows/ci.yml` was not run** (it needs GitHub Actions). Its YAML was parsed and Prettier-checked, and each stage's commands were run locally as described above, but the workflow itself, including the coverage artifact upload, has not run.
- The container smoke test and non-root check were run by hand with the same commands the workflow uses, not by the workflow.
- No test runs the time from process launch to ready (NFR1.2); `run.test.ts` measures start to ready in-process (well under 10 seconds), and the container run above reached ready on the third quick probe. The hosted smoke stage enforces the 10 second limit.

## Deviations From the Plan

1. **Extra development packages for Step 2.** Backstage's test command in this version needs `@backstage/cli-defaults`, and with Jest 30 it refuses to start without `jsdom` and `@jest/environment-jsdom-abstract`, even for a Node.js package. I added `@backstage/cli-defaults ^0.1.7`, `jsdom ^27.1.0` and `@jest/environment-jsdom-abstract ^30` to the root `devDependencies` (with `jest`, `@types/jest`, `@types/node`, `prettier`, `typescript ~5.9.3` and `@backstage/cli`). TypeScript is held at 5.9 because Backstage's tooling is built for 5.x (the newest release is 7.x). No code uses jsdom.
2. **Build uses `tsc`, not `backstage-cli package build`.** The server is a Node.js program that needs plain compiled output with `node16` module resolution (the MCP kit's subpath imports need it); the package keeps `backstage.role: node-library` so Backstage's test and lint commands work. `src/**/*.test.ts`, `src/testing/` and `src/generator/scaled.ts` are left out of the build.
3. **Two extra root files:** `.prettierignore` (keeps the format check off `aidlc/`, `.claude/`, build output and the stored data copy) and the `.dockerignore` the plan named, placed at the project root because the Docker build context is the project root.
4. **Stages 7 and 8 are one workflow job** (`image`) with separate named steps, so the image is built once and the smoke steps use it. Stages 1 to 4 are parallel jobs; 5 and 6 need 4; the image job needs 5 and 6, as in the pipeline design. A second smoke step runs the container with the failure setting on and expects the call to fail.
5. **`ENV PORT=7007` in the image** (the server has no PORT default of its own, per BR3.2).
6. **Checked once with a scratch file outside the project.** To confirm the coverage threshold is enforced I redirected the error output of one coverage command to a file in the system temp folder and deleted it straight away. No other file was written outside the project.
7. **Yarn prints "Workspaces can only be enabled in private projects" three times on install.** It comes from the install, not from this workspace (both `package.json` files are private); installs and the lock file are fine.
8. **Memory check** uses the JavaScript heap in use (`heapUsed`), not the process resident size, because the test runner's own size would dominate the latter.

## Step 18: Changes Carried Into the Design Documents

These are the only edits to existing record documents.

1. `aidlc/spaces/default/intents/261106-backstage-guardrails-plu/inception/contract-design/contract-summary.md` (contract C2): INVALID_INPUT and INTERNAL_ERROR added to the `errors` list of all four tools; `rerun_ci_job` changed from `idempotent: false` to `idempotent: true` with the safe-to-repeat rule; the C2 introduction now says the code and a fixed message travel in the result's structured content with the same text as the text content, lists the six codes, says a caller treats an unrecognized code as a failed call, and points to `packages/guardrails-server/contract/c2-tools.json` as the machine-readable copy.
2. `aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u1-data-and-server/functional-design/rules.md` (BR3.3): states that INTERNAL_ERROR applies only when no earlier check fits and a handler fails unexpectedly, with a fixed message and the server kept running. INVALID_INPUT was already in BR3.3 and BR3.4.
3. `aidlc/spaces/default/intents/261106-backstage-guardrails-plu/construction/u1-data-and-server/functional-design/entities.md` (`ToolError.code`): INTERNAL_ERROR added to the allowed codes. INVALID_INPUT was already listed.

For u2 (recorded in the reliability design): treat any error code it does not recognize as a failed call.

## Story to Step Map

| Story | Steps | Where |
|---|---|---|
| US6.1 | 1-5, 9-10, 12-13, 15-17 | generator, settings, shell, contract, Dockerfile and CI |
| US1.1 | 3-4, 6-7, 9-10, 12-13 | `list_upgrade_plan`, `store/` |
| US1.2 | 3-4, 6-7, 9-10, 12-13 | `list_failed_ci_runs`, `store/` |
| US3.3 | 6-7, 9-10, 12-13 | failure gate, safe repeats |

Requirement-level tracing is in `traceability.json` (the traceability sensor passes: no gaps, no invalid targets). Four acceptance criteria are marked `N/A` with a reason because they belong to other units: AC1.1.3 and AC1.2.3 (view render time and accessibility, measured on the compose sample in u5 and delivered by u3), AC1.1.4 (u3) and AC3.3.4 (u2).
