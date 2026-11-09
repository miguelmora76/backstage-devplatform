# Infrastructure Specification — u3-plugin-ui

This unit is browser code inside the Backstage app. It needs no server, container, database, queue, cache or cloud resource. The table records that choice and the few facets that still matter. The pipeline is in `cicd-pipeline.md`.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | None of its own; runs in the browser page of the Backstage app | A UI plugin is delivered inside the host app's bundle (NFR2.12) |
| Networking | Calls go to the plugin backend and the auth backend's start path, at addresses from Backstage's discovery service; in the compose sample these are the same origin as the app | No address in code (NFR5.11); no cross-origin setup in this unit |
| Storage | The chosen userId in tab storage only; the token in memory (S1); nothing else | Security design |
| Environments | One: the developer laptop with docker compose; minikube optional and not needed by this unit | Team practices: local only |
| IaC approach | None; no resource to define | Nothing to provision |
| Resource sizing | Plugin code at most 300 KB gzip; no memory or processor limit set by this unit | NFR1.7 |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| None | not applicable | not applicable | The plugin uses the services of other units: the plugin backend (u2) and the app's discovery and fetch APIs (u4) |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| GitHub Actions workflow file | u1-data-and-server (created), extended by each unit | u2, u3, u5 | This unit adds only `ui-*` jobs |
| Backstage app that loads the plugin | u4-backstage-app | u3 | The plugin is a package the app imports; the app owns headers and sign-in wiring |

## Hosting Later

Nothing here blocks hosting: the plugin holds no address and reads no setting. The demo sign-in (a passwordless provider) must be replaced before any hosted use, as the security design states.
