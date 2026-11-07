# Rough Mockups — Questions

## Q1. [Design] Where does the plugin appear for a service?

Why we ask: it fixes the entry point that every screen hangs off.

- A. A "Guardrails" tab on the service's catalog entity page
- B. A card on the entity overview page that links into a full view
- C. A standalone page outside the entity page
- D. Not yet defined
- X. Other (please specify)

[Answer]: D

## Q2. [Design] How should the tab organize upgrade planning, CI triage, approvals and the audit log?

Why we ask: four must-have views share one place; this sets the information hierarchy.

- A. One scrolling page with four sections
- B. Sub-tabs, one per view
- C. Upgrade planning and CI triage side by side, with approvals and the audit log below
- D. Not yet defined
- X. Other (please specify)

[Answer]: D

## Q3. [Design] How does a person approve or reject a pending write?

Why we ask: this is the core interaction of the approval-gated flow.

- A. A list of pending changes with Approve and Reject buttons, each asking for confirmation
- B. A detail screen per change showing what it will do, with Approve and Reject there
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q4. [Design] How is the audit log shown?

Why we ask: it must show who approved what, and be readable as it grows.

- A. A table with columns for time, actor, action and outcome, filterable by those
- B. A simple newest-first list without filters
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q5. [Design] Which visual style should the screens follow?

Why we ask: it decides whether we design our own look or reuse an existing one.

- A. Backstage's default theme and components, with no custom branding
- B. Custom branding (describe it under Other)
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q6. [Design] Which devices must be supported?

Why we ask: it bounds the layout work.

- A. Desktop browsers only
- B. Desktop and tablet
- C. Fully responsive down to phones
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q7. [Design] What accessibility level is required?

Why we ask: it decides how much keyboard and screen-reader behavior the design must specify.

- A. WCAG 2.1 AA, including keyboard-only use and screen-reader labels
- B. Keyboard use and sensible labels, without a formal level
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q8. [Design] What does the custom branding chosen in Q5 consist of?

Why we ask: you chose custom branding but did not say what it is.

- A. Own colors and logo on top of Backstage components
- B. Colors only, no logo
- C. Not decided yet
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Entry point and tab layout: not yet defined; the wireframes show the four views inside the service catalog page without fixing the arrangement (Q1: D, Q2: D)
- Approving or rejecting a write: a detail screen per change showing what it will do, with Approve and Reject there (Q3: B)
- Audit log: a table with time, actor, action and outcome columns, filterable (Q4: A)
- Style: custom branding with its own colors and logo on top of Backstage components (Q5: B, Q8: A)
- Devices: desktop browsers only (Q6: A)
- Accessibility: WCAG 2.1 AA, including keyboard-only use and screen-reader labels (Q7: A)

Does this all look correct before I generate the artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
