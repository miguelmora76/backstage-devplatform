# Infrastructure Specification — u1-data-and-server

Sources: the six NFR Design documents for this unit (`performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`), `components.md` (GuardrailsServer, SeedDataGenerator), `functional-spec.md`, `contract-summary.md` (contract C4: health route and settings), `team-practices.md` (local only, docker compose, hosting later possible) and answers Q1–Q5 in `infrastructure-design-questions.md`. This unit builds the image; the compose entry that runs it is written in u5-compose-and-ci.

## Deployment

| Facet | Choice | Rationale |
|---|---|---|
| Compute model | One container, one process, one instance | One browser user; the overlay lives in one process (scalability design) |
| Image build | A Dockerfile in this unit's directory; multi-stage: build stage compiles the TypeScript, final stage holds the compiled output and production dependencies only | Small image, no build tools at run time (NFR2.7) |
| Base image | The small official Node.js image of the pinned long-term-support release, pinned by version tag (NFR2.1) | Same runtime as development; reproducible builds |
| User | Non-root user supplied by the base image | NFR5.6 |
| Networking | Listens on one port inside the container; the compose entry publishes nothing to the host and the Backstage app reaches it by service name on the compose network | NFR5.5 |
| Storage | None. The compose entry makes the root file system read-only; the log goes to standard output | NFR5.2: nothing is written to disk |
| Settings | Environment variables GUARDRAILS_SEED, GUARDRAILS_FAILURE_MODE and PORT, with the defaults of the settings reader; no settings file | Contract C4; no address or path hard-coded |
| Start order | The server starts first; the Backstage app waits for the server's health check | NFR7.7 |
| Restart policy | No automatic restart. A stopped server shows as stopped; a restart is manual and gives the seeded state | NFR7.3, NFR7.6: a bad setting must be visible, not looped |
| Environments | One: the developer laptop under docker compose. Minikube (u6) reuses the same image | Team practices: local only |
| Infrastructure as code | The Dockerfile and, in u5, the compose file; no cloud templates | No cloud resources are involved |
| Resource sizing | 256 MB memory and one processor core, set as limits in the compose entry | Performance requirements |

## Infrastructure Services

| Service | Role | Configuration | Notes |
|---|---|---|---|
| None | n/a | No database, cache, queue, search, content delivery, DNS or load balancer | All data is in the process's memory (BR2.5); one instance, so no balancing |

## Shared Infrastructure

| Shared Resource | Owner Unit | Consumer Units | Access Boundary |
|---|---|---|---|
| Container image `guardrails-server` | u1-data-and-server | u5-compose-and-ci, u6-minikube-run | Consumers run the image and set its three environment variables; they do not modify it |
| Compose network | u5-compose-and-ci | u1-data-and-server, u4-backstage-app | The server joins it with no published port |

## Hosting Later

Nothing here blocks hosting: the image is standard, the address and settings come from the environment, and the only things to add are a caller check (security design) and a shared store if more than one instance is wanted.
