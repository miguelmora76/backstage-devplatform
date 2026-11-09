# Monitoring Design — u4-backstage-app

Sources: `observability-design.md` (O1 to O6), `reliability-design.md` (R2 to R4), `security-design.md` (S3, S4), `performance-design.md`, `scalability-design.md`, `logical-components.md`, `functional-spec.md` (W1, BR5.1), `contract-summary.md` (C4 readiness route), `components.md` and answer Q1 in `infrastructure-design-questions.md`. A local demo has no monitoring stack. This design lists the few signals the app has and who reads them.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Readiness status | `GET /.backstage/health/v1/readiness` | 200 means up; anything else means not ready | Compose waits for it; the start-up test checks it (O1) |
| Process exit code | the backend entry point | non-zero on a failed start | Compose shows a failed start (R2) |
| Sign-in page timing | `signInClient` 5 s limits, tested with fake timers | 5 s | Keeps NFR1.1; real timing of the views is u5's 20-load run |

No metrics endpoint, counters or traces are added.

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| None | no alerting for a local demo | not applicable | not applicable |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| None set | not applicable | not applicable |

## Logs & Tracing

| Signal | Where it appears | Who reads it |
|---|---|---|
| Demo sign-in on warning (one line) | backend log, from u2's provider module | the person starting the app (O2) |
| Missing setting, by name and without a value | backend log, once, then the non-zero exit | the person reading the compose output (O6) |
| Frontend failures | shown as sign-in strings or u3 catalog texts; nothing is written to the console | the person using the page (O5) |

The backend uses Backstage's own logger: plain lines on standard output, collected by compose. The start-up test records those lines with a test-only logger and searches them for the token, the database password and the text of a reason (O3); the same check runs in `app-startup` on every pull request. Tracing is not used.

## Dashboards

None. `docker compose logs` and the readiness route are the whole view.
