# Performance Requirements — u3-plugin-ui

Sources: `requirements.md` (NFR1: each view shows its data within 5 seconds, measured as the 95th percentile of 20 consecutive loads on the docker compose sample; NFR4: desktop Chrome and Firefox), `functional-spec.md` and `rules.md` (BR7.4 parallel loads, BR3.8 and BR6.1 failure behavior, BR2.2 working state), `contract-summary.md` (C1 and the timeouts: reads 3 seconds, writes 10 seconds, no automatic retries) and answers Q1–Q2 in `nfr-requirements-questions.md`.

Measures that need the whole running sample (a real browser, the compose stack) are built and run by u5; this unit defines the target and builds the measurements that fit in its own tests. Detailed IDs inherit NFR1.

## Targets

| ID | Requirement | Measure and pass condition | Measured by |
|---|---|---|---|
| NFR1.1 | Each view (the overview card, the Guardrails view, the change detail screen) shows its data, its empty text or its error within 5 seconds. | In current Chrome on a developer laptop running the compose sample, the 95th percentile of 20 consecutive loads of each view, from navigation to data shown, is at most 5 seconds. | u5 (compose run); this unit supplies the page and the "data shown" signal (the sections are no longer marked busy) |
| NFR1.2 | The four sections of the Guardrails view load at the same time, so the page takes as long as its slowest section, not the sum. | A test with a stand-in backend that answers each read after 300 ms has all four sections loaded within 700 ms of the page opening (not 1,200 ms or more). The test starts with the demo session already set up; after a reload with a stored user the page makes two setup calls first (the user list, then the token) ahead of the section reads, which the 5 second read limit still covers. | This unit (BR7.4) |
| NFR1.3 | The overview card makes its three reads at the same time as well. | The same test on the card: three reads of 300 ms each finish within 700 ms. | This unit |
| NFR1.4 | The page never waits longer than its own limits for an answer, and those limits sit above the backend's so the backend's own answer is normally what the person sees. The read limit is the 5 seconds of NFR1, which is above the backend's 3-second read timeout; the write limit is the backend's 10-second write timeout plus 2 seconds. NFR1.1 applies while the plugin backend itself answers; if the plugin backend hangs, the page shows `error.loadFailed` at 5 seconds, so even that case ends inside the NFR1 bound. | Reads time out in the page after 5 seconds and writes after 12 seconds, each shown as the matching error with the reason kept. A test with a stand-in that never answers shows `error.loadFailed` at 5 seconds and `error.submitFailed` at 12 seconds (fake timers); a stand-in that answers `503 SERVER_UNREACHABLE` after 3 seconds shows the server error panel, not `error.loadFailed`. | This unit |
| NFR1.5 | A pressed action gives feedback at once. | After Propose, Approve, Reject or Retry is pressed, the button shows "Working..." in the same render, before any answer arrives, and ignores a second press. | This unit (BR2.2) |
| NFR1.6 | A full page of data renders without a visible stall. | With the seeded set (10 rows of each paged list, up to 200 open changes) no single render of the open list takes 1 second or more in the test environment (React's own render time for the commit, so the guard does not depend on network timing). | This unit; the figure is a regression guard in a simulated browser, not the user-facing number (that is NFR1.1) |
| NFR1.7 | The plugin does not slow the start of the Backstage app. | The plugin's screens are loaded when their route is first opened (route-level lazy loading), and the plugin's own code is at most 300 KB compressed. | This unit builds it lazily and the build fails above 300 KB (checked on the plugin's compiled output; provisional until u4 builds the app, then checked on what the app ships); u5 reports the size with the build |

## Not Required

- No throughput, memory or scaling target: one viewer at a time on a laptop. The scalability, reliability and observability documents are not produced for a UI unit.
- No live refresh (D5 in `functional-spec.md`), so no polling load on the backend.

## Traceability

NFR1 (view within 5 seconds) is met by NFR1.1 to NFR1.7. NFR4 (desktop Chrome and Firefox) has no speed target; it is covered in `tech-stack-decisions.md`.
