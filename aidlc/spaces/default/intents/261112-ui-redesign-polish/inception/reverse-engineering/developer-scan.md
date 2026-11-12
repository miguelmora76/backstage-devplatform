## Developer Code Scan Results

### Scan Coverage
- **Analyzed deeply**:
  - packages/app/ (package.json, .eslintrc.js, allowed-packages.txt, public/index.html, src/App.tsx, src/index.tsx, src/features.ts, src/signInModule.tsx, src/signin/SignInPage.tsx, src/signin/strings.ts, src/a11y/*.ts(x), src/wiring.test.tsx, src/lintFixtures/rawHtml.tsx)
  - packages/plugin-guardrails/ (package.json, src/plugin.tsx, src/index.ts, src/screens/GuardrailsTab.tsx, GuardrailsView.tsx, GuardrailsRoutes.tsx, src/components/SectionFrame.tsx, GuardrailsHeader.tsx, StatusLabel.tsx, ShieldMark.tsx; style/theme grep across src/)
  - packages/backend/ (package.json, app-config.yaml, src/index.ts, src/features.ts, allowed-packages.txt)
  - packages/e2e/playwright.config.ts, specs/a11y.spec.ts, specs/support/screens.ts
  - package.json (root), yarn.lock (version lookups), README.md (grep of styling/CSP lines), .github/workflows/ci.yml (job names)
  - Installed Backstage packages read only for the cause of the styling: node_modules/@backstage/plugin-app/dist/extensions (AppThemeApi, AppRoot, App, components, DefaultSignInPage), @backstage/ui package.json and dist/css listing
- **Skimmed only**: packages/guardrails-server/, packages/plugin-guardrails-backend/, packages/e2e/src/ and bin/, packages/backend/src/ (other than index/features), packages/backend/scripts/, k8s/, compose.yaml, remaining plugin-guardrails components, hooks, api, texts, tests (file names and structure only)
- **Left out**: node_modules/ (apart from the targeted reads above), dist/, dist-types/, coverage/ at every level (build output, gitignored); .claude/, .kiro/, .codex/, .cursor/, .opencode/, .aidlc/, aidlc/ (AI-DLC install and workspace)

### Packages Found
- app — frontend (new frontend system) — TypeScript/React 18 — host Backstage app: catalog pages, demo sign-in page, guardrails plugin
- plugin-guardrails — frontend-plugin — TypeScript/React + Material-UI v4 — Guardrails entity tab, overview card, change detail
- backend — backend — TypeScript — Backstage backend; serves packages/app/dist via app-backend, catalog, auth, guardrails
- plugin-guardrails-backend — backend-plugin — TypeScript — REST API, change workflow, audit store (Knex), demo sign-in auth module
- guardrails-server — standalone Node service — TypeScript — C2 tool server and data generator
- e2e — tooling/tests — TypeScript/Node — Playwright specs, compose/minikube scripts, repo checks

### Build System
- **Type**: Yarn 1 workspaces (`packages/*`), backstage-cli per package, tsc project builds for plugins/server/backend
- **Config Files**: package.json (root + each package), tsconfig.json per package, .eslintrc.js per package, .prettierignore, compose.yaml, k8s/, Dockerfiles
- **Build Dependencies**: backend -> plugin-guardrails-backend; app -> plugin-guardrails (source-linked, main: src/index.ts); backend serves app/dist at runtime; e2e drives the composed stack

### APIs Discovered
- REST (OpenAPI) — packages/plugin-guardrails-backend/contract/c1-openapi.yaml — plugin router under /api/guardrails plus demo sign-in under /api/auth/demo
- Tool server contract — packages/guardrails-server/contract/c2-tools.json
- Frontend plugin API (C3) — plugin id `guardrails`: one ApiBlueprint, one EntityContentBlueprint (path guardrails), one EntityCardBlueprint

### Frameworks & Libraries
- @backstage/frontend-defaults ^0.5.7, @backstage/frontend-plugin-api ^0.18.2, @backstage/plugin-app ^0.5.4 (resolved 0.5.4), @backstage/plugin-app-react ^0.2.8, @backstage/plugin-catalog ^2.0.10, @backstage/plugin-catalog-react ^3.3.0 — new frontend system
- @backstage/ui 0.19.0, @backstage/theme 0.7.3, @backstage/core-components 0.18.15, @backstage/core-app-api 1.20.6 — transitive only (via plugin-app / catalog)
- @material-ui/core ^4.12.4 (resolved 4.12.4), @material-ui/lab ^4.0.0-alpha.61 — direct in app and plugin
- react ^18.3.1, react-router-dom ^6.30.2, typescript ~5.9.3, @backstage/cli ^0.36.7, jest ^30, prettier ^3.9.10
- Playwright + @axe-core/playwright (e2e), jest-axe 11, @testing-library/*

### Test Coverage
- **Test Directories**: co-located *.test.ts(x) in each package; packages/plugin-guardrails/src/e2e/ (accessibility, keyboard, performance, security jsdom tests); packages/e2e/specs/ (Playwright)
- **Test Frameworks**: Jest via backstage-cli, Testing Library, jest-axe, Playwright (chrome, firefox, timing, http projects)
- **Coverage Config**: present: 85% line threshold per package and root

### Code Quality Indicators
- **Linting**: ESLint via backstage-cli eslint-factory; app adds restricted-syntax rules (no raw HTML, no module-level let, no literal addresses/ports, no console, no localStorage/sessionStorage) in packages/app/.eslintrc.js; Prettier root config @backstage/cli/config/prettier
- **CI/CD**: .github/workflows/ci.yml (prettier, lint, tsc, tests with coverage, server image build/smoke, further live jobs)
- **Documentation**: README.md (root, extensive), package READMEs for guardrails-server, plugin-guardrails, plugin-guardrails-backend; README line 256 admits the app has little styling of its own

### Technical Debt Signals
- No stylesheet and no theme are configured anywhere in packages/app/src (no `@backstage/ui/css/styles.css` import, no ThemeBlueprint, no CSS file); `@backstage/ui` is not a direct dependency and allowed-packages.txt would need an edit to add it (packages/app/allowed-packages.txt, check:packages script)
- Custom SignInPage (packages/app/src/signin/SignInPage.tsx) renders a bare `<main>` with MUI v4 Typography/List/Button and `color="inherit"`; no wrapper, padding or max width
- Plugin hard-codes light-background-only colours: StatusLabel (#8a5a00, #1b6e2d, #9b1c1c, #1f3a93) and ShieldMark fill #1F3A93, plus inline `style={{}}` layout throughout, no makeStyles/theme use
- GuardrailsView grid `repeat(auto-fit, minmax(420px, 1fr))` can force content wider than a narrow container
- CatalogA11yFix mutates Backstage's DOM through a MutationObserver (markup-coupled; changes to the catalog UI can break it)
- e2e browsers are chrome and firefox only; no WebKit/Safari project
- CSP allows 'unsafe-eval' for script-src (documented deviation)

## Handoff Summary
- **Intent-relevant finding**: Backstage's own stylesheet is never loaded. `@backstage/plugin-app` 0.5.4 renders its shell (PluginHeader, BUIProvider, toasts) with `@backstage/ui` 0.19.0 components (node_modules/@backstage/plugin-app/dist/extensions/AppRoot.esm.js:6, components.esm.js:5), but BUI ships its CSS as a separate `@backstage/ui/css/styles.css` entry (sideEffects `*.css`) and nothing in packages/app imports it (packages/app/src/index.tsx, App.tsx, features.ts have no CSS import; packages/app/public/index.html has no link). Themes come only from plugin-app's built-in `light` and `dark` ThemeBlueprint extensions (AppThemeApi.esm.js) using `UnifiedThemeProvider` (MUI v4 theme); the app adds no theme extension, so theme choice is Backstage's default (selector stored in browser storage, system-dependent).
- **Risks / follow-up**: Preserve (1) app lint rules (no localStorage, no raw HTML, no literal URLs/ports, no console), (2) `check:packages` allow-lists in packages/app and packages/plugin-guardrails (a new direct dependency such as @backstage/ui or @backstage/theme must be added to allowed-packages.txt), (3) the WCAG 2.1 AA axe scans for six views in packages/e2e/specs/a11y.spec.ts and the jsdom accessibility/keyboard tests in packages/plugin-guardrails/src/e2e (dark colours must keep AA contrast; status colours in StatusLabel are light-theme colours), (4) the data-testids and role/name selectors used by Playwright and unit tests (`Sign in as <name>`, `sign-in-page`, `sign-in-choose-*`), (5) CSP in packages/backend/app-config.yaml (a bundled same-origin CSS import is fine; inline styles rely on Backstage's default style-src), (6) the 85% coverage floor, and (7) Safari is not covered by Playwright (needs manual check or a new WebKit project).
