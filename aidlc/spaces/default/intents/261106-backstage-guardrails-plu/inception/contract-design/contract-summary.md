# Contract Summary

Sources: `unit-of-work.md` and `unit-of-work-dependency.md` (units and edges), `components.md` (entities, decision order, allowed actions), `requirements.md` (FR1–FR11, NFR1) and answers Q1–Q8 in `contract-design-questions.md`. Changes that come from the refined mockups and are not yet in `requirements.md` are marked **[P1]–[P5]**: P1 auditor role (proposed FR12.1), P2 audited proposals with outcome `proposed`, P3 service-scoped audit log, P4 open changes = pending plus failed, P5 actor and role from the sign-in identity (Q1: A).

No unit is consumed from outside the system, so there is no public API beyond the four contracts below.

## Contracts

| # | Provider Unit | Consumer | Mechanism | Owner |
|---|---|---|---|---|
| C1 | u2-plugin-backend | u3-plugin-ui | Synchronous REST/JSON over HTTP, on the plugin's own path | u2-plugin-backend |
| C2 | u1-data-and-server | u2-plugin-backend | MCP over streamable HTTP; four tools called by name | u1-data-and-server |
| C3 | u2-plugin-backend, u3-plugin-ui | u4-backstage-app | Shared schema: plugin registration, settings keys and the demo sign-in provider | u4-backstage-app (settings, registration) and u2-plugin-backend (demo users) |
| C4 | u1-data-and-server, u4-backstage-app | u5-compose-and-ci | Shared schema: health endpoints and the server's start-up settings | u1-data-and-server |

The seed data set inside u1 (generator to server) is not a contract here: the dependency document leaves it to Functional Design.

## C1: Backend interface (u2 to u3)

Base path `/api/guardrails`. The acting user and role come from the sign-in identity on every request and are never read from the body or the query (P5). Every list item carries `allowedActions` (the UI shows them and never decides a rule). The reason for a disabled action follows this precedence: `SERVER_UNREACHABLE`, then `AUDITOR_READ_ONLY`, then `PROPOSER_CANNOT_DECIDE`, then the state reasons `NOT_PENDING` and `NOT_FAILED`.

When the guardrails server is down, only the plan and CI reads fail (`503`, code `SERVER_UNREACHABLE`). The changes and audit reads keep working, and every write action is listed as not allowed with the reason `SERVER_UNREACHABLE` (Q2: A).

```yaml
openapi: 3.0.3
info:
  title: Guardrails plugin backend interface
  description: Owned by u2-plugin-backend. Consumers ignore unknown fields. No version in the path.
  version: "1"
servers:
  - url: /api/guardrails
paths:
  /me:
    get:
      summary: The signed-in demo user, for display only
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/DemoUser" } } } }
  /services/{service}/plan:
    get:
      summary: Upgrade plan for a service (FR1.1)
      parameters: [ { $ref: "#/components/parameters/service" } ]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/PlanList" } } } }
        "503": { $ref: "#/components/responses/ServerUnreachable" }
  /services/{service}/ci-runs:
    get:
      summary: Failed CI runs with causes (FR2.1)
      parameters: [ { $ref: "#/components/parameters/service" } ]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/CiRunList" } } } }
        "503": { $ref: "#/components/responses/ServerUnreachable" }
  /services/{service}/changes:
    get:
      summary: Changes for a service; open means pending plus failed [P4] (FR3.1)
      parameters:
        - { $ref: "#/components/parameters/service" }
        - { name: status, in: query, required: false, schema: { type: string, enum: [open, pending, applied, rejected, failed] }, description: "Default open." }
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/ChangeList" } } } }
    post:
      summary: Propose a change; writes an audit entry with outcome proposed [P2] (FR1.2, FR2.2)
      parameters: [ { $ref: "#/components/parameters/service" } ]
      requestBody:
        required: true
        content: { application/json: { schema: { $ref: "#/components/schemas/ProposeRequest" } } }
      responses:
        "201": { description: Created, content: { application/json: { schema: { $ref: "#/components/schemas/Change" } } } }
        "403": { $ref: "#/components/responses/Refused" }
        "404": { $ref: "#/components/responses/NotFound" }
  /changes/{changeId}:
    get:
      summary: One change, for the detail screen (FR3.2)
      parameters: [ { $ref: "#/components/parameters/changeId" } ]
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/Change" } } } }
        "404": { $ref: "#/components/responses/NotFound" }
  /changes/{changeId}/approve:
    post:
      summary: Approve and apply through the guardrails server (FR3.4)
      parameters: [ { $ref: "#/components/parameters/changeId" } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/DecisionRequest" } } } }
      responses:
        "200": { description: "Decision made. The change status is applied, or failed when the server failed or timed out (FR3.6).", content: { application/json: { schema: { $ref: "#/components/schemas/Change" } } } }
        "400": { $ref: "#/components/responses/EmptyReason" }
        "403": { $ref: "#/components/responses/Refused" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/RefusedState" }
  /changes/{changeId}/reject:
    post:
      summary: Reject without calling the guardrails server (FR3.5)
      parameters: [ { $ref: "#/components/parameters/changeId" } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/DecisionRequest" } } } }
      responses:
        "200": { description: Rejected, content: { application/json: { schema: { $ref: "#/components/schemas/Change" } } } }
        "400": { $ref: "#/components/responses/EmptyReason" }
        "403": { $ref: "#/components/responses/Refused" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/RefusedState" }
  /changes/{changeId}/retry:
    post:
      summary: Retry a failed change (FR3.6)
      parameters: [ { $ref: "#/components/parameters/changeId" } ]
      requestBody: { required: true, content: { application/json: { schema: { $ref: "#/components/schemas/DecisionRequest" } } } }
      responses:
        "200": { description: "Applied, or failed again with another failed audit entry.", content: { application/json: { schema: { $ref: "#/components/schemas/Change" } } } }
        "400": { $ref: "#/components/responses/EmptyReason" }
        "403": { $ref: "#/components/responses/Refused" }
        "404": { $ref: "#/components/responses/NotFound" }
        "409": { $ref: "#/components/responses/RefusedState" }
  /services/{service}/audit:
    get:
      summary: Audit entries for a service, newest first, filtered and paged [P3] (FR4.3). Read only; there is no write, edit or delete (FR4.1).
      parameters:
        - { $ref: "#/components/parameters/service" }
        - { name: from, in: query, required: false, schema: { type: string, format: date-time } }
        - { name: to, in: query, required: false, schema: { type: string, format: date-time } }
        - { name: actor, in: query, required: false, schema: { type: string } }
        - { name: action, in: query, required: false, schema: { $ref: "#/components/schemas/AuditAction" } }
        - { name: outcome, in: query, required: false, schema: { $ref: "#/components/schemas/Outcome" } }
        - { name: page, in: query, required: false, schema: { type: integer, minimum: 1, default: 1 } }
        - { name: pageSize, in: query, required: false, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
      responses:
        "200": { description: OK, content: { application/json: { schema: { $ref: "#/components/schemas/AuditPage" } } } }
components:
  parameters:
    service: { name: service, in: path, required: true, schema: { type: string }, description: serviceName }
    changeId: { name: changeId, in: path, required: true, schema: { type: string } }
  responses:
    ServerUnreachable:
      description: The guardrails server did not answer within the read timeout
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    EmptyReason:
      description: Reason is empty. Nothing is written, not even an audit entry (FR3.2). Code EMPTY_REASON.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    Refused:
      description: The signed-in user may not do this. The change is unchanged and an audit entry with outcome refused is written (FR3.3). Codes SELF_DECISION, AUDITOR_READ_ONLY.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    RefusedState:
      description: The change is in the wrong state. An audit entry with outcome refused is written (FR3.7). Codes ALREADY_DECIDED, NOT_FAILED.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
    NotFound:
      description: Unknown service or change. Code NOT_FOUND. Nothing is written.
      content: { application/json: { schema: { $ref: "#/components/schemas/Error" } } }
  schemas:
    Role: { type: string, enum: [service-owner, platform-engineer, auditor] }
    DemoUser:
      type: object
      required: [userId, name, role]
      properties: { userId: { type: string }, name: { type: string }, role: { $ref: "#/components/schemas/Role" } }
    ActionName: { type: string, enum: [propose, approve, reject, retry] }
    AllowedAction:
      type: object
      required: [action, allowed]
      properties:
        action: { $ref: "#/components/schemas/ActionName" }
        allowed: { type: boolean }
        reason: { type: string, enum: [SERVER_UNREACHABLE, AUDITOR_READ_ONLY, PROPOSER_CANNOT_DECIDE, NOT_PENDING, NOT_FAILED], description: "Present when allowed is false." }
    PlanItem:
      type: object
      required: [dependencyKey, name, currentVersion, recommendedVersion, allowedActions]
      properties:
        dependencyKey: { type: string }
        name: { type: string }
        currentVersion: { type: string }
        recommendedVersion: { type: string }
        allowedActions: { type: array, items: { $ref: "#/components/schemas/AllowedAction" } }
    PlanList:
      type: object
      required: [service, items]
      properties: { service: { type: string }, items: { type: array, items: { $ref: "#/components/schemas/PlanItem" } } }
    CiRunItem:
      type: object
      required: [runKey, runNumber, status, cause, allowedActions]
      properties:
        runKey: { type: string }
        runNumber: { type: integer }
        status: { type: string }
        cause: { type: string }
        allowedActions: { type: array, items: { $ref: "#/components/schemas/AllowedAction" } }
    CiRunList:
      type: object
      required: [service, items]
      properties: { service: { type: string }, items: { type: array, items: { $ref: "#/components/schemas/CiRunItem" } } }
    ChangeStatus: { type: string, enum: [pending, applied, rejected, failed], description: "deciding is internal and never returned; a claim older than 30 seconds is released to failed with failureMessage Interrupted." }
    Change:
      type: object
      required: [changeId, kind, service, target, proposedBy, status, proposedAt, allowedActions]
      properties:
        changeId: { type: string }
        kind: { type: string, enum: [upgrade, rerun] }
        service: { type: string }
        target: { type: string, description: "dependencyKey for upgrade, runKey for rerun" }
        summary: { type: string, description: "What the change will do, in words" }
        proposedBy: { $ref: "#/components/schemas/DemoUser" }
        status: { $ref: "#/components/schemas/ChangeStatus" }
        decidedBy: { $ref: "#/components/schemas/DemoUser" }
        decisionReason: { type: string }
        failureMessage: { type: string }
        proposedAt: { type: string, format: date-time }
        decidedAt: { type: string, format: date-time }
        allowedActions: { type: array, items: { $ref: "#/components/schemas/AllowedAction" } }
    ChangeList:
      type: object
      required: [service, items]
      properties: { service: { type: string }, items: { type: array, items: { $ref: "#/components/schemas/Change" } } }
    ProposeRequest:
      type: object
      required: [kind, target]
      properties: { kind: { type: string, enum: [upgrade, rerun] }, target: { type: string } }
    DecisionRequest:
      type: object
      required: [reason]
      properties: { reason: { type: string, minLength: 1, description: "Stored exactly as submitted in the audit entry." } }
    AuditAction: { type: string, enum: [propose, approve, reject, retry] }
    Outcome: { type: string, enum: [proposed, applied, rejected, failed, refused] }
    AuditEntry:
      type: object
      required: [entryId, time, actor, action, service, target, outcome]
      properties:
        entryId: { type: string }
        time: { type: string, format: date-time }
        actor: { $ref: "#/components/schemas/DemoUser" }
        action: { $ref: "#/components/schemas/AuditAction" }
        service: { type: string }
        target: { type: string }
        outcome: { $ref: "#/components/schemas/Outcome" }
        reason: { type: string, description: "Absent for a proposal; the submitted reason otherwise." }
        changeId: { type: string }
    AuditPage:
      type: object
      required: [items, page, pageSize, total]
      properties:
        items: { type: array, items: { $ref: "#/components/schemas/AuditEntry" } }
        page: { type: integer }
        pageSize: { type: integer }
        total: { type: integer }
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties:
            code: { type: string, enum: [EMPTY_REASON, SELF_DECISION, AUDITOR_READ_ONLY, ALREADY_DECIDED, NOT_FAILED, SERVER_UNREACHABLE, NOT_FOUND] }
            message: { type: string }
```

Behavior the spec cannot show:

- Decision order inside the backend is the one in `components.md`: atomic claim, then (for approve and retry) the guardrails server call, then the change record, then the audit entry. A server failure or timeout is not an HTTP error for the caller: the response is `200` with the change in status `failed`.
- An empty or blank `reason` returns `400 EMPTY_REASON` and writes nothing (FR3.2). Every other refusal writes an audit entry with outcome `refused` and the reason as submitted.
- Duplicate proposals for the same target are allowed and create separate pending changes (FR1.2, FR2.2).

## C2: Guardrails server tool interface (u1 to u2)

The server is an MCP server on streamable HTTP at `/mcp`. The backend is the only client (FR6.2) and calls four tools by name. The server holds no approval state: it does what it is asked. Applied upgrades live in the server's memory and are lost on restart, when the data is loaded again from the seed. A tool failure returns an MCP tool result with `isError: true`; the `code` and a fixed `message` travel in the result's structured content, and the same message is the text content (u1 Code Generation, from the Functional Design change list). The error codes are UNKNOWN_SERVICE, UNKNOWN_DEPENDENCY, UNKNOWN_RUN, INVALID_INPUT (a required input is missing, empty or not text), FORCED_FAILURE and INTERNAL_ERROR (an unexpected failure inside the server); a caller treats any code it does not recognize as a failed call. A call that gets no answer within the timeout counts as the same failure on the backend side. The machine-readable copy of this section is `packages/guardrails-server/contract/c2-tools.json`, owned by u1.

```yaml
mcp-tools:
  endpoint: /mcp
  transport: streamable-http
  tools:
    - name: list_upgrade_plan
      kind: read
      timeout_ms: 3000
      input:  { service: string }
      output: { service: string, dependencies: [ { dependencyKey: string, name: string, currentVersion: string, recommendedVersion: string } ] }
      errors: [UNKNOWN_SERVICE, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR]
    - name: list_failed_ci_runs
      kind: read
      timeout_ms: 3000
      input:  { service: string }
      output: { service: string, runs: [ { runKey: string, runNumber: integer, status: string, cause: string } ] }
      errors: [UNKNOWN_SERVICE, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR]
    - name: apply_dependency_upgrade
      kind: write
      timeout_ms: 10000
      input:  { service: string, dependencyKey: string }
      output: { dependencyKey: string, currentVersion: string, result: "applied | already-current" }
      idempotent: true   # already at the recommended version succeeds as a no-op (result already-current)
      errors: [UNKNOWN_SERVICE, UNKNOWN_DEPENDENCY, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR]
    - name: rerun_ci_job
      kind: write
      timeout_ms: 10000
      input:  { service: string, runKey: string }
      output: { runKey: string, result: "rerun-started" }
      idempotent: true   # safe to repeat: a repeat returns the same result and changes nothing more (replaces the earlier "not idempotent"; review finding R-03)
      errors: [UNKNOWN_SERVICE, UNKNOWN_RUN, INVALID_INPUT, FORCED_FAILURE, INTERNAL_ERROR]
  retries: none   # the user retries from the UI (Q8: A)
  failure_mode:
    description: Start-up setting, not a tool. With it on, every tool returns FORCED_FAILURE. Tests switch it by restarting the container.
    setting: GUARDRAILS_FAILURE_MODE   # on | off, default off
```

## C3: Wiring between the plugins and the host app (u2 and u3 to u4)

Names below are the working names for Functional Design to confirm. The host app holds wiring and settings only, with no business rules and no address written in code.

```yaml shared-schema
registration:
  backend_plugin_id: guardrails            # package: plugin-guardrails-backend (u2), added to the Backstage backend
  frontend_plugin_id: guardrails           # package: plugin-guardrails (u3), card and view on the service page
settings:   # app-config keys read by u2; u4 supplies the values and may override them per environment
  guardrails.server.url:            { type: string,  required: true,  note: "no default in code; compose and minikube supply it" }
  guardrails.server.readTimeoutMs:  { type: integer, default: 3000 }
  guardrails.server.writeTimeoutMs: { type: integer, default: 10000 }
sign_in:
  provider_id: demo                        # custom Backstage sign-in provider owned by u2 (Q5: A)
  behavior: "signs the browser in as the chosen demo user without a password; the UI then reloads its data"
  identity: "Backstage user entity ref, user:default/<userId>; the backend maps it to a role from the demo user list"
  users:
    - { userId: sam,   name: Sam,   role: service-owner }
    - { userId: priya, name: Priya, role: platform-engineer }
    - { userId: alex,  name: Alex,  role: auditor }
catalog:
  note: "u4 declares one catalog entry per seeded service; the names must equal the serviceName values in the seed data set (see open questions)"
```

## C4: Health and start-up settings (u1 and u4 to u5)

```yaml shared-schema
guardrails_server:
  health: { method: GET, path: /healthz, ok: "200 {\"status\":\"ok\"}" }
  settings:
    GUARDRAILS_SEED:         { type: string, note: "same seed gives the same data (FR7.2)" }
    GUARDRAILS_FAILURE_MODE: { type: "on | off", default: off }
    PORT:                    { type: integer }
backstage_app:
  health: { method: GET, path: /.backstage/health/v1/readiness }
compose:
  rule: "u5 starts the server first, then the app once /healthz answers; the check in FR8.1 is the upgrade plan of a seeded service loading in the browser"
```

## Contract Ownership Rules

- **Owner:** the provider unit owns each spec and keeps it in its own directory: u1 owns C2 and C4, u2 owns C1 and the demo users in C3, u4 owns the settings and registration in C3 (Q6: A).
- **Stand-ins:** u2 tests its stand-in for the server against C2, and u3 tests its stand-in for the backend against C1. A stand-in that disagrees with the spec fails the consumer's test, so drift is caught before u4 joins the pieces.
- **Additive changes are safe:** consumers ignore unknown fields, and a provider may add fields, resources, tools or error codes at any time.
- **Breaking changes:** there are no version numbers (Q7: A). A breaking change updates provider, consumer and spec in the same pull request, and the consumer's contract test must pass in that pull request.
- **Identity:** actor and role are never part of any request body or query. The backend reads them from the sign-in identity [P5].
- **Timeouts and retries:** reads time out after 3 seconds, writes after 10 seconds, and nothing is retried automatically (Q8: A). The 10-second write timeout stays below the 30-second claim release.

## Open Questions

| Contract | Question | Blocks |
|---|---|---|
| C1 | `requirements.md` and `stories.md` do not yet hold P1–P5 (auditor role as FR12.1, audited proposals, service-scoped audit log, open changes, identity from sign-in). They must be updated so the contract and the requirements agree (Q1: A). | u2, u3 (traceability only) |
| C1 | The default page size of 20 for the audit table is a proposal; the mockups do not state one. Confirm in Functional Design. | u2, u3 |
| C1 | The audit table's Target column origin and the full text catalog for disabled reasons are open points from the refined mockups; the reason codes are fixed here, their wording is not. | u3 |
| C1 | The mockup's audit-section "server unreachable" error contradicts Q2: A and must be removed from the mockups or the interaction spec. | u3 |
| C2, C3 | The catalog service names in u4 must equal the seeded names, but the generator's output shape is not fixed until Functional Design. Does u4 read the generator or list the names in its own settings? | u4, u1 |
| C3 | The package names and the exact mechanism of the custom demo sign-in provider are working names; confirm in Functional Design. | u2, u4 |
| C3 | The demo sign-in lives in u2 while the UI's user switch is in u3; u3's stand-in for the sign-in is not specified yet. | u3 |
