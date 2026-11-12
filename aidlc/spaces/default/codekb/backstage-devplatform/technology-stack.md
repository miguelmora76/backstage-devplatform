# Technology Stack

| Area | Technology | Version (range -> resolved) |
|---|---|---|
| Language | TypeScript | ~5.9.3 |
| Runtime | Node | >=22 |
| Package manager | Yarn 1 workspaces | yarn.lock |
| UI library | React | ^18.3.1 |
| Routing | react-router-dom | ^6.30.2 |
| UI kit (app, plugin) | @material-ui/core (MUI v4) | ^4.12.4 -> 4.12.4 |
| Lab | @material-ui/lab | ^4.0.0-alpha.61 (plugin only) |
| Frontend system | @backstage/frontend-defaults / frontend-plugin-api | ^0.5.7 / ^0.18.2 |
| App shell | @backstage/plugin-app / plugin-app-react | ^0.5.4 / ^0.2.8 |
| Catalog UI | @backstage/plugin-catalog / plugin-catalog-react | ^2.0.10 / ^3.3.0 |
| Backstage UI (BUI) | @backstage/ui | 0.19.0, transitive via plugin-app, not direct |
| Theme | @backstage/theme | 0.7.3, transitive |
| Components | @backstage/core-components / core-app-api | 0.18.15 / 1.20.6, transitive |
| CLI | @backstage/cli | ^0.36.7 |
| Backend | @backstage/backend-defaults, plugin-app-backend, auth-backend, catalog-backend | ^0.18.1, ^0.5.19, ^0.30.2, ^4.0.2 |
| Database | better-sqlite3 ^13, pg ^8 (Postgres) | |
| Tests | Jest ^30, Testing Library, jest-axe ^11, Playwright + axe | |
| Format | Prettier ^3.9.10 (`@backstage/cli/config/prettier`) | |

## Frontend system and styling (UI-relevant)
- New frontend system (extensions/blueprints); entry `createApp(...).createRoot()`.
- Themes: plugin-app registers `light` and `dark` (`AppThemeApi.esm.js`, MUI v4 `UnifiedThemeProvider` with `@backstage/theme` `themes.light`/`themes.dark`); no theme extension, `createUnifiedTheme` or `ThemeBlueprint` in this repo.
- `@backstage/ui` is imported by plugin-app (`BUIProvider` in AppRoot, `PluginHeader` in components); its CSS is a separate export `@backstage/ui/css/styles.css` (package `sideEffects: ["*.css"]`) and is not imported in this repo.
- Two UI kits meet: BUI (new Backstage shell) and MUI v4 (catalog content, custom sign-in, plugin).
- Bundler: backstage-cli `package build` (webpack); CSS imports are supported by it; CSP style-src is Backstage default.
- Browsers tested: Chrome and Firefox in Playwright; Safari/WebKit not tested.
