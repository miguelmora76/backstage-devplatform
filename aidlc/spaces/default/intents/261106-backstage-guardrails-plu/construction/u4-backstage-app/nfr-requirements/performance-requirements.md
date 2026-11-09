# Performance Requirements — u4-backstage-app

Sources: `requirements.md` (NFR1: each view shows its data within 5 seconds, measured as the 95th percentile of 20 consecutive loads on the docker compose sample), `functional-spec.md` and `rules.md` (BR2.2, BR2.3, BR2.6), `contract-summary.md` (C4 readiness route; u3 and u2 timeouts) and answer Q1 in `nfr-requirements-questions.md`. Requirement IDs extend NFR1.

u4 adds almost no work of its own: the plugin screens are u3's and the backend work is u2's. What u4 owns is the sign-in page, the catalog and the start-up. The 20-load measurement of the views needs the whole compose sample and is built and run by u5.

| ID | Requirement | Measure and pass condition | Measured by |
|---|---|---|---|
| NFR1.1 | The sign-in page ends in a state within 5 seconds of opening: the users, `signin.off`, or `signin.loadFailed` with Retry. The page gives up on the user list after 5 seconds, and on the start call after 5 seconds (BR2.2). | A test with a stand-in backend that never answers shows `signin.loadFailed` at 5 seconds and, for the start call, `signin.failed` at 5 seconds (fake timers); a stand-in that answers after 300 ms shows the users within 700 ms. | This unit |
| NFR1.2 | Choosing a user gives feedback at once and cannot be repeated by accident. | After a user is chosen, the choice shows a working state in the same render, before the start address answers, and a second activation sends no second request. | This unit (BR2.3) |
| NFR1.3 | The catalog page and each service page show their data within 5 seconds. | The 95th percentile of 20 consecutive loads of the catalog list and of a seeded service's overview, from navigation to data shown, is at most 5 seconds on the compose sample. The catalog holds ten entries, so the list is small. | u5 (compose run); this unit supplies the catalog and the app |
| NFR1.4 | The app does not slow the plugins' calls. | The app puts no proxy, middleware or extra request between the browser and the plugin backend: a test with the start-up stand-in finds the plugin routes reached directly through the backend's own router. | This unit (BR1.2) |

## Not Required

- No start-up time target: the compose run waits for the readiness route (C4), and a slow start is visible in its output. A number would be a guess without a measured start on the target laptop.
- No throughput, memory or scaling target: one viewer at a time on a laptop. The Scalability document says so.
- No caching: the catalog is a small committed file read at start-up.

## Traceability

NFR1 (each view within 5 seconds) is met by NFR1.1 to NFR1.4; the views themselves are timed in u5 together with u3's and u2's limits (u3 NFR1.4, u2 NFR1.1). NFR3 and NFR4 have no speed target.
