# Logical Components — u3-plugin-ui

Sources: `performance-design.md` and `security-design.md` (this stage), `tech-stack-decisions.md`, `performance-requirements.md` and `security-requirements.md` (NFR1.1–NFR1.7, NFR2.1–NFR2.12, NFR5.1–NFR5.12), `frontend-components.md` (components and services), `functional-spec.md` and `rules.md` (BR1.1–BR7.5) and `contract-summary.md` (C1, C3). This is the component-level view of where the NFR patterns apply. The plugin is code that runs inside the Backstage app's browser page; it has no process, store or port of its own. Deployment pieces are decided in Infrastructure Design.

## Components

| Component | Responsibility | NFR patterns applied |
|---|---|---|
| GuardrailsApi | The only code that makes calls. One method per C1 call, address builder, 5 s and 12 s limits, typed failures, credential header from `DemoSession`, response bodies discarded after the error code is read | S2, S3, S5, S9, S10, P2 |
| DemoSession | Holds the chosen user and the in-memory token, stores the userId only, refreshes the token, lists users for the switch | S1, S8 |
| Texts | The string catalog and its additions, reason and error code mapping, `formatTime` | S4, S9, P9 |
| useSection hook | One load per section with a counter that drops stale answers, abort on unmount, states Loading, Loaded, Empty, ServerError, LoadFailed | P1, P5 |
| GuardedButton | Focusable button that sends nothing when the backend does not list the action; shows "Working..." in the same render and ignores a second press | S7, P3 |
| ReasonForm and ReasonField | 500-character box, blank check before sending, reason kept on failure | S6 |
| AuditLogSection | Filters, table, paging; read calls only | S12, P6 |
| DemoUserSwitch | Renders only with a user list; refuses ids outside the list | S8 |
| Section views (plan, CI, open, card) | Render states and rows as text; sorted and sliced with memoized derivations | S4, P6, P7 |
| Route entry points | Lazy-loaded tab and detail routes; card on the overview tab | P8 |
| Contract stand-in (tests) | `msw` handlers with switches per state, checked against `c1-openapi.yaml` | NFR2.10 |

## Failure Domains and Blast Radius

| Failure | What stops | What keeps working |
|---|---|---|
| One section's call fails or reaches 5 s | That section shows `error.loadFailed` with Retry | The other sections and every action not tied to them |
| Plan or CI read answers `SERVER_UNREACHABLE` | That section shows the server error panel; all write actions disable (BR6.2) | Open list, audit log, the signed-in user, navigation |
| Plugin backend hangs | Each section ends at 5 s with `error.loadFailed`; a write ends at 12 s with `error.submitFailed`, reason kept | The Backstage app and its other plugins |
| Start path fails on a switch | The switch; the previous user stays | All sections for the previous user |
| Token expires mid-session | One call; it refreshes and replays a read once, otherwise `error.unauthenticated` and the switch is offered | Screens already shown |
| A component throws while rendering | The section or screen is replaced by the app's error boundary | The rest of the Backstage app (the plugin adds no boundary of its own) |
| Tab storage blocked | The remembered user after a reload | The session for the life of the page |

## Shared Resources

- The browser's own connection limits are shared with the Backstage app; the view starts at most six reads at once (header and four sections), plus at most one token request on a user switch while the aborted older reads end; browsers allow six connections per host to HTTP/1.1 servers and many more on HTTP/2, so at worst a switch queues one request behind an aborted one.
- `DemoSession` is one instance per plugin instance, shared by header, sections and `GuardrailsApi`; that sharing is what keeps the token in one place.
- The plugin uses Backstage's `fetchApi` and `discoveryApi`; it adds no global state, timers outside screens, or event listeners.

## Isolation Notes

- The unit calls only the plugin backend and the auth backend's start path; it never calls the guardrails server (unit boundary).
- Every external seam (`GuardrailsApi`, `DemoSession`) can be replaced by a stand-in in tests; screens do not import `fetch` or storage directly (a lint rule forbids it outside those two files).

## Notes for Later Stages

- Infrastructure Design for this unit decides the package build output, the CI jobs (unit and coverage at 85%, lint, size and address checks, lock-file check) and what u4 needs to load the plugin; there is no runtime infrastructure.
- Code Generation builds in this order, tests first: `Texts` and `formatTime` (pure), `DemoSession` and `GuardrailsApi` with the contract stand-in, `useSection` and `GuardedButton`, the section views and `ReasonForm`, `DemoUserSwitch`, the screens and routes, then the accessibility scan and keyboard tests. The first step confirms the exact new-frontend-system imports (NFR2.2 risk).
