# Observability Requirements — u4-backstage-app

Sources: `requirements.md` (NFR1 timing, FR11.2), `functional-spec.md` and `rules.md` (BR2.1, BR4.1, BR4.4, BR5.1), `contract-summary.md` (C4 readiness route) and answer Q1 in `nfr-requirements-questions.md`. Requirement IDs extend NFR1, because logs and the readiness route exist to show why a view was slow or an app did not come up.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR1.7 | The readiness route is the app's monitoring endpoint. | `GET /.backstage/health/v1/readiness` answers 200 when the backend is up (BR5.1); the start-up test requests it. No metrics endpoint or tracing is required. |
| NFR1.8 | A start-up that turns the demo sign-in on says so in the log. | With `GUARDRAILS_DEMO_SIGN_IN=true`, the start-up test finds u2's warning line in the backend log (u2 FR5.1 control); with the switch off, no such line. The test captures the log by giving the test backend a logger service that records its lines. |
| NFR1.9 | Logs and test output never hold a token, a password or a user's reason. | The start-up test signs in, makes calls and then searches the same captured log for the token, the database password setting and the text of a reason, and finds none (NFR5.3, NFR5.4). |

## Logging Standards

- The backend uses Backstage's own logger: plain lines, one per event, in the compose output. The app adds no logger of its own.
- The frontend writes nothing to the console; failures are shown as the catalog texts (u3) or the sign-in strings (BR2.2).
- A missing required setting is logged once by the plugin that needs it, with the setting's name and no value.

## Out of Scope

Metrics, distributed tracing, dashboards and alert thresholds: not needed for a local demo. They are not blocked: Backstage's logger can be pointed at a log service later.
