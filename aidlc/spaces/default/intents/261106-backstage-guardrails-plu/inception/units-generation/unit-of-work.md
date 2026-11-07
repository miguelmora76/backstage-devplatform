# Units of Work

Sources: `components.md` and `decisions.md` (Domain Design), `requirements.md`, `stories.md`, and answers Q1–Q2 in `units-generation-questions.md` (six grouped units; independent units may be built at the same time). The dependency graph is in `unit-of-work-dependency.md`; which stories each unit carries is in `unit-of-work-story-map.md`. This stage describes topology only; the build order is chosen in Delivery Planning.

## Unit Table

| Unit ID | Directory | Kind | Complexity | Deployment model |
|---|---|---|---|---|
| U1 | u1-data-and-server | service | M | Standalone container |
| U2 | u2-plugin-backend | library | L | Embedded in the Backstage backend (U4) |
| U3 | u3-plugin-ui | ui | L | Embedded in the Backstage frontend (U4) |
| U4 | u4-backstage-app | service | M | Standalone: the host Backstage app |
| U5 | u5-compose-and-ci | packaging | M | Shared: build and run scripts and the CI workflow |
| U6 | u6-minikube-run | packaging | S | Shared: Kubernetes run files (should have) |

## U1: u1-data-and-server

- **Description:** The synthetic guardrails server and the repeatable seed data generator that feeds it.
- **Components:** GuardrailsServer, SeedDataGenerator.
- **Owns:** entities ServiceRecord, Dependency, CiRun, SeedDataSet.
- **Responsibilities:** generate the same data for the same seed (FR7.1, FR7.2); serve the four operations: list the upgrade plan, list failed CI runs with causes, apply a dependency upgrade, re-run a CI job (FR6.1); offer a start-up failure setting for tests; hold applied upgrades in memory and reload from the seed on restart; treat an apply to an already-upgraded dependency as a successful no-op.
- **Boundaries:** knows nothing about changes, approvals, users or the audit log.
- **Implementation notes:** the shared data-shape contract for the seed data set is owned here and filled in by Functional Design.

## U2: u2-plugin-backend

- **Description:** The Backstage backend plugin: change workflow, append-only audit log, and the demo sign-in's users and roles.
- **Components:** ChangeWorkflow, AuditLog, DemoIdentity.
- **Owns:** entities Change, AuditEntry, DemoUser.
- **Responsibilities:** every rule in FR3 (reasons, no self-approval, one decision per change, retry rules, refusals), the auditor restriction (proposed FR12.1), the ordered claim-call-record-audit sequence for each decision, audit append and filtered paged reads (FR4), demo users and roles (FR5), allowed actions with reasons for the UI, relays of plan and CI data from the guardrails server (FR1.1, FR2.1) and the unreachable-server behavior on the backend side (FR11.2).
- **Boundaries:** reaches the guardrails tools only through the server's tool interface (FR6.2); the audit log is reachable only by "append" and "read".
- **Implementation notes:** tested against a stand-in for the server's tool interface, so it needs no running U1.

## U3: u3-plugin-ui

- **Description:** The Backstage frontend plugin: the overview card, the Guardrails view, the change detail screen and the demo-user switch.
- **Components:** GuardrailsPluginUI.
- **Owns:** no entities.
- **Responsibilities:** all screens, states, texts and accessibility behavior from the refined mockups (FR1–FR5, FR11, NFR1, NFR3, NFR4); shows what the backend says is allowed and never decides a rule.
- **Boundaries:** calls the plugin backend and the demo sign-in only; never calls the guardrails server.
- **Implementation notes:** tested against a stand-in for the backend interface, so it needs no running U2.

## U4: u4-backstage-app

- **Description:** The host Backstage app that loads both plugins and the demo sign-in, with the synthetic catalog of services.
- **Components:** none of its own; wiring of GuardrailsPluginUI, ChangeWorkflow, AuditLog and DemoIdentity into one running app.
- **Owns:** no entities.
- **Responsibilities:** register the plugins and the sign-in with the demo users; catalog entries for the seeded services; configuration of the guardrails server address through settings, with no address hard-coded (constraint of hosting later).
- **Boundaries:** contains wiring and configuration only; no business rules.
- **Implementation notes:** the first place the whole application can be seen working.

## U5: u5-compose-and-ci

- **Description:** The one-command local run with docker compose and the GitHub Actions pipeline.
- **Components:** none; build, run and verification files.
- **Owns:** no entities.
- **Responsibilities:** one command that starts the app, the plugins and the guardrails server with no other manual step (FR8.1); GitHub Actions for formatting, lint, tests and the 85% line-coverage check (FR10.1, NFR2, NFR6).
- **Boundaries:** adds no behavior to the application.

## U6: u6-minikube-run

- **Description:** The should-have run on a local minikube cluster.
- **Components:** none; Kubernetes run files and the documented command.
- **Owns:** no entities.
- **Responsibilities:** bring the sample up on minikube and pass the same check as FR8.1 (FR9.1).
- **Boundaries:** may be dropped without affecting any other unit (scope S9 is should have).
