# Monitoring Design — u3-plugin-ui

The plugin runs in the browser page and logs and measures nothing of its own (security control S2 forbids logging calls with credentials, and the NFR Design adds no observability design for a UI unit). There is no metrics store, alerting or dashboard for it. This file says so in the usual tables so that a later reader finds the decision.

## Metrics & KPIs

| Metric | Source | Threshold | Why it matters |
|---|---|---|---|
| None collected at run time | not applicable | not applicable | One viewer on a laptop; the view time target (NFR1.1) is measured once by u5 on the compose sample, not monitored |
| Built size (gzip) | `ui-checks` job | at most 300 KB | Keeps the app start fast (NFR1.7); a build-time check, not a run-time metric |

## Alerts

| Alert | Condition | Severity | Routes to |
|---|---|---|---|
| CI job failure | Any `ui-*` job fails | Blocks the pull request | The pull request author, in GitHub |

## SLIs / SLOs

| SLI | SLO target | Measurement window |
|---|---|---|
| View shows data, empty text or error | 95th percentile at most 5 s | 20 consecutive loads, measured by u5 (NFR1.1) |

## Logs & Tracing

- The plugin writes no log lines. Failures reach the person as catalog texts; error detail is not printed to the console (security control S9).
- A render error is caught by the Backstage app's error boundary, which belongs to u4.
- No tracing. The plugin backend's request log line (u2) is where a failed call shows up, read with the compose logs command.
- No dashboard.
