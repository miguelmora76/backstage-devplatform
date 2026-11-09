# Code Summary — u3-plugin-ui

The unit is built as the approved plan describes: a new package `packages/plugin-guardrails` (the Guardrails frontend plugin on the new Backstage frontend system), its tests, and the `ui-*` jobs in the shared workflow. It was built in the main session test-first by the conductor, not by the developer agent: the dispatch of that agent could not be reviewed by the auto-mode check (the hook that adds the plan and rules made the call too long), and the person chose to build it inline.

## Files Created or Modified

| Where | What |
|---|---|
| `packages/plugin-guardrails/package.json`, `tsconfig*.json`, `.eslintrc.js`, `allowed-packages.txt`, `README.md` | Package, build and lint configuration; the package allow-list; the readme |
| `src/api/` | `GuardrailsApi` (the only code that makes calls: address builder, 5 s read and 12 s write limits, typed failures, one refresh and repeat of a read on 401), `DemoSession` (token in memory, only the userId in tab storage, setup order), `client.ts` (builds both from discovery and fetch), `failures.ts`, `types.ts` (from C1) |
| `src/texts/` | The string catalog with the Functional Design additions, reason and error mappings, `formatTime` (`YYYY-MM-DD HH:mm` in the viewer's zone) |
| `src/rules/derive.ts`, `src/hooks/useSection.ts` | Pure arrangement of backend answers; one load per section with a stale-answer drop |
| `src/components/` | GuardedButton, StatusLabel, ReasonField, PagedTable, SectionState, ServerErrorPanel, ResultBanner, RefusalAlert, header, demo-user switch, the four sections, filters, card, change summary, decision block, reason form |
| `src/screens/` | Guardrails view, change detail, routes, and the entity tab and card wrappers |
| `src/plugin.tsx`, `src/routes.ts`, `src/index.ts` | The plugin definition: plugin API, entity tab "Guardrails", overview card, lazy screen loaders |
| `src/testing/` | Stand-in backend (`msw` handlers with switches for every state), the contract check against `c1-openapi.yaml`, the sign-in shape check against u2's module, the test harness (not part of the build) |
| `src/e2e/` | Security, accessibility, keyboard and performance tests |
| `scripts/check-packages.mjs`, `scripts/check-built.mjs` | Package allow-list check; address and 300 KB gzip check on the built plugin |
| `.github/workflows/ci.yml` | Lint and type check extended to the new package; jobs `ui-unit`, `ui-coverage`, `ui-contract`, `ui-build`, `ui-checks` |
| `yarn.lock` | The packages of `allowed-packages.txt` and their dependencies |

## Key Implementation Decisions

- **Two seams.** `GuardrailsApi` and `DemoSession` are the only code that touches the network, the credential and storage. The screens get them from a small React context; the entity wrappers read them from Backstage's API registry. Lint rules forbid `fetch` and browser storage elsewhere.
- **The credential.** The token lives in a private field and is sent only as the `Authorization` header to the plugin backend. The start address returns the token at `backstageIdentity.token` (checked against u2's own sign-in module in a test). A stored userId that is not in the user list is dropped and no start call is made.
- **No rule in the UI.** Which actions appear follows the change status (D11); whether each is enabled follows the backend's allowed actions; an unavailable action stays focusable and sends nothing.
- **Dates.** One function formats every date-time as `YYYY-MM-DD HH:mm` in the viewer's time zone (answer Q1: A of NFR Design); the audit From and To dates become the start and end of that day.
- **Text, never markup.** Every backend or user string is rendered as a text node; a lint rule and a source test forbid raw-HTML insertion.
- **Paging.** The plan and CI lists are paged in the browser; the audit asks for `pageSize=10`. The audit keeps its table while a page loads, so focus stays on Previous and Next (BR4.4).

## Test Coverage Summary

- 317 tests in 19 files, all passing: API (31) and session (14), stand-in contract (33) and the sign-in shape check (1), texts (32), formatting (7), rules (15) and the section hook (10), plugin (6) and routes (4), shared components (39), card (8), Guardrails view (32), change detail (38, with its accessibility scans), entity wrappers (3), and the cross-cutting tests: security (8), accessibility scan of 16 states of the card and view (16), keyboard (9: seven walkthroughs and two catalog-text checks), performance (7).
- Line coverage over the plugin code: 97.9% (statements 97.2%, branches 93.3%, functions 96.5%); the threshold of 85% is in the package settings and was not changed.
- Prettier and ESLint (with the plugin's own restriction rules, `yarn workspace plugin-guardrails lint`, including the check scripts) are clean for the package; the type check passes for the three packages; the build produces 41 files, 33 KB compressed, with no address in the code; `check:packages` passes. The tests of u1 and u2 still pass.

## Tests Written but Not Executed in This Stage

- The real-browser checks listed in `unit-test-instructions.md` (colour contrast, real focus behavior, a screen-reader pass, Chrome and Firefox walkthroughs, the 20-load timing of AC1.1.3, AC1.2.3 and AC4.1.5, the layout at 1280 px and 400% zoom) are u5's and are marked `Deferred` in `traceability.json`.
- The `ui-*` jobs of the workflow have not run on GitHub yet; each command they use was run locally. The repository's required status checks are set in GitHub settings when the first pull request is opened, by the repository owner.

## Deviations From the Plan

1. **Built inline, not by the developer agent** (see the opening paragraph). The plan, tests-first order and all gates were followed.
2. **Entity blueprints are in the `alpha` entry point.** `EntityContentBlueprint` and `EntityCardBlueprint` come from `@backstage/plugin-catalog-react/alpha` (catalog-react 3.3.0, frontend-plugin-api 0.18.2); this was the NFR2.2 risk and is recorded here as the plan asked.
3. **Audit action label.** C1's audit entry carries `action: propose` without the kind of change, so the Action column and filter show "Propose". The mockup wording was changed to match (`mockups.md`, `interaction-spec.md`, decision D13); the change title in the open list still tells an upgrade from a re-run.
4. **Extra packages.** `react`, `react-dom`, `react-router`, `react-router-dom`, `@types/react`, `@types/react-dom`, `@testing-library/dom`, `@testing-library/jest-dom` and `@types/jest-axe` are in `allowed-packages.txt` beyond the plan's list: the first four are what the app provides to the plugin (peer dependencies), the rest are needed by the test tools. `@backstage/core-plugin-api` and `@backstage/core-components` were in the plan but are not used (the plugin takes `useApi`, the API refs and the route ref from `@backstage/frontend-plugin-api`; status icons and layout are Material UI and small inline parts), so they were removed from the manifest and the allow-list after the first code review.
5. **`routes.test.tsx` tests the routes through `GuardrailsRoutes`** (the tab's inner routes), because the entity-page extension itself is mounted by the app (u4).
6. **React 18.3 and router 6.30** are pinned (the versions Backstage and Material UI 4 support); the first install pulled in React 19 and router 7 and was corrected.
7. **Test setup filter.** `src/setupTests.ts` hides one React 18 warning that Material UI 4 triggers on every render (`findDOMNode`); every other console message still reaches the tests.
8. **Render guard (NFR1.6) measured with React's own timing.** The guard for 200 open changes uses the render time React reports for each commit (it must stay under 1 second) instead of wall-clock time from the network answer; the wall-clock version failed once when the machine was busy. The limit is unchanged.
9. **Shared sign-in refresh.** Several calls that meet a 401 together share one sign-in call (found in the first code review; test added first).
10. **Root type check and test run (found at the Unit checkpoint).** The repository's recorded verification command (`yarn tsc && yarn lint && yarn prettier:check && yarn test --watchAll=false --coverage`) type-checks with settings that cannot compile this package (Node16 modules, no JSX). The root `tsconfig.json` now excludes `packages/plugin-guardrails`, and the root `tsc` script also runs `tsc -p packages/plugin-guardrails`; two shared files outside the package therefore changed (`package.json`, `tsconfig.json`, one line each). Also, a time zone set inside a Jest setup file does not reach the real process, so the date tests failed from the repository root; the zone is now pinned in `jestGlobalSetup.js`, which runs before any worker starts, for every way of running the tests. The whole command passes: 627 tests across the three packages.
11. **Detail-screen reload.** After a refused or unreachable write the change is read again; with `keepPrevious` the form stays on screen but its actions are unavailable until the read ends.

## Fixes After the Unit Approval

The known issues listed in the first version of this summary were fixed in code, test first, after the person asked for no known issues: a 404 on a proposal now says "This can no longer be proposed"; a 401 with no switch now says "Your session ended. Sign in again."; the interrupted-change text now says the change has been reloaded; the overview card shows a dash, not "Loading...", beside an error; and the audit label question was settled as above. The design documents were updated to match and carry no open points.

## Open Items Carried to Later Stages

- The 300 KB gate and the address scan run on the plugin's own compiled output (`tsc`), not on a bundle; they are provisional until u4 builds the app. When the app package exists, its build step is added to `ui-build` and the same two checks run on what the app ships.
- u4: load `guardrailsPlugin` in the app with the new frontend system, add `authModuleDemoSignIn`, make catalog entity names equal the seeded service names, and keep the demo sign-in off by default.
- u5: the real-browser checks above; the layout check at 1280 px and 400% zoom (BR7.5); whether the nested `<main>` of the tab causes a duplicate-landmark finding inside the app's own page layout.
- Minor findings of earlier design reviews that were not fixed (Functional Design R-03 to R-09 and NFR Requirements R-03 to R-09) are listed for the Unit approval.
