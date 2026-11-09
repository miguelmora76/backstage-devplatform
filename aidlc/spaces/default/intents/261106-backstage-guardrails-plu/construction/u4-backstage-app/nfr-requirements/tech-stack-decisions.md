# Tech Stack Decisions — u4-backstage-app

Sources: `requirements.md` (constraints: TypeScript on Backstage's current backend and frontend systems; local only, hosting later possible; NFR2 coverage and tests first; NFR3 WCAG 2.1 AA; NFR4 desktop Chrome and Firefox; NFR6 style; NFR7 repeatability), `functional-spec.md`, `rules.md` and `entities.md` (this unit), the u2 and u3 `tech-stack-decisions.md` (the plugins' stack), `contract-summary.md` (C3, C4), `team-practices.md` (tests first, 85% coverage, Prettier and ESLint) and answer Q1 in `nfr-requirements-questions.md`.

Performance, security, scalability, reliability and observability are in their own documents of this folder. Quality targets that have no document of their own are set here.

## Quality Targets

| ID | Target | Measure and pass condition |
|---|---|---|
| NFR2.1 | At least 85% line coverage on the app's own code (sign-in page, identity handling, catalog script logic, settings check), with tests written first. Excluded from the count: each package's `index.ts` and bootstrap entry file (`App.tsx` or the equivalent), type declaration files, test files and purely declarative configuration. The exclusions are written in the packages' Jest settings, where the threshold is also set, so they can be reviewed. | The coverage report in CI shows 85% or more and CI fails below it; the threshold is set in the packages and never lowered (BR5.3). |
| NFR2.2 | A failing test comes before the code for each layer. | The code plan orders each layer Red, Green, Refactor; the code summary records each Red run. |
| NFR2.3 | The real pieces start together in this unit's tests (answer Q1: A). | A start-up test with Backstage's test backend loads the backend's feature list from one exported list (`packages/backend` builds its entry point from that same list, so a feature missing from the entry point is missing from the test), with the real `plugin-guardrails-backend` and its `authModuleDemoSignIn`, in-memory SQLite and a stand-in guardrails server. It checks the readiness route, the user list with the switch on and off (200 for a signed-out caller with it on; 401 signed out and 404 signed in with it off), the settings failure of NFR7.2, and 401 for credentials built for a service principal, an unknown user and no one (NFR5.1, NFR5.2, NFR7.3, NFR7.4). Runs on every pull request with no Docker. **What it cannot show:** Backstage's test backend replaces the HTTP authentication with a mock, so a token issued by the real auth backend is never verified by the guardrails plugin in this test. That end-to-end step (sign in through the start address with the real auth backend, then call the plugin with that token) is a hand-off to u5's compose run (see the table below). |
| NFR2.4 | The catalog cannot drift from the data. | A test fails when the committed catalog file differs from the script's output for the default seed (BR3.2). |
| NFR2.5 | The shipped settings are checked. | A test parses the committed settings and finds the substitutions, the defaults and the absence of literal secrets or server addresses (NFR5.2, NFR5.4, NFR5.6). |
| NFR3.1 | Every state of the sign-in page has no WCAG 2.1 AA violation in an automated scan. | One test per state (loading, choosing, demo off, load failed, starting, sign-in failed) runs the checker and finds no violation. |
| NFR3.2 | The sign-in page is usable by keyboard alone. | A keyboard-only test reaches each choice, activates one with Enter and Space, and reaches Retry in the load-failed state. |
| NFR3.3 | What a screen reader is told is the sign-in strings of `functional-spec.md`. | Tests read the accessible names and live-region text of the heading, the choices (`signin.choose`), the working state and the errors and compare them with the strings. |
| NFR3.4 | The checks a simulated browser cannot make (colour contrast, real focus behavior, a screen-reader pass of the sign-in page and of the catalog page) are made in real browsers. | Built and run by u5 against the compose sample in Chrome and Firefox; until then listed as open in the unit's test instructions. |
| NFR4.1 | The app works in current stable Chrome and Firefox on desktop. | Built and run by u5. This unit uses no browser feature that is not in both and no vendor-specific code. |
| NFR6.1 | Formatting and linting with Backstage's usual settings are enforced in CI, with a rule that forbids raw-HTML insertion. | Prettier check and ESLint over `packages/app` and `packages/backend` fail the pull request on any difference or error (NFR5.5). |

## Decisions

| ID | Decision | Choice | Rationale |
|---|---|---|---|
| NFR2.6 | Language | TypeScript with the workspace's strict settings, one toolchain with the plugins | Constraint; same compiler and lint rules everywhere |
| NFR2.7 | Frontend system | The new Backstage frontend system, as u3's plugin: the app creates its frontend from the features it is given (the catalog pages, the sign-in page and `guardrailsPlugin`) | u3 chose it (Q1: A there); the app must load the plugin the same way |
| NFR2.8 | Backend system | The new Backstage backend system: the backend adds the catalog backend, the auth backend, `plugin-guardrails-backend` and its `authModuleDemoSignIn` | Matches u2 and contract C3 |
| NFR2.9 | Sign-in page components | Material UI version 4 and the sign-in page extension point of the app plugin, with a custom page that lists the users and signs in through the start address; the choices are real buttons | The version Backstage components use; the same as u3; standard components give keyboard behavior |
| NFR2.10 | Tests | Backstage's test runner (Jest), React Testing Library and its user-event helper, `msw` for the stand-in backend, `jest-axe` for the scan, Backstage's test backend (`@backstage/backend-test-utils`) for the start-up test | The tools u2 and u3 already use |
| NFR2.11 | Catalog script | A TypeScript script in `packages/backend` that calls the u1 generator for a seed (default 20261106) and prints the catalog file; run with one documented command; takes `--seed` and `--out` (BR3.5) | The catalog follows the data (Q1: A); a dev and test dependency on u1, not a runtime one |
| NFR2.12 | Database | In-memory SQLite for plain local development; PostgreSQL supplied by the compose override through environment variables | Matches u2 (SQLite in tests, PostgreSQL at run time) and BR4.3 |
| NFR2.13 | Packaging | Two packages in the same workspace, `packages/app` and `packages/backend`, with the catalog file under the backend package; the Docker image is built by u5 | One lock file and one CI; image building is u5's |
| NFR2.14 | Documentation | A root `README.md` covering the whole project, started in this unit (BR5.2) | The person's request |

## New Packages

| Package | Why | Kind |
|---|---|---|
| `@backstage/frontend-defaults`, `@backstage/plugin-app`, `@backstage/plugin-app-react`, `@backstage/plugin-catalog`, `@backstage/frontend-plugin-api` | The app shell, the catalog pages and the sign-in page extension of the new frontend system | Runtime (app) |
| `@backstage/backend-defaults`, `@backstage/plugin-app-backend`, `@backstage/plugin-catalog-backend`, `@backstage/plugin-auth-backend`, `@backstage/plugin-auth-node`, `plugin-guardrails-backend`, `better-sqlite3`, `pg` | The backend that serves the app, the catalog, the auth backend and the guardrails plugin, with its databases | Runtime (backend) |
| `plugin-guardrails` | The u3 plugin (a workspace package) | Runtime (app) |
| `@material-ui/core`, `react`, `react-dom`, `react-router-dom` (versions 18 and 6) | The sign-in page and the app shell | Runtime (app) |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/dom`, `@testing-library/jest-dom`, `@backstage/test-utils`, `@backstage/backend-test-utils`, `@backstage/cli`, `msw`, `jest-axe`, `guardrails-server` (the generator, a workspace package), `yaml` | Tests, the start-up test and the catalog script | Development |

Every Backstage package name above was checked to exist on the registry on 2026-11-09 (for example `@backstage/frontend-defaults` 0.5.7, `@backstage/plugin-app` 0.5.4, `@backstage/plugin-app-react` 0.2.8, `@backstage/plugin-catalog` 2.0.10, `@backstage/plugin-app-backend` 0.5.19, `@backstage/plugin-catalog-backend` 4.0.2, `@backstage/plugin-auth-backend` 0.30.2, `@backstage/backend-defaults` 0.18.1). The exact list with versions is written in `allowed-packages.txt` beside each package when the packages are created and is checked by a script in CI (NFR5.8). A package added on purpose edits that file in the same pull request.

## Hand-offs to u5

These checks are part of this unit's requirements but are built and run by u5 (the compose and CI unit), so u5's NFR Requirements takes them as inputs.

| ID | What u5 builds or runs |
|---|---|
| NFR1.3 | The 20-load 95th percentile (at most 5 seconds) of the catalog list and a seeded service's overview on the compose sample |
| NFR3.4 | Colour contrast, real focus behavior and a screen-reader pass of the sign-in page and the catalog page in Chrome and Firefox |
| NFR4.1 | The flows in Chrome and Firefox, including the sign-in |
| NFR2.3 (end-to-end part) | Sign in through the start address with the real auth backend, then call the guardrails plugin with that token (an authenticated plan load): the one step the test backend cannot show |
| NFR5.6 (if needed) | The origin check, if the test backend does not apply the CORS setting |
| NFR7.2 (exit code) | That the compose run shows a failed start when `GUARDRAILS_SERVER_URL` is missing, if the entry point's exit code cannot be asserted in this unit |

## Id Notes

Detailed ids extend the inception ids by topic, as in the other units: NFR1.5 to NFR1.6 (scale) and NFR1.7 to NFR1.9 (observability) extend NFR1 because the sample's load and monitoring targets are timing-related; NFR2.6 to NFR2.14 are decisions numbered under NFR2 (quality). The same number can mean something else in another unit's folder (for example NFR5.3 here is the token rule, in u2 it is the passwordless sign-in risk); within a unit's folder every id is unique.

## Alternatives Considered

| Choice | Alternative | Why not |
|---|---|---|
| Catalog from the generator by a script (Q1: A) | Names written by hand, or built at start-up | Chosen against by the person; the script keeps the catalog tied to the data |
| Start-up test in this unit (Q1: A) | Wiring checked only by u5's compose run | Chosen against by the person; the compose run needs Docker and is slow |
| New frontend system | Legacy frontend system | The plugin (u3) uses the new one |
| In-memory SQLite locally | PostgreSQL always | A plain `yarn start` should need no database server; compose supplies PostgreSQL |
| Sign-in held in memory | Sign-in kept in storage | A stored token is readable by any script and survives longer than needed (NFR5.3) |
