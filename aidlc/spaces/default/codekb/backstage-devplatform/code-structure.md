# Code Structure

## Layout
```
package.json              root workspaces, scripts (tsc, test, lint, prettier, compose, e2e)
compose.yaml, k8s/        local stack and optional minikube manifests
.github/workflows/ci.yml  CI
packages/
  app/                    frontend host app
    public/index.html     HTML shell (title from app.title; no stylesheet link)
    src/index.tsx, App.tsx, features.ts, signInModule.tsx
    src/signin/           SignInPage.tsx, signInState.ts (reducer), signInClient.ts, identityHolder.ts, strings.ts
    src/a11y/             catalogA11y.ts, CatalogA11yFix.tsx (DOM repairs for Backstage catalog)
    src/lintFixtures/     file that must fail lint
  plugin-guardrails/      frontend plugin
    src/plugin.tsx, routes.ts, context.tsx, index.ts
    src/screens/          GuardrailsTab, GuardrailsRoutes, GuardrailsView, ChangeDetailScreen, OverviewCardEntity
    src/components/       sections, header, tables, forms, StatusLabel, ShieldMark, banners, SectionFrame
    src/api/, hooks/, rules/, texts/, testing/, e2e/ (jsdom a11y/keyboard/perf/security tests)
  backend/                Backstage backend (src/index.ts, features.ts), app-config*.yaml, catalog/, scripts/
  plugin-guardrails-backend/  http/, store/, workflow/, rules/, auth/, identity/, server/, database/, migrations/
  guardrails-server/      app.ts, tools/, store/, generator/, probe/, contract/
  e2e/                    specs/ (Playwright), src/ (repo checks), bin/ (compose/minikube scripts)
```

## File classification (UI-relevant)
- Configuration: `packages/app/src/features.ts`, `signInModule.tsx`, `packages/backend/app-config.yaml`
- Controller/view: `SignInPage.tsx`, plugin `screens/*`, `components/*`
- Utility: `signInState.ts`, `texts/texts.ts`, `catalogA11y.ts`
- Static/Asset: `public/index.html` only; there are no stylesheets or images in the repo
- Test: co-located `*.test.ts(x)`; Playwright `packages/e2e/specs/*.spec.ts`

## Patterns
- Styling is inline `style={{...}}` plus MUI v4 components (`Paper`, `Typography`, `Button`, `List`) with no `makeStyles`, `withStyles` or theme access in the app or plugin.
- Text from backend is rendered as text only (lint-enforced).
- Strings are centralised (`signin/strings.ts`, `plugin-guardrails/src/texts/texts.ts`).
