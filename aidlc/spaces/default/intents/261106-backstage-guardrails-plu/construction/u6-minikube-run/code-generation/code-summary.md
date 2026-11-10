# Code Summary — u6-minikube-run

The minikube run of the guardrails sample (FR9.1, story US6.3): Kustomize manifests, `yarn minikube:up` and `minikube:down`, the checks that prove it, and one blocking pipeline job. No application behavior was added and no application code was changed.

## Files Created

| Area | Files |
|---|---|
| Manifests | `k8s/kustomization.yaml`, `configmap.yaml`, `serviceaccounts.yaml`, `postgres.yaml`, `guardrails-server.yaml`, `app.yaml` |
| Entries | `packages/e2e/bin/minikube-up.mjs`, `minikube-down.mjs` (thin: load a built module, call it) |
| Modules (`packages/e2e/src`) | `minikubeArgs`, `clusterGuard`, `dbSecret`, `imageBuild`, `portForward`, `minikubeCommands`, `stackControl`, `timingSwitch`, `exposureCheck`, `restartCheck`, `planCompare`, `minikubeChecks`, `k8sCheck`, each with a `.test.ts`; `runner.test.ts` |
| Test helpers (`src/testing`) | `fakeRunner.ts`, `fakeOps.ts`, `k8sLoader.ts` |

## Files Changed

| File | Change |
|---|---|
| `.github/workflows/ci.yml` | New job `minikube-e2e` (`needs: app-image`, 35-minute limit, minikube v1.39.0 and kubectl v1.37.2 each downloaded and checked against a SHA-256 written beside the version); `minikube-e2e` added to `ci-ok`'s `needs`. No existing job edited |
| `.gitignore` | `.minikube-forward.pid` (named in the plan) |
| `package.json` | scripts `minikube:up`, `minikube:down` |
| `README.md` | "Run on minikube" section, the u6 table row, folder layout and status paragraph |
| `packages/e2e/bin/e2e.mjs` | subcommands `minikube-checks`, `minikube-closed`, `plan-snapshot`, `plan-compare` |
| `packages/e2e/specs/support/stack.ts` | now a thin chooser over `stackControl.ts` (`E2E_STACK`, default compose); the compose calls are unchanged |
| `packages/e2e/specs/timing.spec.ts` | only the final assertion is skipped when `E2E_TIMING_BLOCKING=false`; every p95 is still measured, printed and written |
| `packages/e2e/src/runner.ts` | optional `input` (standard input) so the Secret value never travels in an argument |
| `packages/e2e/src/composeArgs.ts` | one constant, `COMPOSE_STACK` (u5's test forbids the quoted word elsewhere) |
| `packages/e2e/src/workflowCheck.ts` and test | rules for the new job; the existing assertions are unchanged |

## Key Implementation Decisions

- Every `kubectl` call is built in one place and carries `--context minikube` and the namespace; the context and profile are checked before and after the cluster starts (NFR5.17).
- The database password is generated and written to the Secret through standard input; it is in no argument, file or output (NFR5.14).
- Images are built with `minikube image build`, falling back to host `docker build` plus `minikube image load`; `imagePullPolicy: Never` (NFR5.18).
- The port-forward listens on 127.0.0.1 only; its process-id file is trusted only after the process's command line is checked (NFR5.13, NFR5.22).
- `E2E_STACK=minikube` stops the server by scaling its Deployment to zero, waiting for the pod to be deleted, and starting it by scaling to one and waiting for the rollout (NFR2.24). `E2E_TIMING_BLOCKING=false` is the report-only switch (NFR1.5).
- The manifest rules are unit tests over the real `k8s/` files, so a change that widens rights, exposure or sizes fails in `e2e-unit` (NFR2.20).

## Test Coverage

- 28 suites, 312 tests, all passing (rechecked by the lead): `minikubeArgs` 18, `clusterGuard` 13, `dbSecret` 6, `runner` 3, `imageBuild` 14, `portForward` 15, `minikubeCommands` 18, `stackControl` 12, `timingSwitch` 8, `exposureCheck` 9, `restartCheck` 6, `planCompare` 9, `minikubeChecks` 11, `k8sCheck` 42, `workflowCheck` 24 (11 new); u5's existing suites unchanged.
- Line coverage of the package: 97.27% (statements 96.22%, branches 88.3%, functions 97.87%). The 85% floor in the package settings is unchanged. `yarn tsc`, `yarn workspace e2e lint`, `check:packages` and `prettier --check` on `k8s`, `.github`, `packages/e2e`, `package.json` and `README.md` were clean.

## Red Steps (failing output recorded before each Green)

| Group | Failing output before the code existed |
|---|---|
| A (`minikubeArgs`, `clusterGuard`) | `Cannot find module './clusterGuard'`, 2 suites failed, 0 tests |
| B (`dbSecret`) | `Cannot find module './dbSecret'` |
| C (`imageBuild`) | `Cannot find module './imageBuild'` |
| D (`portForward`) | `Cannot find module './portForward'` |
| E (`minikubeCommands`) | `Cannot find module './minikubeCommands'` |
| F (`stackControl`, `timingSwitch`) | `Cannot find module` for both, 2 suites failed |
| G (`exposureCheck`, `restartCheck`, `planCompare`, `minikubeChecks`) | `Cannot find module` for all four, 4 suites failed |
| H (`k8sCheck`) | first `Cannot find module './k8sCheck'`; with the module written and `k8s/` holding only the kustomization: `Tests: 39 failed, 3 passed, 42 total` (`k8s/kustomization.yaml lists configmap.yaml, but … does not exist`) |
| I (`workflowCheck`, extended) | `Tests: 11 failed, 13 passed, 24 total` |

Two real defects were caught on the way: `snapshotPlan` failed with ENOENT when the output folder did not exist (a Red test), and a `planCompare` type error that appeared only in the real `yarn minikube:up` build, whose configuration has no DOM types.

## Live Run on the Developer's Machine

Docker, minikube v1.36.0 and kubectl v1.33.1 were available, so part of the live run was done:

- A cold `yarn minikube:up` built the images in 837 s. The app image is 537 MB against the 550 MB limit.
- The first start failed: the `wait-postgres` init container reported "no attempt". The fix, `-U postgres` in `k8s/app.yaml`, was made.
- After the fix, `minikube:up` got all three pods ready with 0 restarts; with cached images the rollout took 6 s. Through a temporary port-forward on 17007, the readiness route, the liveness route and the demo sign-in each answered 200 (this also confirms the Backstage liveness route exists, so no TCP fallback is needed).
- The same `up` then stopped at the port-forward with the "port already in use" message, because the person's compose container holds 7007. It was not stopped.
- `minikube:down` worked: the namespace was removed and the minikube cluster was left running.

## Tests Written but Not Executed in This Stage

| Check | Reason |
|---|---|
| `E2E_STACK=minikube yarn e2e specs` (flows, accessibility, keyboard, tree, headers, token, audit, repeatability) | Port 7007 was held by the person's running compose sample; run after `yarn compose:down` |
| `yarn e2e minikube-checks`, `minikube-closed`, the timing run, and the second-fresh-start plan compare | Same reason |
| The `minikube-e2e` pipeline job | Runs on GitHub after the pull request is opened |
| Server-stop time against the 5-second probe-reuse window | Needs the specs above; measured on that run, with the minikube wait adjusted only if it is not met |
| Screen-reader checklist | The person's, once (u5 NFR3.5); unchanged |

## Deviations From the Plan

- Step 1 created no empty module or test files: each test was written first and each module created at Green, so the Red step reads "module not found". The entries, `k8s/kustomization.yaml`, scripts and the ignore line were created in Step 1.
- `loadK8s` lives in `src/testing/k8sLoader.ts`, not in `k8sCheck.ts`: Backstage lint refuses a `yaml` import in non-test source while `yaml` is a devDependency, and no package was added.
- Four extra `yarn e2e` subcommands, the `plan-snapshot` and `plan-compare` helpers and a `runner.test.ts` were added to make pipeline steps testable.
- In the workflow, `minikube-checks` runs twice (after the specs and after timing), because the second fresh start deletes the first start's pod logs.
- The developer once used `sed -i` and one heredoc to write files; both were redone with the file tools.
- The person's minikube profile had been stopped; `yarn minikube:up` started it and it was left running, with its existing size (not the 2 CPU / 4 GB the script asks for on a new cluster).

## Open Items

| Item | Who | When |
|---|---|---|
| Run the live checks once after `yarn compose:down`: `yarn minikube:up`, `E2E_STACK=minikube yarn e2e specs`, `yarn e2e minikube-checks`, `yarn minikube:down` | The person | Before merging |
| Confirm the measured pipeline time against the 35-minute limit and the server-stop time | The person / first pipeline run | When the job first runs |
| Screen-reader pass (u5 NFR3.5) | The person | Once |
