# Rules — u3-plugin-ui

The UI rules of this unit. This unit decides no business rule (the backend does, in u2); these are rules about what the screens show and send, so each one is a validation, a policy about display, or a constraint on the UI. `functional-spec.md` holds the workflows and states that use them. Category is one of validation, authorization (shown only, never decided), constraint, calculation, policy.

```yaml
rules:
  - id: BR1.1
    statement: The plan section lists every item the backend returns with name, current version, recommended version and a row-named "Propose change" action.
    category: policy
    applies_to: UpgradePlanSection
    trigger: the plan call succeeds with items
    logic: IF the plan answer has items THEN show each as a row with both versions and its action.
    violation: an item missing from the list is a defect; a failed call shows BR6.1 or BR6.3 instead.
    source: FR1.1
  - id: BR1.2
    statement: A section with no items shows its empty text, never an empty area.
    category: policy
    applies_to: plan, CI, open changes, audit log, overview card
    trigger: a call succeeds with no items
    logic: IF there are no items THEN show empty.plan, empty.ci, empty.open or empty.audit; empty.auditFiltered when filters are on; empty.card when all three card counts are 0.
    violation: none (a display rule)
    source: FR11.1
  - id: BR1.3
    statement: The CI section lists every failed run the backend returns with run number, cause and a row-named "Propose re-run" action.
    category: policy
    applies_to: CiTriageSection
    trigger: the CI call succeeds with items
    logic: IF the CI answer has runs THEN show each as a row with its cause and action.
    violation: as BR1.1
    source: FR2.1
  - id: BR1.4
    statement: The card shows three counts and one link, and nothing else.
    category: calculation
    applies_to: GuardrailsOverviewCard
    trigger: the card loads
    logic: Upgrades available = plan items whose recommended version differs from the current one (a stated display calculation on the versions the backend returns); failed CI runs = items in the CI list; open changes = items in the open list. The link opens the Guardrails view. While any of the three reads is loading the counts show "Loading..."; if any read fails the card shows one error with Retry instead of partial counts - error.unreachable when the plan or CI read found the server unreachable, otherwise error.loadFailed - and Retry reloads all three. No partial counts are shown: the count positions show a dash beside the error text.
    violation: none
    source: Screen A, P4
  - id: BR2.1
    statement: A proposal names only its kind and target and, on success, shows a banner and reloads the open list.
    category: constraint
    applies_to: UpgradePlanSection, CiTriageSection
    trigger: the person activates Propose change or Propose re-run
    logic: IF the action is allowed THEN send one proposal with kind and target, show banner.proposed, reload the open list.
    violation: a failed proposal shows the text for its answer (BR2.4) and creates nothing in the UI.
    source: FR1.2, FR2.2
  - id: BR2.2
    statement: The UI never removes a duplicate proposal, and one click sends one proposal.
    category: constraint
    applies_to: GuardedButton on Propose actions
    trigger: a propose action is activated
    logic: IF a proposal is being sent THEN the button shows status.working and ignores further activation; a later deliberate activation sends another proposal.
    violation: none
    source: FR1.2, FR2.2
  - id: BR2.3
    statement: Proposals appear in the audit log as entries with outcome Proposed and "-" as reason.
    category: policy
    applies_to: AuditLogSection
    trigger: an audit page contains a proposal entry
    logic: IF an entry has action propose THEN show the action text action.propose ("Propose"), outcome Proposed, reason "-". C1's audit entry carries the action `propose` without the kind of change, so the mockup's "Propose upgrade" and "Propose re-run" cannot be told apart in this column; the change title in the open list does.  The mockup wording was changed to "Propose" (D13).
    violation: none
    source: P2
  - id: BR2.4
    statement: A propose action listed as not allowed is disabled with its reason and sends nothing; a sent proposal that comes back refused shows the matching text.
    category: authorization
    applies_to: Propose actions
    trigger: allowed actions loaded, or a proposal answered 403 or 409
    logic: IF allowed is false THEN disable with the reason text and send nothing; IF the answer is NOT_ELIGIBLE or AUDITOR_READ_ONLY THEN show refusal.notEligible or disabled.auditor in an announced alert and reload the plan, the open list and the audit log. Any other failure (503, a lost connection, 404 NOT_FOUND, an unknown code) shows the text of "Error Answers to Texts" in the same alert and reloads the same sections. A 404 on a proposal (the dependency or run no longer exists) shows refusal.notEligible, "This can no longer be proposed", because to the person that is what happened.
    violation: the backend refuses and writes what it must; the UI only shows.
    source: FR1.2, FR2.2, FR12.1
  - id: BR3.1
    statement: The open list shows pending and failed changes only, each with its title (the change summary exactly as the backend returns it), proposer, status and a row-named View action, failed first then pending, newest first.
    category: policy
    applies_to: OpenChangesSection
    trigger: the open changes call succeeds
    logic: IF the answer has changes THEN sort failed before pending, each by proposed time descending, and show title, proposer, status label, View.
    violation: none
    source: FR3.1, P4
  - id: BR3.2
    statement: Approve, Reject and Retry need a reason that is not blank after trimming, at most 500 characters, sent exactly as typed.
    category: validation
    applies_to: ReasonForm
    trigger: Approve, Reject or Retry is activated
    logic: IF the trimmed reason is empty THEN keep the screen, show error.reasonRequired linked to the box, send nothing; ELSE send the reason as typed.
    violation: nothing is sent or written.
    source: FR3.2, FR3.6
  - id: BR3.3
    statement: Approve returns to the view with a banner that says whether the change was applied or failed.
    category: policy
    applies_to: ChangeDetailScreen
    trigger: the approve call answers 200
    logic: IF the returned status is applied THEN banner.approved; IF failed THEN banner.applyFailed; return to the view in both cases.
    violation: none
    source: FR3.4, FR3.6
  - id: BR3.4
    statement: Reject returns to the view with banner.rejected.
    category: policy
    applies_to: ChangeDetailScreen
    trigger: the reject call answers 200
    logic: IF the reject answer is 200 THEN return to the view with banner.rejected.
    violation: none
    source: FR3.5
  - id: BR3.5
    statement: Which of Approve, Reject and Retry are shown follows the change's status; a shown action is enabled only when the backend lists it as allowed, otherwise it stays focusable and shows the reason.
    category: authorization
    applies_to: GuardedButton on Screen C
    trigger: the change loads or the user switches
    logic: IF the status is pending THEN show Approve and Reject; IF failed THEN show Retry; IF applied or rejected THEN show none. IF a shown action is not allowed THEN it stays focusable (it is marked unavailable to assistive technology but not removed from the tab order), shows its reason text linked to it, and does nothing when activated; the reason text is the one for the backend's reason code (SERVER_UNREACHABLE, AUDITOR_READ_ONLY, PROPOSER_CANNOT_DECIDE, IN_PROGRESS, ALREADY_CURRENT); NOT_PENDING and NOT_FAILED have no text because the status already decided what is shown. IN_PROGRESS applies to Retry on a failed change as well as to Approve and Reject on a pending one.
    violation: none (the backend refuses a direct call)
    source: FR3.3, FR12.1
  - id: BR3.6
    statement: A refused decision shows an announced alert that takes focus; after a stale refusal the change reloads to its decision block with the alert kept.
    category: policy
    applies_to: ChangeDetailScreen, RefusalAlert
    trigger: a decision answers 403 or 409
    logic: IF the answer is a refusal THEN show the matching text, move focus to the alert, and read the change again (ALREADY_DECIDED, NOT_FAILED, CLAIM_RELEASED, AUDITOR_READ_ONLY, SELF_DECISION, NOT_FOUND) so the screen shows where the change really stands, with the alert kept above it; dismissing the alert moves focus to the decision block heading, or to the h1 when there is none. refusal.claimReleased says the change was interrupted and has been reloaded, because the screen reloads it on its own.
    violation: none (the refusal and its audit entry are written by the backend)
    source: FR3.3, FR3.7
  - id: BR3.7
    statement: Retry is offered on a failed change only and reports its outcome in a banner; a failed change shows the server's failure message.
    category: policy
    applies_to: ChangeDetailScreen
    trigger: the change is failed, or the retry call answers 200
    logic: IF status is failed THEN offer Retry and show text.couldNotApply; IF retry returns applied THEN banner.retryApplied, IF failed THEN banner.retryFailed, and return to the view.
    violation: none
    source: FR3.6
  - id: BR3.8
    statement: A write that cannot reach the plugin backend keeps the typed reason and can be tried again.
    category: constraint
    applies_to: ReasonForm
    trigger: a decision call fails without an answer, or answers 503 SERVER_UNREACHABLE
    logic: IF no answer arrives (a lost connection, or the page's 12 second limit) THEN show error.submitFailed in an announced alert; IF the answer is 503 THEN show error.unreachable. In both cases keep the typed reason and read the change again before the next attempt is possible, because the write may have finished; the reloaded change carries SERVER_UNREACHABLE in its allowed actions when the server is down, which is how Screen C disables its actions (the view's server-down flag lives only on Screen B).
    violation: nothing is assumed written.
    source: FR11.2
  - id: BR4.1
    statement: The audit table shows date and time, actor, action, service, target, outcome and reason for each entry, in the order the backend returns.
    category: policy
    applies_to: AuditLogSection
    trigger: the audit call succeeds with entries
    logic: IF the answer has entries THEN show each as a row with the seven columns; reason is "-" when absent.
    violation: none
    source: FR4.2
  - id: BR4.2
    statement: The audit filters are From, To, Actor, Action and Outcome; a changed filter reloads from page 1, and an end date before the start date is refused in the UI.
    category: validation
    applies_to: AuditFilters
    trigger: a filter changes or Clear filters is activated
    logic: IF To is before From THEN show error.dateRange linked to the dates and request nothing; ELSE request the matching page 1; Clear filters resets all.
    violation: no request is made.
    source: FR4.3
  - id: BR4.3
    statement: The audit section has no control to edit, delete or add an entry.
    category: constraint
    applies_to: AuditLogSection
    trigger: always
    logic: The section offers filters and paging only.
    violation: any such control is a defect.
    source: FR4.1
  - id: BR4.4
    statement: The audit table is for the current service, paged at 10 rows with Previous, Next and "Page N of M", and focus stays on the paging controls.
    category: calculation
    applies_to: AuditLogSection, PagedTable
    trigger: a page is requested
    logic: Request pageSize 10 for the current page; M = ceil(total / 10), at least 1; moving pages keeps focus on the controls.
    violation: none
    source: FR4.3, P3
  - id: BR5.1
    statement: The header switch lists the users from the backend and shows the signed-in user's name and role; without a user list only the name shows.
    category: policy
    applies_to: DemoUserSwitch
    trigger: the header loads
    logic: IF the user list is available THEN show the switch with all users and roles; ELSE show the name only.
    violation: none
    source: FR5.1
  - id: BR5.2
    statement: Choosing a user keeps that user's token inside the plugin and uses it as the credential on every later call of this plugin.
    category: constraint
    applies_to: DemoSession, GuardrailsApi
    trigger: a user is chosen
    logic: IF a user is chosen THEN request the sign-in start address for that userId, keep the token in memory, send it as the Authorization header (replacing the one Backstage's fetch layer adds) on later calls to the plugin backend only; IF none is chosen THEN use the app's own credential. The only value in tab storage is the chosen userId, restored after a reload if that user is still in the user list. The token expires: the plugin never reads its expiry; a 401 with a chosen user asks for a new token once (and repeats a read once), and a second 401 shows error.unauthenticated ("Choose a demo user") when the switch exists, and error.signedOut ("Your session ended. Sign in again.") when it does not (the demo sign-in is off).
    violation: on failure the previous user stays (BR5.4).
    source: FR5.1
  - id: BR5.3
    statement: The identity a call acts as comes only from the credential, and the role on screen is for display only. Two values that name a person are query data, not acting identity - the audit Actor filter (whose entries to read) and the sign-in start address's userId (whom to sign in as).
    category: constraint
    applies_to: GuardrailsApi, DemoSession
    trigger: every call
    logic: Bodies hold only kind and target (propose) or reason (decide); queries hold only filters and paging (the audit Actor filter among them) and, on the sign-in start address, the userId; no body, header or other query carries an actor, role or user id; every allowed action comes from the backend.
    violation: a call that carries an identity field outside those two is a defect.
    source: FR5.2, P5
  - id: BR5.4
    statement: After a user switch the page refreshes for the new user without leaving the screen.
    category: policy
    applies_to: GuardrailsView, ChangeDetailScreen, DemoUserSwitch
    trigger: a switch completes or fails
    logic: IF the switch succeeded THEN clear the banner, reload all sections and the open change, announce status.signedIn, keep the screen, return focus to the switch button; IF it failed THEN keep the previous user and announce error.generic.
    violation: none
    source: FR5.1
  - id: BR6.1
    statement: A plan or CI read that finds the guardrails server unreachable shows the server error panel with Retry for that section.
    category: policy
    applies_to: UpgradePlanSection, CiTriageSection, GuardrailsOverviewCard
    trigger: the answer is 503 SERVER_UNREACHABLE
    logic: IF the answer is 503 SERVER_UNREACHABLE THEN show error.unreachable and Retry; Retry reloads the section.
    violation: none
    source: FR11.2
  - id: BR6.2
    statement: While the server is unreachable every write action on the page is disabled, including Reject.
    category: authorization
    applies_to: GuardrailsView, ChangeDetailScreen
    trigger: a section is in the server error state, or the backend lists a write as SERVER_UNREACHABLE
    logic: IF either holds THEN disable propose, approve, reject and retry with disabled.unreachable until a load succeeds.
    violation: none (the backend refuses a direct write with 503)
    source: FR11.2
  - id: BR6.3
    statement: The open list and the audit log load independently of the guardrails server, and their failure is reported for that section only.
    category: policy
    applies_to: OpenChangesSection, AuditLogSection
    trigger: either call fails
    logic: IF a call fails THEN show error.loadFailed with Retry for that section; the other sections are unaffected.
    violation: none
    source: FR11.2
  - id: BR7.1
    statement: Every screen has the structure and labelling WCAG 2.1 AA needs.
    category: constraint
    applies_to: all screens
    trigger: always
    logic: One h1, h2 per section, header and main landmarks, a page title naming screen and service, visible focus, captioned tables with header cells, status by icon plus word, lang en.
    violation: any automated-scan violation is a defect.
    source: NFR3
  - id: BR7.2
    statement: Banners, alerts, loading and working states are announced once and managed for focus.
    category: constraint
    applies_to: ResultBanner, RefusalAlert, SectionState, GuardedButton
    trigger: a banner or alert appears, a load starts or ends, an action starts or ends
    logic: A banner or alert is a status region that takes focus and has a close button named label.dismiss; loading regions are marked busy with a polite message; "Working..." is announced at the start and the result at the end.
    violation: as BR7.1
    source: NFR3
  - id: BR7.3
    statement: Focus follows the accessibility checklist and the reason counter announces only at thresholds.
    category: constraint
    applies_to: ChangeDetailScreen, GuardrailsView, DemoUserSwitch, ReasonField
    trigger: navigation, menu close, typing in the reason box
    logic: Opening the detail screen focuses its h1; returning to the view focuses the banner; closing the switch menu focuses its button; the count is announced at 100, 50, 20 and 0 characters left.
    violation: as BR7.1
    source: NFR3
  - id: BR7.4
    statement: Every section starts its own load when the screen opens and shows its own loading state until its data arrives.
    category: constraint
    applies_to: GuardrailsView, GuardrailsOverviewCard
    trigger: a screen opens
    logic: Start all calls together; no section waits for another.
    violation: a section that waits on another is a defect.
    source: NFR1
  - id: BR7.5
    statement: Layout works from 1280 px, stacks below that and survives 400% zoom; behavior is specified for current Chrome and Firefox on desktop.
    category: constraint
    applies_to: all screens
    trigger: always
    logic: Two panels side by side from 1280 px, stacked below; no two-way scrolling except inside tables.
    violation: as BR7.1
    source: NFR4, NFR3
```

## Rules Summary

| Group | Rules | Subject |
|---|---|---|
| 1 View | BR1.1 to BR1.4 | Lists, empty texts, card counts |
| 2 Propose | BR2.1 to BR2.4 | Proposals, duplicates, audit display, refusals |
| 3 Decide | BR3.1 to BR3.8 | Open list, reason, outcomes, disabled actions, refusals, retry, lost connection |
| 4 Audit | BR4.1 to BR4.4 | Columns, filters, no edit, paging |
| 5 Identity | BR5.1 to BR5.4 | Switch, token, no identity fields, after a switch |
| 6 Resilience | BR6.1 to BR6.3 | Server error panel, writes disabled, independent sections |
| 7 Accessibility and performance | BR7.1 to BR7.5 | Structure, announcements, focus, parallel loads, layout |
