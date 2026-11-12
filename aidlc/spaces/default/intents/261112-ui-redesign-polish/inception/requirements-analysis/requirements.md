# Requirements: UI Redesign (Fix and Polish)

## Sources

- [desc] Initial description: "UI redesign of the guardrails sample: fix and polish. The host app pages (sign-in, catalog list, service overview, tabs) look unstyled and inconsistent (likely Backstage UI stylesheet never loaded in packages/app); content overflows the right edge; one consistent dark theme across host app and the Guardrails plugin, like the plugin has today; works in Chrome and Safari; same screens and behaviour; keep accessibility and the 85% coverage floor".
- [scope] Workflow-selected scope: express.
- [Q1] to [Q4] in `requirements-analysis-questions.md`: Q1 = B (dark default, light/dark switch kept), Q2 = A (Backstage's usual look), Q3 = A (add the Backstage UI package as a direct dependency), Q4 = A (Safari checked by hand).
- Code knowledge base (`aidlc/spaces/default/codekb/backstage-devplatform/`: business-overview, architecture, code-structure, code-quality-assessment): the Backstage UI stylesheet is never imported; no theme extension; the Guardrails plugin uses fixed light-theme status colours; the app asserts exactly three features.
- Team practice (`team.md`, `project.md`): 85% line coverage on the plugin code, Prettier and ESLint enforced in CI, tests first, local only.
- Browser observation of the running app on 2026-11-12 (Chrome): unstyled sign-in page, mixed light and dark catalog list, raw tables and run-together tabs on the service overview, the Guardrails tab styled but clipped at the right edge.

## Intent Analysis

The person wants the sample to look like a finished product. The host app (sign-in, catalog, service page, tabs) looks unstyled and inconsistent, while the Guardrails tab already looks good. The goal is one consistent look across both, dark by default, that also works in Safari, without changing what the screens do. [desc]

## Functional Requirements

### FR1. Styling foundation
- **FR1.1** The app loads the Backstage UI stylesheet, so the page header, navigation, tabs and layout of the host app render styled. [desc]
- **FR1.2** The sign-in page, catalog list, service overview and the tab bar are visually consistent with each other and with the Guardrails tab (same fonts, spacing, colours, surfaces). [desc]
- **FR1.3** The Backstage UI package is a direct dependency of the app and appears in the repository's allow-list of packages. [Q3]

### FR2. Themes
- **FR2.1** A first-time visitor sees the dark theme. [desc] [Q1]
- **FR2.2** Backstage's usual light and dark choice stays available, and both themes are consistent across the host app and the Guardrails plugin. [Q1]
- **FR2.3** The Guardrails plugin takes its colours from the theme, so none of its text, status labels or icons use a fixed colour that is unreadable on the other theme. Every status is shown with text as well as colour. [desc] [codekb]
- **FR2.4** The accent and status colours stay Backstage's usual palette; no custom brand colour is introduced. [Q2]

### FR3. Layout
- **FR3.1** No page of the six checked views (sign-in choices, catalog list, service overview, changes list, change detail, audit log) has content clipped or a horizontal page scroll at viewport widths of 1024, 1308 and 1440 pixels. [desc]
- **FR3.2** The sign-in page shows the three demo users in a centred container of limited width, each name and role next to its "Sign in" button. [desc]

### FR4. Behaviour unchanged
- **FR4.1** Every screen, flow, label and text of the app and the plugin stays as it is, and no screen is added or removed. [desc]
- **FR4.2** The existing test hooks stay as they are: every `data-testid` and the "Sign in as <Name>" button name. [codekb]
- **FR4.3** The app still loads exactly the three features it loads today. [codekb]

### FR5. Safari
- **FR5.1** From the docker compose run, every view in FR3.1 renders styled and without clipping in Safari on macOS. The person checks this by hand before the work is approved; no automated Safari or WebKit check is added. [desc] [Q4]

## Non-Functional Requirements

- **NFR1. Accessibility.** The existing WCAG 2.1 AA scan finds no violation on the six views in the dark theme and in the light theme, in Chrome and in Firefox. The keyboard-only tests keep passing. [desc]
- **NFR2. Quality gates.** Line coverage stays at or above 85% for the plugin code and for each package's own floor; every existing test, the lint rules (no raw HTML, no browser storage, no literal addresses or ports) and Prettier keep passing, and a new test is written first for each new behaviour. [desc] [team.md]
- **NFR3. Content policy.** The styles load under the existing content policy: no new allowance is added to it. [codekb]
- **NFR4. Performance.** The existing timing step still passes: p95 of 20 loads of each view is at most 5 seconds. [codekb]
- **NFR5. Browsers.** Chrome and Firefox are checked by the automated end-to-end checks; Safari by hand (FR5.1). [Q4]

## Constraints

- The sample stays local only: docker compose, with minikube optional; nothing is deployed. [team.md]
- The pipeline stays read-only with `ci-ok` as the only required status. [CI Pipeline stage of the guardrails intent]
- The work goes on its own branch and pull request (`u8-ui-redesign`). [team.md]
- A test asserts that the app has exactly three features; a change to that test needs the person's agreement. [codekb]

## Assumptions

- [assumption] "Dark by default with a switch" (Q1 = B) means the light theme has to meet the same accessibility checks as the dark one, and is in scope only for consistency, not for extra polish. Reason: the person kept the switch but asked for the dark look.
- [assumption] Backstage's own default dark palette already meets contrast requirements for its own components; only the plugin's fixed colours need correcting. Reason: the scan found no other fixed colours.

## Out of Scope

- New screens, new features, new data, or changes to the backend and the guardrails server.
- A custom brand colour or logo (Q2 = A).
- An automated Safari or WebKit check in the pipeline (Q4 = A).
- Responsive layouts for phones and tablets below 1024 pixels wide.

## Assumptions & Open Questions

- Open question: None.
- The two assumptions above are for the person to confirm at this stage's approval.
