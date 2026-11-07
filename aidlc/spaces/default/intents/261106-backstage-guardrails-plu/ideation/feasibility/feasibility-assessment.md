# Feasibility Assessment

Upstream: `intent-statement` (ideation/intent-capture/intent-statement.md). Answers referenced as Q1–Q9 in `feasibility-questions.md`.

## Summary

The initiative is feasible as a local sample on synthetic data. The main pressure is the schedule, not the technology: a one-week target (Q8) against a full scope that the owner chose to keep, treating the week as soft (Q9).

## Technical Viability

| Intent-statement need | Viability | Basis |
|---|---|---|
| Plugin with frontend and backend on a catalog page | High | TypeScript on Backstage's current backend and frontend systems (Q1) |
| Guardrails tools (dependency-upgrade planning, CI triage) surfaced in the UI | Medium | The existing guardrails server is not available, so a synthetic one is built as a separate MCP server in its own container (Q2); its fidelity to the real tools is a hypothesis, not verified |
| Approval-gated write flow visible in the UI | Medium | Must be built in the stub, since no real flow exists locally (Q2) |
| Audit log visible in the UI | High | Append-only log showing who approved what (Q5) |
| One-command local run | High | docker compose is the primary path (Q4) |
| Optional minikube run | Medium | Extra effort and a second runtime to keep working (Q4) |
| Repeatable demo data | High | A seeded generator yields the same synthetic data every run (Q3) |
| Green CI on GitHub Actions and a coverage floor | High | Standard for the chosen stack; the coverage number is still undecided (intent-statement open point) |

## Risk Analysis

- Schedule: a one-week target (Q8) is tight for the full scope; mitigated by the decision that the week is soft (Q9). Hypothesis: the full scope fits in about a month.
- Stub fidelity: the synthetic MCP server may diverge from the real mcp-devplatform-guardrails tools, so the sample may not transfer. Hypothesis, to be checked when tool contracts are defined (Q2).
- Two runtimes: supporting minikube alongside compose raises effort and failure modes (Q4). Minikube is optional, so it can be dropped first.
- Portability: the owner wants the design free of local-only assumptions where cheap (Q7), which can conflict with schedule pressure.

## Compliance and Cloud

- No regulatory requirements apply, as all data is synthetic; the audit log is still append-only and shows who approved what (Q5).
- No AWS accounts or services are involved now (Q7).

## Verdict

Feasible. Proceed, with minikube as the first item to cut if the schedule slips.
