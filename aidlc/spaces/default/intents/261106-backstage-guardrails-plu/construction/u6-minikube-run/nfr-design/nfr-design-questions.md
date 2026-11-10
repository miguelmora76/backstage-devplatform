# NFR Design Questions — u6-minikube-run

Context: the NFR requirements for u6 are approved in substance (security items NFR5.13 to NFR5.22, tech-stack items NFR1.5 to NFR7.4) and your three answers there fix the main design: Kustomize YAML in `k8s/`, a `kubectl port-forward` on `127.0.0.1:7007`, and a blocking live minikube job. u6 adds no behavior and has no functional spec or rules of its own, so nothing here designs a business rule. The remaining design choices all follow from those answers and from the compose run that u5 already settled, so there is no open question for you in this stage.

Settled without asking (written into `security-design.md` for you to correct):

- Ordering: the app pod has two init containers, one that waits until PostgreSQL accepts connections (`pg_isready`, the same PostgreSQL image) and one that waits until the guardrails server answers its health route (the app image's Node, no extra tool). Probes alone would let the app crash and restart while the database starts, which is noisy and slower. The app's readiness probe stays the readiness route of u4, so "ready" still means migrations finished.
- Static files: the app image's own start command copies the pristine frontend into the static directory, exactly as in compose. In the pod that directory is an `emptyDir` and the pod sets `fsGroup: 1000`, so no image change is needed.
- PostgreSQL: a StatefulSet with one 1 GiB claim from minikube's default storage class, `fsGroup: 70`, and its data in a subdirectory of the mount (`PGDATA`) because a new volume root is not empty; `/tmp` and the socket directory are `emptyDir`s.
- Secret: created by the start script with `kubectl create secret generic` reading the value from standard input, so the password is never in an argument list; the manifests only reference it by name.
- Stopping the server for the one server-down flow: the Deployment is scaled to zero and back to one with a short `terminationGracePeriodSeconds` on the server pod (5 seconds), and Code Generation measures that the server is gone well inside the plugin's 5-second probe-reuse window, adjusting the minikube wait only if it is not.
- Port-forward: started by `minikube:up` as a detached child, its process id written to an untracked file that `.gitignore` lists, restarted by a second `up`, and stopped by `down`.
- Live job: the two cluster tools are downloaded at exact versions and checked against SHA-256 values, the cluster is started with the Docker driver, the images are built with `minikube image build`, and the job always removes the namespace and uploads the report.

## Consolidated Summary Confirmation

- No open questions: the design follows from the three NFR answers (Kustomize YAML in `k8s/`, port-forward on `127.0.0.1:7007`, blocking live minikube job) and from the compose run
- Settled without asking: init containers that wait for PostgreSQL and the guardrails server before the app starts; the image's own start command fills the static directory, with an `emptyDir` and `fsGroup 1000`; PostgreSQL as a StatefulSet with a 1 GiB claim, `fsGroup 70`, a data subdirectory and `emptyDir`s for `/tmp` and the socket; the database password created from standard input by the start script and referenced by name; the server pod's 5-second grace period for the server-down flow, measured in Code Generation; a detached, tracked, stoppable port-forward; pinned and checked cluster tools in the live job

- Looks correct
- Request changes

[Answer]: Looks correct
