# API Documentation

Skimmed (not UI-relevant for this intent); contracts live in the repo.

## HTTP API (backend, port 7007)
- Guardrails plugin REST: `packages/plugin-guardrails-backend/contract/c1-openapi.yaml`, mounted at `/api/guardrails` (changes, audit, upgrade plans, CI runs, `me`, `demo-users`). Implemented in `src/http/router.ts` with `identityGuard`, input schemas and an error handler.
- Demo sign-in: `/api/auth/demo/start?userId=<id>` (auth module `authModuleDemoSignIn`, active only when `guardrails.demoSignIn.enabled`).
- Catalog API and app-backend static serving from standard Backstage plugins.

## Tool server (guardrails-server)
Contract `packages/guardrails-server/contract/c2-tools.json`; tools in `src/tools/`.

## Frontend plugin surface (contract C3)
- Plugin id `guardrails`; `rootRouteRef`.
- Extensions: API `guardrailsClientApiRef`, entity content tab `guardrails` ("Guardrails"), entity info card.
- Host app surface: `appFeatures` array, `signInModule`, `SignInPageWithApis`, `HomeRedirect`.

## Selectors the UI exposes to tests (must be kept)
`data-testid`: `sign-in-page`, `sign-in-loading`, `sign-in-off`, `sign-in-load-failed`, `sign-in-retry`, `sign-in-failed`, `sign-in-choose-<userId>`, `signed-in`, `detail-h1`, `decision-block`, `what-it-will-do`, `status-<status>`. Accessible names: button "Sign in as <Name>", breadcrumb nav "Breadcrumb".
