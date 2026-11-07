# Bolt Plan

Sources: `unit-of-work.md`, `unit-of-work-dependency.md` and `unit-of-work-story-map.md` (units, edges, stories per unit), `contract-summary.md` (contracts C1–C4 and their open questions), `requirements.md` and `stories.md` (what each Bolt must deliver), `components.md` (components per unit), `mockups.md` (screens u3 builds), `team-practices.md` (branching, tests first, 85% coverage, no walking skeleton) and answers Q1–Q8 in `delivery-planning-questions.md`.

A **Bolt** is one build pass over a piece of the work, ending in something that runs and has been checked. Here every Bolt holds exactly one unit (Q2: A) and is built on its own short-lived branch and merged through a pull request (team practices). A **walking skeleton** (a thin end-to-end slice built first) is not used: the team affirmed building piece by piece in the planned order.

Bolts are built one at a time (Q6: A), in this order (Q1: A):

| Order | Bolt | Unit | Complexity | Depends on (units) |
|---|---|---|---|---|
| 1 | B1 | u2-plugin-backend | L | none |
| 2 | B2 | u1-data-and-server | M | none |
| 3 | B3 | u3-plugin-ui | L | none |
| 4 | B4 | u4-backstage-app | M | u2, u3 |
| 5 | B5 | u5-compose-and-ci | M | u1, u4 |
| 6 | B6 | u6-minikube-run (should-have) | S | u5 |

**Order change at the start of Construction (decided 2026-11-06):** the build tool walks the units in the order the dependency file lists them, so u1 is built before u2. B1 and B2 swap: u1-data-and-server goes first, then u2-plugin-backend, then the rest as above. u2 is then built against the real server rather than only a stand-in, and the workspace and pipeline setup happens in the first Bolt built, whichever unit that is. The Definition of Done items stay with their units.

The order respects every edge of the unit graph (nothing is built before the units it depends on); see `risk-and-sequencing-rationale.md`.

## Before B1: Workspace and Pipeline Setup (Q5: A)

B1's first branch also creates what every later Bolt needs, outside the six units: the Backstage workspace the plugins live in (created with Backstage's standard scaffolder, kept bare so u4 can wire it later), Prettier and ESLint with Backstage's usual settings, the test runner with the 85% line-coverage check, and a GitHub Actions workflow that runs formatting, lint, tests and the coverage check on every pull request. u5 later extends this workflow; it does not create it. Done when a pull request with a failing check shows a failed status (FR10.1, NFR2, NFR6).

## B1: u2-plugin-backend

- **Stories:** US5.1, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US1.1, US1.2, US5.2 (backend side), in that order (story map).
- **Components:** ChangeWorkflow, AuditLog, DemoIdentity.
- **Contracts:** provides C1 (backend interface); consumes C2 through a stand-in for the guardrails server, checked against the C2 spec; provides the demo users and sign-in in C3.
- **Definition of Done:**
  - Tests were written before the code for each layer; plugin line coverage is at least 85% and CI is green.
  - Every rule in FR3 is enforced by the backend and covered by a test: reasons required, no self-approval, one decision per change, retry only for a failed change, refusals audited, and the decision order (claim, server call, change record, audit entry), including the recovery of a decided change with no audit entry and the 30-second claim release.
  - The backend reads actor and role from the Backstage sign-in identity of the custom demo sign-in, never from the request, and the auditor cannot write (proposed FR12.1).
  - The stand-in for the server passes a check against the C2 spec.
  - The requirements and stories are updated for the rule-side mockup changes and the FR11.2 conflict, each with its origin noted: auditor role (FR12.1), audited proposals with outcome proposed, service-scoped audit reads, open changes as pending plus failed, identity from the sign-in, and FR11.2 amended so only the plan and CI views show the server error (delivery-planning Q4: B).
- **Confidence hypothesis:** the approval rules, the ordered decision flow and the append-only audit log hold under concurrent and failing calls, and the custom demo sign-in gives the backend a trustworthy user and role. Shipping B1 proves the two worries the team named first (Q3: A, B).
- **Expected demo:** the full test suite and coverage report in CI, plus a short script that proposes, approves, rejects and retries against the stand-in server and prints the audit entries. No screens yet.

## B2: u1-data-and-server

- **Stories:** US6.1, US1.1, US1.2, US3.3.
- **Components:** GuardrailsServer, SeedDataGenerator.
- **Contracts:** provides C2 (the four tools) and the server side of C4 (health endpoint, start-up settings).
- **Definition of Done:**
  - Two runs of the generator with the same seed give identical output, byte for byte, and the counts are within 20% of 5 services, about 10 dependencies and 20 CI runs each (FR7.1, FR7.2).
  - The four tools answer over MCP on streamable HTTP and match the C2 spec; applying an already-applied upgrade succeeds as a no-op; the failure setting forces every tool to fail.
  - The same C2 spec check that B1's stand-in passes also passes against the real server, so the stand-in is shown to be true.
  - The server builds into its own container image.
- **Confidence hypothesis:** the stand-in used in B1 behaves like the real server, and the shared data-shape contract for the seed data works. A failure here is cheap to fix in B1's stand-in.
- **Expected demo:** start the server container and call each of the four tools; start it with the failure setting on and see every tool fail.

## B3: u3-plugin-ui

- **Stories:** US1.1, US1.2, US2.1, US2.2, US3.1, US3.2, US3.3, US4.1, US5.1, US5.2.
- **Components:** GuardrailsPluginUI.
- **Contracts:** consumes C1 through a stand-in for the backend interface, checked against the C1 spec; consumes the demo sign-in in C3 through a stand-in.
- **Definition of Done:**
  - Tests were written before the code for each layer; plugin line coverage stays at least 85% and CI is green.
  - The overview card, the Guardrails view (plan, CI failures, open changes, audit table), the change detail screen and the demo-user switch match the refined mockups, including empty and error states, with actions shown or disabled exactly as the backend's allowed actions say.
  - An automated accessibility scan reports no AA violations on each screen, and a keyboard-only walkthrough completes propose, approve and view the audit log (NFR3).
  - The mockups and interaction spec are updated where Contract Design changed them: the audit section no longer shows a server-unreachable error, and the open points on the audit Target column and the full string catalog are settled.
  - The stand-in for the backend passes a check against the C1 spec.
- **Confidence hypothesis:** the screens work with only the backend interface to rely on, and the UI never decides a rule. A mismatch with the real backend would show as a failing check against C1 in B1's tests or in B4.
- **Expected demo:** the screens in the plugin's own development harness against the stand-in, with the three demo users, plus the accessibility scan result.

## B4: u4-backstage-app

- **Stories:** US5.1, US6.2 (the app and catalog part).
- **Components:** none of its own; wiring of GuardrailsPluginUI, ChangeWorkflow, AuditLog and DemoIdentity.
- **Contracts:** consumes the registration, settings and sign-in in C3; the app side of C4 (readiness endpoint).
- **Definition of Done:**
  - Both plugins and the demo sign-in are registered in one running app; the guardrails server address comes from settings, with no address in code.
  - One catalog entry exists for each seeded service, and the names equal the seeded service names (open question in the contract summary).
  - With the guardrails server running, a signed-in demo user sees the upgrade plan for a seeded service on its catalog page and can propose and approve a change end to end.
  - The first measured loads show each view within 5 seconds at the 95th percentile of 20 loads (NFR1); the full measurement is repeated in B5.
- **Confidence hypothesis:** the units fit together as the contracts say. This is the first time the whole application is seen working, so it is where drift between the stand-ins and the real pieces would show.
- **Expected demo:** start the app and the server by hand, sign in as Sam, propose an upgrade, switch to Priya, approve it, and see the audit entry.

## B5: u5-compose-and-ci

- **Stories:** US6.2, US6.4.
- **Components:** none; build, run and verification files.
- **Contracts:** consumes C4 (health endpoints and start-up settings) from u1 and u4.
- **Definition of Done:**
  - One docker compose command starts the app, the plugins and the guardrails server with no other manual step, and the upgrade plan for a seeded service loads in the browser from a clean checkout (FR8.1).
  - The workflow from the setup step is extended to cover everything the compose run needs, and still fails a pull request on any formatting, lint, test or coverage failure (FR10.1, NFR2, NFR6).
  - The accessibility, keyboard-only and 5-second checks are run against the compose sample (NFR1, NFR3).
  - The failure setting of the guardrails server can be switched on in the compose run to demonstrate the failed-apply and retry path.
  - The change and audit stores survive a restart of the app container, or the sample states plainly that they do not (open item from the contract review).
- **Confidence hypothesis:** a stranger can bring the sample up with one command and see it work, and CI protects the team rules. Shipping B5 completes every must-have.
- **Expected demo:** from a clean checkout, run the compose command and walk the whole flow in the browser; open a pull request with a deliberate lint failure and see it blocked.

## B6: u6-minikube-run (should-have)

- **Stories:** US6.3.
- **Components:** none; Kubernetes run files and the documented command.
- **Contracts:** reuses C4.
- **Definition of Done:** a documented command brings the sample up on a local minikube cluster, and the same check as B5's one-command run succeeds (FR9.1). This Bolt may be dropped without affecting any other (scope item S9 is should-have).
- **Confidence hypothesis:** nothing in the sample is tied to docker compose, so hosting it elsewhere later is possible (the team's rule to keep that option open).
- **Expected demo:** the documented minikube command, then the upgrade plan loading in the browser.

## Carried Items

| Item | Where it is handled |
|---|---|
| Update requirements and stories for the five mockup changes and the FR11.2 conflict | B1 (rules) and B3 (screens), as part of their Definition of Done |
| Contract review findings R-01 to R-07 (server-down detection, idempotency of a re-run, error mapping, claim states, storage durability, owners and filters) | Functional Design of u2 and u1 resolves them before their Bolts build; B5 settles storage durability |
| Catalog service names equal seeded names; sign-in stand-in for u3 | B4, and Functional Design of u3 |
| Verification command for each Unit and batch checkpoint | Decided at the end of this stage (see the gate) |
