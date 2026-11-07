# Monitoring Design — u1-data-and-server

Sources: `observability-design.md` and `observability-requirements.md` (NFR1.6–NFR1.8), `reliability-design.md` (health and start line), `performance-requirements.md` (NFR1.1), `infrastructure-specification.md` and answers Q5 in `infrastructure-design-questions.md` (call log and health route only). This is the platform-specific side of the observability design: where the log and health signals are read in the docker compose run.

## Metrics and KPIs

No metrics system is built (Q5: A). The numbers below come from the call log and the tests.

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| Call duration | `ms=` field in each call line | 200 ms at the 95th percentile (checked in tests and in the u5 container run, not by an alert) | Keeps views inside the 5 second target |
| Call result | `result=` field in each call line | `ok` for normal use; error codes only when the caller sent bad input or the failure setting is on | Shows what the plugin backend experienced |
| Health | `/healthz` answer | Ready within 10 seconds of container start | Start order and troubleshooting |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| None | No alerting is set up for a local demo | n/a | n/a |

A stopped or unhealthy container is visible in the output of the compose status command and in the app's own server-unreachable message.

## SLIs and SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| Tool call duration | 95th percentile at most 200 ms | 200 consecutive calls on the default seed, once per pull request in CI |
| Time to ready | At most 10 seconds | One container start, once per pull request in CI and in the u5 run |

## Logs and Tracing

- **Where logs go:** standard output of the container, read with the compose logs command. No log aggregation or file is used.
- **Shape:** the start line and one call line per call from the observability design; the call line shows the service only when it is a known one.
- **Tracing:** none.
- **Dashboards:** none. The health route is the only monitoring endpoint, and the compose health check uses it so the app waits for the server.

## Compose Health Check

| Facet | Value | Why |
|---|---|---|
| Probe | Request to the health route from inside the container | Contract C4 |
| Start allowance | 10 seconds before failures count | NFR1.2 |
| Interval and retries | Every 5 seconds, 3 failures to mark unhealthy | Fast enough for a local run without noise |
| Dependants | The Backstage app starts only when the server is healthy | NFR7.7 |
