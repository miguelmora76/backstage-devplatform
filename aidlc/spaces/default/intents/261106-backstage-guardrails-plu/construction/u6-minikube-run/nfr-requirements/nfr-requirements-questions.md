# NFR Requirements Questions — u6-minikube-run

Context: u6 is the should-have run on a local minikube cluster (FR9.1, scope S9). It adds no behavior: it brings up the same three parts as the compose run (the guardrails server, the app, PostgreSQL) on minikube and passes the same check as FR8.1, the upgrade plan of a seeded service loading in the browser. It reuses the app image, the server image, the environment variable names and the end-to-end checks of u5 without changing them. It may be dropped without affecting any other unit.

Settled without asking (written into the documents for you to correct):

- The same three parts as compose: the guardrails server (the u1 image), the app (the u5 image: the backend serving the built frontend) and PostgreSQL at the same exact 16.x tag with persistent storage. The app waits for the server and the database through readiness probes; the server and the app use the same health routes as compose.
- The same rights as compose, written as Kubernetes settings: non-root user, all capabilities dropped, no privilege escalation, read-only root file system with the same short list of writable paths (`/tmp`, the frontend static directory for the app; the data directory, `/tmp` and the socket directory for PostgreSQL), and no service account token mounted.
- Nothing is exposed outside the cluster except what the browser needs: the guardrails server and PostgreSQL are cluster-internal services only. Network policies are not added: they need a network plugin that default minikube does not enable, so the isolation is by service type (internal addresses only), stated honestly in the document.
- No secret is committed. The database password is generated into a Kubernetes Secret by the start script on the first run, from a random value, never printed and never written to a tracked file; the manifests only reference the Secret by name.
- Images are built into the cluster's own image store by the start script from the same build files as compose (no registry, no push, no login), tagged with a fixed local tag, and never pulled (`imagePullPolicy: Never`). Nothing deploys to anywhere but the local cluster.
- The demo sign-in is on in this run (as in compose, because the sample has no other way in), and the README states that it must be replaced before any hosting. The seed stays the literal 20261106.
- One command starts it and one removes it, as a Node script behind `yarn minikube:up` and `yarn minikube:down`, tested the way the compose scripts are. Startup is bounded: not ready within 5 minutes fails with each pod's log.
- The earlier floors stay: 85% line coverage on the code u6 adds (it goes in the `packages/e2e` package, whose floor is not lowered), Prettier and ESLint, and tests written first.
- Manifest files are checked by unit tests that need no cluster (the same pattern as u5's compose-file checks).

## Q1. [Packaging] How are the Kubernetes files written?

Why we ask: this decides what the person has to install and how the files look. Kustomize is built into `kubectl`, so nothing extra is installed, and the files stay plain YAML that a unit test can read. A Helm chart adds a tool and a template language, which is more than a single-environment sample needs, but is what many teams expect for later hosted use.
Recommendation: A, because it needs no extra tool, the files stay readable by tests, and a hosted environment can still reuse them as a base.

- A. Plain YAML files with Kustomize (`kubectl apply -k`), in a `k8s/` folder at the repository root
- B. A Helm chart (needs `helm` installed; values file for settings)
- C. Plain YAML files applied one by one, no Kustomize
- X. Other (please specify)

[Answer]: A

## Q2. [Operations] How does the browser reach the app on minikube?

Why we ask: the app only accepts browser calls from its own address (the origin check of u4), and the end-to-end checks of u5 expect `http://localhost:7007`. If the address on minikube differs, the app's two base addresses must be set per run and the checks pointed at the new address. A port-forward keeps the address identical to the compose run, so the same checks run unchanged.
Recommendation: A, because it keeps the one address that every check and setting already expects, and nothing is exposed beyond the loopback address.

- A. `kubectl port-forward` to `127.0.0.1:7007`, started by the `yarn minikube:up` command (same address as compose; the end-to-end checks run unchanged)
- B. A NodePort service opened with `minikube service` (the address is chosen by minikube, so the base addresses and the checks follow it each run)
- C. The ingress add-on with a local hostname (needs the add-on, a hosts-file entry and a tunnel on some systems)
- X. Other (please specify)

[Answer]: A

## Q3. [Quality] How far is the minikube run verified on every pull request?

Why we ask: the requirement (FR9.1) says the same check as FR8.1 must succeed on minikube. Proving that on the pipeline means starting a minikube cluster on the runner (about 5 to 8 more minutes, one more job, and a pinned minikube download because the pipeline rule allows only GitHub's own actions). Checking only the files keeps the pipeline fast but a broken manifest would show up only when someone runs it. Because this unit is a should-have, a blocking cluster job is a real cost for a part that may be dropped.
Recommendation: B, because it is the only way a regression in the manifests fails a pull request, and the cost is one extra job that runs in parallel with the others.

- A. Files only: unit tests read the manifests (rights, ports, secrets, versions, probes) with no cluster; the live run on minikube is a documented command you run by hand
- B. Files and a live job: the same file tests, plus a pipeline job that starts minikube, runs `yarn minikube:up` and the same end-to-end checks as compose (flows, headers, token step, accessibility), and fails the pull request on any failure; timing is reported but not blocking there
- C. Files and a live job that is advisory: as B, but the job's result does not block the pull request (it is not in the final summary job)
- X. Other (please specify)

[Answer]: B

## Consolidated Summary Confirmation

- Kubernetes files are plain YAML with Kustomize (`kubectl apply -k`), in a `k8s/` folder at the repository root (Q1: A)
- The browser reaches the app through `kubectl port-forward` on `127.0.0.1:7007`, started by `yarn minikube:up`, the same address as compose, so the end-to-end checks run unchanged (Q2: A)
- Every pull request runs the manifest tests with no cluster and a live job that starts minikube, runs `yarn minikube:up` and the same end-to-end checks as compose; the job blocks the pull request, timing is reported but not blocking there (Q3: B)
- Settled without asking: the same three parts as compose with persistent storage for PostgreSQL; the same rights as compose written as Kubernetes settings and no service account token; guardrails server and PostgreSQL cluster-internal only, no network policies (default minikube has no network plugin for them); database password generated into a Kubernetes Secret on first run, never printed or committed; images built into the cluster's own store from the same build files with a fixed local tag and never pulled; demo sign-in on and flagged for replacement before hosting; one start and one remove command as a tested Node script; start bounded to 5 minutes; coverage, style and tests-first floors not lowered

- Looks correct
- Request changes

[Answer]: Looks correct
