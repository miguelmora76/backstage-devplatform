# Monitoring Design — u5-compose-and-ci

Sources: this unit's `security-design.md` (output hygiene, health checks, timing, failure output), `nfr-requirements/tech-stack-decisions.md` (NFR1.1 to NFR1.3, NFR2.6, NFR2.7), `contract-summary.md` (readiness route), u4's `monitoring-design.md`, and `infrastructure-design-questions.md`. A local demo has no monitoring stack. This lists the few signals the run has and who reads them. The strategy documents `observability-design` and `reliability-design` do not exist for this unit (it has no service of its own); their small content is here.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Container health | `docker compose ps`, health checks of the three containers | all `healthy` within 180 s of `up` | `up --wait` fails otherwise (NFR1.2, NFR2.7) |
| Readiness route | `GET /.backstage/health/v1/readiness` on the app | 200 | The app's own signal that migrations finished |
| View load time | `yarn e2e:timing` output file | 95th percentile of 20 loads at most 5000 ms per view | The blocking check (NFR1.1) |
| Phase times of the compose job | one printed line per step | total within the 25-minute limit | Shows where time goes (NFR1.3) |
| App image size | printed by `app-image` | at most 550 MB (raised from 500 MB; person-approved 2026-11-09) | NFR1.4 |
| Line coverage of `packages/e2e/src` | `e2e-unit` coverage summary | at least 85% | NFR2.1 |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| Failed pipeline job | any job not `success` | the pull request shows a failed status through `ci-ok` | the person who opened the pull request (GitHub's own notice) |
| Slow view | p95 over 5000 ms in the timing run | fails the job | the same |

No other alerting for a local demo.

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Time from navigation to data for each of six views | p95 at most 5 seconds | 20 consecutive loads per run |
| Time from `compose:up` to all containers healthy | at most 180 seconds after the images are built | each start |

These are the inception targets (NFR1) applied to this run; there is no running service to measure over days.

## Logs & Tracing

| Signal | Where it appears | Who reads it |
|---|---|---|
| Backend and server logs | standard output of each container, read with `docker compose logs` | the person running the sample |
| Failure output | on any failure the start script and the job print `docker compose ps` and each service's log | the person reading the job |
| Missing-address start failure | output of the stopped second `app` container, naming `guardrails.server.url` | the missing-address check |
| Browser report | the Playwright text report and failure screenshots, uploaded for 7 days; trace, video and HAR capture are off | the person reading a failed job |
| Timing numbers | JSON file uploaded for 7 days | the person comparing runs |
| Output scan | `scanOutputs` finds the database password or any token-shaped text in logs and report files and fails the job (NFR5.10) | the pipeline |

Screenshots are binary images and are not searched for tokens; this is accepted because the app keeps tokens in memory only and never renders them (u4 NFR5.3). Tracing is not used.

## Dashboards

None. `docker compose logs`, `docker compose ps` and the readiness route are the whole view.
