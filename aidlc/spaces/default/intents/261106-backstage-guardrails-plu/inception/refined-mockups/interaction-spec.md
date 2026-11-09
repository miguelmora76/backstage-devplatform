# Interaction Specification

Screens are in `mockups.md`. Story IDs are from `stories.md`; requirement IDs are from `requirements.md`. "P1–P3" and "proposed FR12.1" are the requirement changes raised in `mockups.md`.

## String Catalog (single source of user-facing text)

| Key | Text |
|---|---|
| banner.proposed | Change proposed. |
| banner.approved | Change approved and applied. |
| banner.rejected | Change rejected. |
| banner.applyFailed | Change approved but could not be applied. |
| banner.retryApplied | Retry applied. |
| banner.retryFailed | Retry failed again. |
| error.unreachable | Guardrails server unreachable. |
| error.submitFailed | Could not reach the Guardrails server. Your reason is kept. Try again. |
| error.notFound | This change no longer exists. |
| error.reasonRequired | Enter a reason. |
| refusal.alreadyDecided | This change was already decided. |
| refusal.notFailed | Only a failed change can be retried. |
| disabled.proposer | You proposed this change, so someone else must decide it. |
| disabled.auditor | Auditors can read but not change. |
| disabled.unreachable | Guardrails server unreachable. |
| empty.plan | No dependencies to upgrade. |
| empty.ci | No failed CI runs. |
| empty.open | No open changes. |
| empty.audit | No audit entries yet. |
| empty.auditFiltered | No entries match these filters. |
| empty.card | Nothing to review. |
| loading.section | Loading <section name>. |
| loading.card | Loading Guardrails. |
| loading.change | Loading change... |
| status.signedIn | Signed in as <name>. |
| status.working | Working... |
| status.counter | <n> characters left |
| error.dateRange | The end date must be on or after the start date. |
| label.proposeChange | Propose change |
| label.proposeChangeFor | Propose change for <dependency> |
| label.proposeRerun | Propose re-run |
| label.proposeRerunFor | Propose re-run for build <run number> |
| label.approve | Approve |
| label.reject | Reject |
| label.retry | Retry |
| label.back | Back |
| label.view | View |
| label.viewFor | View change: <change title> |
| label.openGuardrails | Open Guardrails |
| label.clearFilters | Clear filters |
| label.previous | Previous |
| label.next | Next |
| label.pageOf | Page <n> of <m> |
| label.dismiss | Dismiss message |
| label.switchUser | Switch demo user, signed in as <name> |
| label.reason | Reason (required) |
| text.whatItWillDo | What it will do |
| text.proposedBy | Proposed by <name> at <time> |
| text.decidedBy | Decided by <name> at <time> |
| text.couldNotApply | Could not be applied: <message from the server> |
| section.plan | Dependency upgrade plan |
| section.ci | CI failure triage |
| section.open | Open changes |
| section.audit | Audit log |
| column.plan | Dependency, Current, Recommended |
| column.ci | Run, Cause |
| column.open | Change, Proposed by, Status, Action |
| column.audit | Date/time, Actor, Action, Service, Target, Outcome, Reason |
| status.pending / applied / rejected / failed / refused / proposed | Pending / Applied / Rejected / Failed / Refused / Proposed |

Banners carry no change names; the Open changes list shows which change was affected. Any string not in this catalog is not shown to the user.

## Precedence of Disabled Reasons

When several reasons apply to one action, the first in this order is the one shown; the others are not listed.

1. `disabled.unreachable` (the server cannot be reached)
2. `disabled.auditor` (the signed-in user is an auditor)
3. `disabled.proposer` (the signed-in user proposed this change)

A change that is not in the right state (not pending for Approve and Reject, not failed for Retry) does not show the action at all, so it has no disabled reason. A decision made by someone else while a page is open is handled as the stale-page case below, not as a disabled reason.

## Flows

| # | Flow | Steps | Stories |
|---|------|-------|---------|
| 1 | Propose an upgrade | On Screen B choose "Propose change" on a row; a pending change is created and an audit entry with outcome Proposed is written; banner `banner.proposed`; the change appears in Open changes | US2.1 |
| 2 | Propose a re-run | Same, from a failed run in CI triage | US2.2 |
| 3 | Approve | Open a pending change (Screen C); enter a reason; choose Approve; return to Screen B with `banner.approved` | US3.1 |
| 4 | Reject | Same; choose Reject; `banner.rejected` | US3.1 |
| 5 | Apply fails | Approve; the write fails; return to Screen B with `banner.applyFailed`; the change shows Failed and stays in Open changes | US3.3 |
| 6 | Retry | Open a failed change; enter a reason; choose Retry; return to Screen B with `banner.retryApplied` or `banner.retryFailed` | US3.3 |
| 7 | Filter audit log | Choose a filter value; the table shows matching entries only; "Clear filters" resets | US4.1 |
| 8 | Switch demo user | Open the switch in the header; choose a user; actions are re-evaluated; `status.signedIn` is announced | US5.1 |
| 9 | Stale page | Two users open the same pending change; one decides; the other submits; `refusal.alreadyDecided` is shown; a Refused entry with the typed reason is written; the page reloads to the decision block | US3.2 |
| 10 | Server drops during submit | Submit with the server down; `error.submitFailed`; the reason stays; nothing is written | US5.2 |

## Component Specifications

### Demo-user switch

- **Purpose:** switch the signed-in demo user (FR5.1, US5.1).
- **Control:** a button labelled "Switch demo user, signed in as <name>" that opens a list of users with their roles.
- **Keyboard:** Enter or Space opens; arrows move; Enter selects; Escape closes; focus returns to the button.
- **After a switch:** banner cleared; actions re-evaluated; `status.signedIn` announced politely; the current screen stays.
- **Identity (Q11: A):** each demo user is a real sign-in identity with a fixed role. A switch replaces the identity the plugin backend sees. The backend reads the acting user and role from that identity, never from the request body or the browser's claim.

### Open-change row

- **Fields:** change title, proposed by, status label with icon, View action.
- **States shown:** pending and failed only (Q9: A). Order: failed first, then pending, each newest first.
- **Behavior:** View opens Screen C. Keyboard: Enter or Space.

### Reason input

- **Purpose:** capture the reason for approve, reject and retry (FR3.2, FR3.6).
- **Behavior:** multi-line, up to 500 characters, required (trimmed value non-empty). The remaining count is shown always; it is announced to screen readers only at 100, 50, 20 and 0 characters left.
- **Errors:** `error.reasonRequired` under the box, linked to it; nothing is written.

### Action buttons (Approve, Reject, Retry)

- **Enabled when:** the server is reachable, the user is not an auditor, did not propose the change, and the change is in the right state.
- **Disabled actions stay focusable** (marked `aria-disabled="true"`, not the native disabled attribute) with the reason text linked by `aria-describedby`; activating them does nothing.
- **Working state:** the button shows `status.working` and cannot be pressed twice; the change is announced politely. The same applies to **Propose change** and **Propose re-run**, so an accidental double-click creates one pending change, not two. (Duplicate proposals remain allowed when the person proposes again on purpose, FR1.2.)
- **Names:** repeated row buttons carry the row in their accessible name (`label.proposeChangeFor`, `label.proposeRerunFor`, `label.viewFor`).
- **Backend:** the plugin backend enforces every rule above, not only the UI (FR3.3, proposed FR12.1). A direct call that breaks a rule is refused and writes a Refused audit entry.

### Result banner (Q4: B)

- **Behavior:** shown at the top of Screen B after propose, approve, reject and retry; stays until dismissed or the next action. It takes focus when it appears and is a status region, so it is announced once. Its close button is named `label.dismiss`.
- **Texts:** the `banner.*` strings only.

### Audit filters

- **Fields:** time range (From and To date inputs), actor, action, outcome (FR4.3). Each has a visible label. If To is before From, `error.dateRange` is shown under the dates, linked to them, and the filter is not applied.
- **Order and paging:** newest first; 10 rows per page with `label.previous`, `label.next` and `label.pageOf`; changing a filter returns to page 1. The upgrade plan and CI triage lists page the same way. Action values: Propose, Approve, Reject, Retry (catalog keys `action.propose` to `action.retry`; one word for both kinds of proposal, because the audit entry does not carry the kind). Outcome values: Proposed, Applied, Rejected, Failed, Refused.
- **Behavior:** applying a filter updates the table in place; "Clear filters" resets; `empty.auditFiltered` shows when nothing matches.
- **Scope:** this service only (Q8: A).

### Server error panel

- **Behavior:** replaces a section's content with `error.unreachable` and a Retry action. Retry reloads that section. All write actions on the page stay disabled until a load succeeds (FR11.2).

### Stale-page refusal

- **Case:** the change was decided by someone else after this page loaded (Q10: A).
- **Behavior:** the actions are still enabled on the stale page; submitting writes a Refused entry carrying the typed reason and reloads the page to the decision block (FR3.7).
- **Message (Q12: A):** after the reload the refusal stays visible at the top of the decision block in an announced alert, and keyboard focus moves to it. A stale Approve or Reject shows `refusal.alreadyDecided`. A stale Retry on a change that is no longer failed shows `refusal.notFailed`. The alert has a `label.dismiss` button; dismissing it moves focus to the decision block heading.
- **After a user switch on Screen C:** actions are re-evaluated and focus stays on the switch button.

## Responsive Behavior

Desktop browsers only (NFR4). The layout is designed at 1280 px and wider. Below that the two side-by-side panels stack. The page must remain usable at 400% zoom (an effective width of 320 CSS px) without two-way scrolling, except inside data tables, which may scroll within their own region.

## Browsers

Specified for current stable Chrome and Firefox (NFR4).
