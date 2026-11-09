# Code Summary — u4-backstage-app

Built in the main session, test-first (Testing Contract: TDD, 85% line floor), because the build could not be handed to the developer agent (see Deviations). All 21 plan steps are done.

## Results

| Check | Result |
|---|---|
| Frontend tests (`yarn workspace app test`) | 6 suites, 36 tests, all pass; line coverage 97.76% (floor 85%) |
| Backend tests except start-up (`yarn workspace backend test --testPathIgnorePatterns startup`) | 7 suites, 30 tests, all pass; line coverage 96.49% (floor 85%) |
| Start-up test (`yarn workspace backend test startup`) | 1 suite, 11 tests, all pass (includes the check that the start address refuses sign-in while the switch is off, added after the code review) |
| The recorded checkpoint command from the repository root (`yarn tsc && yarn lint && yarn prettier:check && yarn test --watchAll=false --coverage`) | Its first run failed because the start-up test assumed it ran from `packages/backend`; the test now finds its files from its own location, and the command passes (63 suites, 708 tests) |
| Catalog drift check (`catalog:check`) | 11 tests, pass |
| Settings check, both package allow-lists, failed-start exit check | pass |
| `yarn tsc` (root, plugin and app), ESLint in both packages, `yarn prettier:check` | clean |

About 76 tests in total. The coverage thresholds in each package's Jest settings are 85% lines and were never lowered. `features.ts` shows 0% in the run that skips the start-up test, because only that test loads it; with the start-up test it is covered, and both runs are above the floor.

## Files created or changed

- `packages/backend/`: `package.json`, `app-config.yaml`, `app-config.postgres.yaml`, `allowed-packages.txt`, `tsconfig*.json`, `.eslintrc.js`, `catalog/guardrails-catalog.yaml`, `scripts/` (`check-packages.mjs`, `check-exit.mjs`, `start-local.mjs`), and in `src/`: `features.ts`, `index.ts`, `catalog/` (builder, serializer, args, `writeCatalog`), `settings/checkShippedSettings.ts`, `startLocal/startEnv.ts`, `scripts/` (thin wrappers), `startup.test.ts`, `testing/` (recording logger, stand-in guardrails server, shipped-config loader, fixtures), `lintFixtures/`, and their tests.
- `packages/app/`: `package.json`, `allowed-packages.txt`, `tsconfig.json`, `.eslintrc.js`, `jestGlobalSetup.js`, `public/index.html`, and in `src/`: `index.tsx`, `App.tsx`, `features.ts`, `signInModule.tsx`, `signin/` (`signInState`, `signInClient`, `identityHolder`, `SignInPage`, `strings`), `setupTests.ts`, `lintFixtures/`, and their tests.
- Root: `README.md` (new, thorough), `.env.example` (new), `.gitignore` (one line: `.env`), `package.json` (scripts `tsc` and `start:local`), `tsconfig.json` (excludes `packages/app`, which has its own), `yarn.lock`, `.github/workflows/ci.yml` (jobs `app-unit`, `app-coverage`, `app-startup`, `app-catalog`, `app-checks`, `app-build`; app and backend added to the shared lint and type-check jobs).

## Red runs (before the code)

| Step | Failing command | Output |
|---|---|---|
| 3 catalog | `yarn workspace backend test src/catalog` | Suite failed to run: `Cannot find module './buildCatalog'`; 0 tests |
| 6 settings check | `yarn workspace backend test src/settings` | Suite failed to run (module not found); 0 tests |
| 9 sign-in logic | `yarn workspace app test src/signin` | 3 suites failed: `Cannot find module './signInState'`, `'./signInClient'`, `'./identityHolder'`; 0 tests |
| 12 start-up | `yarn workspace backend test startup` | `Cannot find module './features'`; 0 tests |
| 15 sign-in page | `yarn workspace app test SignInPage` | `Cannot find module './SignInPage'`; 0 tests |
| wiring (16) | `yarn workspace app test wiring` | `Cannot find module './features'`; 0 tests |
| 18 scripts | `yarn workspace backend test startLocal checkPackages` | `Cannot find module './startEnv'` and `scripts/check-packages.mjs` missing; 3 tests failed, 1 suite failed to run |
| 18 lint rules | ESLint on the fixtures | Exit 0 with no findings (the rules were not applied: the backstage factory overrides `no-restricted-syntax`); fixed by passing `restrictedSrcSyntax` (backend) and `rules` (app), then the fixtures fail as intended |
| content policy | `yarn workspace backend test settings` after the test was changed | 1 failed (policy still forbade `unsafe-eval` in scripts) |

## Key decisions

- **One state function for the sign-in page** (`reduceSignIn`): loading, choosing, demo off, list failed, starting, sign-in failed, signed in. An id outside the list and a second choice while starting change nothing.
- **A sign-in failed state of its own** (the functional spec returns straight to choosing with an error text; the page shows `signin.failed` above the still usable list, as the reliability design describes).
- **Plain browser `fetch` and an abort signal** for the user list and the start call (5 s each); addresses come from the discovery service. A request counter drops stale answers.
- **`IdentityHolder`** keeps the answer in a private copy and exposes only the four identity API methods. Sign-out forgets it; the framework reloads the page afterward.
- **One exported feature list on each side**; the start-up test builds from the backend list.
- **Catalog**: `buildCatalog` (pure, sorted), serializer, and a script that asks the u1 generator CLI for a seed. The committed file equals its output for seed 20261106.
- **`checkShippedSettings`** is the one settings check, used by the settings test and by `check:settings` in CI.
- **A home redirect** page (`/` to `/catalog`) in the app module: without it a signed-in person lands on Backstage's "page not found". Found in a real browser run.
- **`start:local`**: loads `.env`, shell wins over the file, `--demo` sets the switch for that run, starts both packages.

## D8 and D9 (settled by running the app)

- **D8: `auth.providers.demo` is needed.** With the entry (`demo: {}`), `GET /api/auth/demo/start?userId=sam` answers 200 with a token; without it the same call answers 404 even with the switch on. It is in the shipped `app-config.yaml`, and the start-up test checks the start address against the real auth backend (200 with identity and token for a demo user, 401 for an unknown id).
- **D9 confirmed**: the answer is `{profile, providerInfo, backstageIdentity:{token, identity}}`; the page turns it into an identity object whose only holder is `IdentityHolder`.
- A string `true`/`false` from `${GUARDRAILS_DEMO_SIGN_IN:-false}` is read correctly as a boolean by the config reader and passes schema validation.

## Exit code of a failed start (NFR7.2)

Running the real entry point (`src/index.ts` through the CLI's source loader) with `GUARDRAILS_SERVER_URL` unset prints the plugin's message naming `guardrails.server.url` and exits with code **1**. `yarn workspace backend check:exit` asserts both and runs in the `app-build` job.

## Real-browser check (manual, once)

The backend was started for real with the demo switch on and the built frontend served from it, and opened in Chrome: the sign-in page showed the three users with their roles; choosing Priya signed in and showed the catalog with six components; a service page showed the Guardrails card and tab. Two defects found there and fixed: the role text was invisible because it took a theme colour (now inherited), and a home redirect was missing. A third finding is the content policy below. This was not an automated test; the real-browser tests are u5's.

## Deviations from the plan and the design (for your attention)

1. **Content policy allows `unsafe-eval` for scripts.** Security design S9 and the settings check said "no `unsafe-eval`". With `script-src 'self'` alone, Backstage's entity page failed with `EvalError: Evaluating a string as JavaScript violates the Content Security Policy` (seen in the browser run). Backstage's own default policy allows it. The shipped `script-src` is `'self' 'unsafe-eval'`; `unsafe-eval` is still refused in every other directive, and wildcards are still refused. Your answer to the headers question (A: defaults plus an explicit policy) allowed this; the written design did not. Recorded in `README.md` under known limits.
2. **Built by me in this session, not by the developer agent**, at your request, because the call that hands the build to the agent could not be checked by auto mode (a hook changed its input).
3. **`msw` is not used.** The browser tests inject a fake `fetch`, which is simpler; the package was removed from the app's dependencies and allow-list.
4. **`@backstage/backend-plugin-api` is a development dependency of the backend** (the start-up test's recording logger service), and is on its allow-list with a comment. The tech stack list did not name it.
5. **`yaml` is a runtime dependency** of the backend (the catalog serializer and settings check are in `src`), not a development one.
6. **`check:exit` runs the source entry point with the CLI's loader, not a built backend.** Backstage's backend build produces a tarball for an image (u5), not a runnable `dist`. The CI job name and purpose are as designed.
7. **Settings live in `packages/backend/`** (not the repository root) and the backend must be run from that folder (`yarn workspace backend start` does this); the catalog file location in the settings is relative to it. Documented in the README.
8. **Coverage patterns are relative to `src`** in the Jest settings (the Backstage runner's root), listed as written in `package.json` of each package; the exclusions are `index`, the bootstrap file, `src/scripts/` wrappers, `testing/` and `lintFixtures/`.
9. **Two small process slips:** one file edit was made with a one-off script instead of the editor, and one shell test wrote an empty output file to the system temp folder. Neither affects the code.

## Hand-offs to u5 (checks this unit could not make)

- **CORS and content-policy headers in a test:** Backstage's test backend sends neither (observed: no `Access-Control-*` or `Content-Security-Policy` header at all). The start-up test therefore only proves that another site's origin is never allowed. In the real run the backend did send `Access-Control-Allow-Origin: http://localhost:3000` for the app's origin and the full `Content-Security-Policy`; u5's compose run should assert both.
- **The end-to-end token step:** a token issued by the real auth backend, verified by the guardrails plugin on a real call (the test backend replaces authentication with a mock). The real run showed the start address issuing a token; the plugin call with it needs the compose sample.
- 20-load timing of the views (NFR1.3), colour contrast, a screen-reader pass and the Chrome and Firefox flows (NFR3.4, NFR4.1).
- PostgreSQL: `app-config.postgres.yaml` is checked for its five substitutions only; its live use is proved by the compose run. The two base URLs must be equal in compose.

## Tests written but not executed

- The PostgreSQL settings file against a real PostgreSQL (needs compose).
- The CI workflow itself (needs GitHub Actions); its YAML was parsed and its commands were run locally one by one.
- `start:local` as a whole (it starts two long-running processes); its environment logic is unit tested and the pieces it starts were run on their own.
