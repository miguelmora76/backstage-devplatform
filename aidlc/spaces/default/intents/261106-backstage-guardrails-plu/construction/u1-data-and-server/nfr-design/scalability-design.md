# Scalability Design — u1-data-and-server

Sources: `scalability-requirements.md` (NFR1.4, NFR1.5), `performance-requirements.md` (NFR1.1), `functional-spec.md` and `rules.md` (BR1.2 size limits, BR2.5, BR2.6), `tech-stack-decisions.md` and `contract-summary.md` (one client, the plugin backend).

## Scaling Architecture

One process, one instance. The sample has one browser user, so there is no scaling rule, load balancing, partitioning or queue. A second instance is not supported because the overlay lives in one process's memory (documented in the requirements).

| Concern | Design | Requirement |
|---|---|---|
| Overlapping calls | The server runs on one event loop. Each write handler checks and changes the overlay in one synchronous step with nothing that waits between the check and the change, so two calls cannot interleave inside a write. Calls therefore take effect one at a time in the order they arrived, which is what BR2.6 asks. | NFR1.4 |
| Concurrency test | A test fires 10 calls at once (a mix of reads and writes, including two identical writes) and checks that all succeed, that the two identical writes leave one change, and that the 95th percentile still meets 200 ms. | NFR1.4 |
| Larger data set | The generator library takes an optional size factor. It is not a setting, is not read from the environment, and is not reachable from the tools; only tests pass it. With a factor of 10 the generator builds about 50 services, 500 dependencies and 1,000 CI runs. This is the one declared exception to the size limits of BR1.2, which apply to every data set the server loads at start; the large data set is built and loaded by the test itself directly into the server's data store and is never reachable through the start-up path. | NFR1.5 |
| Data growth | None while running: apply and re-run mark items in the overlay and never add data. | NFR1.4 |

### How the Large Data Check Is Built

The size limits of BR1.2 are checked in the default-size entry point of the generator, the only one the server's start-up path calls. The size factor is a separate, test-only entry point that skips that check. The server is built by a factory that takes a ready data set; start-up passes it the default-size set, and the NFR1.5 test passes it the large set built with the factor. No setting or tool can reach the factor, so BR1.2 holds for every data set the running server can load.

## Capacity Thresholds

None are monitored. The tests above are the capacity evidence. If the sample is ever hosted for more than one user, the first change is moving the overlay to a shared store, and that is a new design, not a tuning step.
