# Unit Test Instructions: UI Redesign (Fix and Polish)

## Test frameworks and configuration

All three packages use the existing Jest setup of Backstage's CLI (`backstage-cli package test`). No new runner is added.

- App (`packages/app`): Jest with jsdom, Testing Library, `jest-axe`.
- Plugin (`packages/plugin-guardrails`): the same.
- Real-browser specs (`packages/e2e`): Playwright in Chromium and Firefox, run by the compose end-to-end job; their pure-logic tests run in Jest.

## Commands (each scoped to what this work changes)

Runnable before the first test-first cycle (Step 2 verifies them):

- App unit tests: `yarn workspace app test --watchAll=false src/theme src/signin src/wiring.test.tsx`
- Plugin unit tests: `yarn workspace plugin-guardrails test --watchAll=false src/components/StatusLabel.test.tsx src/components/ShieldMark.test.tsx src/screens/layout.test.tsx`
- Real-browser layout and accessibility specs: `yarn e2e specs layout a11y` against a running `yarn compose:up` stack (Chromium and Firefox).

Revision 1 additions (Steps 24 to 31):

- App unit tests: `yarn workspace app test --watchAll=false src/theme src/signin src/wiring.test.tsx` now also covers the switch and the four-feature wiring test.
- Real-browser specs, run directly because `yarn e2e specs` runs the whole pipeline: `yarn workspace e2e playwright test --project chrome --project firefox --no-deps layout a11y flows keyboard tree` against a rebuilt `yarn compose:up` stack, then `yarn e2e checks`.

Run the full suite once with coverage, as a command of its own, in Build and Test: `yarn test --watchAll=false --coverage`.

## Expected coverage

The 85% line floor for the plugin code and for each package's own floor applies to the whole project; Build and Test checks it on the full suite. A unit-scoped run is not judged against it. No threshold is changed.

## Expected number of tests (Minimal)

About 14 new or changed tests: default dark theme and kept switch (2); three features unchanged (existing); sign-in layout and unchanged texts and hooks (2); status label and shield colours in both themes (2); grid without a forcing minimum (1); no horizontal scroll at three widths on six views (1 spec); accessibility of six views in both themes (1 spec, run in two browsers).

## Mocking and test data

- The app tests use the existing sign-in client fake and Backstage's test utilities; no network.
- Theme colours are asserted through the rendered theme (computed style or the theme object), never through hard-coded hex values in the production code.
- Real-browser specs use the fixed seed and the three demo users of the compose stack; no new data.
