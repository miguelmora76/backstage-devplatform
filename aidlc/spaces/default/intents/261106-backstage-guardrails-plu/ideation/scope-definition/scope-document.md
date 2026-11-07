# Scope Document

Upstream: `intent-statement`, `feasibility-assessment`, `constraint-register`. Answers referenced as Q1–Q6 in `scope-definition-questions.md`.

## Minimum Viable Scope

No smaller slice than the full must-have set delivers the value the intent statement describes (Q4). The minimum is therefore everything listed under In Scope (Must have).

## In Scope

### Must have

| ID | Capability | Source |
|----|-----------|--------|
| S1 | A dependency-upgrade planning view on the service catalog page | Q1 |
| S2 | A CI failure triage view on the service catalog page | Q1 |
| S3 | The approval-gated write flow, usable from the UI | Q1 |
| S4 | A visible audit log of those writes, append-only and showing who approved what | Q1, constraint C6 |
| S5 | A synthetic guardrails MCP server in its own container (the existing server is not available locally) | Q2, constraint C2 |
| S6 | A seeded, repeatable synthetic data generator | Q2, constraint C3 |
| S7 | One-command local run with docker compose | Q2, constraint C4 |
| S8 | GitHub Actions CI that is green, with a stated test-coverage floor on plugin code | Q2, constraint C5, C9 |

### Should have

| ID | Capability | Source |
|----|-----------|--------|
| S9 | A minikube run, built once the must-haves are done | Q3, constraint C4 |

## Out of Scope

- Real company data, real cloud or production deployment: the project is a local sample on synthetic data (intent statement; constraints C4, C8).
- Anything beyond the capabilities above has not been requested; no further exclusions were stated in the intent statement.

## Sequencing and Deadlines

- Sequencing preference is not yet defined; it is left for delivery planning (Q5).
- No deadline is tied to a specific capability; the one-week target from feasibility is soft for all capabilities (Q6, constraint C7).

## Open Points

- The numeric test-coverage floor is still undecided (risk-log issue I1 in `raid-log.md`); it is set in a later stage.
- Sequencing preference (Q5) is undecided.
