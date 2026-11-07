# Observability Design — u1-data-and-server

Sources: `observability-requirements.md` (NFR1.6–NFR1.8), `security-requirements.md` (NFR5.3, NFR5.4), `functional-spec.md` and `rules.md` (tool errors BR3.3), `contract-summary.md` (contract C4 health check) and answer Q2 in `nfr-requirements-questions.md` (one line per call).

## Logging Design

One small module is the only code that writes to standard output. It offers two functions, one for the start line and one for a call line. Lines are plain text, one per event, with the time in UTC first, then fixed words and key=value pairs.

| Line | Fields | Example shape |
|---|---|---|
| Start line | time, seed, failure mode, port | `<time> start seed=<n> failure=<on or off> port=<n>` |
| Call line | time, tool, service, result, milliseconds | `<time> call tool=<name> service=<name or -> result=<ok or code> ms=<n>` |
| Stop line (invalid setting) | the fixed sentence from NFR5.4 | one line, then exit |

Every call writes a line, including a call refused by the failure gate or for a bad input (the result then shows FORCED_FAILURE or INVALID_INPUT), because every call reaches the handler (security design).

Rules that keep the log safe and readable (the answer to a reviewer finding on NFR1.6):

- The tool name comes from the four registered names, never from the caller.
- The service value is written only when the input matches a known service name. For anything else, including empty, very long or markup-containing input, the line shows a single dash, so caller text can never reach the log or break a line.
- The result is `ok` or one of the fixed error codes.
- Nothing else from the call (versions, causes, keys) is written.
- Time comes from the system clock for the log only; the data generator never reads the clock.

## Metrics, Tracing and Alerts

None. The log line carries what is needed: which tool, which service, how long, and whether it worked. Lines have a stable shape, so they can be shipped to a log service later without changing the server.

## Health

`/healthz` is the only monitoring route. It answers ready or not ready (reliability design) and is used by the compose health check.

## SLIs

The one indicator is the duration in each call line; the 200 ms target (NFR1.1) is checked in the unit's tests, not by an alert.

## Tests

A test captures standard output while it makes one call of each kind (success, each error code, an input with markup and a very long input) and checks that each call wrote exactly one line of the call shape, that the odd inputs show a dash, and that no line holds caller text.
