# Intent Capture — Questions

## Sources

- [desc] Initial description: "Build a Backstage plugin (frontend + backend) that surfaces the mcp-devplatform-guardrails tools — dependency-upgrade planning and CI failure triage — inside a service catalog page, with the existing approval-gated write flow and audit log visible in the UI. Sample project on synthetic data; local only (docker compose or minikube); CI via GitHub Actions."
- [scope] Workflow-selected scope: `mvp`.

## Q1. [Product] What problem does this plugin solve?

Why we ask: it fixes the problem statement everything else is traced to.

- A. Platform/dev teams must leave Backstage to use the guardrails tools, so dependency-upgrade and CI-triage insight is not where service owners look
- B. Guardrail actions (writes) happen without a visible approval and audit trail for service owners
- C. Both A and B
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Product] Who is the primary user of the plugin?

Why we ask: it decides which view and actions the catalog page puts first.

- A. Service owners / developers who own a catalog entity
- B. Platform engineers who operate the guardrails and approve writes
- C. Both equally
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q3. [Product] What does success look like for this sample project?

Why we ask: success metrics must be measurable, so they drive acceptance tests.

- A. A demo on synthetic data: a catalog page shows an upgrade plan and a CI triage result, a write is approved in the UI, and the audit log shows it
- B. A, plus all of it runs from one local command and CI is green on GitHub Actions
- C. B, plus a stated test-coverage floor for the plugin code
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q4. [Product] Why is this being built now?

Why we ask: the trigger shapes how polished versus exploratory the first version is.

- A. Demonstrate/learn: a reference sample for integrating MCP guardrails into Backstage
- B. Prototype to be adopted by a real platform team later
- C. Personal/portfolio project
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q5. [Developer] What is the "existing" guardrails server and approval flow the plugin builds on?

Why we ask: the plugin must call the mcp-devplatform-guardrails tools and its approval-gated write flow; we need to know what already exists and what we may change.

- A. It already exists in another repo; the plugin only consumes it and must not change it
- B. It exists in another repo and may be changed as part of this work
- C. It must be created or stubbed here (synthetic) because it is not available locally
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q6. [Product] Who decides scope and priority, and who else has a stake?

Why we ask: the stakeholder map records decision-makers versus influencers.

- A. Just me (single owner and decision-maker); no other stakeholders
- B. Me as decision-maker, with a platform team and service owners as influencers
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q7. [Product] Is there a reporting or communication cadence?

Why we ask: it decides whether a status or demo artifact is needed.

- A. None
- B. A demo or write-up at the end
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q8. [Product] What should this first version leave out?

Why we ask: the plan (mvp) is already chosen; this fixes what the product itself will not do.

- A. Real company data, real cloud/production deployment, and authentication beyond Backstage's local guest/default
- B. A, plus any write action beyond the existing approval-gated flow
- C. Nothing is excluded beyond what the description says (local only, synthetic data)
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Consolidated Summary Confirmation

- Problem: teams must leave Backstage to use the guardrails tools (Q1: A)
- Primary users: service owners and platform engineers equally (Q2: C)
- Success: synthetic-data demo, one-command local run, green GitHub Actions CI, plus a stated coverage floor (Q3: C)
- Trigger: demonstrate/learn, a reference sample (Q4: A)
- Existing guardrails server and approval flow: created/stubbed here with synthetic data (Q5: C)
- Stakeholders: just you (Q6: A); no reporting cadence (Q7: A)
- Out of scope: nothing beyond local-only and synthetic data (Q8: C)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
