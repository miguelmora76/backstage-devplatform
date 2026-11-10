# Infrastructure Design Questions — u6-minikube-run

Context: u6 maps the reviewed NFR design onto the concrete things that will exist: the `k8s/` Kustomize files, the start script, one extra pipeline job, and the pods that run on your local minikube cluster. The team practices fix the big choices (local only, minikube optional, nothing deploys automatically, GitHub Actions), your three NFR answers fixed the rest (Kustomize YAML, port-forward on `127.0.0.1:7007`, a blocking live minikube job), and u5 settled the compose equivalents, so there are no open questions.

Settled without asking (written into the documents for you to correct):

- No cloud resource of any kind. The only places anything runs are your machine (a minikube cluster, Docker driver) and GitHub-hosted runners (the pipeline). There is one environment, "local".
- Cluster size: `minikube start --driver=docker --cpus=2 --memory=4096`, the same on a laptop and on the runner. The three pods stay well under that: memory limits app 1 GiB, guardrails server 256 MiB, PostgreSQL 512 MiB, the same as compose, with smaller requests (512, 128 and 256 MiB) so the scheduler can place them. No CPU limit is set, only small CPU requests (250, 100 and 100 millicores), because a limit would only slow the timing numbers.
- Storage: one 1 GiB claim for PostgreSQL from minikube's built-in default storage class. The `emptyDir` volumes have size limits (app `/tmp` 64 MiB, app static directory 64 MiB, PostgreSQL `/tmp` 64 MiB, socket directory 8 MiB), the same sizes as compose's tmpfs. Removing the namespace removes the data.
- Images: `guardrails-app:local` and `guardrails-server:local`, built into minikube's own image store from the same build files as compose, never pushed or pulled. PostgreSQL uses the compose tag.
- The only monitoring is what a local sample needs: the probes, `kubectl rollout status`, logs through `kubectl logs`, the end-to-end report and the timing numbers file. No metrics server, dashboards or alerting.
- Secrets: only the generated database password in the Kubernetes Secret `guardrails-db`. The pipeline uses no secret.
- Pipeline artifacts (the test report and the timing numbers) are kept 7 days, like the compose job; nothing else is uploaded.
- Hosting later: the `k8s/` base names no host and no machine path. A hosted overlay would change the image names, the storage class, the demo sign-in and the database password handling, which the README lists as what must change first.

## Consolidated Summary Confirmation

- No open infrastructure questions; the choices follow the team practices (local only, minikube optional, nothing deploys automatically), your three NFR answers and the reviewed design
- Settled without asking: no cloud resource and one local environment; a 2-CPU, 4 GB Docker-driver cluster with memory limits of 1 GiB (app), 256 MiB (server) and 512 MiB (database), smaller requests, small CPU requests and no CPU limit; a 1 GiB claim from the default storage class and `emptyDir`s sized like compose's tmpfs; local `:local` images built into the cluster and never pushed; monitoring limited to probes, rollout status, pod logs, the report and the timing file; the Secret `guardrails-db` as the only secret; pipeline artifacts kept 7 days; `k8s/` free of host-specific names so a hosted overlay can reuse it

- Looks correct
- Request changes

[Answer]: Looks correct
