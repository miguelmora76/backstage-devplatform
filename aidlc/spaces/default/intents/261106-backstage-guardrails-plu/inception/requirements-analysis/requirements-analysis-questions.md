# Requirements Analysis — Questions

## Q1. [Product] Which writes does the approval-gated flow cover?

Why we ask: the earlier mockup review noted it is unclear what an approved write actually does; this fixes the set of writes to specify and test.

- A. Applying a dependency upgrade from the upgrade plan (CI failure triage is read-only)
- B. Applying a dependency upgrade, and re-running a failed CI job from the triage view
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q2. [Product] How does an upgrade plan become a pending change?

Why we ask: the link between the planning view and the approval list is the core of the intent.

- A. A person clicks a "Propose change" action on a row of the upgrade plan, which creates a pending change
- B. The guardrails server creates pending changes by itself, and the plugin only lists them
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Security] Who may approve or reject a pending change?

Why we ask: it decides the authorization rule the approval flow must enforce.

- A. Any signed-in user except the person who proposed it (no self-approval)
- B. Any signed-in user, including the proposer
- C. Only members of a platform-engineers group
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q4. [Security] How are people identified locally, so the audit log can show who approved what?

Why we ask: the audit log must name an actor, and the local sample has no company sign-in.

- A. Several synthetic demo users the viewer can sign in as
- B. A single guest user only, so every action is attributed to "guest"
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q5. [Quality] Which fields must every audit log entry carry? (select all that apply)

Why we ask: the audit log is a must-have view and its content must be checkable.

- A. Time and actor
- B. Action and target service
- C. Outcome (applied, rejected, failed)
- D. The approver's comment or reason
- X. Other (please specify)

[Answer]: A, B, C, D

## Q6. [Quality] What should happen when an approved write fails to apply?

Why we ask: the earlier mockup review flagged this as an unspecified case.

- A. The change is marked failed, the failure is recorded in the audit log, and it can be retried
- B. The change is marked failed and recorded, with no retry
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q7. [Quality] How quickly should the views load on the synthetic data?

Why we ask: requirements need a measurable threshold rather than "fast".

- A. Each view renders within 2 seconds
- B. Each view renders within 5 seconds
- C. No target for this sample
- D. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q8. [Product] How big is the synthetic data set?

Why we ask: it bounds the seeded generator and the demo.

- A. About 5 services with roughly 10 dependencies and 20 CI runs each
- B. About 20 services of similar size
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Requested Changes Feedback

[Answer]: Fix all five review points and the reviewer's two major points (backend refuses self-approval and proposer retry; add a reason input; measurable pass criteria; duplicate proposals).

## Q9. [Security] Who may retry a failed change?

Why we ask: the review noted the proposer could retry around the no-self-approval rule.

- A. Anyone but the proposer, enforced by the backend
- B. Any signed-in user, including the proposer
- C. Only the original approver
- X. Other (please specify)

[Answer]: A

## Q10. [Product] Is the approver's reason required?

Why we ask: every audit entry carries a reason, so the approve and reject screen needs a reason input.

- A. Required on reject only
- B. Required on both approve and reject
- C. Optional on both
- X. Other (please specify)

[Answer]: B

## Q11. [Product] If two people decide the same change, what happens to the second decision?

Why we ask: it decides concurrent-approval behavior.

- A. Refused with a message; nothing is written to the audit log
- B. Refused with a message, and the attempt is recorded in the audit log
- X. Other (please specify)

[Answer]: B

## Q12. [Product] What happens if someone proposes a change when one is already pending for the same dependency or CI job?

Why we ask: the review noted duplicate proposals were not covered.

- A. Refused with a message: one pending change per dependency or job
- B. Allowed: duplicates are permitted
- X. Other (please specify)

[Answer]: B

## Requested Changes Feedback

[Answer]: Resolve the second review's points: the empty-reason contradiction, auditing of blocked proposer attempts, retry rules, empty and error states, and the specific figures.

## Q13. [Product] What happens to an approve or reject with an empty reason?

Why we ask: the requirements contradicted each other on whether anything is recorded.

- A. Refused with a message, and nothing is written (no audit entry)
- B. Refused and recorded as a refused entry in the audit log
- X. Other (please specify)

[Answer]: A

## Q14. [Security] Is a proposer's blocked approve, reject or retry attempt recorded in the audit log?

Why we ask: double decisions are recorded as refused; this keeps the two cases consistent.

- A. Yes, recorded with outcome refused
- B. No, only refused with a message
- X. Other (please specify)

[Answer]: A

## Q15. [Product] How does retry behave?

Why we ask: the retry action had no stated rules.

- A. A reason is required; retrying a change that is not failed is refused; a second failure marks it failed again and is audited
- B. No reason is needed; retrying a change that is not failed is refused; a second failure is audited
- X. Other (please specify)

[Answer]: A

## Q16. [Product] How are empty states, an unreachable guardrails server, and the specific figures handled?

Why we ask: these corners were silent, and "three demo users" and "Chrome and Firefox" were not in your earlier answers.

- A. Require them: an empty list shows a message; an unreachable server shows an error with retry and disables writes; three demo users and Chrome/Firefox are confirmed
- B. Same behaviors, with three users and Chrome/Firefox listed as assumptions
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Writes covered by the approval flow: applying a dependency upgrade and re-running a failed CI job (Q1: B)
- A person proposes a change from a row of the upgrade plan, which creates a pending change (Q2: A)
- Any signed-in user except the proposer may approve or reject (Q3: A)
- People sign in as several synthetic demo users (Q4: A)
- Every audit entry carries time, actor, action, target service, outcome and the approver's reason (Q5: A, B, C, D)
- A failed write is marked failed, recorded in the audit log, and can be retried (Q6: A)
- Each view renders within 5 seconds on the synthetic data (Q7: B)
- Synthetic data: about 5 services with roughly 10 dependencies and 20 CI runs each (Q8: A)
- Retrying a failed change: anyone but the proposer, enforced by the backend (Q9: A)
- The approver's reason is required on both approve and reject (Q10: B)
- A second decision on an already-decided change is refused with a message, and the attempt is recorded in the audit log (Q11: B)
- Duplicate proposals for the same dependency or CI job are allowed (Q12: B)
- An approve or reject with an empty reason is refused with a message and nothing is written (Q13: A)
- A proposer's blocked approve, reject or retry attempt is recorded in the audit log with outcome refused (Q14: A)
- Retry requires a reason; retrying a change that is not failed is refused; a second failure marks it failed again and is audited (Q15: A)
- An empty list shows a message; an unreachable server shows an error with retry and disables writes; three demo users and Chrome/Firefox are confirmed (Q16: A)

Does this all look correct before I generate the requirements artifact?

- Looks correct
- Request changes

[Answer]: Looks correct
