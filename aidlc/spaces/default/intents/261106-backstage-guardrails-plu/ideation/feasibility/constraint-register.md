# Constraint Register

Upstream: `intent-statement`. Answers referenced as Q1–Q9 in `feasibility-questions.md`.

| ID | Type | Constraint | Source |
|----|------|------------|--------|
| C1 | Technical | TypeScript on Backstage's current backend and frontend systems | Q1 |
| C2 | Technical | The guardrails tools are provided by a synthetic MCP server in a separate container; the plugin backend calls it | Q2 |
| C3 | Technical | All data is synthetic, produced by a seeded generator that is repeatable | Q3 |
| C4 | Technical | Local only: docker compose is the primary runtime, minikube is optional | Q4, intent-statement |
| C5 | Technical | CI runs on GitHub Actions and must be green | intent-statement |
| C6 | Regulatory | No regulatory requirements; the audit log must still be append-only and show who approved what | Q5 |
| C7 | Organizational | A one-week target exists and is soft; the full scope is kept | Q6, Q8, Q9 |
| C8 | Organizational | No cloud accounts or services now; avoid local-only assumptions where cheap | Q7 |
| C9 | Quality | A test-coverage floor applies to plugin code; its number is not yet set | intent-statement |
