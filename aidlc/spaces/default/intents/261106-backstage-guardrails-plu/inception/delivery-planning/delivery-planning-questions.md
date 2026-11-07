# Delivery Planning — Questions

This stage decides the order in which the six units are built. A **Bolt** is one build pass over a piece of the work, ending in something that runs and has been checked; a Bolt holds one or more units. The units and their dependencies are already fixed: u1-data-and-server, u2-plugin-backend and u3-plugin-ui depend on nothing; u4-backstage-app needs u2 and u3; u5-compose-and-ci needs u1 and u4; u6-minikube-run needs u5 (and is a should-have). Several orders are allowed; the questions below choose one.

Already decided by your team practices, so not asked again: no walking skeleton (a thin end-to-end slice first); each Bolt is its own short-lived branch and pull request; tests are written first; at least 85% line coverage; local run only.

Recorded Construction settings, unchanged unless you say otherwise: each unit goes through its design and build steps in turn (unit by unit), one at a time.

## Q1. [Product] Which parts should be built first?

Why we ask: the three units with no dependencies (u1, u2, u3) can be built in any order, and the order decides what we learn first. u2 holds the approval rules and the audit log, which is the riskiest logic. u1 is small and well understood. u3 is the largest in screens but depends on the backend interface only through a stand-in. Recommendation: A.

- A. Riskiest first (u2, u1, u3, u4, u5, u6): the approval rules and audit log first, then the server, the screens, the app and the run files
- B. Data first, bottom-up (u1, u2, u3, u4, u5, u6): the server and its data, then the backend on top of it, then the screens
- C. Screens first (u3, u2, u1, u4, u5, u6): the UI against a stand-in, so there is something to look at early
- D. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q2. [Product] How big should one Bolt be?

Why we ask: smaller Bolts mean smaller pull requests and earlier checks; bigger ones mean fewer hand-offs. Recommendation: A, because the team works in short-lived branches and pull requests.

- A. One unit per Bolt: six Bolts, the last (minikube) being the should-have
- B. Related units bundled: u4 and u5 together (the app and its run files), the rest one each: five Bolts
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q3. [Product] What worries you most about this build (select all that apply)?

Why we ask: the Bolt that carries a worry can be placed early, so the risk is dealt with before other work depends on it.

- A. The approval flow rules: the one-decision-per-change claim, recovery after a failed write, and the audit entries staying in step with the change records
- B. The Backstage setup: the custom demo sign-in and getting the backend to read the user from it
- C. The two stand-ins drifting from the contracts, so the units don't fit when the app joins them
- D. The one-week target slipping
- X. Other (please specify)

[Answer]: A, B

## Q4. [Product] When should the requirements and stories be brought in line with the five mockup changes?

Why we ask: the contracts include the five changes from the refined mockups (auditor role, audited proposals, per-service audit log, open changes as pending plus failed, identity from the sign-in) and the reviewer found that requirement FR11.2 ("every view shows the error when the server is down") contradicts the decision that only the plan and CI views do. The approved requirements and stories do not hold these yet (Contract Design Q1: update later). Recommendation: B, because it keeps the approved documents untouched and ties the update to the work that needs it.

- A. Now: re-open Requirements Analysis and User Stories for just these changes, then come back here
- B. During the work: the first Bolt that needs each change updates the requirements and stories as part of its Definition of Done (u2 for the rules, u3 for the screens), and the change is written into the Bolt plan
- C. Not yet defined
- X. Other (please specify)

[Answer]: B

## Q5. [Delivery] When should the GitHub Actions pipeline first exist?

Why we ask: the team rule is that tests run in CI before merge and CI must be green, but the pipeline currently belongs to u5, which comes near the end. Recommendation: A.

- A. With the first Bolt: it adds a small pipeline (formatting, lint, tests, 85% coverage check) as a prerequisite, and u5 later extends it with the compose run. This adds work outside the six units.
- B. In u5 only: earlier pull requests rely on local checks, which does not meet the "CI green before merge" rule until the end
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q6. [Delivery] May two Bolts be built at the same time?

Why we ask: u1, u2 and u3 could be built in parallel (each in its own copy of the project), but the recorded setting is one at a time. Recommendation: A, because you review each Bolt before the next and the pieces are small.

- A. One at a time, as recorded
- B. u1, u2 and u3 in parallel, then the rest one at a time (this means switching the build setting to stage by stage with parallel runs)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q7. [Delivery] Is anything outside this project going to hold the build up?

Why we ask: the plan lists outside items (data, approvals, hand-offs, services) against the Bolts that need them. From the earlier stages we know of: Docker on your machine, a GitHub repository with Actions, the public Backstage and MCP packages, and minikube (should-have only). Recommendation: A.

- A. Nothing else: those are the only outside items and none is owned by another team
- B. There are more (please describe who owns each, how long it takes and what we do if it slips)
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Q8. [Delivery] Do you want a formal scoring model to rank the Bolts?

Why we ask: a scoring model such as WSJF (Weighted Shortest Job First: value, urgency and risk reduction divided by size) turns the order into numbers; for six units with firm dependencies a short written argument is usually enough. Recommendation: A.

- A. No: a short written risk-first argument, using the answers above
- B. Yes: score each Bolt with WSJF and show the table
- C. Not yet defined
- X. Other (please specify)

[Answer]: A

## Consolidated Summary Confirmation

- Build order is riskiest first: u2 (approval rules and audit log), u1, u3, u4, u5, then u6 (Q1: A)
- One unit per Bolt: six Bolts, the last (minikube) being the should-have (Q2: A)
- Biggest worries are the approval flow rules and the Backstage setup (custom demo sign-in), so u2 comes first and the sign-in is proved early (Q3: A, B)
- The requirements and stories are brought in line with the five mockup changes and the FR11.2 conflict during the work: u2's and u3's Bolts do it as part of their Definition of Done, and the Bolt plan records it (Q4: B)
- A small GitHub Actions pipeline (formatting, lint, tests, 85% coverage check) is a prerequisite of the first Bolt; u5 later extends it with the compose run (Q5: A)
- Bolts are built one at a time, as recorded (Q6: A)
- No outside items hold the build up beyond Docker, a GitHub repository with Actions, the public Backstage and MCP packages, and minikube for the should-have (Q7: A)
- No formal scoring model; the order is argued in writing, risk first (Q8: A)

- Looks correct
- Request changes

[Answer]: Looks correct
