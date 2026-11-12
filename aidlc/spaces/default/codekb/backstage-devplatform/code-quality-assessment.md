# Code Quality Assessment

## Tests, lint, CI
- Jest per package with an 85% line floor (package.json `jest.coverageThreshold`, also root); TDD is the team posture.
- ESLint via backstage-cli; `packages/app/.eslintrc.js` forbids raw HTML insertion, module-level `let`, literal ports/addresses, `console`, `localStorage`/`sessionStorage`.
- CI (`.github/workflows/ci.yml`): prettier, lint, tsc, tests with coverage, server image and smoke, further live jobs.
- Docs: extensive root README; known limit recorded at README.md:256.

## Constraints a UI redesign must respect
- WCAG 2.1 AA axe scan of six views (sign-in choices, catalog list, service overview, changes list, change detail, audit log) in Chrome and Firefox: `packages/e2e/specs/a11y.spec.ts` (viewport 1440x900); jsdom a11y/keyboard tests in `packages/plugin-guardrails/src/e2e/`, `SignInPage.test.tsx`, `CatalogA11yFix*.test.ts(x)`.
- Test hooks and names: see api-documentation.md (data-testids, "Sign in as <Name>").
- `wiring.test.tsx` asserts exactly three app features (`appFeatures` length 3) and ids `catalog`, `guardrails`; adding a fourth feature (for example a theme module) breaks it and BR1.1 wording.
- Lint/allow-list rules listed in dependencies.md and above.
- CSP (`packages/backend/app-config.yaml`): bundled same-origin CSS is allowed; inline `style` attributes depend on Backstage default style-src.

## Why the pages look unstyled (from code)
1. The app never imports `@backstage/ui/css/styles.css` (no CSS import in `index.tsx`, `App.tsx`, `features.ts`; no link in `public/index.html`; no `@backstage/ui` direct dependency). plugin-app 0.5.4 builds its shell with BUI components (`BUIProvider`, `PluginHeader`), so header, nav and layout render without BUI styles.
2. No theme extension: only built-in MUI v4 `light`/`dark` themes; which one applies is Backstage's default selector (stored in browser storage, system dependent), so dark is not guaranteed.
3. The custom `SignInPage` is a bare `<main>` with MUI v4 widgets and `color="inherit"`, with no container, padding or max width; the page background comes from whatever the theme/BUI provides (nothing, without the CSS).
4. Overflow at the right edge: not provable from code alone; likely from the unstyled BUI shell (no BUI layout CSS) and from the plugin grid `minmax(420px, 1fr)` and wide tables. Needs a browser check.
5. The plugin tab looks fine because it is composed only of MUI v4 components (themed by `UnifiedThemeProvider`) and inline styles.

## Technical debt
- Plugin colours are hard-coded for light backgrounds (`StatusLabel.tsx`, `ShieldMark.tsx`); on a dark theme they need theme-based or lighter values and AA contrast checks.
- Inline styles instead of theme tokens; no shared layout primitives.
- `CatalogA11yFix` depends on Backstage DOM details.
- No WebKit/Safari project in Playwright; Firefox axe crash workaround in `a11y.spec.ts`.
- CSP `'unsafe-eval'` deviation.
