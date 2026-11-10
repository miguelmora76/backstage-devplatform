# Infrastructure Specification — u6-minikube-run

Sources: `security-design.md` and `traceability.json` of this unit's NFR Design (manifest, pod rights, start order, probe timings, Secret, start script, stack control, pipeline), `nfr-requirements/security-requirements.md` and `tech-stack-decisions.md` (NFR5.13 to NFR5.22, NFR1.5 to NFR7.4), `components.md` (u6 owns no component), `contract-summary.md` (the guardrails server address, the health routes), the finished `compose.yaml` and `packages/backend/Dockerfile` (the sizes, names and variables this unit mirrors), u5's `infrastructure-specification.md`, and `infrastructure-design-questions.md`. There is no `functional-spec.md` for this unit (it adds no behavior). The earlier-stage names `performance-design`, `scalability-design`, `reliability-design`, `observability-design` and `logical-components` do not exist for this packaging unit; their few items are in `security-design.md` and `tech-stack-decisions.md`.

u6 provisions no cloud resource. This document says what exists on a developer machine and a GitHub-hosted runner when the sample runs on minikube, and which file creates it.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | Three workloads in one namespace of a local minikube cluster: Deployment `app`, Deployment `guardrails-server`, StatefulSet `postgres` | Mirrors the three compose services; team practice allows minikube as the optional run (NFR2.26) |
| Cluster | `minikube start --driver=docker --cpus=2 --memory=4096`, the same on a laptop and on the runner | Small, repeatable, fits GitHub-hosted runners (NFR1.7) |
| Namespace | `guardrails-sample`, created by the start script; every namespaced object is placed there by the kustomization | Everything is removed with one delete; no cluster-wide object (NFR5.16) |
| Networking | ClusterIP Services `app:7007`, `guardrails-server:7007`, `postgres:5432`. No Ingress, NodePort or LoadBalancer. The only host-side entry is `kubectl port-forward --address 127.0.0.1 svc/app 7007:7007` | One loopback entry; server and database unreachable from the host (NFR5.13) |
| Storage | One 1 GiB claim `postgres-data` from minikube's default storage class (`standard`) for PostgreSQL; `emptyDir` volumes for `/tmp` (app and database), the app's static directory and the database socket directory; the server writes nothing | Read-only root file systems with named writable paths (NFR5.15) |
| Environments | One: local. CI starts the same cluster shape on a GitHub-hosted runner | Nothing deploys automatically (NFR2.34) |
| IaC approach | Plain Kustomize base in `k8s/` (`kustomization.yaml`, `configmap.yaml`, `serviceaccounts.yaml`, `postgres.yaml`, `guardrails-server.yaml`, `app.yaml`); the namespace and the Secret are created by the start script, not the base; no cloud IaC | Q1: A. A hosted overlay can build on the base later (NFR2.25) |
| Resource sizing | See "Sizing" below | Stops a runaway pod taking the machine |
| Start order | App init containers wait for PostgreSQL and the guardrails server; startup, readiness and liveness probes per the timing table of `security-design.md`; `progressDeadlineSeconds: 300` on each Deployment | A failure stays visible within the 5-minute bound (NFR1.6, NFR2.7) |
| Targeting | Every `kubectl` call of the script, the stack control and the pipeline passes `--context minikube`; the script also checks the current context and the `minikube` profile before and after starting the cluster and refuses anything else (NFR5.17) | A shell left on another cluster can never receive the manifests or the namespace delete |
| Start command | `yarn minikube:up` is a thin `.mjs` entry (`packages/e2e/bin/minikube-up.mjs`, with `minikube-down.mjs` for `yarn minikube:down`) that only calls tested TypeScript in `packages/e2e/src` (checks tools, starts the cluster if needed, builds images, creates namespace and Secret, applies `k8s/`, waits for rollout, starts the port-forward, prints the address); `yarn minikube:down` | One command, no manual step (NFR2.19, NFR2.23) |

## Sizing

| Workload | Memory request | Memory limit | CPU request | CPU limit | Other limits |
|---|---|---|---|---|---|
| `app` | 512 MiB | 1 GiB (compose's `mem_limit`) | 250m | none | `emptyDir` `/tmp` 64 MiB; static directory 64 MiB |
| `guardrails-server` | 128 MiB | 256 MiB | 100m | none | none (writes nothing) |
| `postgres` | 256 MiB | 512 MiB | 100m | none | `emptyDir` `/tmp` 64 MiB; socket directory 8 MiB; claim 1 GiB |

Requests total 896 MiB and limits 1.75 GiB, inside the 4 GiB cluster beside minikube's own system pods (about 1 GiB). The `emptyDir` volumes use the default medium (node disk, not memory) with a `sizeLimit` equal to compose's tmpfs size; Kubernetes enforces it by evicting the pod when exceeded, and, unlike compose's tmpfs, the files do not count against the container's memory limit. The test asserts the `sizeLimit` values. The seed `GUARDRAILS_SEED=20261106` is a literal on the guardrails-server Deployment, not in the ConfigMap, as it is a server setting. No CPU limit is set: a local machine, and a limit would only slow the timing numbers. A unit test asserts every limit is no larger than compose's `mem_limit` and every request is no larger than its limit (NFR2.20). All values are revised in Code Generation if a real run needs more, and the change is recorded.

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| PostgreSQL | database | StatefulSet, 1 replica, the compose tag `postgres:16.15-alpine3.24` (one value, asserted equal across compose, both plugin jobs and `k8s/`); user 70, `fsGroup: 70`; data in the subdirectory `pgdata` of the claim (`PGDATA`); login from the Secret `guardrails-db` | Persistent across a pod restart; removed with the namespace |
| Guardrails server | MCP server | Deployment, 1 replica, `guardrails-server:local` built from `packages/guardrails-server/Dockerfile`; `GUARDRAILS_SEED=20261106`; `terminationGracePeriodSeconds: 5`; exec probe `healthcheck.js` | No state; holds applied upgrades in memory, lost on restart as in compose |
| App | backend serving the built frontend | Deployment, 1 replica, `guardrails-app:local` built from `packages/backend/Dockerfile`; settings from the ConfigMap; `POSTGRES_PASSWORD` from the Secret; two init containers | The image's own start command fills the static directory |
| ConfigMap `guardrails-settings` | non-secret settings | The same names as compose: `GUARDRAILS_SERVER_URL`, `GUARDRAILS_DEMO_SIGN_IN=true`, `APP_BASE_URL` and `BACKEND_BASE_URL` (both `http://localhost:7007`), `BACKEND_PORT`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER` | Demo sign-in on in this sample only (NFR5.19) |
| Secret `guardrails-db` | database password | Created by `ensureSecret` from standard input on the first run, referenced by `secretKeyRef` | Never in a file, argument or log (NFR5.14) |
| Service accounts | identity | One per workload, no role binding, token not mounted | NFR5.15, NFR5.16 |
| Port-forward | host entry | `kubectl port-forward --address 127.0.0.1 svc/app 7007:7007`, detached, process id in the untracked `.minikube-forward.pid` | Stopped by `minikube:down` after a command-line check of the process (NFR5.22) |
| Image store | images | `guardrails-app:local` and `guardrails-server:local`, built with `minikube image build` from the repository root, `imagePullPolicy: Never` | No registry, no push, no login (NFR5.18) |
| Cluster tools | local programs | `minikube` and `kubectl` at exact versions, downloaded in the pipeline and checked against SHA-256 values; on a laptop the person's own installation | Versions chosen in Code Generation by checking the release pages that day (NFR5.18) |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| App image build file and settings names | u5-compose-and-ci | u6-minikube-run | Reused as they are; u6 adds the two e2e switches `E2E_STACK` and `E2E_TIMING_BLOCKING` to u5's `packages/e2e`, default-preserving |
| Guardrails server image | u1-data-and-server | u5, u6 | Built from its own Dockerfile, unchanged |
| PostgreSQL tag | u5-compose-and-ci | u6 | One value in `compose.yaml`, both plugin jobs and `k8s/`, asserted equal by a test |
| Shared workflow `.github/workflows/ci.yml` | the unit that created it | every unit | u6 adds one job and one `needs` entry only |

## Hosting Later

Nothing in `k8s/` names the developer's machine or a hosted environment. A hosted overlay would change the image names and pull policy, the storage class, the demo sign-in setting, the database password handling and add network policies; the README lists these as what must change first (NFR2.25, team practice: do not block hosted environments).

## Traceability

`traceability.json` lists the 40 IDs the tool derived from the NFR design, mapped to the rows above or to the other two documents of this stage. The IDs that u6 inherits unchanged from u5 (NFR5.1 to NFR5.7, NFR5.9, NFR5.11, NFR5.12 and the like) point to the u6 row that realises them or are `N/A` with the reason.
