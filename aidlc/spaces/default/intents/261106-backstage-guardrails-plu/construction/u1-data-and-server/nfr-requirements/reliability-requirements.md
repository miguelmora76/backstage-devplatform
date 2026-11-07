# Reliability Requirements — u1-data-and-server

Sources: `requirements.md` (NFR7 repeatability, FR3.6 forced failure, FR6.1), `functional-spec.md` and `rules.md` (BR1.1, BR2.4, BR2.5, BR3.1, BR3.2, BR4.1), `contract-summary.md` (contract C2 timeouts and C4 health) and answers Q1–Q3 in `nfr-requirements-questions.md`. Requirement IDs extend NFR7 (repeatability), the only inception reliability-type requirement; the sample has no availability promise.

## Availability

No availability target (SLA or SLO) applies: the server runs on a developer laptop for a demo and has no uptime promise. What matters is that it starts the same way every time and fails the same way when asked to.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR7.1 | The same seed gives the same data, byte for byte, on every machine. | Two runs of the generator with one seed compare equal (BR1.1); the check runs in the server's tests and again in CI on a different machine than a developer laptop. |
| NFR7.2 | A plain start gives the same demo every time. | With no seed setting, the fixed default seed is used (BR3.2); the start line in the log shows which seed. |
| NFR7.3 | A restart returns the server to its seeded state. | After a restart, applied upgrades and re-runs are gone and the data equals a fresh start (BR2.5). A test applies, restarts and compares. |
| NFR7.4 | Forced failure is reliable and nothing changes during it. | With the failure setting on, every tool call returns FORCED_FAILURE and the overlay is unchanged afterwards (BR3.1); with it off, no call fails for that reason. The setting changes only by restart. |
| NFR7.5 | Repeated writes are safe. | Applying an upgrade or re-running a run twice changes nothing the second time (BR2.3, BR2.4), so a caller that repeats after a timeout cannot double an effect. |
| NFR7.6 | A bad start is loud. | An invalid setting stops the server with a message naming the setting (BR3.2); the container exits with a non-zero code so compose shows the failure. |
| NFR7.7 | The health check tells the truth. | It answers ready only after the data is loaded (BR4.1); before that, a compose health check keeps the Backstage app waiting. |

## Fault Tolerance and Recovery

- The server keeps no data worth backing up. Recovery is a restart.
- A tool call that raises an unexpected error returns a tool error and does not stop the server; the next call works. (No crash on odd input: NFR5.3.)
- A call that takes longer than the caller's timeout is abandoned by the caller; the server finishes the call it started, so a write that timed out on the caller's side may still have taken effect. Because writes are safe to repeat (NFR7.5), the caller's retry is harmless.

## Graceful Degradation

None needed. The server either answers or reports an error; the plugin backend decides what the user sees.
