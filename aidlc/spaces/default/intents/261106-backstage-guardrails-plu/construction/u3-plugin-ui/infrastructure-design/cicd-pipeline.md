# CI/CD Pipeline — u3-plugin-ui

Sources: `team-practices.md` (pull requests, CI green before merge, Prettier and ESLint, 85% coverage, nothing deploys automatically, docker compose locally), `performance-design.md` and `security-design.md` and `logical-components.md` (NFR Design for this unit: controls P1–P9 and S1–S12, which the checks below prove), `components.md` (GuardrailsPluginUI) and `functional-spec.md` (workflows W1–W7 and the screen states, which set what the tests cover), `contract-summary.md` (C1 and C3) and answer Q1 in `infrastructure-design-questions.md`. This unit has no separate scalability-design, reliability-design or observability-design documents (not produced for a UI unit; their content is in `performance-design.md`, `logical-components.md` and the section states of `functional-spec.md`). The unit adds jobs to the shared GitHub Actions workflow, which it does not own, next to the `plugin-*` jobs of u2.

## Deployment Shape Used by the Pipeline

| Facet | Choice |
|---|---|
| Packaging | A package `plugin-guardrails` in `packages/plugin-guardrails` of the same workspace, loaded by the Backstage app that u4 builds; no separate service (NFR2.12) |
| Runtime resources | None: the code runs in the browser page of the app; calls go to the plugin backend and the auth backend through the app's discovery service |
| Tests | A simulated browser (jsdom) on the Node release the other jobs use; time zone and clock pinned by the test setup (NFR7.1); no real browser in this unit's jobs (u5 owns those) |
| Monitoring | None of its own (see `monitoring-design.md`) |

## Build and Test Stages

The workflow runs on every pull request and on every push to `main`. A failed job fails the pull request.

| Job | What it does | Gate |
|---|---|---|
| `ui-format-lint` | Prettier check and ESLint with Backstage settings, plus the rules that forbid raw-HTML insertion, `fetch` and storage outside `GuardrailsApi` and `DemoSession`, and port-like string literals (NFR6.1, S4, S10) | Any difference or error fails |
| `ui-typecheck` | TypeScript compile without output | Any error fails |
| `ui-unit` | All plugin tests with the time zone and clock pinned: pure parts, `DemoSession`, `GuardrailsApi`, section hook, screens, keyboard and `jest-axe` scans, the timing tests with fake timers (NFR1.2–1.6, NFR2.9, NFR5.1–5.10, NFR3.1–3.3) | Any failing test fails |
| `ui-coverage` | Coverage report over the plugin code from `ui-unit` | Line coverage below 85% fails (team practices) |
| `ui-contract` | Reads `c1-openapi.yaml` of u2 and fails when a stand-in handler's answers differ (NFR2.10). A second test runs u2's `authModuleDemoSignIn` handler (from `src/auth/demoSignIn.ts`, exported by `plugin-guardrails-backend`) and checks that the start-path answer carries the token at `backstageIdentity.token`, the shape the stand-in for `DemoSession` uses (security-design S1). C1 does not describe this response; the shape is owned by u2's code, and the sign-in module is delivered by u2 and registered by u4 | Any mismatch fails |
| `ui-build` | Builds the plugin package, uploads its `dist` as a workflow artifact, and builds the app package that includes it when u4 exists | Build failure fails |
| `ui-checks` | Runs after `ui-build` on the downloaded `dist`: no `http://`, `https://` or `localhost` outside the constants file (S10); gzip size at most 300 KB (NFR1.7); the package allow-list check (Q1: A, NFR5.12) | Any hit or overshoot or extra package fails |

Order: `ui-format-lint`, `ui-typecheck`, `ui-unit` and `ui-contract` start together; `ui-coverage` takes the coverage output that `ui-unit` runs with and uploads (it does not run the tests again); `ui-build` runs in parallel with `ui-unit`; `ui-checks` needs `ui-build`. No Docker-in-Docker and no service container are needed. The app-package build step in `ui-build` is added when u4 exists; until then the job builds the plugin only. Where jobs of the shared workflow already do the same work (`format`, `lint`, `typecheck`), Code Generation adds this package's paths to those jobs instead of keeping `ui-format-lint` and `ui-typecheck` as copies, as u2 did; the required rules stay as listed. Timing tests use fake timers, not wall-clock assertions, so shared runners do not make them flaky, and the test setup sets `TZ` explicitly (NFR7.1). The required status checks of the repository are the jobs of this table; they are set in the GitHub repository settings when the first pull request of this unit is opened, which is a manual step for the person who owns the repository.

### Package allow-list check (Q1: A)

A script (`packages/plugin-guardrails/scripts/check-packages`) reads `dependencies` and `devDependencies` of the plugin's own `package.json` and compares their names with `allowed-packages.txt` beside it (the packages of `tech-stack-decisions.md`; their own dependencies are not listed because the lock file resolves them). It needs no base branch, so it works the same on pull requests and on pushes to `main`, and a pull request of another unit that changes the shared lock file does not fail it. A package not listed fails the job with its name; adding one on purpose means editing the list in the same pull request, where a reviewer sees it.

## Deployment Strategy

None. Nothing deploys automatically and the package is neither published nor pushed anywhere. The sample runs with the compose command from u5.

## Rollback

Nothing runs in an environment, so nothing is rolled back there. A bad change is undone by reverting its pull request on `main`; the next run checks the revert.

## Environment Promotion

None: one environment, the developer laptop. If hosting is added later, the plugin needs no change: it holds no address and reads no setting (S10); hosting is the app's concern.

## Secrets in the Pipeline

None. The jobs push nothing and call no outside service. The plugin holds no secret; the demo token exists only at run time in memory (S1) and is never written in a test file (tests use a fixed fake string).

## Branching

Each Bolt is a short-lived branch merged through a pull request after review (team practices). The required checks are the jobs above.

## NFR to Infrastructure Mapping

| ID | Where it lands |
|---|---|
| NFR1.1 | Delegated to u5 (real 20-load timing on the compose sample); this unit's `ui-unit` proves the parts (loads in parallel, stale drop) |
| NFR1.2 | `ui-unit` test with 300 ms stand-in answers, four sections within 700 ms |
| NFR1.3 | `ui-unit` test on the card |
| NFR1.4 | `ui-unit` fake-timer tests for 5 s and 12 s |
| NFR1.5 | `ui-unit` test that "Working..." is present synchronously after press |
| NFR1.6 | `ui-unit` regression guard with the seeded set |
| NFR1.7 | `ui-checks` gzip size gate; lazy loading proved by a `ui-unit` test that the tab module loads on route open |
| NFR2.1 | Node release and TypeScript settings pinned in the workspace and the workflow |
| NFR2.2 | `ui-build` and the first Code Generation step that confirms the frontend system imports |
| NFR2.4 | `ui-unit` test with a stand-in discovery API; no address in code (`ui-checks`) |
| NFR2.6 | Code only (hook per section); tested in `ui-unit` |
| NFR2.3 | Package name and plugin id fixed in the package manifest; `ui-build` builds it |
| NFR2.5 | Code only (Backstage and Material UI components); tested in `ui-unit` |
| NFR2.7 | Code only (routes in the entity tab); tested in `ui-unit` |
| NFR2.8 | `ui-unit` runs the tests; `ui-coverage` fails below 85% line coverage |
| NFR2.9 | `ui-unit` uses React Testing Library, `msw`, `jest-axe` |
| NFR2.11 | Delegated to u5 (real-browser tool in the compose run); not in this unit's jobs |
| NFR3.1 | `ui-unit` runs `jest-axe` once per screen state of the scan list |
| NFR3.2 | `ui-unit` keyboard-only tests of the seven walkthroughs |
| NFR3.3 | `ui-unit` tests of accessible names, descriptions and live-region text against the catalog |
| NFR3.4 | Delegated to u5 (contrast, real focus, screen-reader pass in Chrome and Firefox); listed as open in this unit's test instructions |
| NFR4.1 | Delegated to u5 (Chrome and Firefox walkthroughs); this unit uses no vendor-specific code |
| NFR2.10 | `ui-contract` |
| NFR2.12 | `ui-build` |
| NFR5.1 | `ui-unit` test of the audit section controls |
| NFR5.2 | `ui-unit` storage test |
| NFR5.3 | `ui-unit` full-walkthrough token search |
| NFR5.4 | `ui-unit` recorded-request test |
| NFR5.5 | `ui-unit` hostile-text test and the raw-HTML lint rule in `ui-format-lint` |
| NFR5.6 | `ui-unit` encoded-address test |
| NFR5.7 | `ui-unit` reason-limit test |
| NFR5.8 | `ui-unit` per-reason no-request tests |
| NFR5.9 | `ui-unit` demo-off and list-membership tests |
| NFR5.10 | `ui-unit` error-code tests and console check |
| NFR5.11 | `ui-checks` address search; `ui-unit` start with empty settings |
| NFR5.12 | `ui-checks` allow-list script on the plugin's `package.json` (Q1: A) |
| NFR6.1 | `ui-format-lint` |
| NFR7.1 | Pinned time zone and clock in the `ui-unit` setup |

## Dependencies on Other Units

- u1/u2: the workflow file and the shared setup exist from earlier Bolts; this unit adds its jobs. u2 owns `c1-openapi.yaml`, which `ui-contract` reads, and the sign-in module whose start-path body shape is checked.
- u4-backstage-app loads the plugin with the new frontend system and adds `authModuleDemoSignIn`; `ui-build` of the app package starts once u4 exists.
- u5-compose-and-ci builds the real-browser checks (scan, Chrome and Firefox walkthroughs, 20-load timing) and reports the plugin's built size.
