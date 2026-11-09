# Logical Components — u4-backstage-app

Sources: all five NFR design documents of this folder, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md` (NFR2.3, NFR2.11, NFR2.13), `functional-spec.md` (D10, W1 to W5) and `contract-summary.md` (C3, C4). This is the component-level view for Infrastructure Design.

## Components

| Component | Package | Role | NFR patterns |
|---|---|---|---|
| `SignInPage` | `packages/app` | Renders the states and the choices as text and buttons | P3, S5, S7, R5 |
| `signInState` | `packages/app` | Pure reducer for the sign-in states | R5, S7 |
| `signInClient` | `packages/app` | The user-list read and the start call, each with a 5 s abort | P1, P2 |
| `IdentityHolder` | `packages/app` | Keeps the identity and token in a closure; no getter | S3, SC1 |
| `appFeatures` | `packages/app` | The list of frontend features: catalog pages, sign-in page, `guardrailsPlugin` | P6 |
| `backendFeatures` | `packages/backend` | The one exported list of backend features | S1, R7 |
| Backend entry point | `packages/backend` | Builds from `backendFeatures`; exits non-zero on a failed start | R2, P4 |
| `catalogScript` and catalog file | `packages/backend` | Writes the ten-entry catalog from the u1 generator; the committed file is checked against it | R1 |
| `checkShippedSettings` | `packages/backend` | One function that checks the committed settings | S2, S4, S6, S9 |
| Allow-list script | each package | Compares declared dependencies with `allowed-packages.txt` | S8 |
| Start-up test | `packages/backend` | Runs the real features in the test backend with a stand-in server and a recording logger | R3, R4, O2, O3 |

## Failure Domains and Blast Radius

| Domain | Failure | Blast radius |
|---|---|---|
| Guardrails server | Down | Plugin pages show unreachable states; app, catalog and sign-in keep working (R3) |
| Database | Unavailable | Backend does not become ready; readiness stays not-200 (R4); compose shows it |
| Demo switch | Off | App starts; sign-in page shows `signin.off` |
| Catalog file | Differs from the seed | The drift test fails in CI; the running app is unaffected |
| Browser tab | Reload | Sign-in lost by design; nothing stored |

## Shared Resources

| Resource | Used by | Isolation |
|---|---|---|
| Environment variables (server address, switch, database login) | backend start-up | Read once at start; never logged as values |
| Database | `plugin-guardrails-backend` | Compose PostgreSQL volume; in-memory SQLite locally |
| u1 generator | `catalogScript` and its test | Development dependency only (D10) |
| Auth backend | `signInClient`, `IdentityHolder` | Reached through the start address only |

## Where NFR Patterns Apply

| NFR area | Components | Documents |
|---|---|---|
| Performance | `signInClient`, `SignInPage`, backend entry point | `performance-design.md` |
| Security | `IdentityHolder`, `checkShippedSettings`, `backendFeatures`, lint rules, allow-list script | `security-design.md` |
| Scalability | whole app (stateless) | `scalability-design.md` |
| Reliability | `signInState`, entry point, catalog script, start-up test | `reliability-design.md` |
| Observability | start-up test, recording logger, readiness route | `observability-design.md` |

## Hand-offs to Infrastructure Design and u5

- Infrastructure Design takes the environment variable list, the readiness route and the PostgreSQL supply from this view.
- u5 takes the items listed as hand-offs in `tech-stack-decisions.md`: the 20-load timing, colour contrast and screen-reader pass, Chrome and Firefox flows, the end-to-end token step, the CORS and content-policy checks if the test backend does not apply them, and the compose view of a failed start.
