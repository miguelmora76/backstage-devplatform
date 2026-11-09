# Code Generation Plan — u4-backstage-app

## Summary

- Builds: the host Backstage app (frontend and backend packages) with the demo sign-in page, the committed ten-entry catalog and its generator script, the shipped settings, the readiness route, the CI jobs and the root README
- Touches: `packages/app/`, `packages/backend/`, `.github/workflows/` (new `app-*` jobs), root `README.md`, `.gitignore` (one line for `.env`), root `package.json` (scripts only)
- Tests: about 55 tests in two packages, test-first (unit, a start-up integration test with the test backend, accessibility scans); line coverage at least 85% on the app's own code

## Sources

`functional-spec.md` (W1 to W5, D1 to D11, strings), `rules.md` (BR1.1 to BR5.3), `entities.md`, `contract-summary.md` (C3, C4), `performance-design.md` (P1 to P6), `security-design.md` (S1 to S9), `infrastructure-specification.md` (variables, run modes, database selection), `unit-of-work.md` (U4) and `requirements.md` (FR5.1, FR5.2, FR7.2, FR8.1, FR11.2, NFR1 to NFR7). Stories: US5.1 (AC5.1.1 to AC5.1.3) and US6.2 (AC6.2.1, AC6.2.2).

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "For each layer, write a failing test before writing the code that makes it pass.",
  "scope": "mvp",
  "test_strategy": "standard",
  "project_type": "greenfield",
  "applicable_notes": [
    {
      "layer": "org",
      "text": "We treat tests as a first-class deliverable in every Bolt. The specific\nmethodology (TDD, BDD, ATDD, or classic test-after) is affirmed at\npractices-discovery and recorded in `team.md` under this heading with explicit\n`Methodology` and `Ordering` fields; Code Generation resolves those fields\nindependently from coverage, tooling, and scope notes.\n\nWhen no posture has been affirmed, our default per scope is:\n- **Methodology**: test-after\n- **Ordering**: implement each applicable testable layer, then write and run\n  that layer's tests.\n- `mvp`, `enterprise`, `feature`, `infra`, `classic` add an 80% line-coverage\n  floor and CI execution before merge.\n- `bugfix`, `security-patch` add a targeted regression for the specific\n  bug/vulnerability and require the existing suite to remain green.\n- `express` uses the Minimal strategy: requirement-driven unit tests (one per\n  requirement, with a happy-path floor per component); existing tests remain\n  green.\n- `poc`, `refactor`, `workshop` add no extra new-test floor and require the\n  existing suite to remain green.\n\nThe active `Test Strategy` still applies in every scope and determines test\nvolume/types. Scope floors are additive; they never reduce or replace the\nselected strategy.\n\nBuild and Test verifies defined coverage floors and affirmed quality targets;\nthey may not be weakened to make a step pass.\n\nAffirm a stricter posture in `team.md` if the team commits to one."
    },
    {
      "layer": "team",
      "text": "- **Methodology**: tdd\n- **Ordering**: For each layer, write a failing test before writing the code that makes it pass.\n- **Methodology evidence**: The team chose test-first (test-driven) development in the interview (Q3: B); no existing code or history exists to suggest otherwise.\n- Coverage: at least 85% line coverage on the plugin code, and CI runs the tests before merge and must be green (Q4).\n- Build and Test may not weaken the coverage floor to pass."
    }
  ],
  "obligations": {
    "strategy": "standard",
    "strategy_volume": [
      "Five to eight tests per component.",
      "Unit tests plus integration tests for key boundaries.",
      "Add E2E, performance, or security tests when requirements demand them."
    ],
    "scope_floor": [
      "Meet an 80% line-coverage floor.",
      "Run the selected tests in CI before merge."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
    "runner_ready_before_first_test": true,
    "testable_layers": [
      "Data model / database behavior",
      "Repository / data access",
      "Business logic",
      "API / endpoint",
      "Frontend behavior"
    ],
    "steps": [
      "Project structure and production configuration skeleton.",
      "Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.",
      "Data model / database behavior - Red: write the failing tests and record the failing command output.",
      "Data model / database behavior - Green: implement only enough behavior to pass.",
      "Data model / database behavior - Refactor: improve the implementation while tests stay green.",
      "Repository / data access - Red: write the failing tests and record the failing command output.",
      "Repository / data access - Green: implement only enough behavior to pass.",
      "Repository / data access - Refactor: improve the implementation while tests stay green.",
      "Business logic - Red: write the failing tests and record the failing command output.",
      "Business logic - Green: implement only enough behavior to pass.",
      "Business logic - Refactor: improve the implementation while tests stay green.",
      "API / endpoint - Red: write the failing tests and record the failing command output.",
      "API / endpoint - Green: implement only enough behavior to pass.",
      "API / endpoint - Refactor: improve the implementation while tests stay green.",
      "Frontend behavior - Red: write the failing tests and record the failing command output.",
      "Frontend behavior - Green: implement only enough behavior to pass.",
      "Frontend behavior - Refactor: improve the implementation while tests stay green.",
      "Environment/build configuration.",
      "Documentation and traceability."
    ]
  },
  "input_sha256": "sha256:b4a8500ee06ca516328b6af1aaf731b1f118b83b754e86211c0928e7e4bd042e",
  "contract_sha256": "sha256:e296bbb8657fda2574bff860c37db41f575891b05caa066b632cf57f0a3659da"
}
```

## Layer Mapping

| Contract layer | In this unit |
|---|---|
| Data model / database behavior | Not applicable: u4 owns no entity or table (`entities.md`); the committed catalog file is covered under Business logic |
| Repository / data access | Not applicable: no repository; the plugin's own data access is u2's |
| Business logic | The catalog builder, the settings check, `signInState`, `signInClient`, `IdentityHolder` (pure or near-pure code, no business rule: BR1.2) |
| API / endpoint | `backendFeatures`, the backend entry point and the start-up test with Backstage's test backend |
| Frontend behavior | `SignInPage`, the app wiring and the accessibility and keyboard tests |

## Steps

Each step is ticked in this file as it finishes. Red steps record the failing command output in `code-summary.md`.

- [x] **Step 1: Project structure and production configuration skeleton.** Create `packages/backend/` and `packages/app/` (`package.json` with the dependencies of `tech-stack-decisions.md` only, `tsconfig`, source folders), `packages/backend/app-config.yaml` and `app-config.postgres.yaml` (substitutions only, demo switch default false, one CORS origin, content policy, `catalog.locations` to the committed file, `catalog.readonly`), `.env.example`, `allowed-packages.txt` in each package. Run `yarn install` once for the new packages (BR1.1, BR4.1 to BR4.5, NFR2.6 to NFR2.13).
- [x] **Step 2: Bootstrap the test runner and record the unit-scoped commands.** Jest settings through `backstage-cli package test` in each package: coverage collection limited to the app's own code, exclusions for `index.ts`, bootstrap entry files, declaration files, tests and declarative configuration, the 85% line threshold, a pinned time zone (NFR2.1, D11). Add one trivial passing test per package to prove the runner, then record the commands in `unit-test-instructions.md`.
- [x] **Step 3: Business logic (catalog) - Red.** Write failing tests for `buildCatalog(seed)`: ten entries (six Components named by the seed's `serviceName` values, three Users, one Group), owner and member links, stable order, identical output on two runs, and the committed file equals the output for the default seed (BR3.1 to BR3.5, NFR7.1, NFR2.4). Record the failing output.
- [x] **Step 4: Business logic (catalog) - Green.** Implement `buildCatalog`, the serializer and the `write-catalog` script (`--seed`, `--out`, default seed 20261106) using the u1 generator; write `packages/backend/catalog/guardrails-catalog.yaml`.
- [x] **Step 5: Business logic (catalog) - Refactor.** Tidy while green; confirm the script runs from the documented command and its output equals the committed file.
- [x] **Step 6: Business logic (settings check) - Red.** Write failing tests for `checkShippedSettings`: finds `demo` as the only `auth.providers` entry (once D8 is settled), the substitutions for `GUARDRAILS_SERVER_URL` and `GUARDRAILS_DEMO_SIGN_IN` with default false, no literal password, no foreign host name, one CORS origin without a wildcard, the content policy present without a wildcard or `unsafe-eval`, the PostgreSQL file with five required substitutions, `.env.example` core names present and no password; plus bad fixtures that each fail (NFR5.1, NFR5.2, NFR5.4, NFR5.6, NFR2.5, S9).
- [x] **Step 7: Business logic (settings check) - Green.** Implement `checkShippedSettings` and the `check-settings` script that runs it on the real files.
- [x] **Step 8: Business logic (settings check) - Refactor.** Tidy while green.
- [x] **Step 9: Business logic (sign-in) - Red.** Write failing tests in `packages/app`: `signInState` table test (every state with every event, never undefined; an id outside the list is ignored: NFR5.7, NFR7.5); `signInClient` with fake timers (user list and start call give up at 5 s, a 300 ms answer shows in time, a stale answer is dropped: NFR1.1); a second activation sends one request (NFR1.2); `IdentityHolder` keeps the identity and token with no getter and nothing in storage (NFR5.3). Record the failing output.
- [x] **Step 10: Business logic (sign-in) - Green.** Implement `signInState`, `signInClient` (abort controller, stale-answer counter) and `IdentityHolder`.
- [x] **Step 11: Business logic (sign-in) - Refactor.** Tidy while green.
- [x] **Step 12: API / endpoint - Red.** Write the failing start-up test in `packages/backend` with Backstage's test backend, in-memory SQLite, a stand-in guardrails server and a recording logger: readiness 200; user list 200 to a signed-out caller with the switch on, 401 signed out and 404 signed in with it off; a missing `GUARDRAILS_SERVER_URL` fails with the message naming `guardrails.server.url`; 401 for credentials of a service principal, an unknown user and no one; the server-down case (readiness 200, open routes work, server-dependent routes 503); the demo-on warning line only with the switch on; no token, password or reason text in the recorded log; plugin routes reached through the backend's own router (NFR2.3, NFR5.1, NFR5.2, NFR7.2 to NFR7.4, NFR1.4, NFR1.8, NFR1.9). Add the CORS check for another `Origin` and the policy header check; if the test backend does not apply them, record that and leave the check to u5. Record the failing output.
- [x] **Step 13: API / endpoint - Green.** Implement `backendFeatures` (catalog backend, auth backend, `plugin-guardrails-backend`, `authModuleDemoSignIn`, app backend), the entry point that builds from it and exits non-zero on a failed start, and whatever settings the test shows are missing. Run the app to settle D8 (whether `auth.providers.demo` is needed) and record the result.
- [x] **Step 14: API / endpoint - Refactor.** Tidy while green; run the real entry point once with `GUARDRAILS_SERVER_URL` unset and record its exit code.
- [x] **Step 15: Frontend behavior - Red.** Write failing tests for `SignInPage`: the loading, choosing, demo-off, load-failed, starting and sign-in-failed states show the strings of `functional-spec.md`; a `jest-axe` scan per state; keyboard-only use (Enter and Space on a choice, Tab to Retry); hostile names and roles shown as text; no free-text field; a full sign-in leaves no token in storage, console or rendered text (NFR3.1 to NFR3.3, NFR5.3, NFR5.5, NFR5.7, NFR7.5, NFR7.6). Record the failing output.
- [x] **Step 16: Frontend behavior - Green.** Implement `SignInPage`, the sign-in page extension and the app's feature list (catalog pages, sign-in page, `guardrailsPlugin`), with `data-testid` attributes on interactive elements.
- [x] **Step 17: Frontend behavior - Refactor.** Tidy while green; confirm sign-out returns to the sign-in page (BR2.5) and that the app registers no module-level mutable state.
- [x] **Step 18: Checks and scripts.** Write tests first, then code, for `check-packages` (allow-list comparison with a bad fixture) and the source scan for host names and ports; add ESLint rules (raw HTML, `console`, top-level mutable state) with a failing fixture each; add the `start:local` script (loads `.env`, `--demo` sets the switch for that run) (NFR5.4, NFR5.5, NFR5.8, NFR6.1, NFR1.5, NFR1.9, Q1).
- [x] **Step 19: Environment and build configuration.** Add the `app-*` jobs to `.github/workflows/` as described in `cicd-pipeline.md` (adding this unit's paths to the shared format, lint and type-check jobs instead of copies), including the built-entry-point exit-code step in `app-build`; add `.env` to `.gitignore`; add the root scripts for this unit.
- [x] **Step 20: Documentation.** Write the root `README.md` thoroughly: what the project is, the units and contracts, the demo users and the sign-in risk, every setting and variable, run modes, how to run and test, the CI jobs, the known limits and the hand-offs to u5; keep it in step with the commands (BR5.2, NFR2.14).
- [x] **Step 21: Traceability and summary.** Run the whole unit-scoped test set and the coverage command, write `code-summary.md` (files, decisions, Red outputs, D8 result, exit code, tests not run and why), `source-manifest.json` and `traceability.json`.

## Story-to-Step Traceability

| Story or requirement | Steps |
|---|---|
| US5.1 AC5.1.1 (sign in as a chosen demo user) | 9, 10, 12, 13, 15, 16 |
| US5.1 AC5.1.2 and AC5.1.3 (only demo users, no other way in) | 6, 7, 12, 13 |
| US6.2 AC6.2.1 (the app answers when up) | 12, 13, 19 |
| US6.2 AC6.2.2 (a seeded service's plan loads) | 3, 4, 5, 15, 16 (end-to-end part is u5's) |
| FR7.2, FR8.1 (catalog from the data, local only) | 1, 3, 4, 6, 7 |
| NFR1 to NFR7 (performance, security, reliability, observability, quality) | per step above; see `traceability.json` |
