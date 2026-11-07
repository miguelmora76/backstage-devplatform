# Performance Design — u1-data-and-server

Sources: `performance-requirements.md` and `scalability-requirements.md` (NFR1.1–NFR1.5), `reliability-requirements.md` (NFR7.7), `functional-spec.md` and `rules.md` (the four tools, BR1.1, BR2.1–BR2.6) and `contract-summary.md` (contract C2 timeouts). No design questions were needed: the NFR Requirements answers (language, logging, caller check) and the targets already fix every choice made here.

## Approach

All data lives in memory and is small, so no caching layer, pooling or asynchronous work is needed. The design keeps each call to a few lookups and one sort-free list copy.

| Concern | Design | Requirement |
|---|---|---|
| Fast reads | At start, build the data set once and prepare, for every service, its dependency list already ordered by name and its run list already ordered newest first. A read copies the prepared list and applies the overlay; it sorts nothing. | NFR1.1 |
| Overlay lookups | The overlay holds two sets of keys (upgraded dependencies, re-run runs). A set lookup is constant time, so applying the overlay to a list is one pass. | NFR1.1 |
| No input or output waits | No file, network or database access after start. The only outward write is one log line per call. | NFR1.1 |
| Fast start | Build the data set before the port opens, in one synchronous pass. The generator does a fixed amount of work per item (linear in the data size). | NFR1.2, NFR1.3 |
| Budget | 200 ms per call at the 95th percentile (NFR1.1) against the caller's 3 second read timeout and the 5 second view target: the server uses under 7% of the read timeout. | NFR1.1 |

## Performance Budget Checks

- A test calls each tool 200 times on the default seed inside the test process and fails if the 95th percentile exceeds 200 ms (NFR1.1). It measures the tool handlers, then once more through the HTTP route so the transport is counted.
- A test builds the default data set 20 times and fails if the slowest build exceeds 1 second (NFR1.3).
- A start test measures the time from process launch to a ready health check against the 10 second limit (NFR1.2).
- Memory (256 MB) and the one-core limit are set as limits on the container in the compose file (u5); u1 documents them as the intended limits and checks memory use once, at the end of the 200-call test.
- The 200-call benchmark runs in the test process in this unit; the same measurement is repeated against the running container in u5-compose-and-ci, which is where NFR1.1 ("inside the container") is finally met.

## Not Used, and Why

| Option | Why not |
|---|---|
| A cache in front of the lists | The lists are already in memory; a cache would add stale-data bugs for no gain |
| Worker threads | One browser user; the work is microseconds |
| Streaming responses | Responses are tens of items |
