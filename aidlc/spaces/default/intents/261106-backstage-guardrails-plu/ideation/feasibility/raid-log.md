# RAID Log

Upstream: `intent-statement`. Answers referenced as Q1–Q9 in `feasibility-questions.md`.

## Risks

| ID | Risk | Likelihood | Impact | Mitigation | Source |
|----|------|-----------|--------|------------|--------|
| R1 | Full scope does not fit the one-week target | High | Medium | Week is soft; cut minikube first | Q8, Q9 |
| R2 | Synthetic MCP server diverges from the real guardrails tools | Medium | Medium | Define tool contracts explicitly in a later stage | Q2 |
| R3 | Maintaining two runtimes (compose and minikube) costs more than expected | Medium | Low | Minikube stays optional | Q4 |

## Assumptions

| ID | Assumption | Status | Source |
|----|-----------|--------|--------|
| A1 | The full scope fits in about a month | Hypothesis, unconfirmed | Q9 |
| A2 | A synthetic stub is an acceptable stand-in for the existing guardrails server | Hypothesis, unconfirmed | Q2, intent-statement |

## Issues

| ID | Issue | Source |
|----|-------|--------|
| I1 | The numeric test-coverage floor is still undecided | intent-statement |
| I2 | The existing guardrails server is not available locally | intent-statement |

## Dependencies

| ID | Dependency | Source |
|----|-----------|--------|
| D1 | Backstage's current backend and frontend systems | Q1 |
| D2 | Docker (compose) on the local machine; minikube if used | Q4 |
| D3 | GitHub Actions for CI | intent-statement |
