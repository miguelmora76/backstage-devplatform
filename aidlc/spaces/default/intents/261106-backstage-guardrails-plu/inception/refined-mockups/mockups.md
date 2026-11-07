# Refined Mockups

Inputs: rough `wireframes.md` and `user-flow.md`, `stories.md` (US IDs), `requirements.md` (FR/NFR IDs), and answers Q1–Q10 in `refined-mockups-questions.md`. Desktop browsers only (NFR4). Style: placeholder deep blue accent and a simple shield mark, to be swapped later (Q3). Status always uses an icon plus a word, never color alone. Every user-facing string is defined once in the string catalog in `interaction-spec.md`; the mockups below quote those strings exactly.

## Requirement Changes Raised Here

This stage raised three points that go beyond `requirements.md`. Each has its origin recorded and is carried here until it is adopted into the requirements.

| # | Point | Origin | Effect on screens |
|---|---|---|---|
| P1 | **Proposed FR12.1:** a read-only auditor role. The plugin backend refuses propose, approve, reject and retry from an auditor, and records the attempt with outcome refused. | Q7 | Auditor sees every view with write actions disabled; backend enforcement and audit entry as for FR3.3 |
| P2 | Proposals are audited: a proposal writes an entry with outcome *proposed*. This extends the outcome list in FR4.2 (applied, rejected, failed, refused) and matches FR5.2, which already names proposals. | Q8 | Audit log lists proposals |
| P3 | The audit log is scoped to the current service and shows the service on each entry (FR4.2 "target service"). | Q8 | Audit log columns |
| P4 | FR3.1 and FR11.1 say "pending changes"; here they are read as *open changes*, meaning pending plus failed. Applied and rejected changes are read in the audit log. | Q9 | Open changes list, card count, empty message |
| P5 | The backend takes the acting user and role from the sign-in identity, never from the request body. This is how FR3.3, proposed FR12.1 and FR5.2 are enforced. | Q11 | Demo-user switch changes the identity the backend sees |

## Screen Map

| Screen | Purpose | Stories | Requirements |
|---|---|---|---|
| A. Overview card | Entry point on the service overview page | US1.1, US1.2 | FR1.1, FR2.1 |
| B. Guardrails view | Upgrade plan, CI triage, open changes, audit log, demo-user switch | US1.1, US1.2, US2.1, US2.2, US4.1, US5.1 | FR1, FR2, FR4, FR5, FR11 |
| C. Change detail | Read what a change does; approve, reject or retry with a reason | US3.1, US3.2, US3.3 | FR3 |

The demo-user switch sits in the header of Screens B and C (see below).

## Header with Demo-User Switch (Screens B and C; US5.1, FR5.1)

```
+------------------------------------------------------------------+
| [shield] Guardrails > payments-api         Signed in as: [Priya v]|
+------------------------------------------------------------------+
                                                 | Sam    Service owner |
                                                 | Priya  Platform engineer |
                                                 | Alex   Auditor       |
```

- The control is a button labelled "Switch demo user, signed in as Priya" that opens a list of the demo users, each with a role label. Three users are offered: Sam, Priya and Alex (FR5.1).
- Keyboard: Enter or Space opens the list; arrow keys move; Enter selects; Escape closes and returns focus to the button.
- Each demo user is a real sign-in identity with a fixed role (Sam: service owner, Priya: platform engineer, Alex: auditor). Switching replaces the identity the plugin backend sees, and the backend reads the acting user and role from that identity, never from the request (Q11: A, P5).
- After a switch: the page stays on the same screen, any banner is cleared, every action is re-evaluated for the new user, and a status message announces "Signed in as Sam." Focus returns to the switch button.
- On Screen C, a switch to the proposer disables Approve, Reject and Retry with the proposer reason; a switch to the auditor disables them with the read-only reason.
- Demo users: Sam (service owner), Priya (platform engineer), Alex (auditor). Sam and Priya can each propose and decide the other's changes; Alex only reads.

## Screen A: Overview card (Q1: B)

```
+---------------------------------------------+
| [shield] Guardrails                         |
| ------------------------------------------- |
| Upgrades available:     4                   |
| Failed CI runs:         2                   |
| Open changes:           2                   |
|                                             |
| [ Open Guardrails ]                         |
+---------------------------------------------+
```

- Counts (Q9: A): *Upgrades available* is the number of dependencies whose recommended version differs from the current one. *Failed CI runs* is the number of failed runs listed in CI triage. *Open changes* is the number of rows in the pending list on Screen B (pending plus failed changes).
- The card is read-only; "Open Guardrails" links to Screen B.
- Accessibility: h2 "Guardrails" inside the overview `main`; "Open Guardrails" is the only control.

### States of Screen A

| State | What shows |
|---|---|
| Loading | The three labels with "Loading..." in place of counts; the card has `aria-busy` and a status message "Loading Guardrails." |
| Empty (all three counts zero) | "Nothing to review." (counts still shown as 0) |
| Error | "Guardrails server unreachable." with a Retry action |
| Loaded | As above |

## Screen B: Guardrails view (Q2: C)

```
+------------------------------------------------------------------+
| [shield] Guardrails > payments-api       Signed in as: [Priya v] |
+------------------------------------------------------------------+
| [banner] Change approved and applied.                      [x]   |
+------------------------------------------------------------------+
| Dependency upgrade plan            | CI failure triage           |
| ---------------------------------  | --------------------------- |
| Dependency Current Recommended     | Run   Cause                 |
| lib-a      1.2     2.0   [Propose change]| #41 Flaky test   [Propose re-run]|
| lib-b      3.1     3.4   [Propose change]| #39 Dependency conflict [Propose re-run]|
+------------------------------------------------------------------+
| Open changes                                                     |
| ---------------------------------------------------------------- |
| Change                  Proposed by  Status          Action      |
| Upgrade lib-a to 2.0    Sam          [!] Pending     [View]      |
| Re-run build #41        Sam          [x] Failed      [View]      |
+------------------------------------------------------------------+
| Audit log                                                        |
| Filter: From [..] To [..] Actor [..] Action [..] Outcome [..] [Clear filters]|
| ---------------------------------------------------------------- |
| Date/time     Actor Action        Service       Target Outcome Reason|
| Nov 6 10:42   Priya Approve       payments-api  lib-a  Applied Safe  |
| Nov 6 10:40   Sam   Propose upgrade payments-api lib-a Proposed -   |
|                              [ Previous ]  Page 1 of 3  [ Next ]  |
+------------------------------------------------------------------+
```

- Status labels: `[!] Pending`, `[ok] Applied`, `[x] Rejected`, `[x] Failed`, `[!] Refused`, `[i] Proposed`. Each is an icon plus a word.
- **Open changes** lists pending and failed changes only (Q9: A). Order: failed first, then pending, each newest first. Applied and rejected changes leave the list and are read in the audit log. The empty message "No open changes." therefore means nothing is pending or failed.
- Duplicate proposals are allowed, so two rows can name the same dependency (FR1.2).
- **Paging and order** (Q13: A): the audit log is newest first and shows date and time. The audit log, the upgrade plan and the CI triage list each show 10 rows per page with Previous and Next controls and "Page N of M". Row buttons have names that include the row ("Propose change for lib-a", "View change: Upgrade lib-a to 2.0").
- **Status component:** `[i] Proposed` is a custom label (an info icon plus the word); the others use Backstage status icons (see `design-system-mapping.md`).
- **Audit log** (Q8: A, P2, P3): shows this service only; the Service column is shown on every entry. The Action column values are: Propose upgrade, Propose re-run, Approve, Reject, Retry. The Outcome values are: Proposed, Applied, Rejected, Failed, Refused. Every propose, approve, reject, retry and refused attempt writes an entry. The Reason column holds the approver's reason as submitted, or "-" for a proposal.
- Banner: a result banner appears after propose, and after a return from Screen C (Q4: B).
- Accessibility: h1 is the service name; h2 for each of the four sections; landmarks header and main; the banner takes focus (see `accessibility-checklist.md`).

### States of Screen B

| Section | Loading | Empty | Error |
|---|---|---|---|
| Upgrade plan | Skeleton rows, `aria-busy` | "No dependencies to upgrade." | "Guardrails server unreachable." with Retry; Propose change disabled |
| CI triage | Skeleton rows, `aria-busy` | "No failed CI runs." | Same; Propose re-run disabled |
| Open changes | Skeleton rows, `aria-busy` | "No open changes." | Same |
| Audit log | Skeleton rows, `aria-busy` | "No audit entries yet." | Same; filters disabled |

When any section shows the error, all write actions on the page stay disabled until a load succeeds (FR11.2). With filters applied and no match: "No entries match these filters."

### Read-only auditor (Q6: A, Q7: B, proposed FR12.1)

Alex sees Screen B exactly as above. Propose change, Propose re-run, and every action on Screen C are disabled with the text "Auditors can read but not change." The backend also refuses any write from Alex and writes an audit entry with outcome Refused (P1).

## Screen C: Change detail (Q5: A)

```
+------------------------------------------------------------------+
| [shield] Guardrails > payments-api > Change 17  Signed in as: [Priya v]|
+------------------------------------------------------------------+
| Upgrade lib-a to 2.0                         [!] Pending         |
| Proposed by Sam at 10:40                                         |
|                                                                  |
| What it will do                                                  |
|   - Apply the dependency upgrade lib-a 1.2 -> 2.0 to payments-api |
|                                                                  |
| Reason (required)                                                |
| +--------------------------------------------------------------+ |
| |                                                              | |
| +--------------------------------------------------------------+ |
| 500 characters left                                              |
|                                                                  |
| [ Back ]                         [ Reject ]      [ Approve ]     |
+------------------------------------------------------------------+
```

- Pending change: Approve and Reject are offered (FR3.2). A failed change shows `[ Retry ]` instead and the failure message (below). Applied and rejected changes show no action; they show the decision block instead.
- Both actions require a non-empty reason; submitting an empty one keeps the screen open and shows "Enter a reason." under the box; nothing is written (FR3.2). The same applies to Retry.
- **Decision block** for applied, rejected and failed changes: "Decided by Priya at 10:42" with the reason as entered. For a failed change it also shows "Could not be applied: <message from the server>."
- If the viewer proposed the change, Approve, Reject and Retry are disabled (FR3.3); if the viewer is the auditor, they are disabled (FR12.1). The reason text beside the buttons follows the precedence in `interaction-spec.md`.
- **Stale page** (Q10: A, Q12: A, FR3.7): if someone else decided the change while this page was open, the actions still look enabled. Submitting is refused and the attempt is written to the audit log with outcome Refused and the typed reason. The page then reloads to show the decision block, and the refusal message stays visible at the top of the decision block in an announced alert, with keyboard focus on it (so it is neither lost in the reload nor missed). Which message shows: a stale Approve or Reject says `refusal.alreadyDecided` ("This change was already decided."); a stale Retry on a change that is no longer failed says `refusal.notFailed` ("Only a failed change can be retried."). The alert can be dismissed.
- After a successful action the person returns to Screen B with a banner (Q4: B).

### States of Screen C

| State | What shows |
|---|---|
| Loading | Title placeholder and "Loading change..." with `aria-busy`; actions hidden |
| Server unreachable | "Guardrails server unreachable." with Retry; actions disabled |
| Not found | "This change no longer exists." with a Back link; no actions |
| Submit failed (network or server drops during Approve, Reject or Retry) | "Could not reach the Guardrails server. Your reason is kept. Try again." The typed reason stays in the box; nothing is written |
| Apply failed (approved, but the write failed) | Return to Screen B with the banner "Change approved but could not be applied."; the change shows Failed |
| Decided | Decision block as above; no actions |

- Accessibility: h1 is the change title, h2 "What it will do"; the reason box has a visible label, its count is announced at thresholds (see the accessibility checklist); the error text is linked to the box; focus order is Back, reason, Reject, Approve.

## Branding

- Accent: deep blue (placeholder `#1F3A93`) on white; contrast about 10:1, above the AA minimum of 4.5:1.
- Mark: a simple shield beside the title; replaceable in one place (see `design-system-mapping.md`).
