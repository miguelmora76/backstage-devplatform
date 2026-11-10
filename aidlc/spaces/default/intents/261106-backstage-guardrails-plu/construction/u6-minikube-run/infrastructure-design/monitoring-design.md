# Monitoring Design — u6-minikube-run

Sources: this unit's `security-design.md` (probe timings, failure output, output hygiene, timing switch), `nfr-requirements/tech-stack-decisions.md` (NFR1.5 to NFR1.8, NFR2.22, NFR2.23), `contract-summary.md` (readiness and health routes), u5's `monitoring-design.md`, and `infrastructure-design-questions.md`. A local demo has no monitoring stack. This lists the few signals the minikube run has and who reads them. The strategy documents `observability-design` and `reliability-design` do not exist for this unit (it has no service of its own); their small content is here. There is no `functional-spec.md` for this unit.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Rollout state | `kubectl rollout status` for the three workloads, run by `minikube:up` | all ready within 300 s | The start fails otherwise (NFR1.6) |
| Probe results | startup, readiness and liveness probes per the timing table | server ready within 60 s, app within 150 s of start, database within 100 s | Compose's health budgets, kept in the pods (NFR2.20) |
| Readiness route | `GET /.backstage/health/v1/readiness` through the port-forward | 200 | The app's own signal that migrations finished |
| Pod restarts | `kubectl get pods -o json` restart count of every pod, asserted by the live job after the specs ("Pod-restart check" in `cicd-pipeline.md`) and printed on failure | 0 during a normal run | A restart loop means a probe budget or a setting is wrong |
| View load time | `yarn e2e:timing` output file, run with `E2E_TIMING_BLOCKING=false` | reported, not blocking: p95 of 20 loads per view compared with 5000 ms | NFR1.5 (blocking only in the compose job) |
| Phase times of the live job | one printed line per step | total within the 35-minute limit | Shows where time goes (NFR1.7) |
| App image size | printed after `minikube image build` | at most 550 MB | NFR1.8 |
| Line coverage of `packages/e2e/src` | `e2e-unit` coverage summary | at least 85% | NFR2.18 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Failed pipeline job | `minikube-e2e` not `success` | the pull request shows a failed status through `ci-ok` | the person who opened the pull request (GitHub's own notice) |
| Failed start | rollout not ready within 300 s | `minikube:up` exits non-zero and prints the diagnosis | the person running it |
| Exposure found | a non-loopback connection to port 7007 is accepted while the sample runs | fails the job | the same |
| Secret found in output | the database password or a token appears in pod logs or the report | fails the job | the same |

No other alerting for a local demo. A slow view on minikube is a number in the report, not an alert (NFR1.5).

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Time from `minikube:up` to all workloads ready, once the images are built | at most 300 seconds | each start |
| Time from navigation to data for each of six views on minikube | reported against 5 seconds, not enforced | 20 consecutive loads per run |

## Logs & Tracing

Logs stay in the pods and are read with `kubectl logs` (the live job prints them on failure, with `describe` output and `kubectl get pods,svc,pvc`). There is no log aggregation and no tracing. Output hygiene is the same as in u5: browser traces, video and HAR capture are off; after the run `scanOutputs` searches the pod logs and every report file (including zip entries) for the database password and token-shaped text, and any hit fails the job (NFR5.14). The report and the timing numbers are uploaded as a build artifact kept 7 days. There are no dashboards.

## Traceability

The monitoring-relevant IDs of the 40 are NFR1.5, NFR1.6, NFR1.7, NFR1.8, NFR2.7, NFR2.18, NFR2.20, NFR2.22, NFR2.23 and NFR5.13/NFR5.14 (the two hygiene alerts); each is mapped in `traceability.json`. The rest need no monitoring and are `N/A` or point to the specification or pipeline document.
