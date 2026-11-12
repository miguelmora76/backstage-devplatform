# Code Generation Plan: UI Redesign (Fix and Polish)

## Summary

- Builds: one consistent dark-by-default look across the host app and the Guardrails plugin, with the Backstage stylesheet loaded and no clipped layouts.
- Touches: `packages/app` (entry, sign-in page, theme, package files), `packages/plugin-guardrails` (status colours, grid layout), `packages/e2e` (accessibility and layout specs), `README.md`.
- Tests: about 14 new or changed tests, written first (one per requirement plus a happy-path test per changed component), in jsdom unit tests and the existing real-browser specs.

## Sources

- `requirements.md` (FR1 to FR5, NFR1 to NFR5), `requirements-analysis-questions.md` (Q1 = B, Q2 = A, Q3 = A, Q4 = A).
- Code knowledge base `aidlc/spaces/default/codekb/backstage-devplatform/` (stylesheet never loaded; no theme extension; fixed plugin colours; three-feature test).
- Browser observation of the running app on 2026-11-12.
- Team practice: tests first, 85% line coverage, Prettier and ESLint in CI, own branch and PR (`u8-ui-redesign`).

## Approach

Backstage's newer page shell (header, navigation, tabs) is built from `@backstage/ui` components whose styles live in `@backstage/ui/css/styles.css`; the app never imports it. Fix that first, then make the theme dark by default with the switch kept, then correct what a dark background breaks in the plugin and fix the layout. Nothing changes in behaviour, text, test hooks, the backend or the server.

Decision made while planning (small detail): the default-dark choice is made inside the existing sign-in module or the app entry, not as a fourth app feature, so `wiring.test.tsx` and its "exactly three features" rule stay as they are (FR4.3). If that turns out to be impossible, the build stops and asks you before changing that test. (Superseded by Revision 1: the person asked for a visible light/dark switch, which is a fourth feature, so `wiring.test.tsx` is changed on purpose in Step 24.)

## Plan Steps

Layers that do not apply to this work are marked N/A: data model, repository, business logic and API/endpoint (no backend or data change).

- [x] **Step 1. Production configuration skeleton (FR1.1, FR1.3).** Add `@backstage/ui` (version matching the one already installed, 0.19.0) to `packages/app/package.json`, to `packages/app/allowed-packages.txt` and to `yarn.lock`; import `@backstage/ui/css/styles.css` in `packages/app/src/index.tsx`.
- [x] **Step 2. Verify the test runners and record the commands (NFR2).** Confirm that `yarn workspace app test --watchAll=false`, `yarn workspace plugin-guardrails test --watchAll=false` and `yarn workspace e2e test --watchAll=false` run, and record them in `unit-test-instructions.md`.
- [x] **Step 3. Data model / database behavior:** N/A (no data change).
- [x] **Step 4. Repository / data access:** N/A.
- [x] **Step 5. Business logic:** N/A.
- [x] **Step 6. API / endpoint:** N/A.
- [x] **Step 7. Frontend, theme: Red (FR2.1, FR2.2, FR4.3).** Write failing tests: a first visit with no stored choice gets the dark theme; the light/dark choice is still offered; the app still has exactly three features.
- [x] **Step 8. Frontend, theme: Green.** Make dark the default theme while keeping Backstage's theme choice; no new app feature, no browser storage written by our code.
- [x] **Step 9. Frontend, theme: Refactor.** Tidy while green.
- [x] **Step 10. Frontend, sign-in layout: Red (FR3.2, FR4.1, FR4.2).** Write failing tests: the three users sit in one limited-width centred container with each name and role next to its "Sign in as <Name>" button; texts and `data-testid`s are unchanged.
- [x] **Step 11. Frontend, sign-in layout: Green.** Style `SignInPage` with MUI v4 theme-based styling (no literal colours, no raw HTML).
- [x] **Step 12. Frontend, sign-in layout: Refactor.**
- [x] **Step 13. Frontend, plugin colours: Red (FR2.3, FR2.2).** Write failing tests: `StatusLabel` and `ShieldMark` take their colours from the theme in the dark and the light theme, and every status still shows its text.
- [x] **Step 14. Frontend, plugin colours: Green.** Replace the fixed colours (#8a5a00, #1b6e2d, #9b1c1c, #1f3a93) with theme-based values.
- [x] **Step 15. Frontend, plugin colours: Refactor.**
- [x] **Step 16. Frontend, layout: Red (FR3.1, FR1.2).** Write failing tests: the plugin's section grid has no fixed minimum that forces overflow (`minmax(420px, 1fr)` becomes a width that shrinks), and a real-browser spec checks that none of the six views has a horizontal page scroll at 1024, 1308 and 1440 pixels.
- [x] **Step 17. Frontend, layout: Green.** Fix the grid and any wide table so the content fits.
- [x] **Step 18. Frontend, layout: Refactor.**
- [x] **Step 19. Frontend, accessibility: Red (NFR1).** Extend the real-browser accessibility spec and the jsdom accessibility tests to run the six views in the dark and in the light theme; they fail wherever the new styles break contrast.
- [x] **Step 20. Frontend, accessibility: Green.** Fix any violation found (contrast, focus, names) without changing text or test hooks.
- [x] **Step 21. Frontend, accessibility: Refactor.**
- [x] **Step 22. Environment and build configuration (NFR3, NFR4).** Rebuild the compose stack; check the content policy still serves the stylesheet with no new allowance (a settings test confirms `backend.csp` is unchanged except where this work needs it, which must be none); run the existing timing step.
- [x] **Step 23. Documentation and traceability (FR5.1).** Add a short "Look and theme" section to `README.md` (the stylesheet, the dark default, the switch, where the plugin colours come from, and how to check Safari by hand); write `code-summary.md` and `traceability.json`; hand the Safari check to you.

### Revision 1 (requested by the person at the Code Generation gate, 2026-11-12)

The person asked for four changes: a visible light/dark switch, the catalog table width, the stale README line, and a re-run of the other browser specs. Choosing the switch is the person's agreement to a fourth app feature, which changes the "exactly three features" rule (FR4.3) and its wording in `wiring.test.tsx`.

- [x] **Step 24. Frontend, visible theme switch: Red (FR2.2, FR4.3).** Write failing tests: a settings page offers a light/dark choice a person can use with the mouse and the keyboard; `wiring.test.tsx` is updated first to expect exactly four features (catalog, sign-in, guardrails, user settings) and its BR1.1 wording is updated to match, which fails until the feature is added; a first visit still gets dark.
- [x] **Step 25. Frontend, visible theme switch: Green.** Add the Backstage user-settings plugin as the fourth feature (`@backstage/plugin-user-settings`, a version compatible with the installed Backstage packages, added to `packages/app/package.json` and `allowed-packages.txt`), with its page and a sidebar link reachable by a signed-in demo user; no browser storage is written by our own code.
- [x] **Step 26. Frontend, visible theme switch: Refactor.**
- [x] **Step 27. Frontend, catalog table width: Red (FR3.1, FR1.2).** Write failing tests (and extend the real-browser layout spec): at 1308 pixels the catalog list shows its name column without breaking names mid-word and without an inner horizontal scrollbar.
- [x] **Step 28. Frontend, catalog table width: Green.** Fix it within the app (column widths and layout) without changing texts or test hooks.
- [x] **Step 29. Frontend, catalog table width: Refactor.**
- [x] **Step 30. Documentation (FR2.2).** Replace the stale "little styling of its own" line in README "Known limits", and describe the visible switch in "Look and theme".
- [x] **Step 31. Real-browser checks (NFR1, NFR5).** Re-run the existing `flows`, `keyboard` and `tree` specs and `yarn e2e checks`, plus the layout and accessibility specs (both themes, now including the settings page), in Chromium and Firefox on a rebuilt compose stack; record the results in `code-summary.md` without claiming a pass that was not run.

## Test Files

- `packages/app/src/theme/defaultTheme.test.tsx` (new, Step 7): default dark, switch kept.
- `packages/app/src/signin/SignInPage.test.tsx` (changed, Step 10): layout container, unchanged texts and hooks.
- `packages/app/src/wiring.test.tsx` (unchanged, kept green, FR4.3).
- `packages/plugin-guardrails/src/components/StatusLabel.test.tsx` and `ShieldMark.test.tsx` (new, Step 13).
- `packages/plugin-guardrails/src/screens/layout.test.tsx` (new, Step 16): grid has no forcing minimum.
- `packages/e2e/specs/layout.spec.ts` (new, Step 16): no horizontal scroll at three widths on six views.
- `packages/e2e/specs/a11y.spec.ts` and the jsdom accessibility tests (changed, Step 19): both themes.
- Revision 1: `packages/app/src/wiring.test.tsx` (changed on purpose, Step 24: four features); `packages/app/src/theme/themeSwitch.test.tsx` (new, Step 24); a catalog-list layout test and an extended `packages/e2e/specs/layout.spec.ts` (Step 27).
- Test configuration: the existing Jest configuration of each package; no new runner.

## Traceability

| Requirement | Plan steps |
|---|---|
| FR1.1, FR1.3 | 1 |
| FR1.2 | 11, 16, 17 |
| FR2.1, FR2.2 | 7, 8 |
| FR2.3 | 13, 14 |
| FR2.4 | 1, 8 (Backstage's palette, no custom colour) |
| FR3.1 | 16, 17 |
| FR3.2 | 10, 11 |
| FR4.1, FR4.2 | 10, 11 (unchanged texts and hooks asserted) |
| FR4.3 | 7, 8 |
| FR5.1 | 23 (by hand, by you) |
| NFR1 | 19, 20 |
| NFR2 | 2, every Red step |
| NFR3 | 22 |
| NFR4 | 22 |
| NFR5 | 19, 23 |

## Not Changed

The backend, the guardrails server, the backend plugin, k8s manifests, the CI workflow (no new job), `wiring.test.tsx` (kept as it is), the content policy, and the demo sign-in behaviour.

## Testing Contract

```json
{
  "version": 1,
  "methodology": "tdd",
  "source": "team",
  "ordering": "For each layer, write a failing test before writing the code that makes it pass.",
  "scope": "express",
  "test_strategy": "minimal",
  "project_type": "brownfield",
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
    "strategy": "minimal",
    "strategy_volume": [
      "One verifiable test per requirement at the narrowest effective level.",
      "At least one happy-path unit test per component.",
      "Unit tests are the default; a bugfix/security scope floor may require an integration or E2E regression when that is the narrowest level that reproduces the defect."
    ],
    "scope_floor": [
      "Keep the existing test suite green.",
      "This scope adds no extra new-test floor beyond the selected test strategy."
    ],
    "combination_rule": "Apply every selected-strategy obligation and every scope-floor obligation; neither replaces the other, and a targeted scope regression may add the narrowest necessary test type beyond the strategy default."
  },
  "plan_profile": {
    "methodology": "tdd",
    "runner_step": "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
      "Verify the existing test runner/configuration and record the exact unit-scoped command.",
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
  "input_sha256": "sha256:2887aa622445523ecbc34915e76bc0eb60b1bcd80e0ca1d920166179163d42cd",
  "contract_sha256": "sha256:1462b4c5b2aa850281c518075325f7ff1c89682242c2acd4bb6ce6f103013d55"
}
```
