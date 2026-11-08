# Requirements

Sources: intent statement (`intent-statement.md`), scope document (`scope-document.md`, items S1–S9), team practices (`team-practices.md`), and answers Q1–Q16 in `requirements-analysis-questions.md`.

## Intent Analysis

Service owners and platform engineers should see dependency-upgrade planning and CI failure triage for a service inside its catalog page, and should be able to approve the resulting writes through a visible, audited flow, instead of leaving Backstage to use the guardrails tools (intent statement). The sample runs locally on synthetic data, with CI on GitHub Actions (intent statement; scope S7, S8).

## Functional Requirements

### FR1: Dependency-upgrade planning view (scope S1)

- FR1.1: The catalog page for a service shows its dependencies with the current version and the recommended version, taken from the guardrails server. Pass: for each seeded service, every seeded dependency appears with both versions.
- FR1.2: Each row of the upgrade plan offers a "Propose change" action that creates a pending change for that upgrade (Q2). Proposing again while a pending change for the same dependency exists is allowed and creates a separate pending change (Q12). Pass: after the action, a pending change for that dependency appears in the pending list with the proposer recorded and an audit entry with outcome proposed exists (P2); after a second proposal, two pending changes for it are listed. A dependency already at its recommended version cannot be proposed (the action is disabled and a direct call is refused with NOT_ELIGIBLE and writes nothing).

### FR2: CI failure triage view (scope S2)

- FR2.1: The catalog page shows the service's failed CI runs with the identified cause for each, from the guardrails server. Pass: each seeded failed run appears with its cause.
- FR2.2: Each failed run offers a "Propose re-run" action that creates a pending change to re-run that job (Q1: B). Proposing again for the same job while one is pending is allowed (Q12). Pass: after the action, a pending re-run change appears in the pending list with the proposer recorded and an audit entry with outcome proposed exists (P2); after a second proposal, two pending changes for that job are listed. A run that is no longer failed cannot be proposed (refused with NOT_ELIGIBLE, nothing written).

### FR3: Approval-gated write flow (scope S3)

- FR3.1: The page lists the open changes of the service (pending and failed, newest first, at most 200) with what each will do, who proposed it, and its status; the other statuses can be listed by a filter (updated in u2 Code Generation from the refined mockups, P4). Pass: every pending and failed change appears with these three items.
- FR3.2: A detail screen per change shows what it will do and offers Approve and Reject, each with a reason input; a reason is required for both (Q10). Pass: both actions are available on a pending change and on no other; submitting either with an empty reason is refused with a message and writes nothing; a submitted reason appears unchanged in the audit entry (FR4.2).
- FR3.3: A person cannot approve or reject a change they proposed; any other signed-in user can (Q3). The plugin backend enforces this, not only the UI (Q9). Pass: the proposer sees the actions disabled with a stated reason; a direct call to the plugin backend by the proposer to approve, reject or retry is refused with a message, the change is unchanged, and an audit entry with outcome refused is written (Q14); a different demo user can approve or reject.
- FR3.4: On Approve, the change is applied through the guardrails server and its status becomes applied. Pass: the status is applied and an audit entry with outcome applied exists.
- FR3.5: On Reject, the change is not applied and its status becomes rejected. Pass: no write reaches the guardrails server and an audit entry with outcome rejected exists.
- FR3.6: If an approved write fails to apply, the change is marked failed, the failure is recorded in the audit log, and it can be retried (Q6). Anyone but the proposer may retry, and the plugin backend enforces this (Q9). A retry requires a reason, as approve and reject do; retrying a change that is not in the failed state is refused; if the retry also fails, the change is marked failed again and another audit entry with outcome failed is written (Q15). Pass: with the server forced to fail, the status is failed, an audit entry with outcome failed exists, and a retry action is offered to a user other than the proposer; a retry with an empty reason is refused and writes nothing; a retry of an applied or rejected change is refused and recorded with outcome refused; with the server still failing, a retry leaves the status failed and adds a second failed entry.
- FR3.7: A second decision (approve or reject) on a change that has already been decided is refused with a message, and the attempt is recorded in the audit log with outcome refused (Q11). Pass: with two demo users deciding the same change, the first decision stands, the second receives a refusal message, and an audit entry with outcome refused exists for the second.

### FR4: Audit log (scope S4)

- FR4.1: The audit log is append-only: entries cannot be edited or deleted through the plugin. Pass: no edit or delete action exists in the UI or the plugin's interface.
- FR4.2: Every entry carries time, actor, action, target service, outcome (proposed, applied, rejected, failed or refused), and the approver's reason (Q5, Q10, Q11; proposals are audited with outcome proposed and no reason, P2). Pass: all six fields are present on each entry; a refused attempt records the reason as submitted. A decision submitted with an empty reason is not recorded at all (see FR3.2). A reason is at most 2,000 characters; a longer one is refused with INVALID_INPUT and nothing is written.
- FR4.3: The audit log of a service is shown as a table, newest first, filterable by time, actor, action and outcome and paged (default 20 entries, at most 100) (rough mockups Q4; P3; page defaults confirmed in u2 Functional Design). Pass: applying each filter shows only matching entries of that service.

### FR5: Identity

- FR5.1: People sign in as one of several synthetic demo users (Q4). Pass: at least three demo users exist (Sam, service owner; Priya, platform engineer; Alex, auditor) and the viewer can switch between them.
- FR5.2: The signed-in demo user is recorded as the actor on every proposal, approval, rejection, retry and refused attempt. The actor and role come only from the sign-in identity, never from the request (P5). Pass: each audit entry names the demo user who acted; a request that carries another actor or role is served as the signed-in user; a request without a valid demo identity is refused with 401 and writes nothing.

### FR12: Roles (proposed in the refined mockups, P1; added in u2 Code Generation)

- FR12.1: The auditor role is read only. An auditor can open every view but cannot propose, approve, reject or retry; the plugin backend enforces this, not only the UI. Pass: the auditor sees the four actions disabled with a stated reason; a direct call by the auditor to propose, approve, reject or retry is refused with AUDITOR_READ_ONLY, the change is unchanged, and an audit entry with outcome refused is written.

### FR6: Synthetic guardrails server (scope S5)

- FR6.1: A synthetic guardrails server runs in its own container (Q5 of intent capture) and offers four operations: list the upgrade plan for a service, list failed CI runs with causes for a service, apply a dependency upgrade, and re-run a CI job. Pass: each operation can be called against the running container and returns data consistent with the seeded set.
- FR6.2: The plugin backend reaches the guardrails tools only through this server. Pass: no plugin code reads the seeded data directly.

### FR7: Seeded data generator (scope S6)

- FR7.1: A generator produces about 5 services with roughly 10 dependencies and 20 CI runs each (Q8). Pass: the counts fall within 20% of these figures.
- FR7.2: Two runs with the same seed produce identical data. Pass: the outputs compare equal byte for byte.

### FR8: Local run (scope S7)

- FR8.1: One command starts the whole sample with docker compose. Pass: from a clean checkout, the command brings up the catalog page, the plugin and the guardrails server with no other manual step, and the upgrade plan for a seeded service loads in the browser.

### FR9: Minikube run (scope S9, should have)

- FR9.1: The sample can also be started on minikube. Priority is should have: built after the must-haves. Pass: a documented command brings the sample up on a local minikube cluster, and the same check as FR8.1 succeeds.

### FR10: Continuous integration (scope S8)

- FR10.1: GitHub Actions runs formatting, linting and the tests on every pull request. Pass: a pull request with a failing check shows a failed status.

### FR11: Empty and error states (Q16)

- FR11.1: When a service has no dependencies, no failed CI runs, no pending changes or no audit entries, the matching view shows a message saying so instead of an empty area. Pass: for a service seeded with none of an item, the view shows that message.
- FR11.2: When the guardrails server cannot be reached while a view loads, the views that need it (the upgrade plan and the failed CI runs) show an error with a retry action, and all propose, approve, reject and retry actions are disabled, including reject, which needs no server call (amended in u2 Functional Design; the changes list and the audit log keep loading because they do not depend on the server). Pass: with the server stopped, the plan and failed-run views show the error and retry, no write action is enabled, a direct write call is refused with SERVER_UNREACHABLE and writes nothing, the changes list and the audit log still load, and after the server restarts the retry action loads the data.

## Non-Functional Requirements

- NFR1 (performance): Each view renders within 5 seconds on the synthetic data (Q7). Measured from navigation to the view showing its data, on a developer laptop running the docker compose sample; pass when the 95th percentile of 20 consecutive loads of each view is at most 5 seconds.
- NFR2 (quality): At least 85% line coverage on the plugin code, with tests written before the code (team practices; project rule). Pass: the coverage report in CI shows 85% or more, and CI fails below it.
- NFR3 (accessibility): The screens meet WCAG 2.1 AA, including keyboard-only use and screen-reader labels (rough mockups Q7). Pass: an automated accessibility scan reports no AA violations on each screen, and a keyboard-only walkthrough completes propose, approve and view the audit log.
- NFR4 (platform): Desktop browsers only (rough mockups Q6). Pass: the flows in FR1 to FR4 work in the current stable releases of Chrome and Firefox on desktop.
- NFR5 (audit integrity): Audit entries are never altered after being written (see FR4.1).
- NFR6 (code style): Prettier and ESLint with Backstage's usual settings are enforced in CI (team practices). Pass: a formatting or lint violation fails the CI run.
- NFR7 (repeatability): The demo produces the same data on every run (see FR7.2).

## Constraints

- TypeScript on Backstage's current backend and frontend systems (feasibility Q1).
- The guardrails server is a separate container (feasibility Q2).
- Local only: docker compose primary, minikube optional (feasibility Q4).
- CI on GitHub Actions (intent statement).
- Branching by short-lived feature branches and pull requests (team practices).
- The one-week target is soft (feasibility Q6, Q8, Q9).
- Design choices must not block deploying to hosted environments later (team practices; feasibility Q7). Check: no hosted-environment address or local path is hard-coded outside configuration.

## Assumptions

- The synthetic guardrails server's behavior is an acceptable stand-in for the real tools (intent capture Q5, hypothesis, not verified).
- The visual style is custom branding with its own colors and logo on Backstage components (rough mockups Q5, Q8); the palette itself is not yet specified.

## Out of Scope

- Real company data, real cloud or production deployment (scope document).
- Any write beyond applying a dependency upgrade and re-running a CI job (Q1).

## Open Questions

- Where the plugin appears on the service page and how the four views are arranged (rough mockups Q1, Q2: not yet defined).
- Pull request review rules such as required approvals (raised in practices discovery; not yet answered).
- The branding palette and logo for the custom style.
