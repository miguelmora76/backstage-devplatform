# Test Results — Guardrails Sample (u1 to u6)

Sources: commands run in this stage and at the u6 checkpoint, the GitHub Actions run named below, the person's pasted output, and the instruction files of this stage.

## Build

| Command | Where | Result |
|---|---|---|
| `yarn tsc && yarn lint && yarn prettier:check` | the u6 checkpoint verification (part of the recorded project check) | exit 0 |
| Per-package builds (`plugin-build`, `ui-build`, `app-build`), the two images (`image`, `app-image`) | GitHub Actions run 42717839586, `main` at `9cbd241` | all `success` |

## Unit and Contract Tests

| Command | Result |
|---|---|
| `yarn tsc && yarn lint && yarn prettier:check && yarn test --watchAll=false --coverage --testPathIgnorePatterns packages/guardrails-server/src/performance.test.ts && yarn workspace guardrails-server test --watchAll=false src/performance.test.ts` (the recorded verification command, run once for the whole project) | exit 0. Test suites: 92 passed, 1 skipped, 93 total. Tests: 1,022 passed, 12 skipped, 1,034 total. Then the performance suite: 1 suite, 4 tests passed |
| `yarn workspace e2e test --watchAll=false --coverage` (this session, run once) | exit 0. 28 suites, 312 tests passed |
| The unit-scoped u6 command from `unit-test-instructions.md` (14 files) | the reviewer ran it: 14 suites, 197 tests passed |

Distinct commands from the unit test instruction files were deduplicated: u1 to u4 commands are covered by the project-wide `yarn test`, the u5 and u6 commands by the `packages/e2e` run, and each was run once.

## Coverage

| Scope | Command | Lines | Floor | Result |
|---|---|---|---|---|
| Project (all measured source) | the recorded verification command | 94.25% (4,184 of 4,439); statements 93.44%, branches 89.47%, functions 94.16% | 85% | Met |
| `packages/e2e` | `yarn workspace e2e test --watchAll=false --coverage` | 97.27% (1,250 of 1,285); statements 96.22%, branches 88.3%, functions 97.87% | 85% | Met |
| Plugin, UI and app packages (own floors) | pipeline coverage jobs | not re-run here | 85% each | `success` in the pipeline (CI:plugin-coverage, CI:ui-coverage, CI:app-coverage) |

No threshold was lowered. The jest warnings about `coverageThreshold` in per-project configs are Backstage's and do not change the floors.

## Integration and Live Checks

| Check | Where | Result |
|---|---|---|
| Real-browser flows, accessibility, keyboard, accessibility tree, headers, token step, append-only audit, repeatability, timing, published ports, missing-address start, output scan (compose) | GitHub Actions job `compose-e2e` on `main` at `9cbd241` | `success`, 7 min 36 s |
| Plugin rules against PostgreSQL | job `plugin-rules` | `success` |
| `E2E_STACK=minikube yarn e2e specs` (minikube, through the port-forward) | the person's machine, 2026-11-10, output pasted | 40 tests: **37 passed, 3 skipped, 0 failed**, 55.7 s. The 3 skipped are `[firefox]` accessibility scans of the service overview, changes list and audit log: the known crash of the pinned Firefox build on macOS arm64, which the spec skips and annotates; Chrome ran all six screens |
| Within that run: flow of plan, proposals, decisions, retry and audit with the server stopped and restarted through `kubectl` (Chrome and Firefox) | same | passed |
| `yarn compose:down`, `yarn minikube:up`, `yarn e2e minikube-checks`, `yarn minikube:down` | the person's machine | reported as working; no output was provided |
| Pipeline job `minikube-e2e` on PR #6, run 42763792290 at `c9658b8` (cluster started with the Docker runtime) | GitHub Actions | `success`, 20 min 50 s: first fresh start (images 323 s, rollout 161 s), flows and security specs (38 passed, 2 skipped: the known Firefox crash), exposure, image, restart and log scans (passed twice), second fresh start (same plan byte for byte, 2,253 bytes), timing (reported, not blocking: p95 582 to 1,628 ms), stop, port 7007 closed |
| The first `minikube-e2e` run on PR #6 (run 42761244399 at `2c698b8`) | GitHub Actions | failed at the first start: "Could not read the size of guardrails-app:local" (the cluster ran containerd, which has no `docker`); fixed in `a06c8e2` (`--container-runtime=docker`). The next run then failed creating the Secret through `/dev/stdin`; fixed in `c9658b8` (manifest on standard input, `kubectl create -f -`) |

## Browser Evidence

Behavior in a browser is reported as tested only where a real engine ran it: Chrome (stable channel) and Firefox (the pinned Playwright build) in `compose-e2e` and in the person's minikube run. The tests in `packages/plugin-guardrails` and `packages/app` that use a DOM emulator (jsdom) are integration evidence only, never browser evidence; the real-engine specs cover the same targets.

## Failures

None in the commands that were run for this assessment. The pipeline runs of PR #6 had failures that were fixed or passed on re-run (listed above; two were flakes: a 1.64 s timing in `plugin-rules` against a 1.2 s limit, and an accessibility scan of the catalog list that caught a loading spinner). The four targets that were `Unverified` are now `Met` (screen-reader pass by the person, evidence SR; branch protection and the blocked failing PR #7, evidence BP; see the summary). The project check was re-run on 2026-11-11 after the Safari content-policy fix and exited 0: 92 suites and 1,024 tests passed (12 skipped), lines 94.26%, performance suite 4 tests passed.
