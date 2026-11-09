# Code Generation Plan — u3-plugin-ui

## Summary

- Builds: the guardrails plugin screens: an overview card, the Guardrails tab (upgrade plan, CI triage, open changes, audit log with filters and paging), the change detail screen with approve, reject and retry, and the demo-user switch
- Touches: a new package `packages/plugin-guardrails/` (source, tests, stand-in backend, README), the shared GitHub Actions workflow and `.eslintrc`-style lint rules for the package
- Tests: about 150 tests in the Standard strategy (5 to 8 per component across about 25 parts, plus an accessibility scan per screen state, keyboard-only walkthroughs and contract and timing tests), written before their code; 85% line coverage enforced

Sources: `functional-spec.md`, `rules.md`, `frontend-components.md`, `performance-design.md`, `security-design.md`, `logical-components.md`, `tech-stack-decisions.md`, `security-requirements.md`, `performance-requirements.md`, `cicd-pipeline.md`, `contract-summary.md` and `unit-of-work.md` for u3-plugin-ui, and the refined mockups and string catalog for texts. Stories implemented, in order: US1.1, US1.2, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US5.1 and US5.2.

## Decisions for This Plan

- **Package:** `packages/plugin-guardrails` (name `plugin-guardrails`, plugin id `guardrails`, role `frontend-plugin`), inside the existing workspace (`packages/*`), on the new Backstage frontend system (NFR2.2).
- **First step confirms imports:** Step 1 checks the exact entity-page extension imports of the pinned Backstage versions before anything depends on them (the NFR2.2 risk). If a needed helper exists only in an alpha entry point, the plan uses it and records it in `code-summary.md`.
- **Layers mapped to the contract:** the Testing Contract names five layers. For this unit they are: *Data model* (not applicable, the unit owns no entities); *Repository / data access* = `GuardrailsApi` and `DemoSession`; *Business logic* = `Texts`, `formatTime`, the section hook and the pure mapping rules; *API / endpoint* = the plugin definition, extensions and routes (what the app sees); *Frontend behavior* = components and screens. Each applicable layer has its Red, Green and Refactor steps.
- **Stand-in backend:** a set of `msw` handlers (`src/testing/standIn/`) with switches for every state of the scan list, checked against `packages/plugin-guardrails-backend/contract/c1-openapi.yaml` by a contract test (NFR2.10).
- **Accessibility scan and keyboard tests** run in the simulated browser; the real-browser checks (contrast, Chrome and Firefox walkthroughs, 20-load timing) are u5's and are listed as open in the test instructions.
- **No wiring into the app:** loading the plugin in the Backstage app, `authModuleDemoSignIn` and the compose settings belong to u4 and u5. This plan builds and tests the package alone, and `ui-build` builds the app package once u4 exists.
- **Shared files touched:** the GitHub Actions workflow (the `ui-*` jobs of `cicd-pipeline.md`; the shared format, lint and type steps get the new package's paths). Nothing else outside the new package.
- **data-testid:** interactive elements get `data-testid` attributes (stage rule), named from the component and the row (`propose-lib-a`, `approve`, `reason`).

## Steps

- [x] **Step 1: Project structure and production configuration skeleton.** Create `packages/plugin-guardrails/` with `package.json` (runtime: `@backstage/frontend-plugin-api`, `@backstage/plugin-catalog-react`, `@backstage/core-components`, `@backstage/core-plugin-api`, `@material-ui/core`, `@material-ui/lab`; dev: `@testing-library/react`, `@testing-library/user-event`, `@backstage/test-utils`, `msw`, `jest-axe`, `yaml`), `tsconfig.json`, `src/index.ts`, the empty plugin shell `src/plugin.ts` and `allowed-packages.txt`. Confirm the entity-page extension imports against the installed versions and record any alpha entry point. Stories: all. NFR2.1–NFR2.3, NFR5.12.
- [x] **Step 2: Bootstrap the minimal test runner/configuration and record the exact unit-scoped command.** Jest settings through Backstage's CLI in `package.json` (jsdom, coverage from `src`, 85% line threshold, pinned `TZ` and fake clock in `src/setupTests.ts`, `jest-axe` matchers), one smoke test `src/plugin.test.ts`, and the command in `unit-test-instructions.md`. NFR2.8, NFR2.9, NFR7.1.
- [x] **Step 3: Data model / database behavior.** Not applicable: this unit owns no entities and no storage beyond the userId in tab storage (covered in Step 6).
- [x] **Step 4: Repository / data access (GuardrailsApi and DemoSession) - Red.** Failing tests: `src/api/guardrailsApi.test.ts` (one method per C1 call; address builder encodes service and change ids containing `/`, `?`, `#` and spaces; query strings from `URLSearchParams`; the `Authorization` header only on calls to the plugin backend's base address; no actor, role or user id in any body or query except the audit actor filter; 5 second read and 12 second write limits with fake timers mapped to `no-answer`; every C1 error code mapped to a typed failure; response bodies and status text discarded; stale answers dropped), `src/api/demoSession.test.ts` (setup order: stored id, user list, token only if the id is a member; token at `backstageIdentity.token`; token never in storage, address, console or rendered text; only the userId stored; storage failure tolerated; one refresh and one repeat of a read on 401 with a demo user chosen, none without; failed start path keeps the previous user), `src/testing/standIn/contract.test.ts` (every stand-in answer matches `c1-openapi.yaml`). Rules BR5.1–BR5.4, BR6.1, BR3.8; NFR1.4, NFR2.4, NFR2.10, NFR5.2–NFR5.4, NFR5.6, NFR5.9–NFR5.11.
- [x] **Step 5: Repository / data access - Green.** Write `src/api/guardrailsApi.ts`, `src/api/failures.ts`, `src/api/demoSession.ts`, `src/api/types.ts` (types written from the C1 file) and the stand-in `src/testing/standIn/handlers.ts`. Calls use Backstage's discovery and fetch APIs; no address or secret in code.
- [x] **Step 6: Repository / data access - Refactor.** Single place for the header and the timeout wrapper; keep tests green.
- [x] **Step 7: Business logic (Texts, formatTime, section hook, mapping rules) - Red.** Failing tests: `src/texts/texts.test.ts` (every catalog key present, a missing key fails; reason-to-text and error-to-text mappings of `functional-spec.md`; unknown reason becomes `error.generic`), `src/texts/formatTime.test.ts` (`YYYY-MM-DD HH:mm` in the viewer's zone, pinned zone and clock, no relative times, From and To become start and end of day), `src/hooks/useSection.test.ts` (Loading, Loaded, Empty, ServerError, LoadFailed; reload and Retry; a stale answer is dropped; unmount aborts; four sections together finish within 700 ms with 300 ms answers), `src/rules/derive.test.ts` (card counts from the three lists; open list sorted failed first then pending, newest first; paging of the plan and CI lists 10 per page; "Page N of M" from the audit total; which actions show by status per D11). Rules BR1.2, BR1.4, BR3.1, BR3.5, BR4.4, BR6.1–BR6.3, BR7.4, D3, D4, D6, D10, D11; NFR1.2, NFR1.3, NFR7.1.
- [x] **Step 8: Business logic - Green.** Write `src/texts/texts.ts` (the catalog with the additions), `src/texts/formatTime.ts`, `src/hooks/useSection.ts` and `src/rules/derive.ts`.
- [x] **Step 9: Business logic - Refactor.** Share the section-state type across hook and views; keep tests green.
- [x] **Step 10: API / endpoint (plugin definition, extensions, routes) - Red.** Failing tests: `src/plugin.test.ts` (plugin id `guardrails`; the entity tab "Guardrails" with routes `/` and `/changes/:changeId`; the overview card extension; the screens load when their route opens, not at app start), `src/routes.test.ts` (routes render the view and the detail inside a test app; an unknown change id shows not found). Stories US1.1, US3.1; NFR1.7, NFR2.2, NFR2.7.
- [x] **Step 11: API / endpoint - Green.** Write `src/plugin.ts`, `src/routes.ts`, the lazy tab and card extensions and the plugin's own API extension (`GuardrailsApi` and `DemoSession` with discovery and fetch).
- [x] **Step 12: API / endpoint - Refactor.** Keep the extension file thin; keep tests green.
- [x] **Step 13: Frontend behavior (shared parts) - Red.** Failing tests for `GuardedButton` (stays focusable and marked unavailable when not allowed, reason linked, a press sends nothing when not allowed, "Working..." in the same render, second press ignored even in one frame), `StatusLabel`, `ReasonField` (500 limit, visible count, announcements at 100, 50, 20 and 0, linked error), `PagedTable` (caption, header cells, 10 rows, Previous, Next, "Page N of M", focus stays on the controls), `SectionState` (busy marking, polite loading text, empty text, `error.loadFailed` with Retry), `ServerErrorPanel`, `ResultBanner` and `RefusalAlert` (status or alert region, takes focus, close button `label.dismiss`). Rules BR2.2, BR3.2, BR3.5, BR3.6, BR7.1–BR7.3; NFR1.5, NFR3.1–NFR3.3, NFR5.5, NFR5.7, NFR5.8.
- [x] **Step 14: Frontend behavior (shared parts) - Green.** Write the shared components under `src/components/` with `data-testid` attributes.
- [x] **Step 15: Frontend behavior (shared parts) - Refactor.** Remove duplicated markup; keep tests green.
- [x] **Step 16: Frontend behavior (Guardrails view and card) - Red.** Failing tests: `GuardrailsOverviewCard` (three counts, empty text when all are 0, partial failure states, link to the tab), `GuardrailsHeader` and `DemoUserSwitch` (name and role from `me`, menu by keyboard with arrows, Enter and Escape, selection announced with `status.signedIn`, switch absent when demo is off, id outside the list never sent, after a switch the banner clears, everything reloads, focus returns to the button), `UpgradePlanSection` and `CiTriageSection` (rows, row-named actions, empty and error states, propose sends only kind and target, one click one proposal, banner `banner.proposed`, refusal texts, reload), `OpenChangesSection` (sorted by D6, status label, View), `AuditLogSection` and `AuditFilters` (columns, "-" for no reason, filters reload from page 1, `error.dateRange` sends nothing, Clear filters, paging, no control that writes), and `GuardrailsView` (four loads at once, each section ends on its own, writes disabled while a section shows the server error panel, open list and audit still load when the server is down). Stories US1.1, US1.2, US2.1, US2.2, US4.1, US5.1, US5.2; rules BR1.1–BR1.4, BR2.1–BR2.4, BR3.1, BR4.1–BR4.4, BR5.1–BR5.4, BR6.1–BR6.3, BR7.4.
- [x] **Step 17: Frontend behavior (Guardrails view and card) - Green.** Write the card, header, switch, four sections, filters and view under `src/components/` and `src/screens/`.
- [x] **Step 18: Frontend behavior (Guardrails view and card) - Refactor.** Keep sections independent; keep tests green.
- [x] **Step 19: Frontend behavior (change detail) - Red.** Failing tests for `ChangeDetailScreen` (focus on the h1, title is the backend `summary`, kind label, pending shows Approve and Reject, failed shows Retry, decided shows the decision block only, the "Actions by Case" table of `functional-spec.md`, blank reason sends nothing and shows `error.reasonRequired`, approve and reject return to the view with the right banner, retry outcomes, refusals `ALREADY_DECIDED`, `NOT_FAILED`, `CLAIM_RELEASED` and auditor or proposer refusals in an announced alert with a reload, not found, server unreachable, a lost connection or the 12 second limit keeps the reason and shows `error.submitFailed` then reloads the change before the next attempt is enabled). Stories US3.1, US3.2, US3.3; rules BR3.2–BR3.8, D10, D11; NFR5.8, NFR5.10.
- [x] **Step 20: Frontend behavior (change detail) - Green.** Write `ChangeSummary`, `DecisionBlock`, `ReasonForm`, `ChangeDetailScreen`.
- [x] **Step 21: Frontend behavior (change detail) - Refactor.** Share the decision path between approve, reject and retry; keep tests green.
- [x] **Step 22: Cross-cutting tests (security, accessibility, keyboard, performance).** Write `src/e2e/security.test.ts` (a full walkthrough with every request recorded: the token appears only in the header to the plugin backend, nowhere in rendered text, console or addresses; no `actor`, `role` or `userId` outside the two exceptions; hostile text in summary, cause, failure message, reason, names and target shown literally with no element created; a console check for response bodies), `src/e2e/accessibility.test.ts` (`jest-axe` once per state of the scan list), `src/e2e/keyboard.test.ts` (the seven walkthroughs by keyboard only, accessible names and live-region text equal the catalog) and `src/e2e/performance.test.ts` (parallel loads, the 5 and 12 second limits, the first full render with the seeded set within 1 second). Fix any failure at its cause in the earlier layers. NFR1.2–NFR1.6, NFR3.1–NFR3.3, NFR5.1–NFR5.10.
- [x] **Step 23: Environment/build configuration.** Add the `ui-*` jobs of `cicd-pipeline.md` to the shared workflow; add `scripts/check-packages` (compares the package's `package.json` dependencies with `allowed-packages.txt`), the address check on the built output, the gzip size gate at 300 KB, and the lint rules (no raw-HTML insertion, no `fetch` or storage outside `GuardrailsApi` and `DemoSession`, no port-like string literals). NFR1.7, NFR5.5, NFR5.11, NFR5.12, NFR6.1.
- [x] **Step 24: Documentation and traceability.** Write `packages/plugin-guardrails/README.md` (what the plugin shows, how u4 loads it, the demo user switch and its accepted risk, how to run the tests), then `code-summary.md`, `source-manifest.json` and `traceability.json` in the record, and list the checks left open for u5 in `unit-test-instructions.md`.

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
