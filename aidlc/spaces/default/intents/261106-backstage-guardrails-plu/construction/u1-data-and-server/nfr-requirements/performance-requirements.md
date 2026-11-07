# Performance Requirements — u1-data-and-server

Sources: `requirements.md` (NFR1 view render time, NFR7 repeatability), `functional-spec.md` and `rules.md` (the four tools, in-memory data), `contract-summary.md` (contract C2: 3 second read and 10 second write timeouts) and answers Q1–Q3 in `nfr-requirements-questions.md`. Requirement IDs extend the requirement they come from (NFR1 gives NFR1.1, NFR1.2, and so on).

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR1.1 | Each of the four tools answers quickly on the seeded data set. | Measured inside the container over 200 calls of each tool on the default seed: the 95th percentile is at most 200 milliseconds. This leaves the plugin backend's 3 second read timeout and the 5 second view target (NFR1) almost entirely for the other units. |
| NFR1.2 | The server is ready soon after the container starts. | From container start to a ready health check (BR4.1) on a developer laptop: at most 10 seconds, including building the data set from the seed. |
| NFR1.3 | The data set is built quickly enough not to delay start. | Building the default data set (about 5 services, 50 dependencies, 100 CI runs) takes at most 1 second; the same seed gives the same bytes regardless of how long it takes (BR1.1). |

## Resource Limits

- Memory: at most 256 MB for the container while serving calls on the default data set.
- Processor: one core is enough; no requirement needs more.
- The data set stays in memory and is small; there is no disk read after start.

## Benchmarks

The performance check runs as part of the server's own tests (not as a separate load test) and reports the 95th percentile of the 200 calls; a result above the target fails the test run. The end-to-end view time (NFR1 for the screens) is measured in u5-compose-and-ci.
