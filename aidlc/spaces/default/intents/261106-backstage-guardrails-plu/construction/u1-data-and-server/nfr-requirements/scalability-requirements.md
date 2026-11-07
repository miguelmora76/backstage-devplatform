# Scalability Requirements — u1-data-and-server

Sources: `requirements.md` (NFR1, FR7.1 data size), `functional-spec.md` and `rules.md` (BR1.2 data size, BR2.6 overlapping writes), `contract-summary.md` (one client: the plugin backend) and answers Q1–Q3 in `nfr-requirements-questions.md`. Requirement IDs extend NFR1 (view time), because capacity here exists only to keep views fast.

## Load Projection

One browser user at a time, through one Backstage app, calling the server a few times per page view. There is no growth plan: the data set is fixed at about 5 services, 50 dependencies and 100 CI runs (BR1.2) and one server instance runs.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR1.4 | The server handles overlapping calls without error or slowdown beyond the target. | 10 calls at the same time (a mix of reads and writes) all succeed and meet NFR1.1; overlapping writes act one at a time and leave the same result as running them in order (BR2.6). |
| NFR1.5 | A larger data set still works. | The generator and server accept a data set ten times the default size (50 services, 500 dependencies, 1,000 CI runs) with the same tool answers, still meeting NFR1.1; this is checked once in the server's tests and is not a supported mode of the sample. |

## Scaling Strategy

None. A single instance is enough, and the in-memory overlay (BR2.5) means a second instance would not share applied changes. Running more than one instance is therefore not supported; the requirement is recorded so a later hosted version does not start several without a shared store.

## Data Growth

The data set does not grow while running: applying and re-running only mark items in memory. A restart resets it.
