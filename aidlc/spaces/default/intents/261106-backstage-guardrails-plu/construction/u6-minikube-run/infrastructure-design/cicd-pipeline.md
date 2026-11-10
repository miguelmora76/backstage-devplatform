# CI/CD Pipeline — u6-minikube-run

Sources: `team-practices.md` (pull requests, CI green before merge, Prettier and ESLint, 85% coverage, nothing deploys automatically, minikube optional), this unit's `security-design.md` (pipeline, live exposure and image checks, stack control, timing switch, manifest checks), `nfr-requirements/security-requirements.md` and `tech-stack-decisions.md`, `contract-summary.md` (readiness route, the server address), the existing `.github/workflows/ci.yml`, u5's `cicd-pipeline.md`, and `infrastructure-design-questions.md`. There is no `functional-spec.md` for this unit (it adds no behavior). The unit extends the shared workflow, which it does not own, next to the jobs of u1 to u5. There is no deployment stage: nothing is pushed, published or deployed; the cluster exists only for the length of the job.

## Deployment Shape Used by the Pipeline

| Facet | Choice |
|---|---|
| Runner | `ubuntu-latest` (GitHub-hosted), with Docker; Node 24 like the other jobs |
| Cluster | minikube started in the job with the Docker driver, 2 CPUs, 4096 MB; gone when the job ends |
| Tools | `minikube` and `kubectl` at exact versions written in the workflow, each downloaded from its official release location and checked with `sha256sum -c` against a digest written beside the version; no third-party action |
| Packaging | The app image and the server image built into the cluster with `minikube image build`, never pushed; PostgreSQL at the compose tag |
| Browsers | Google Chrome stable (installed on the runner) and the Firefox build of the pinned Playwright version, as in the compose job |
| Secrets | None. `permissions: contents: read`; the database password is generated inside the job by the start script and goes into the cluster through standard input |
| Triggers | Pull requests and pushes to `main` (unchanged); no `pull_request_target`; no schedule |

## Build and Test Stages

Jobs run in parallel unless `needs` is shown. A failed job fails the pull request through `ci-ok`.

| Job | New or changed | What it does | Gate |
|---|---|---|---|
| `e2e-unit` | changed (more tests only) | Runs the `packages/e2e` unit tests with coverage, now including: the start and stop script logic with a faked `kubectl` and `minikube` (tools, cluster start, the two context guards, Secret from standard input, port-forward and its process-id check, rollout failure diagnosis), the stack-control module for both backends and its call order, the timing-switch module, the live exposure check with a fake socket, the manifest rules over `k8s/` and the workflow rules for the new job. No Docker, no cluster. The 15-minute limit stays | Any failing test, or line coverage below 85%, fails (NFR2.18, NFR2.20, NFR2.21, NFR5.13 to NFR5.18, NFR5.21) |
| `minikube-e2e` | new; `needs: [app-image]` (a fail-fast order only: it builds the images itself in the cluster) | 35-minute limit. In order: install; download and verify `minikube` and `kubectl`; `minikube start`; `yarn minikube:down` then `yarn minikube:up`; image checks (non-root user and one exposed port on both images, app image at most 550 MB, measured as in the `app-image` job: the file-system size of the image through a `du` run against the image in the node, not a size column); the live exposure check (non-loopback refused, loopback accepted); install Chrome and Firefox; flows, accessibility, keyboard and tree specs with `E2E_STACK=minikube`; header, token and audit specs; repeatability, which on a fresh start reads the changes list and the audit log of every seeded service and finds both empty (NFR7.4); the second fresh start (below); timing with `E2E_TIMING_BLOCKING=false`; the pod-restart check (below); `scanOutputs` over pod logs and the report; on failure the diagnosis (`kubectl get pods,svc,pvc`, `describe`, each pod's logs); always `yarn minikube:down`, the closed-port check and the upload of the report and timing numbers (7 days). Each step prints its time | Any spec failing, an exposure or image check failing, a secret found, or the 35-minute limit, fails (NFR1.6 to NFR1.8, NFR2.22 to NFR2.24, NFR3.5, NFR4.3, NFR5.13 to NFR5.22, NFR7.3, NFR7.4); a p95 over 5000 ms does not (NFR1.5) |
| `ci-ok` | changed (one `needs` entry) | `minikube-e2e` is added to `needs`; the rule is unchanged: `if: always()`, fails when any needed job is not `success`; the one status the repository requires | NFR2.21, FR10.1 |
| `lint`, `typecheck`, `format` | unchanged | The new modules are inside `packages/e2e`, already linted and type-checked; Prettier already covers the YAML under `k8s/`, the workflow and the README | NFR6.2 |

## Steps That Need Detail

| Step | Detail |
|---|---|
| Second fresh start (NFR7.3) | The job saves the upgrade plan of one seeded service (the response body, as bytes) after the first start, runs `yarn minikube:down` then `yarn minikube:up` again (the image builds are layer-cached), reads the plan again and requires the two byte strings equal. The comparison is a small function in `packages/e2e/src`, unit tested for equal, different and missing input. It adds about 4 minutes, which moves the planning budget of `tech-stack-decisions.md` (NFR1.7) from 25 to 29 minutes; the 35-minute limit is unchanged and each phase still prints its time. |
| Image build inside the node | `buildImages` runs `minikube image build` first. If that fails (the Backstage frontend build can run out of memory beside the control plane in a 4096 MB node, exit code 137 or a killed build), it falls back to `docker build` on the host's Docker followed by `minikube image load`, says so in one line, and the size check and the image checks are unchanged because they read the image either way. The fallback is unit tested with a faked runner; no new switch is added. |
| Pod-restart check | After the specs the job reads the restart count of every pod in `guardrails-sample` (`kubectl get pods -o json`) and fails if any is not 0; the server pod started again by the server-down flow is a new pod and counts from 0. It makes the "0 during a normal run" threshold of `monitoring-design.md` an assertion. |
| Tool digests | The SHA-256 values are copied into the workflow, next to the version, from the checksum files the projects publish with each release (minikube's release page, and `dl.k8s.io` for `kubectl`), when the version is pinned; the workflow never fetches the digest at run time. |
| Browsers | Chrome is the stable channel on the runner and moves on its own, and Firefox is the build of the pinned Playwright version, exactly as in the compose job (u5 NFR4.2); the window is 1440 by 900 in both. |
| Runner size | The standard GitHub-hosted runner for public repositories (4 vCPU, 16 GB); the cluster takes 2 CPUs and 4096 MB of that. If the repository uses a smaller runner, the cluster size is revised in Code Generation and the change recorded. |
| Accessibility and screen reader | The automated scans and the accessibility-tree specs run on minikube (NFR3.5); the manual screen-reader checklist of u5 applies to the same application and is not repeated, and the README says so. |
| Port-forward | A port-forward ends when its pod ends. The job does not restart it; the app pod is never restarted by the specs (only the server pod is), and a forward that died fails the next spec with a clear connection error. `yarn minikube:up` starts a new one. |

## Deployment Strategy

None. There is no environment to promote to, no rolling, blue-green or canary stage, and no artifact registry. `yarn minikube:up` is the "deploy" and only ever targets the local `minikube` context (NFR5.17). The team practice that nothing deploys automatically is enforced by the workflow tests: no registry login, push or deploy step (NFR2.34, NFR5.21).

## Rollback

| Situation | Procedure |
|---|---|
| A bad manifest change | Revert the commit; `yarn minikube:down` then `yarn minikube:up` recreates the sample from the files. The namespace is the unit of rollback; its data is invented and is removed with it |
| A failed start | `minikube:up` exits non-zero and prints the diagnosis; fix the cause and run it again (apply and the image builds are repeatable) |
| A bad pipeline change | Revert the commit; no state outside the job exists |
| A stuck port-forward or a taken port | `yarn minikube:down` stops the forward by its checked process id; a taken port stops the start with a plain message |

## Secrets Management in CI/CD

| Secret | Where it lives | Rule |
|---|---|---|
| Database password | generated inside the job; held only in the cluster's Secret `guardrails-db` | Passed through standard input, never in an argument, file or log; the output scan fails the job on any hit (NFR5.14) |
| Repository secrets | none | The workflow tests find no `secrets.` reference (NFR5.21) |
| Demo sign-in tokens | in memory in the specs | Never written to the report; traces are off (NFR5.14) |

## Environment Promotion

None: one environment, "local". The same `k8s/` base is what a hosted overlay would start from; promoting is a later team decision and not part of this unit.

## Traceability

The pipeline-relevant IDs of the 40 are NFR1.7, NFR2.18, NFR2.20, NFR2.21, NFR2.24, NFR5.13 to NFR5.18, NFR5.21, NFR6.2 and the reused u5 checks NFR5.6, NFR5.7 and NFR5.11 (run unchanged in `minikube-e2e` as NFR5.20); each is mapped in `traceability.json`.
