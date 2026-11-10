# Code Generation Plan — u6-minikube-run

## Summary

- Builds: the minikube run of the guardrails sample (FR9.1): `k8s/` Kustomize files, `yarn minikube:up` and `minikube:down`, the checks that prove it, and one blocking pipeline job
- Touches: new `k8s/`, new modules and tests in `packages/e2e/src`, two thin entries in `packages/e2e/bin`, two small switches in u5's specs, one job and one `needs` entry in `.github/workflows/ci.yml`, two lines in the root `package.json`, one line in `.gitignore`, a README section
- Tests: about 80 unit tests in 13 test files (written first, no cluster or Docker needed), plus the live minikube job in the pipeline and one laptop run

## Inputs

Design inputs read: `nfr-requirements/security-requirements.md` and `tech-stack-decisions.md` (NFR5.13 to NFR5.22, NFR1.5 to NFR7.4), `nfr-design/security-design.md`, `infrastructure-design/infrastructure-specification.md`, `monitoring-design.md`, `cicd-pipeline.md`, `contract-summary.md` (settings and health routes), `unit-of-work.md` (U6: no components, owns no entity, may be dropped), `requirements.md` (FR9.1, FR10.1, NFR1 to NFR7), and the finished `compose.yaml`, `packages/backend/Dockerfile`, `packages/e2e` and `.github/workflows/ci.yml`. There is no `functional-spec.md`, `rules.md` or `entities.md` (u6 adds no behavior). The story for this unit is US6.3 (`unit-of-work-story-map.md`).

## Files in the Person's Project That This Plan Changes

These existed before this work. Each change is the smallest the unit cannot be built without, and is named here as the stage rules require:

- `.gitignore`: one added line, `.minikube-forward.pid` (the port-forward's process-id file must stay untracked, NFR5.22).
- `README.md`: one added section for the minikube run (the command, what it needs, what it keeps, the passwordless sign-in risk, the screen-reader note, what a hosted overlay must change). u4's rule for a very thoroughly documented README applies.
- `package.json` (root): two scripts, `minikube:up` and `minikube:down`.
- `.github/workflows/ci.yml`: the new `minikube-e2e` job and its entry in `ci-ok`'s `needs`; no existing job is edited.
- `packages/e2e/specs/support/stack.ts`, `packages/e2e/specs/timing.spec.ts`, `packages/e2e/src/workflowCheck.ts` (and its test): the two default-preserving switches and the new workflow rules (NFR1.5, NFR2.24, NFR2.21). Their existing assertions are not changed.

## Testing Contract

Rendered by `aidlc engine testing-posture render`; do not edit.

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

How the contract applies to this unit: the layers "Data model / database behavior", "Repository / data access", "API / endpoint" and "Frontend behavior" do not exist here (u6 adds no entity, route or screen), so they are omitted as genuinely inapplicable. The testable layer is business logic: the TypeScript modules of `packages/e2e/src`. Each module group below is taken through Red (failing tests, with the failing output recorded), Green (the least code that passes) and Refactor (while green). The manifest files, the pipeline job and the README are the "Environment/build configuration" and "Documentation and traceability" steps. Every Red step records its failing command output in `code-summary.md`.

## Module Layout (all under `packages/e2e/src`, each with a `.test.ts` beside it)

| Module | Job | Requirements |
|---|---|---|
| `minikubeArgs.ts` | the one place that builds every `kubectl` and `minikube` argument list; `--context minikube` and `-n guardrails-sample` on every `kubectl` call; refuses a caller-set context or namespace | NFR5.17 |
| `clusterGuard.ts` | `checkTools` (docker, minikube, kubectl present, plain message naming the missing one) and `assertLocalContext` (current context and profile must be `minikube`, run before and after cluster start) | NFR5.17, NFR2.19 |
| `dbSecret.ts` | `ensureSecret`: random value, passed on standard input, never in an argument or output; existing Secret left unchanged; claim-without-Secret stops with a plain message | NFR5.14 |
| `imageBuild.ts` | `buildImages` (`minikube image build`, host-Docker fallback with `minikube image load`), image checks (non-root user, one exposed port), size measured as the `app-image` job does | NFR5.15, NFR1.8 |
| `portForward.ts` | start detached on 127.0.0.1, process-id file, command-line check before trusting or stopping a process, taken-port message, stale-file handling | NFR5.13, NFR5.22 |
| `minikubeCommands.ts` | `minikubeUp` (tools, guard, cluster, images, namespace, Secret, apply, rollout wait, forward, readiness poll, address) and `minikubeDown`; failure diagnosis; phase times | NFR2.19, NFR2.23, NFR1.6, NFR2.22 |
| `stackControl.ts` | `E2E_STACK` chooser with the compose backend (today's calls) and the minikube backend (find, scale to 0, wait for delete, scale to 1, rollout status); unknown value refused | NFR2.24 |
| `timingSwitch.ts` | `E2E_TIMING_BLOCKING` (true unless exactly `false`) | NFR1.5 |
| `exposureCheck.ts` | non-loopback address refused, loopback accepted; closed after `down` | NFR5.13, NFR5.22 |
| `restartCheck.ts` | parse `kubectl get pods -o json` and fail on a restart count other than 0 | NFR1.6 (monitoring-design) |
| `planCompare.ts` | byte comparison of the plan before and after the second fresh start | NFR7.3 |
| `minikubeChecks.ts` | `yarn e2e minikube-checks`: exposure, image, restart, pod-log scan through `scanOutputs` | NFR5.13, NFR5.14, NFR5.15 |
| `k8sCheck.ts` | the manifest rules over `k8s/` (exposure, secrets, rights, scope, versions, settings, probes and order, sizing) | NFR2.20, NFR5.13 to NFR5.19 |

`workflowCheck.ts` gains the rules for the new job (NFR2.21, NFR5.21, NFR5.18 digests).

## Steps

### Setup

- [x] Step 1: Project structure and production configuration skeleton. Create the empty module files and test files above, the `k8s/` folder with `kustomization.yaml` listing the resources (no manifest content yet), and `bin/minikube-up.mjs` and `bin/minikube-down.mjs` as thin entries (like `compose-up.mjs`: `load` a built module, call it, nothing else). Add `minikube:up` and `minikube:down` to the root `package.json` and `.gitignore` line for `.minikube-forward.pid`. Traces: NFR2.31, NFR5.22.
- [x] Step 2: Bootstrap the test runner and record the exact unit-scoped command. The runner already exists (Backstage's `backstage-cli package test` in `packages/e2e`, Jest, 85% global line threshold in the package settings, never lowered). Record in `unit-test-instructions.md` and confirm by running it on one new empty-but-failing test: `yarn workspace e2e test --watchAll=false src/minikubeArgs.test.ts`. Traces: NFR2.18.

### Group A: argument builders and cluster guard (business logic)

- [x] Step 3: Red: write `minikubeArgs.test.ts` and `clusterGuard.test.ts` (every `kubectl` list carries `--context minikube` and the namespace; a caller-set context or namespace is refused; missing tool message names the tool; current context other than `minikube` is refused before and after start, with nothing changed; profile not running is detected; both guard runs happen in order). Run and record the failing output.
- [x] Step 4: Green: implement `minikubeArgs.ts` and `clusterGuard.ts`.
- [x] Step 5: Refactor while green.

### Group B: database Secret (business logic)

- [x] Step 6: Red: write `dbSecret.test.ts` (first run creates the Secret with the value on standard input and no value in any argument; value is 32 random characters; an existing Secret is left unchanged and nothing is written; claim exists but Secret does not stops with a message naming `yarn minikube:down`; the function's output and thrown messages never contain the value). Run and record the failing output.
- [x] Step 7: Green: implement `dbSecret.ts`.
- [x] Step 8: Refactor while green.

### Group C: images (business logic)

- [x] Step 9: Red: write `imageBuild.test.ts` (builds both images with `minikube image build` from the repository root; a build failure falls back to host `docker build` then `minikube image load` and says so in one line; a failure of both stops with both outputs named; image config check requires a non-root user and exactly one exposed port; the size is read as the file-system size through a `du` run and compared with 550 MB, equal passes and one more fails). Run and record the failing output.
- [x] Step 10: Green: implement `imageBuild.ts`.
- [x] Step 11: Refactor while green.

### Group D: port-forward (business logic)

- [x] Step 12: Red: write `portForward.test.ts` (starts `kubectl port-forward --address 127.0.0.1` detached and writes the process id; a taken local port stops with a plain message; a stale file whose process is gone is replaced; a live process whose command line is not a `kubectl port-forward` for `guardrails-sample` is ignored and never killed; `stop` kills only a verified forward and removes the file; no file means nothing to stop). Run and record the failing output.
- [x] Step 13: Green: implement `portForward.ts`.
- [x] Step 14: Refactor while green.

### Group E: up and down (business logic)

- [x] Step 15: Red: write `minikubeCommands.test.ts` with a faked runner (tools missing stops first; wrong context stops before any change; cluster not running is started once; images then namespace then Secret then apply then rollout wait then forward then readiness poll, in that order; a failed rollout prints `get pods,svc,pvc`, `describe` and each pod's log and throws a message that names the 300-second bound; a second `up` reuses the Secret; `down` stops the forward, then deletes the namespace, says the data is gone and the cluster stays running; `down` on a wrong context changes nothing). Run and record the failing output.
- [x] Step 16: Green: implement `minikubeCommands.ts` and the two `.mjs` entries' calls.
- [x] Step 17: Refactor while green.

### Group F: the two switches (business logic)

- [x] Step 18: Red: write `stackControl.test.ts` (compose backend makes today's three calls; minikube backend find, then `scale ... --replicas=0`, then `wait --for=delete pod/<name>`, then `scale ... --replicas=1`, then `rollout status`, in that order; a timed-out delete wait stops before scale 1; no pod found is refused; unknown `E2E_STACK` value refused) and `timingSwitch.test.ts` (`false` turns it off; `true`, empty, unset and a typo keep it blocking). Run and record the failing output.
- [x] Step 19: Green: implement `stackControl.ts` and `timingSwitch.ts`; make `specs/support/stack.ts` a thin chooser over `stackControl.ts` and make `specs/timing.spec.ts` skip only its final assertion when the switch is off (still measure, print and write every p95). The assertions of `flows.spec.ts` are not changed.
- [x] Step 20: Refactor while green.

### Group G: live checks (business logic)

- [x] Step 21: Red: write `exposureCheck.test.ts` (fake socket: refused on the non-loopback address and accepted on loopback passes; accepted on non-loopback fails; no non-loopback address found is reported, not passed; closed after `down`), `restartCheck.test.ts` (all zero passes; one pod with restarts fails and names it; malformed JSON is an error), `planCompare.test.ts` (equal, different and missing input) and `minikubeChecks.test.ts` (runs the four checks and fails if any fails; scans pod logs and the report for the password and token-shaped text through the existing `scanOutputs`). Run and record the failing output.
- [x] Step 22: Green: implement `exposureCheck.ts`, `restartCheck.ts`, `planCompare.ts`, `minikubeChecks.ts`, and the `minikube-checks` subcommand of `yarn e2e`.
- [x] Step 23: Refactor while green.

### Group H: manifests (environment/build configuration, test first)

- [x] Step 24: Red: write `k8sCheck.test.ts` with a good and a bad document per rule: no NodePort, LoadBalancer, Ingress, hostPort, hostNetwork or hostPID, and ClusterIP for the server and PostgreSQL; password only as `secretKeyRef`, no `kind: Secret`, no `secretGenerator`; rights block on every container, `automountServiceAccountToken: false`, `fsGroup` on every pod with a claim or `emptyDir`, writable-mount set equal to the table; no cluster-scoped kind, one service account per workload without a binding, namespace set; PostgreSQL tag equal to `compose.yaml` and both plugin jobs, `:local` images with `imagePullPolicy: Never`, no `latest`; settings names equal compose's, equal base URLs, seed `20261106`, demo sign-in only in the ConfigMap; probes with the timings of the table and both init containers, `progressDeadlineSeconds`, requests and limits no larger than compose's, `emptyDir` `sizeLimit` values. Run against the empty `k8s/` and record the failing output.
- [x] Step 25: Green: write the manifests in `k8s/` (`kustomization.yaml`, `configmap.yaml`, `serviceaccounts.yaml`, `postgres.yaml`, `guardrails-server.yaml`, `app.yaml`) from `security-design.md` and `infrastructure-specification.md` until the rules pass; any real-run exception is written beside the manifest and the rule names it.
- [x] Step 26: Refactor while green.

### Group I: pipeline (environment/build configuration, test first)

- [x] Step 27: Red: extend `workflowCheck.test.ts` (new job `minikube-e2e` exists, `needs: app-image`, `timeout-minutes: 35`, listed in `ci-ok`'s `needs`; downloads of minikube and kubectl each followed by a SHA-256 check; only `actions/*` in `uses`; no `docker login`, push or deploy; the existing rules still pass). Run and record the failing output.
- [x] Step 28: Green: add the `minikube-e2e` job to `.github/workflows/ci.yml` as in `cicd-pipeline.md` (the exact minikube and kubectl versions and digests are looked up on the release pages on the day and written beside each download) and add it to `ci-ok`.
- [x] Step 29: Refactor while green.

### Finish

- [x] Step 30: Environment/build configuration: run the whole `packages/e2e` suite with coverage (`yarn workspace e2e test --watchAll=false --coverage`), `yarn tsc` for the package, `yarn workspace e2e lint` and `prettier --check` on every new and changed file; fix anything they find; the 85% floor is not changed. Where Docker, minikube or a browser is available, run `yarn minikube:up`, the live checks and `yarn minikube:down` once and record the result and timings; where not, record in `code-summary.md` that the live run is left to the pipeline job and the laptop run.
- [x] Step 31: Documentation: add the README section (thorough: prerequisites with versions, the two commands, what each does and keeps, the address, the passwordless demo sign-in risk, what a hosted overlay must change, the screen-reader note, troubleshooting for a taken port, a wrong context, a failed rollout and the memory fallback), and the comments at the top of each `k8s/` file and `.mjs` entry (like `compose.yaml`'s header).
- [x] Step 32: Traceability and summary: write `code-summary.md` (files, decisions, test counts, Red outputs, the measured timings and the server-stop time if a cluster was available, tests written but not executed and why), `source-manifest.json`, and `traceability.json` through `aidlc engine sensor-traceability`.

## Story and Requirement Traceability

| Step | Story | Requirement IDs |
|---|---|---|
| 1, 2, 30, 32 | US6.3 | NFR2.18, NFR2.31, NFR6.2 |
| 3 to 5 | US6.3 | NFR5.17, NFR2.19 |
| 6 to 8 | US6.3 | NFR5.14 |
| 9 to 11 | US6.3 | NFR5.15, NFR5.18, NFR1.8 |
| 12 to 14 | US6.3 | NFR5.13, NFR5.22 |
| 15 to 17 | US6.3 | FR9.1, NFR2.19, NFR2.22, NFR2.23, NFR1.6 |
| 18 to 20 | US6.3 | NFR1.5, NFR2.24 |
| 21 to 23 | US6.3 | NFR5.13, NFR5.14, NFR5.15, NFR7.3 |
| 24 to 26 | US6.3 | NFR2.20, NFR5.13 to NFR5.19, NFR2.25 |
| 27 to 29 | US6.3 | FR10.1, NFR2.21, NFR5.21, NFR1.7, NFR2.34 |
| 31 | US6.3 | NFR5.19, NFR3.5, NFR2.25 (hosted overlay note) |

## Deferred or Not Built Here

Nothing is deferred. The screen-reader pass is the person's, once, and stays an open item of u5 (NFR3.5). The exact tool versions and digests are chosen in Step 28 on the day.
