# User Flow

Upstream: `intent-statement`, `scope-document`, `intent-backlog`. Screens are defined in `wireframes.md`. Answers referenced as Q1–Q8 in `rough-mockups-questions.md`.

## Core Flow (happy path)

```
Open a service in the catalog
        |
        v
Screen 1: see upgrade plan and CI triage
        |
        v
Pick a pending change --> Screen 2: read what it will do
        |
        +-- Approve --> change is applied --> audit entry added
        |
        +-- Reject  --> change is not applied --> audit entry added
        |
        v
Screen 3: audit log shows time, actor, action, outcome
```

## Branches and Recovery

- No pending changes: Screen 1 shows an empty pending list; nothing to approve.
- The synthetic guardrails server is unreachable: the views show an error state with a way to retry; no write can be approved.
- A person leaves Screen 2 without choosing: the change stays pending and unchanged.

## Notes

- The page entry point and the arrangement of views on Screen 1 are undecided (Q1, Q2) and are fixed in the refined mockups.
- The detail screen with Approve and Reject follows Q3; the audit log table follows Q4.
