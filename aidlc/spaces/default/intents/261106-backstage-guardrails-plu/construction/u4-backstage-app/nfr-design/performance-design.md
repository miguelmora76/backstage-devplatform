# Performance Design — u4-backstage-app

Sources: `performance-requirements.md` (NFR1.1 to NFR1.4), `scalability-requirements.md` (NFR1.5, NFR1.6), `tech-stack-decisions.md` (NFR2.9, NFR2.10), `functional-spec.md` (W2, the sign-in state machine, D9), `security-requirements.md` and `reliability-requirements.md` (limits shared with the states), `contract-summary.md` (C3 start address, C4 readiness route).

The app adds almost no work of its own. The design keeps the sign-in page quick to reach a state, safe against double presses, and out of the plugins' way.

## Patterns

| ID | Pattern | Meets | How it works |
|---|---|---|---|
| P1 | **Timeboxed calls with abort** | NFR1.1 | `signInClient` wraps the user-list read and the start call in one helper that creates an `AbortController`, aborts at 5000 ms and maps an abort to the same typed failure as a lost connection. The state function receives `listFailed` or `startFailed`, so a limit and a network error show the same text (`signin.loadFailed`, `signin.failed`). Tests use fake timers: a stand-in that never answers shows the failure at 5 s; one answering after 300 ms shows the users within 700 ms. |
| P2 | **Stale answer dropped** | NFR1.1 | Each load carries a counter. An answer whose counter is older than the latest load (Retry pressed, page unmounted) is ignored. |
| P3 | **Working state in the same render** | NFR1.2 | The click handler sets `starting` in the state function and returns; a ref flag set synchronously before the state update makes a second activation in the same frame a no-op. The chosen row shows the working text and all rows are disabled while `starting`. A test activates twice inside one `act` and counts one request. |
| P4 | **No proxy, no middleware** | NFR1.4 | The backend entry point lists features only; it adds no route, no proxy and no middleware in front of `plugin-guardrails-backend`. The start-up test requests a plugin route and finds it answered by the plugin's own router (nothing in between records the call). |
| P5 | **Small committed catalog** | NFR1.3 | The catalog holds ten entries read from a file at start-up; no query-time work, no cache. The 20-load timing of the list and a service overview is u5's compose measurement; the unit supplies the file and the app. |
| P6 | **Lazy routes from the framework** | NFR1.3 | The catalog pages and `guardrailsPlugin` load their screens through the new frontend system's route extensions; the app adds no eager imports of screens in `App.tsx`. |

## Budget

| Step | Budget | Owner |
|---|---|---|
| User list read | 5 s limit, typically under 100 ms locally | P1 |
| Start call | 5 s limit | P1 |
| Catalog list and service overview | at most 5 s at the 95th percentile of 20 loads | u5 measures |
| Plugin calls | u3 and u2 limits; unchanged by the app | P4 |

## Not Designed

No start-up time target, no throughput, no cache and no memory limit (see `performance-requirements.md`, Not Required and `scalability-requirements.md`, NFR1.6, which sets no scaling target).

## Failure and Edge Behavior

| Case | Behavior |
|---|---|
| List answers after Retry was pressed | The older answer is dropped (P2) |
| Press during `starting` | Ignored (P3) |
| Abort fires after the answer arrived | No effect; the timer is cleared on settle |
