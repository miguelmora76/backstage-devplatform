# Tech Stack Decisions — u3-plugin-ui

Sources: `requirements.md` (constraints: TypeScript on Backstage's current backend and frontend systems; local only, hosting later possible; NFR2 coverage and tests first; NFR3 WCAG 2.1 AA; NFR4 desktop Chrome and Firefox; NFR6 style; NFR7 repeatability), `functional-spec.md`, `rules.md` and `frontend-components.md` (components, services GuardrailsApi and DemoSession, testing seams), `design-system-mapping.md` (Backstage and Material UI components), `contract-summary.md` (C1, C3), `team-practices.md` (tests first, 85% coverage, Prettier and ESLint) and answers Q1–Q2 in `nfr-requirements-questions.md`.

This unit's stage produces no separate documents for scale, reliability or observability, so the quality targets for accessibility, browsers and repeatability are set here. Performance is in `performance-requirements.md` and security in `security-requirements.md`.

## Quality Targets

| ID | Target | Measure and pass condition |
|---|---|---|
| NFR3.1 | Every screen state in the accessibility checklist's scan list has no WCAG 2.1 AA violation in an automated scan. | One test per variant (card: loaded, loading, empty, error; Guardrails view: each section loading, empty and error, banner shown, filters with no match, bad date range, second page, auditor, proposer; detail: pending as proposer, as another user, as auditor, failed, decided, loading, server unreachable, not found, submit failed, empty-reason error, stale refusal) runs the checker and finds no violation. |
| NFR3.2 | Every control is reachable and usable by keyboard alone, in the order the mockups give. | Keyboard-only tests drive the seven walkthroughs of the accessibility checklist with keyboard events only and reach the end of each. |
| NFR3.3 | What a screen reader is told is the catalog text. | Tests read the accessible name, description and live-region text of the disabled actions, banners, alerts, the counter and the paging, and compare them with the catalog strings. |
| NFR3.4 | The checks a simulated browser cannot make (colour contrast, real focus behavior, a screen-reader pass of walkthrough 1) are made in real browsers. | Built and run by u5 against the compose sample in Chrome and Firefox (Q2: A); until then they are listed as open in the unit's test instructions. |
| NFR4.1 | The flows of FR1 to FR4 work in current stable Chrome and Firefox on desktop. | Built and run by u5 (Q2: A). This unit uses no browser feature that is not in both, and no vendor-specific code. |
| NFR7.1 | The same data gives the same screens every run. | No random or clock-dependent text: dates and times are shown as `YYYY-MM-DD HH:mm` in the viewer's own time zone (chosen by the person in NFR Design, Q1: A), built by one function; tests pin the time zone (in the Jest global setup, so it holds from the package and from the repository root) and the clock; no relative times ("5 minutes ago"). |

## Decisions

| ID | Decision | Choice | Rationale |
|---|---|---|---|
| NFR2.1 | Language | TypeScript, strict settings of the workspace, one toolchain with the server and the backend plugin | Constraint; same compiler and lint rules everywhere |
| NFR2.2 | Frontend system | The new Backstage frontend system (Q1: A): the plugin is declared with `@backstage/frontend-plugin-api`, and the service tab and the overview card are extensions on the catalog entity page | Chosen by the person; the host app (u4) must load the plugin the same way. Risk: some entity-page extension helpers have been in alpha entry points, so versions are pinned and the first Code Generation step confirms the exact imports |
| NFR2.3 | Plugin identity | Frontend plugin id `guardrails`, package `plugin-guardrails` in `packages/plugin-guardrails` of the same workspace | Contract C3 names `guardrails` and `plugin-guardrails`; one lock file and one CI |
| NFR2.4 | Backend address and credential | The plugin's own API extension uses Backstage's discovery service to find the base address of the plugin backend (`guardrails`) and of the auth backend (`auth`, for the demo sign-in start path) and Backstage's fetch service for calls; the chosen demo user's token replaces the Authorization header for this plugin's calls only (BR5.2) | No address in code (NFR5.11); the credential rules stay in one place (`GuardrailsApi`) |
| NFR2.5 | UI components | `@backstage/core-components` and Material UI version 4 (the version Backstage components use), with the lab package for the alert; React as the app provides it | `design-system-mapping.md`; standard components give keyboard behavior and focus handling for free |
| NFR2.6 | Data loading | One small custom hook per section on top of React state and effects; no data-fetching library | Six calls and no cache needs; keeps dependencies low (NFR5.12). Each section owns its own load so sections never wait on each other (BR7.4) |
| NFR2.7 | Routing | The plugin's own routes inside the entity tab: the view at `/` and the detail at `/changes/:changeId` (D1) | `frontend-components.md` |
| NFR2.8 | Tests and coverage | Backstage's usual test runner with its coverage report; a failing test written before the code for each layer; at least 85% line coverage on the plugin code, enforced in CI by the threshold set in the package | Team practice and NFR2 |
| NFR2.9 | Test tools | React Testing Library with its user-event helper for behavior and keyboard use; Backstage's test utilities (`@backstage/test-utils`) to render inside a test app with the plugin's APIs; `msw` through Backstage's helper for a stand-in backend; `jest-axe` for the accessibility scan | All are the usual Backstage frontend test tools except `jest-axe`, added for NFR3.1 |
| NFR2.10 | Stand-in backend | A set of `msw` handlers that answer the C1 calls with fixed data, with switches for every state in the scan list; a contract test reads `packages/plugin-guardrails-backend/contract/c1-openapi.yaml` and fails when a handler's answers differ from it | Contract Ownership Rules: a stand-in that disagrees with the spec fails the consumer's test |
| NFR2.11 | Real browsers | Not in this unit (Q2: A). u5 adds a browser test tool to the compose run for the real scan, the Chrome and Firefox walkthroughs and the 20-load timing | Keeps this unit's pull request fast; the checks that need the whole sample belong where the sample runs |
| NFR2.12 | Packaging | A package of the same workspace, built with Backstage's usual package build, added to the host app by u4; no separate service | Keeps one lock file and one CI setup |
| NFR6.1 | Formatting and linting | Prettier and ESLint with Backstage's usual settings, enforced in CI, plus a lint rule that forbids raw-HTML insertion (NFR5.5) | NFR6, team practice |

## New Packages

| Package | Why | Kind |
|---|---|---|
| `@backstage/frontend-plugin-api`, `@backstage/plugin-catalog-react` (entity page extensions, from its `alpha` entry point) | The plugin itself | Runtime |
| `react`, `react-dom`, `react-router-dom` (version 18 and 6, which Backstage and Material UI 4 support) | Provided by the app; also declared as peer dependencies | Peer and development |
| `@material-ui/core`, `@material-ui/lab` | Components in the mockups | Runtime |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `@testing-library/jest-dom`, `@backstage/test-utils`, `@backstage/cli`, `msw`, `jest-axe`, `@types/jest-axe`, `@types/react`, `@types/react-dom`, `yaml` | Tests and the contract check (`yaml` reads the C1 file, as in u2) | Development |

The list is exact: it is kept in `allowed-packages.txt` beside the plugin and a CI script fails on any other package (NFR5.12). `@backstage/core-components` and `@backstage/core-plugin-api` were considered and are not used. Exact versions are fixed by the lock file and checked against the versions the host app (u4) uses.

## Alternatives Considered

| Choice | Alternative | Why not |
|---|---|---|
| New frontend system (NFR2.2) | Legacy frontend system | Chosen against by the person (Q1: A); the older path is on its way out |
| Hook per section (NFR2.6) | A data-fetching library with caching | Overkill for six calls and no caching need; one more dependency to keep in step with the host app |
| Simulated-browser scan plus real browsers in u5 (NFR2.11) | Real browsers inside this unit | Chosen against (Q2: A); a heavier unit test setup for a check that also needs the compose sample |
| Token in memory with userId in tab storage (NFR5.2) | Token in tab storage | A stored token is readable by any script and survives longer than needed |
