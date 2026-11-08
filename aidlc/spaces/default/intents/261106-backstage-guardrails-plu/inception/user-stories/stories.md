# User Stories

Personas are defined in `personas.md`. Requirement IDs (FR, NFR) are defined in `requirements.md`. Stories are grouped by workflow (Q3) and sized per capability (Q2). Non-functional requirements appear as acceptance criteria inside the stories they affect (Q4). Priorities follow the scope document: all Must Have except the minikube run.

## Group 1: View

### US1.1: See the upgrade plan for a service

**As** Sam (service owner), **I want** to see my service's dependencies with current and recommended versions on its catalog page, **so that** I know what to upgrade without leaving Backstage.

- **Priority:** Must Have
- **Requirements:** FR1.1, FR11.1, NFR1, NFR3, NFR4
- **INVEST:** Independent of writes; small; testable on seeded data.
- **Acceptance criteria:**
  - AC1.1.1: Given a seeded service, when Sam opens its catalog page, then every seeded dependency appears with its current and recommended version.
  - AC1.1.2: Given a service seeded with no dependencies, when Sam opens the page, then the view shows a message saying there are none.
  - AC1.1.3: Given the docker compose sample, when the view is loaded 20 times in a row in Chrome on a developer laptop, then the 95th percentile is at most 5 seconds.
  - AC1.1.4: Given the view, when an automated accessibility scan runs and a keyboard-only user tabs through it, then the scan reports no WCAG 2.1 AA violations and every control is reachable.

### US1.2: See failed CI runs and their causes

**As** Sam (service owner), **I want** to see my service's failed CI runs with the identified cause, **so that** I can tell what is blocking the service.

- **Priority:** Must Have
- **Requirements:** FR2.1, FR11.1, NFR1, NFR3
- **INVEST:** Independent of US1.1; small; testable on seeded data.
- **Acceptance criteria:**
  - AC1.2.1: Given a seeded service with failed runs, when Sam opens its page, then each failed run appears with its cause.
  - AC1.2.2: Given a service with no failed runs, when Sam opens the page, then the view shows a message saying there are none.
  - AC1.2.3: Given the view, when it is loaded 20 times in a row, then the 95th percentile is at most 5 seconds and an automated accessibility scan reports no AA violations.

## Group 2: Propose

### US2.1: Propose a dependency upgrade

**As** Sam (service owner), **I want** to propose an upgrade from a row of the upgrade plan, **so that** the change enters the approval flow.

- **Priority:** Must Have
- **Requirements:** FR1.2
- **INVEST:** Depends only on US1.1; small; testable.
- **Acceptance criteria:**
  - AC2.1.1: Given a row of the upgrade plan, when Sam chooses "Propose change", then a pending change for that dependency appears in the pending list with Sam recorded as proposer.
  - AC2.1.2: Given a pending change already exists for the same dependency, when Sam proposes it again, then a second pending change is created and both are listed.
  - AC2.1.3: Given a proposal was made, when the audit log is read, then an entry with outcome proposed, Sam as actor and no reason exists (P2).
  - AC2.1.4: Given a dependency already at its recommended version, when it is proposed by a direct call, then the call is refused with NOT_ELIGIBLE and nothing is written; given Alex (auditor), the call is refused with AUDITOR_READ_ONLY and an audit entry with outcome refused is written.

### US2.2: Propose a CI re-run

**As** Sam (service owner), **I want** to propose a re-run of a failed CI job, **so that** a retry goes through the same approval flow.

- **Priority:** Must Have
- **Requirements:** FR2.2
- **INVEST:** Depends only on US1.2; small; testable.
- **Acceptance criteria:**
  - AC2.2.1: Given a failed run, when Sam chooses "Propose re-run", then a pending re-run change appears in the pending list with Sam recorded as proposer.
  - AC2.2.2: Given a pending re-run exists for the same job, when Sam proposes it again, then a second pending change is created and both are listed.
  - AC2.2.3: Given a re-run was proposed, when the audit log is read, then an entry with outcome proposed exists; given a run that is no longer failed, a direct proposal is refused with NOT_ELIGIBLE and nothing is written.

## Group 3: Decide

### US3.1: Approve or reject a pending change with a reason

**As** Priya (platform engineer), **I want** to read what a pending change will do and approve or reject it with a reason, **so that** writes happen only with a visible, accountable decision.

- **Priority:** Must Have
- **Requirements:** FR3.1, FR3.2, FR3.4, FR3.5, NFR3
- **INVEST:** Depends on US2.1 or US2.2 for a change to decide; testable.
- **Acceptance criteria:**
  - AC3.1.1: Given pending or failed changes, when Priya opens the list, then the open changes (pending and failed, newest first, at most 200) each show what it will do, who proposed it and its status (P4).
  - AC3.1.2: Given a pending change proposed by Sam, when Priya approves it with a reason, then it is applied through the guardrails server, its status becomes applied, and an audit entry with outcome applied and her reason exists.
  - AC3.1.3: Given a pending change proposed by Sam, when Priya rejects it with a reason, then nothing is written to the guardrails server, its status becomes rejected, and an audit entry with outcome rejected exists.
  - AC3.1.4: Given the detail screen, when Priya submits Approve or Reject with an empty reason, then it is refused with a message and nothing is written.
  - AC3.1.5: Given the detail screen, when a keyboard-only user completes an approval, then every control is reachable and an automated accessibility scan reports no AA violations.

### US3.2: Keep decisions honest

**As** Priya (platform engineer), **I want** the system to stop self-approval and double decisions, **so that** the audit log reflects independent, single decisions.

- **Priority:** Must Have
- **Requirements:** FR3.3, FR3.7
- **INVEST:** Depends on US3.1; testable by direct backend calls.
- **Acceptance criteria:**
  - AC3.2.1: Given a change Sam proposed, when Sam views it, then Approve and Reject are disabled with a stated reason.
  - AC3.2.2: Given a change Sam proposed, when Sam calls the plugin backend directly to approve, reject or retry, then the call is refused, the change is unchanged, and an audit entry with outcome refused is written.
  - AC3.2.3: Given a change already approved by Priya, when a second demo user tries to approve or reject it, then the attempt is refused with a message and an audit entry with outcome refused exists for it.
  - AC3.2.4: Given Alex (auditor), when Alex views a change or calls the plugin backend directly to approve, reject or retry, then the actions are disabled with a stated reason or the call is refused with AUDITOR_READ_ONLY, the change is unchanged, and an audit entry with outcome refused and the reason as submitted is written (FR12.1, P1).
  - AC3.2.5: Given a decision whose reason is empty, or longer than 2,000 characters, when it is submitted, then it is refused (EMPTY_REASON or INVALID_INPUT) and nothing is written, for every user.

### US3.3: Retry a failed change

**As** Priya (platform engineer), **I want** to retry an approved write that failed, **so that** a temporary failure does not strand the change.

- **Priority:** Must Have
- **Requirements:** FR3.6
- **INVEST:** Depends on US3.1; testable by forcing the server to fail.
- **Acceptance criteria:**
  - AC3.3.1: Given the guardrails server forced to fail, when Priya approves a change, then its status is failed and an audit entry with outcome failed exists.
  - AC3.3.2: Given a failed change proposed by Sam, when Priya retries it with a reason, then it is attempted again; on success it becomes applied with an audit entry.
  - AC3.3.3: Given the server still failing, when Priya retries, then the change stays failed and a second audit entry with outcome failed is added.
  - AC3.3.4: Given an applied or rejected change, or a retry with an empty reason, when a retry is attempted, then it is refused (an empty reason writes nothing; a non-failed change is recorded as refused).

## Group 4: Audit

### US4.1: Read and filter the audit log

**As** Alex (auditor), **I want** a filterable, append-only table of every decision, **so that** I can trust and search what happened.

- **Priority:** Must Have
- **Requirements:** FR4.1, FR4.2, FR4.3, FR11.1, NFR1, NFR3, NFR5
- **INVEST:** Depends on US3.1 for entries; testable.
- **Acceptance criteria:**
  - AC4.1.1: Given decisions have been made, when Alex opens the audit log, then each entry shows time, actor, action, target service, outcome and reason.
  - AC4.1.2: Given the table, when Alex filters by time, actor, action or outcome, then only matching entries show.
  - AC4.1.3: Given the plugin's interface, when Alex looks for ways to edit or delete an entry, then none exist.
  - AC4.1.4: Given no entries yet, when Alex opens the log, then it shows a message saying so.
  - AC4.1.6: Given a service, when the log is read, then only that service's entries show, newest first, in pages of 20 by default and at most 100, and proposals appear with outcome proposed (P2, P3).
  - AC4.1.5: Given the log, when it is loaded 20 times in a row, then the 95th percentile is at most 5 seconds and an automated accessibility scan reports no AA violations.

## Group 5: Identity and resilience

### US5.1: Sign in as a demo user

**As** Sam, Priya or Alex, **I want** to sign in as one of several synthetic demo users, **so that** the audit log can show who acted.

- **Priority:** Must Have
- **Requirements:** FR5.1, FR5.2
- **INVEST:** Independent; testable.
- **Acceptance criteria:**
  - AC5.1.1: Given the running sample, when a viewer opens it, then at least three demo users are available (Sam, service owner; Priya, platform engineer; Alex, auditor) and the viewer can switch between them.
  - AC5.1.3: Given a request that carries another actor or role, or no valid demo identity, when it reaches the plugin backend, then it is served as the signed-in user, or refused with 401 and nothing written (P5).
  - AC5.1.2: Given a demo user acts (propose, approve, reject, retry or a refused attempt), when the audit log is read, then the entry names that demo user as actor.

### US5.2: Cope with an unreachable guardrails server

**As** Sam, **I want** a clear error and a way to retry when the guardrails server is down, **so that** I am not left with a blank or misleading page.

- **Priority:** Must Have
- **Requirements:** FR11.2
- **INVEST:** Independent; testable by stopping the server.
- **Acceptance criteria:**
  - AC5.2.1: Given the guardrails server is stopped, when any view loads, then it shows an error with a retry action.
  - AC5.2.2: Given the same state, when Sam looks at propose, approve, reject and retry actions, then all are disabled (including reject), and a direct write call is refused with SERVER_UNREACHABLE and writes nothing.
  - AC5.2.4: Given the same state, when Sam opens the changes list or the audit log, then they still load, because they do not depend on the server (FR11.2 as amended).
  - AC5.2.3: Given the server restarts, when Sam uses retry, then the data loads.

## Group 6: Run and deliver

### US6.1: Synthetic guardrails server and repeatable data

**As** Sam, **I want** a guardrails server and seeded data that behave the same every run, **so that** the sample is a dependable demo.

- **Priority:** Must Have
- **Requirements:** FR6.1, FR6.2, FR7.1, FR7.2, NFR7
- **INVEST:** Independent of the UI; testable.
- **Acceptance criteria:**
  - AC6.1.1: Given the running container, when the four operations (list upgrade plan, list failed CI runs, apply an upgrade, re-run a CI job) are called, then each returns data consistent with the seeded set.
  - AC6.1.2: Given the generator, when it runs, then it produces about 5 services with roughly 10 dependencies and 20 CI runs each, within 20%.
  - AC6.1.3: Given two runs with the same seed, when their outputs are compared, then they are identical byte for byte.
  - AC6.1.4: Given the plugin code, when it is inspected, then it reaches the guardrails tools only through the server.

### US6.2: Start everything with one command

**As** Sam, **I want** one command to start the whole sample with docker compose, **so that** I can see it working locally.

- **Priority:** Must Have
- **Requirements:** FR8.1
- **INVEST:** Depends on US6.1; testable from a clean checkout.
- **Acceptance criteria:**
  - AC6.2.1: Given a clean checkout, when the one command runs, then the catalog page, the plugin and the guardrails server come up with no other manual step.
  - AC6.2.2: Given it is up, when Sam opens a seeded service, then the upgrade plan loads in the browser.

### US6.3: Start the sample on minikube

**As** Sam, **I want** to start the sample on a local minikube cluster, **so that** I can see it run on Kubernetes too.

- **Priority:** Should Have
- **Requirements:** FR9.1
- **INVEST:** Depends on US6.2; testable.
- **Acceptance criteria:**
  - AC6.3.1: Given a local minikube cluster, when the documented command runs, then the sample comes up.
  - AC6.3.2: Given it is up, when the check from AC6.2.2 is repeated, then it succeeds.

### US6.4: Green CI with enforced quality

**As** Priya, **I want** GitHub Actions to run formatting, linting and tests on every pull request, **so that** quality is enforced before merge.

- **Priority:** Must Have
- **Requirements:** FR10.1, NFR2, NFR6
- **INVEST:** Independent; testable with a failing pull request.
- **Acceptance criteria:**
  - AC6.4.1: Given a pull request with a failing check, when CI runs, then it shows a failed status.
  - AC6.4.2: Given coverage below 85% of lines on the plugin code, when CI runs, then it fails.
  - AC6.4.3: Given a formatting or lint violation, when CI runs, then it fails.

## Dependencies and Critical Path

- US6.1 → US1.1, US1.2 → US2.1, US2.2 → US3.1 → US3.2, US3.3 → US4.1; US5.1 underlies every acted-on story; US6.2 and US6.4 package and verify the rest; US6.3 follows US6.2.
