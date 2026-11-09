# Observability Design — u4-backstage-app

Sources: `observability-requirements.md` (NFR1.7 to NFR1.9), `security-requirements.md` (NFR5.3, NFR5.4), `reliability-requirements.md` (NFR7.2 to NFR7.4), `tech-stack-decisions.md` (NFR2.3, NFR6.1), `functional-spec.md` (BR2.1, BR4.1, BR4.4, BR5.1), `performance-requirements.md` and `contract-summary.md` (C4 readiness route). A local demo needs a health route and honest logs, not metrics or traces.

## Patterns

| ID | Pattern | Meets | How it works |
|---|---|---|---|
| O1 | **Readiness route as the health signal** | NFR1.7 | `GET /.backstage/health/v1/readiness` is the monitoring endpoint; compose waits for it (u5). The start-up test requests it. No metrics or tracing endpoint is added. |
| O2 | **Demo-on warning in the log** | NFR1.8 | u2's provider module logs one warning line when the switch is on. The start-up test replaces the logger service with one that records its lines (a test-only service factory) and finds the line with the switch on and none with it off. |
| O3 | **No secret in any log** | NFR1.9 | The start-up test signs in, makes calls, then searches the recorded lines and the test output for the token, the database password setting and the text of a reason, and finds none. The app logs setting names, never values. |
| O4 | **Backstage's logger only** | NFR1.7 | The backend uses its own logger: plain lines, one per event. The app adds no logger. |
| O5 | **Silent frontend** | NFR1.9 | ESLint `no-console` is an error in `packages/app`; failures are shown as the sign-in strings or u3's catalog texts. |
| O6 | **Missing setting logged once, by name** | NFR7.2 | The plugin that needs a setting logs it once with the key and no value; the entry point's catch adds the exit (see `reliability-design.md`, R2). |

## Signals

| Signal | Where | Who reads it |
|---|---|---|
| Readiness | HTTP 200 on the route | compose, the start-up test |
| Demo sign-in on | one warning line | the person starting the app |
| Start failure | the plugin's message and a non-zero exit | compose output |

## SLIs and Alerts

None. No SLO, alert threshold or dashboard is set for a local demo (see `observability-requirements.md`, Out of Scope). Backstage's logger can be pointed at a log service later without changing this design.
