# Wireframes

Upstream: `intent-statement`, `scope-document`, `intent-backlog`. Answers referenced as Q1–Q8 in `rough-mockups-questions.md`.

These are low-fidelity sketches. Where the page entry point and the arrangement of the four views are undecided (Q1, Q2), the sketch shows the four views inside the service catalog page without fixing how they are arranged; that choice is made in the refined mockups. Style is the owner's own colors and logo on top of Backstage components (Q5, Q8); desktop browsers only (Q6).

## Information Architecture

- Service catalog page (the service the person is viewing)
  - Dependency-upgrade planning view (scope S1)
  - CI failure triage view (scope S2)
  - Pending changes list, linking to a change detail screen (scope S3)
  - Audit log table (scope S4)
- Change detail screen, with Approve and Reject (Q3: B)

## Screen 1: Service catalog page with guardrails views

```
+----------------------------------------------------------------+
| [logo]  Service: payments-api                                  |
+----------------------------------------------------------------+
| Dependency upgrade plan          | CI failure triage           |
| ------------------------------   | -------------------------   |
| lib-a   1.2 -> 2.0   [plan]      | build #41  failed           |
| lib-b   3.1 -> 3.4   [plan]      |   cause: flaky test         |
| ...                              | build #39  failed           |
|                                  |   cause: dependency conflict|
+----------------------------------------------------------------+
| Pending changes                                                |
| ------------------------------------------------------------   |
| Upgrade lib-a to 2.0        requested by ...   [View details]  |
+----------------------------------------------------------------+
| Audit log  (see Screen 3)                                      |
+----------------------------------------------------------------+
```

Accessibility: heading level h1 for the service name, h2 for each view; landmark regions header and main; keyboard entry point is the first link in the page header, then each view in reading order. Target level WCAG 2.1 AA (Q7).

## Screen 2: Change detail with approve or reject

```
+----------------------------------------------------------------+
| [logo]  < Back to payments-api                                 |
+----------------------------------------------------------------+
| Change: Upgrade lib-a to 2.0                                   |
|                                                                |
| What it will do                                                |
|   - edit dependency file  ...                                  |
|   - open change request   ...                                  |
|                                                                |
| Requested by: ...          Status: Pending                     |
|                                                                |
|                          [ Reject ]   [ Approve ]              |
+----------------------------------------------------------------+
```

Accessibility: h1 is the change title, h2 for "What it will do"; main landmark holds the details and both buttons; keyboard entry point is the Back link, then Reject, then Approve; button labels state the action in text, not by color alone.

## Screen 3: Audit log

```
+----------------------------------------------------------------+
| Audit log                  Filter: [time] [actor] [action] [outcome]
| ------------------------------------------------------------   |
| Time          Actor     Action              Outcome            |
| 10:42  ...    alice     approved upgrade    applied            |
| 10:15  ...    bob       rejected upgrade    not applied        |
+----------------------------------------------------------------+
```

Accessibility: h2 "Audit log" inside the main landmark; the table has column headers and a caption; keyboard entry point is the first filter control, and every filter is operable without a mouse.

## Empty and error states to show in refined mockups

- No pending changes, no audit entries yet, and the synthetic server unreachable are states the refined mockups must cover.
