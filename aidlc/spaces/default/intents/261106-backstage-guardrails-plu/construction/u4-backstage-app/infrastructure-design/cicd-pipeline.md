# CI/CD Pipeline — u4-backstage-app

Sources: `team-practices.md` (pull requests, CI green before merge, Prettier and ESLint, 85% coverage, nothing deploys automatically, docker compose locally), the NFR Design of this unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), `components.md`, `functional-spec.md` (W1 to W5, D8, D10, D11), `contract-summary.md` (C3, C4) and answer Q1 in `infrastructure-design-questions.md`. The unit adds jobs to the shared GitHub Actions workflow, which it does not own, next to the `plugin-*` and `ui-*` jobs of u2 and u3.

## Deployment Shape Used by the Pipeline

| Facet | Choice |
|---|---|
| Packaging | Packages `packages/app` and `packages/backend` of the same workspace; the backend serves the built frontend |
| Runtime resources | None in CI; the start-up test uses Backstage's test backend, in-memory SQLite and a stand-in guardrails server, with no Docker |
| Tests | Jest with React Testing Library, `msw`, `jest-axe` and `@backstage/backend-test-utils`, on the Node release the other jobs use |
| Monitoring | None of its own (see `monitoring-design.md`) |
| Image | Built by u5 from the `app-build` output |

## Build and Test Stages

The workflow runs on every pull request and on every push to `main`. A failed job fails the pull request.

| Job | What it does | Gate |
|---|---|---|
| `app-unit` | One Jest run over both packages, with coverage, of every test except the start-up test file: `signInState` table test, `signInClient` with fake timers, `IdentityHolder`, the page states with `jest-axe` scans and keyboard tests, the hostile-text test, and the unit tests of the catalog script logic and of `checkShippedSettings` as functions (NFR1.1, NFR1.2, NFR3.1 to NFR3.3, NFR5.3, NFR5.5, NFR5.7, NFR7.5). Uploads the coverage output | Any failing test fails |
| `app-coverage` | Reads the coverage output of `app-unit` only, with the exclusions written in the packages' Jest settings. `app-catalog` and `app-checks` run the same functions on the real files as scripts; their runs are not counted | Line coverage below 85% on the app's own code fails; the threshold is never lowered (NFR2.1, D11) |
| `app-startup` | The start-up test: the real feature list in the test backend with a stand-in guardrails server and a recording logger; readiness, user list with the switch on and off, the failed-start message, 401 for the three credential kinds, server-down behavior, the log search for secrets (NFR2.3, NFR5.1, NFR5.2, NFR7.2 to NFR7.4, NFR1.4) | Any failing check fails |
| `app-catalog` | Runs the catalog script twice with the default seed and compares bytes, then compares with the committed file (NFR7.1, NFR2.4) | Any difference fails |
| `app-checks` | `checkShippedSettings` over every committed settings file and `.env.example` (substitutions, defaults, no literal secret, no foreign host, one CORS origin, content policy present); allow-list scripts for both packages; lint bans on raw HTML, `console` and top-level mutable state; no host name or port literal in the source (NFR2.5, NFR5.4 to NFR5.6, NFR5.8, NFR6.1, NFR1.5, NFR1.9) | Any hit fails |
| `app-format-lint` | Prettier check and ESLint with Backstage settings over both packages. Where the shared `format`, `lint` and `typecheck` jobs already cover the workspace, Code Generation adds these paths to them instead of keeping copies, as u2 and u3 did (NFR6.1) | Any difference or error fails |
| `app-build` | Builds both packages and uploads the output as a workflow artifact for u5's image build (NFR2.13). A last step starts the built backend entry point with `GUARDRAILS_SERVER_URL` unset and asserts a non-zero exit code and the message naming `guardrails.server.url` (NFR7.2) | Build failure, a zero exit code or a missing message fails |

Order: `app-format-lint`, `app-unit`, `app-startup`, `app-catalog` and `app-checks` start together; `app-coverage` takes the coverage output that `app-unit` uploads and does not run the tests again; `app-build` runs in parallel and needs no Docker. `app-catalog` needs the u1 generator package built in the workspace (a development dependency, D10), so it runs after the workspace install step. Timing tests use fake timers, not wall-clock assertions. The required status checks of the repository are the jobs above; they are set in the GitHub repository settings when the first pull request of this unit is opened, a manual step for the person who owns the repository.

### What this pipeline does not prove

The test backend replaces HTTP authentication with a mock, so a token issued by the real auth backend is never verified by the guardrails plugin in `app-startup` (NFR2.3). The compose run in u5 makes that end-to-end step. The same hand-off covers the 20-load timing (NFR1.3), colour contrast and a screen-reader pass (NFR3.4), the Chrome and Firefox flows (NFR4.1), and the CORS and content-policy header checks if the test backend does not apply those settings (NFR5.6, S9).

## Deployment Strategy

None. Nothing deploys automatically and nothing is published. The sample runs with the compose command from u5.

## Rollback

Nothing runs in an environment, so nothing is rolled back there. A bad change is undone by reverting its pull request on `main`; the next run checks the revert. The committed catalog file and settings revert with the pull request.

## Environment Promotion

None: one environment, the developer laptop. If hosting is added later, only settings change (see `infrastructure-specification.md`, Hosting Later).

## Secrets in the Pipeline

None. The jobs push nothing and call no outside service. Tests use a fixed fake token string and a fake database password that exist only inside the test. `.env.example` holds no password, and `app-checks` fails if one appears.

## Branching

Each Bolt is a short-lived branch merged through a pull request after review (team practices). The required checks are the jobs above.

## NFR to Infrastructure Mapping

| ID | Where it lands |
|---|---|
| NFR1.1 | `app-unit` fake-timer tests of the 5 s limits and the 300 ms answer |
| NFR1.2 | `app-unit` test: working state in the same render, one request for two activations |
| NFR1.3 | Delegated to u5 (20-load 95th percentile on the compose sample) |
| NFR1.4 | `app-startup` finds the plugin routes reached through the backend's own router |
| NFR1.5 | `app-checks` lint ban on top-level mutable state; stateless design reviewed in code |
| NFR1.6 | No target; settings only (nothing to build) |
| NFR2.3 | `app-startup` with one exported feature list; end-to-end token step delegated to u5 |
| NFR2.4 | `app-catalog` |
| NFR2.5 | `app-checks` `checkShippedSettings` |
| NFR2.9 | `app-unit` renders the page with Material UI 4 |
| NFR2.10 | `app-unit`, `app-startup` run on the listed test tools |
| NFR2.11 | `app-catalog` runs the script with a seed and `--out` |
| NFR2.12 | `app-startup` runs on in-memory SQLite; PostgreSQL supplied by u5 |
| NFR2.13 | `app-build` builds both packages; image by u5 |
| NFR5.1 | `app-startup` credential tests and the settings test for `auth.providers` |
| NFR5.2 | `app-startup` with the switch off and on; `app-checks` default check |
| NFR5.3 | `app-unit` storage, console and rendered-text search |
| NFR5.4 | `app-checks` settings check and source ban on hosts and ports |
| NFR5.5 | `app-unit` hostile-text test; `app-checks` raw-HTML lint ban |
| NFR5.6 | `app-checks` one CORS origin; `app-startup` other-origin request, else u5 |
| NFR5.7 | `app-unit` test that an id outside the list sends nothing |
| NFR5.8 | `app-checks` allow-list scripts |
| NFR6.1 | `app-format-lint` |
| NFR7.1 | `app-catalog` byte comparison |
| NFR7.2 | `app-startup` failed-start message; `app-build` last step asserts the non-zero exit code of the built entry point; u5's compose run shows the failure |
| NFR7.3 | `app-startup` with a stand-in server that is not running |
| NFR7.4 | `app-startup` readiness request |
| NFR7.5 | `app-unit` table test and one render test per state |
| NFR7.6 | `app-unit` and `app-catalog` (no random or clock text; same input, same output) |

## Dependencies on Other Units

- u1: the generator package, used by the catalog script and its test as a development dependency; the workflow file exists from earlier Bolts and this unit adds its jobs.
- u2: `plugin-guardrails-backend` and `authModuleDemoSignIn`, loaded by `backendFeatures`.
- u3: `plugin-guardrails`, loaded by the app's frontend features.
- u5: the compose files, the image build, the real-browser checks and the end-to-end token step; it uses the variable names of `infrastructure-specification.md`.
