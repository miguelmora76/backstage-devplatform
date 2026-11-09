# Scalability Requirements — u4-backstage-app

Sources: `requirements.md` (NFR1 timing on the compose sample; the sample runs on a developer laptop), `functional-spec.md` and `rules.md` (BR3.1, BR4.3), `contract-summary.md` and answer Q1 in `nfr-requirements-questions.md`. Requirement IDs extend NFR1, the only inception requirement that sets a load-related target.

## Load

One viewer at a time, on a laptop, with three invented users who are rarely signed in together. The catalog holds ten entries. There is no load projection to plan for and no scaling trigger.

| ID | Requirement | Measure and pass condition |
|---|---|---|
| NFR1.5 | The app keeps no state that would stop it running as more than one copy later. | The app holds nothing in its own memory that other copies would need: the sign-in token is in the browser's memory, the catalog is a committed file, and the plugins' data is in the database (u2). A review of the app's code finds no module-level store (BR2.6, BR3.4). |
| NFR1.6 | There is no scaling target for the sample. | None is set; this is recorded so a later hosting effort knows it was a choice. |

## Capacity Notes

- The in-memory SQLite database used for plain local development holds one process's data and is lost on restart (BR4.3). It is not a scaling choice: compose uses PostgreSQL, which also allows more than one backend copy later.
- Nothing in the design blocks hosting later: the guardrails server address, the database and the app's own base addresses are settings (BR4.1, BR4.3, BR4.5).

## Not Required

Auto-scaling, load balancing, partitioning and queueing: not applicable to a local sample.
