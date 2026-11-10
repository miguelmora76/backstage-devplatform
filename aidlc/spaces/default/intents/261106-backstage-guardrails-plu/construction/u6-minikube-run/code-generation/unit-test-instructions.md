# Unit Test Instructions — u6-minikube-run

Test strategy: Standard (five to eight tests per component), test-first (TDD) by the team's Testing Contract, plus the scope floor of 80% line coverage and CI execution before merge (the team's own floor is 85%, which is the stricter and the one enforced).

## Framework and Setup

Jest through Backstage's test runner, in the existing workspace package `packages/e2e` (u5). Nothing is installed: the runner, the `yaml` package and the coverage settings already exist. Prerequisites: `yarn install` at the repository root. The unit tests need no Docker, no minikube, no kubectl and no browser; every external call goes through the `Runner` function of `src/runner.ts`, which tests replace with a fake.

## Run This Unit's Tests

All commands run from the repository root and name only this unit's test files. The first one is runnable before the first Red step (Step 2 of the plan) and is the command the Red and Green steps use:

```
yarn workspace e2e test --watchAll=false src/minikubeArgs.test.ts src/clusterGuard.test.ts
```

The whole unit, one command (13 test files plus the extended workflow test):

```
yarn workspace e2e test --watchAll=false src/minikubeArgs.test.ts src/clusterGuard.test.ts src/dbSecret.test.ts src/imageBuild.test.ts src/portForward.test.ts src/minikubeCommands.test.ts src/stackControl.test.ts src/timingSwitch.test.ts src/exposureCheck.test.ts src/restartCheck.test.ts src/planCompare.test.ts src/minikubeChecks.test.ts src/k8sCheck.test.ts src/workflowCheck.test.ts
```

One group at a time while working: pass only that group's files, for example `src/dbSecret.test.ts` for the Secret.

## Expected Coverage Targets

- Component targets: five to eight tests per module (13 modules, about 80 tests), covering the happy path and at least two error or edge cases each (construction phase rule).
- The floor is the package's 85% line coverage in the `packages/e2e` Jest settings. It is a project-wide floor measured on the full suite of the package, so a Unit-scoped run does not judge it; Build and Test checks it on the full suite. It is never lowered. The full-suite command, kept as a command of its own so a threshold exit stops nothing after it:

```
yarn workspace e2e test --watchAll=false --coverage
```

- Excluded from the count, each with its reason (unchanged from u5): the `.mjs` entries (a few lines that only call a module), the Playwright specs under `specs/` (run against the live stack), and `src/testing/`.

## Mocking and Stubbing

- `Runner` fake: records every `(command, args, options)` and returns scripted results by matching the command and its first arguments; it also records standard input where the code writes to it (the Secret). A call the test did not script fails the test, so an unplanned `kubectl` call is caught.
- Process table fake for the port-forward: a map of process id to command line; `kill` is recorded, not performed.
- Socket fake for the exposure check: `connect(host, port)` resolves refused or accepted per host.
- `k8sCheck` and `workflowCheck` tests parse small YAML strings (a good document and a bad one per rule), and one test reads the real `k8s/` and `.github/workflows/ci.yml` of the repository to prove the committed files pass.
- Time: pass a fake clock and a no-wait sleep where code waits (rollout bound, delete wait); no test sleeps for real.

## Test Data

Inline strings and small fixtures; no network and no real cluster. The random source is injected (as `envFile.ts` does) so the Secret test can check length and that the value never appears in arguments or output.

## Live Checks (not unit tests)

These need Docker, minikube and kubectl and run in the pipeline job `minikube-e2e` and once on the person's machine:

```
yarn minikube:up
yarn e2e specs
yarn e2e minikube-checks
yarn minikube:down
```

with `E2E_STACK=minikube` set for the specs and `E2E_TIMING_BLOCKING=false` for `yarn e2e:timing`. If Docker or minikube is not available where this stage runs, the live run is recorded in `code-summary.md` as not executed here, with the reason, and is left to the pipeline job and the laptop run.
