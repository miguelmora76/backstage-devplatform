# Intent Statement

## Problem Statement

Platform and service teams have to leave Backstage to use the mcp-devplatform-guardrails tools, so dependency-upgrade planning and CI failure triage insight is not where service owners look. [Q1] [desc]

The request is for a Backstage plugin, with a frontend and a backend, that brings these two tools into a service catalog page. [desc]

## Target Customer

- Service owners and developers who own a catalog entity, and platform engineers who operate the guardrails and approve writes, are equally primary users. [Q2]
- The approval-gated write flow and the audit log are to be visible to them in the UI. [desc]

## Success Metrics

- A demo on synthetic data in which the catalog page shows dependency-upgrade planning and CI failure triage results. [Q3] [desc]
- A write is approved through the approval-gated flow in the UI and the audit log shows it. [Q3] [desc]
- The whole sample runs locally from one command (docker compose or minikube). [Q3] [desc]
- CI is green on GitHub Actions. [Q3] [desc]
- A stated test-coverage floor applies to the plugin code; its numeric value is set in a later stage. [Q3]

## Initiative Trigger

- The initiative exists to demonstrate and learn: a reference sample for integrating MCP guardrails into Backstage. [Q4]

## Initial Scope Signal

- Workflow-selected scope: `mvp`. [scope]
- Product boundary: nothing is excluded beyond what the description already limits, namely a sample project, synthetic data, and local only. [Q8] [desc]
- The "existing" guardrails server and its approval flow are not available locally, so a synthetic version is created or stubbed within this project. [Q5]

## Assumptions & Open Questions

None.
