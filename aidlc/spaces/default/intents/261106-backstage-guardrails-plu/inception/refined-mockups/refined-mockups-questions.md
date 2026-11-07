# Refined Mockups — Questions

## Q1. [Design] Where does the plugin appear for a service?

Why we ask: the rough mockups left this open, and every refined screen hangs off it.

- A. A "Guardrails" tab on the service's catalog entity page
- B. A card on the entity overview that links to a full Guardrails view
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Design] How are the four views arranged inside it (upgrade plan, CI triage, pending changes, audit log)?

Why we ask: this was also left open in the rough mockups.

- A. Sub-tabs, one per view
- B. One scrolling page with four sections
- C. Upgrade plan and CI triage side by side, pending changes and audit log below
- D. Not yet defined
- X. Other (please specify)

[Answer]: C

## Q3. [Design] What are the custom branding colors and logo?

Why we ask: you chose custom colors and a logo; the mockups need real values or an agreed placeholder.

- A. Use a placeholder now: a deep blue accent and a simple shield mark, easy to swap later
- B. Use a placeholder now: a teal accent and a simple shield mark, easy to swap later
- C. I will provide the colors and logo later; keep Backstage's default colors meanwhile
- X. Other (please specify, for example hex colors)

[Answer]: A

## Q4. [Design] How does the screen confirm a decision?

Why we ask: after Approve, Reject or Retry, the person needs clear feedback.

- A. A short message on screen plus the change's status badge updating in place
- B. Return to the pending list with a banner stating what happened
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q5. [Design] What does the reason input look like?

Why we ask: a reason is required for approve, reject and retry.

- A. A multi-line text box, required, up to 500 characters, with the remaining count shown
- B. A single-line text box, required, up to 200 characters
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q6. [Design] What does the read-only auditor see?

Why we ask: the auditor persona only reads the audit log.

- A. The same page as everyone, with propose, approve, reject and retry disabled and a stated reason
- B. Only the audit log
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Requested Changes Feedback

[Answer]: Address all nine gaps the reviewer raised (R-01 to R-09).

## Q7. [Product] The read-only auditor: what should happen, given no requirement says a role can't approve?

Why we ask: the mockups showed an auditor with actions disabled, but nothing in the requirements creates that restriction.

- A. Drop the role: the auditor is just another demo user, and only the existing rules disable actions
- B. Add a role requirement: the auditor is read-only, the backend refuses their writes, and the attempt is recorded as refused
- X. Other (please specify)

[Answer]: B

## Q8. [Product] What does the audit log show?

Why we ask: requirements say each entry carries the target service, but not which service's entries or which actions appear.

- A. This service only, covering every action: propose, approve, reject, retry and refused attempts, with the service shown on each entry
- B. All services in one log, with a service column and a service filter
- C. This service only, decisions only (proposals are not logged)
- X. Other (please specify)

[Answer]: A

## Q9. [Product] What does the pending list show, and what do the overview card counts mean?

Why we ask: failed changes sit in the list, and the empty message "No pending changes" would otherwise be ambiguous.

- A. Pending and failed changes only; applied and rejected ones leave the list and live in the audit log; card counts match what the list shows
- B. All changes, newest first, as history; card counts cover only open (pending and failed) changes
- X. Other (please specify)

[Answer]: A

## Q10. [Product] When does the "already decided" refusal happen?

Why we ask: the buttons are disabled for decided changes, so the refusal needs a stated case.

- A. On a stale page: someone else decided while this page was open, the buttons still look enabled, the attempt is refused with a message, and the refused entry keeps the typed reason
- B. The same, but the refused entry records no reason
- X. Other (please specify)

[Answer]: A

## Requested Changes Feedback

[Answer]: Fix all remaining review points (R-06, R-10 to R-17) as recommended in the walk-through: backend identity model, a stale-page message that survives the reload, a complete string catalog, the small accessibility and button-protection additions, audit log order and paging, the Proposed status component, and the open-changes wording note.

## Q11. [Security] How does the backend know who is acting and what role they hold?

Why we ask: no self-approval and the auditor rule must be enforced by the backend, so it needs a trusted actor and role.

- A. Each demo user is a real sign-in identity with a fixed role; switching users replaces the identity the backend sees; the backend takes the actor and role from that identity, never from the request body
- B. The browser tells the backend who is acting in each request
- X. Other (please specify)

[Answer]: A

## Q12. [Product] How is the "already decided" refusal shown after the page reloads?

Why we ask: the message would otherwise disappear with the reload.

- A. Keep it visible in an announced alert at the top of the decided view, with keyboard focus on it; a stale Approve or Reject says "This change was already decided."; a stale Retry on a change that is no longer failed says "Only a failed change can be retried."
- B. Show it briefly and let it disappear
- X. Other (please specify)

[Answer]: A

## Q13. [Product] How are the audit log and the long lists ordered and paged?

Why we ask: the seeded data has about 10 dependencies and 20 CI runs per service, and entries from different days must be told apart.

- A. Audit log newest first, showing date and time, 10 rows per page with Previous and Next; the upgrade plan and CI triage lists use the same paging
- B. No paging; show everything
- X. Other (please specify)

[Answer]: A

## Q14. [Design] How complete is the string catalog?

Why we ask: the mockups claim every on-screen string is in one list, but many are missing.

- A. Add every on-screen string (messages, button labels, loading and working texts, counter, decision block, column and section names) and use one label, "Clear filters"
- B. Narrow the claim to messages only
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Placement: a card on the service's overview page that links to a full Guardrails view (Q1: B)
- Layout of the full view: upgrade plan and CI triage side by side, pending changes and audit log below (Q2: C)
- Branding: placeholder deep blue accent and a simple shield mark, easy to swap later (Q3: A)
- Confirming a decision: return to the pending list with a banner stating what happened (Q4: B)
- Reason input: multi-line, required, up to 500 characters, with the remaining count shown (Q5: A)
- The read-only auditor sees the same page with all write actions disabled and a stated reason (Q6: A)
- The auditor is a read-only role: the backend refuses their writes and records the attempt as refused. This is a new requirement that comes from this stage (Q7: B)
- The audit log shows this service only, with every action (propose, approve, reject, retry, refused), and the service on each entry (Q8: A)
- The pending list shows pending and failed changes only; applied and rejected ones live in the audit log; card counts match the list (Q9: A)
- "Already decided" happens on a stale page: the attempt is refused with a message and the refused entry keeps the typed reason (Q10: A)
- The reviewer's other points (demo-user switch, missing screen states, accessibility checklist gaps, consistent texts, real Backstage component names) are fixed in the artifacts
- Each demo user is a real sign-in identity with a fixed role; the backend takes the actor and role from that identity, never from the request body (Q11: A)
- The "already decided" refusal stays visible in an announced alert with focus after the reload; a stale Retry on a non-failed change says "Only a failed change can be retried." (Q12: A)
- The audit log is newest first with date and time, 10 rows per page with Previous and Next; the upgrade plan and CI lists page the same way (Q13: A)
- The string catalog holds every on-screen string, with "Clear filters" as the single label (Q14: A)
- Smaller review points are fixed too: row buttons named for their row, a named banner close button, page language, a date-range error, announced "Working...", Propose buttons protected from double presses, a custom label for Proposed, and a note that FR3.1 and FR11.1 are read as open changes (pending plus failed)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
