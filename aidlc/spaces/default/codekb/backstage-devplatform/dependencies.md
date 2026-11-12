# Dependencies

## Internal
- app -> plugin-guardrails (source-linked, `main: src/index.ts`)
- backend -> plugin-guardrails-backend; guardrails-server (dev)
- plugin-guardrails -> @backstage/plugin-catalog-react/alpha (entity blueprints)
- e2e drives the composed stack of backend + guardrails-server + Postgres

## External direct (app)
@backstage/frontend-defaults, frontend-plugin-api, plugin-app, plugin-app-react, plugin-catalog, @material-ui/core, react, react-dom, react-router-dom, plugin-guardrails; dev: cli, test-utils, testing-library, jest-axe. Exact versions in technology-stack.md.

## External direct (plugin-guardrails)
frontend-plugin-api, plugin-catalog-react, @material-ui/core, @material-ui/lab; dev: msw, testing-library, jest-axe, react-router.

## Governance
Each package has `allowed-packages.txt`, verified by `check:packages` (`packages/backend/scripts/check-packages.mjs`, `packages/plugin-guardrails/scripts/check-packages.mjs`, CI). Adding a direct dependency (for example `@backstage/ui` or `@backstage/theme`) requires editing the list in the same change. The app list currently contains no `@backstage/ui` or `@backstage/theme`.

## Transitive of note
@backstage/ui 0.19.0, @backstage/theme 0.7.3, @backstage/core-components 0.18.15, @mui/material 5.18.0 (via theme).
