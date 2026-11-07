# Accessibility Checklist

Target: WCAG 2.1 AA, including keyboard-only use and screen-reader labels (NFR3). Screens and states are in `mockups.md`; behavior is in `interaction-spec.md`.

## Per-Screen Checks

| # | Check (WCAG reference) | A | B | C |
|---|---|---|---|---|
| 1 | One h1; sections use h2 (1.3.1) | Card h2 | Service name h1; four h2 | Change title h1; "What it will do" h2 |
| 2 | Landmarks header and main (1.3.1) | Yes | Yes | Yes |
| 3 | Page title names the screen: "Guardrails - payments-api", "Change 17 - payments-api" (2.4.2) | Yes | Yes | Yes |
| 4 | Every control reachable by Tab in reading order (2.1.1, 2.4.3) | Yes | Yes | Back, reason, Reject, Approve |
| 5 | Visible focus indicator (2.4.7) | Yes | Yes | Yes |
| 6 | Tables have a caption and header cells (1.3.1) | n/a | Yes | n/a |
| 7 | Status is icon plus text, not color alone (1.4.1) | n/a | Yes | Yes |
| 8 | Text contrast at least 4.5:1; large text and controls at least 3:1 (1.4.3, 1.4.11) | Yes | Yes | Yes |
| 9 | Form fields have visible labels; errors linked to their field (3.3.1, 3.3.2, 1.3.1) | n/a | Filters | Reason box |
| 10 | **Disabled actions stay focusable** (`aria-disabled`), with the reason linked by `aria-describedby`, so keyboard and screen-reader users reach the reason (2.1.1, 1.3.1) | Open link only | Propose actions | Approve, Reject, Retry |
| 11 | Result banner is a status region and takes focus when it appears; announced once (4.1.3, 2.4.3) | n/a | Yes | n/a |
| 12 | **Focus after navigation:** returning from Screen C moves focus to the banner; opening Screen C moves focus to its h1; closing the user menu returns focus to its button (2.4.3) | n/a | Yes | Yes |
| 13 | **Loading is announced** through a polite live message and `aria-busy` on the loading region, not by skeleton shapes (4.1.3) | Yes | Yes | Yes |
| 14 | **Character counter** is visible always, and announced only at 100, 50, 20 and 0 characters left, to avoid per-keystroke chatter (4.1.3) | n/a | n/a | Yes |
| 15 | **Reflow and zoom:** usable at 400% zoom (320 CSS px) with no two-way scrolling except inside data tables; text can be resized to 200% without loss (1.4.10, 1.4.4) | Yes | Yes | Yes |
| 16 | **Demo-user switch:** named button, menu navigable by arrows, Escape closes, selection announced (4.1.2, 2.1.1) | n/a | Yes | Yes |
| 17 | Disabled-reason text and error text use the strings in the catalog, so what is read is what is shown (3.3.1) | Yes | Yes | Yes |
| 18 | Repeated row buttons have names that include the row, for example "Propose change for lib-a" and "View change: Upgrade lib-a to 2.0" (2.4.6, 4.1.2) | n/a | Yes | n/a |
| 19 | The banner and alert close buttons are named "Dismiss message" (4.1.2) | n/a | Yes | Yes |
| 20 | The page language is set (`lang="en"`) (3.1.1) | Yes | Yes | Yes |
| 21 | An end date before the start date shows an error linked to the date fields, and the filter is not applied (3.3.1) | n/a | Yes | n/a |
| 22 | "Working..." is announced politely when an action starts and its result is announced when it ends (4.1.3) | n/a | Yes | Yes |
| 23 | After an "already decided" refusal the alert is announced and takes focus; dismissing it moves focus to the decision block heading (4.1.3, 2.4.3) | n/a | n/a | Yes |
| 24 | Paging controls are named, the current page is announced, and moving between pages keeps focus on the controls (2.4.3, 4.1.3) | n/a | Yes | n/a |

(Sortable columns are not part of this design, so no `aria-sort` is needed.)

## Automated Scan Scope

Run on each screen and on its state variants:

- Screen A: loaded, loading, empty, error.
- Screen B: loaded, each section loading, empty and error, banner shown, filters applied with no match, invalid date range, second page of a list, auditor view (actions disabled), proposer view.
- Screen C: pending (as proposer, as another user, as auditor), failed, decided, loading, server unreachable, not found, submit failed, empty-reason error, stale-page refusal.

Pass: no AA violations in any variant.

## Keyboard Walkthroughs (no mouse)

1. **Propose and approve:** open the overview card, choose "Open Guardrails", propose an upgrade, switch to a second demo user with the header switch, open the pending change, type a reason, choose Approve, and read the audit log.
2. **Reject:** repeat to Screen C and choose Reject with a reason.
3. **Failure and retry:** with the server forced to fail, approve a change, open the failed change, and retry with a reason.
4. **Blocked actions:** as the proposer, reach the disabled Approve and read its reason by keyboard; as the auditor, reach the disabled Propose change and read its reason.
5. **Error recovery:** with the server stopped, reach the error panel and activate Retry.
6. **Filters and paging:** filter the audit log by outcome, enter an end date before the start date and read the error, move between pages with Previous and Next, and clear the filters.
7. **Stale page:** with two sessions open on one pending change, decide it in one, submit in the other, and read the refusal alert.

Pass: every step completes without a mouse, and every message is announced.

## Verification

- Automated scan over the variants listed above, in current stable Chrome and Firefox (NFR4).
- Manual keyboard walkthroughs 1–7, with one screen-reader pass over walkthrough 1.
- Contrast of the placeholder accent checked now; re-check when the real palette replaces it.
