# Observability Requirements — u1-data-and-server

Sources: `requirements.md` (NFR1 timing, FR3.6), `functional-spec.md` and `rules.md` (tool errors, start-up settings), `contract-summary.md` (contract C4 health check) and answers Q1–Q3 in `nfr-requirements-questions.md`. Requirement IDs extend NFR1 (timing), because the log's purpose is to show how the server behaved when a view was slow or failed.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR1.6 | Each tool call writes one line to standard output. | The line holds the time, tool name, service, result (ok or the error code) and duration in milliseconds, and nothing else from the call (no versions, causes or other data). A test makes one call of each kind and finds exactly one matching line each. |
| NFR1.7 | The server writes one start line. | It holds the seed, the failure setting and the port, and is written once the data is loaded. An invalid-setting stop writes the one line from NFR5.4 instead. |
| NFR1.8 | The health check is the only monitoring endpoint. | `/healthz` answers ready or not ready (BR4.1); no metrics endpoint or tracing is required. |

## Logging Standards

- Lines are plain text, one per event, time first in UTC, so they can be read in the compose output and sorted.
- Errors use the tool error code (for example UNKNOWN_SERVICE or FORCED_FAILURE), never free text from the caller.
- Nothing from the caller's input is logged beyond the service name and tool name, so odd input cannot fill or confuse the log.

## Out of Scope

Metrics, distributed tracing, dashboards and alert thresholds: not needed for a local demo. They are not blocked: lines in this format can be shipped to a log service later.
