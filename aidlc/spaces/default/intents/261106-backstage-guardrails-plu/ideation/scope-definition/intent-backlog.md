# Intent Backlog

Upstream: `intent-statement`, `feasibility-assessment`, `constraint-register`. Capabilities S1–S9 are defined in `scope-document.md`. Answers referenced as Q1–Q6 in `scope-definition-questions.md`.

## Prioritized Proto-Units (MoSCoW)

Priority is MoSCoW as chosen in Q1–Q3. Order inside a priority is not ranked, because sequencing is undecided (Q5).

| Proto-Unit | Covers | Priority | Depends on | Source |
|-----------|--------|----------|-----------|--------|
| P1 Synthetic guardrails MCP server | S5 | Must | P2 | Q2 |
| P2 Seeded data generator | S6 | Must | none | Q2 |
| P3 Upgrade planning and CI triage views | S1, S2 | Must | P1 | Q1 |
| P4 Approval-gated write flow | S3 | Must | P1 | Q1 |
| P5 Audit log view | S4 | Must | P4 | Q1 |
| P6 Local run with docker compose | S7 | Must | P1, P3 | Q2 |
| P7 GitHub Actions CI and coverage floor | S8 | Must | P1, P3 | Q2 |
| P8 Minikube run | S9 | Should | P6 | Q3 |

## Dependencies Between Capabilities

- The views and the write flow need the synthetic server, which needs generated data (P2 → P1 → P3, P4).
- The audit log needs the write flow to have something to record (P4 → P5).
- The local run and CI package what the others build (P6, P7 after P1, P3).
- The minikube run reuses what the compose run proves (P6 → P8).

## Value Stream

Synthetic data is generated, the synthetic server exposes the tools, the plugin shows upgrade plans and CI triage on the catalog page, a person approves a write in the UI, and the audit log shows it. This matches the demo in the intent statement's success metrics.

## Sequencing

Not yet defined (Q5); left for delivery planning. No capability has its own deadline (Q6).
