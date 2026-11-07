# Risk and Sequencing Rationale

Sources: `unit-of-work-dependency.md` (the allowed orders), `unit-of-work.md` and `unit-of-work-story-map.md` (size and stories per unit), `contract-summary.md` (contracts and the open findings from its review), `components.md` (where the rules live), `requirements.md` and `stories.md` (what has to be true at the end), `mockups.md` (size of the UI), `team-practices.md` (no walking skeleton, tests first) and answers Q1–Q8 in `delivery-planning-questions.md`. A **Bolt** is one build pass over a piece of the work, ending in something that runs and has been checked; here each Bolt is one unit.

## Heuristic

Risk-first sequencing (Boehm's spiral model: do the most uncertain work first, so later work is not built on a wrong guess). No scoring model such as WSJF (Weighted Shortest Job First: value, urgency and risk reduction divided by size) was used (Q8: A); with six units and firm dependencies a written argument is enough. A walking skeleton (a thin end-to-end slice first) is off by the team's own practice, so the order is not chosen to reach an end-to-end slice early.

## The Order and Why

Order: B1 u2, B2 u1, B3 u3, B4 u4, B5 u5, B6 u6 (Q1: A).

1. **B1 u2-plugin-backend first.** It holds the approval rules, the ordered decision flow and the append-only audit log, which are the first worry you named (Q3: A), and it holds the custom demo sign-in the backend trusts for who is acting, the second worry (Q3: B). It depends on no other unit, so it can go first. Doing it first also means a wrong guess about the rules or the sign-in costs the least.
2. **B2 u1-data-and-server second.** It is small and well understood. Building it right after u2 checks early that the stand-in u2 was tested against is true to the real server (contract C2). If it is not, only u2's stand-in needs fixing.
3. **B3 u3-plugin-ui third.** It is the largest in screens, but it relies only on the backend interface (contract C1), so it can wait until the backend is real. Its stand-in is checked against C1, which the finished u2 now provides.
4. **B4 u4-backstage-app fourth.** It needs u2 and u3. It is the first moment the whole application runs, so it is where drift between stand-ins and real pieces would show. You did not name drift between stand-ins and real pieces as a top worry (Q3), but B4 covers it anyway.
5. **B5 u5-compose-and-ci fifth.** It needs u1 and u4, and it closes the must-haves with the one-command run.
6. **B6 u6-minikube-run last.** It is a should-have and needs u5.

## Check Against the Unit Graph

Every Bolt is built after the units it depends on: u4 after u2 and u3, u5 after u1 and u4, u6 after u5. u1, u2 and u3 have no edges between them, so any order of those three is valid. There is no deviation from the order the graph allows.

## One Addition Outside the Units

A small GitHub Actions pipeline and the workspace it runs in are set up at the start of B1 (Q5: A). They belong to no unit (the pipeline would otherwise come with u5, near the end). The reason is the team rule that tests run in CI before merge and CI must be green: without the early pipeline, B1 to B4 would be merged without it. The cost is some extra work in B1, and u5 then extends the pipeline rather than creating it.

## Alternatives Considered

| Option | Why not |
|---|---|
| Data first: u1, u2, u3, u4, u5, u6 (Q1: B) | Builds the lowest-risk unit first and meets the approval rules late; a wrong guess there would be found after the server and part of the screens exist |
| Screens first: u3, u2, u1, u4, u5, u6 (Q1: C) | Gives something to look at early, but the screens would be built against a backend interface not yet proven by a real backend |
| Two or three Bolts in parallel (Q6: B) | Possible for u1, u2 and u3, but every Bolt is reviewed by one person, and parallel Bolts would multiply the review load and need a different build setting |
| Bundle u4 and u5 in one Bolt (Q2: B) | Fewer hand-offs, but a larger pull request that mixes wiring with run files |

## Risks

| Risk | Likelihood | Impact | Mitigation | Bolt |
|---|---|---|---|---|
| The approval flow has a gap (concurrent decisions, failed write, audit entry missing after a failure) | Medium | High | Build it first; test the claim, the call, the record and the audit entry in order; recovery of a decided change with no audit entry is a Definition of Done item | B1 |
| The custom demo sign-in does not give the backend a reliable user and role in Backstage | Medium | High | Prove it in B1 with a test through Backstage's own sign-in path; the mechanism is confirmed in Functional Design | B1, B4 |
| A stand-in drifts from the real thing and the pieces do not fit | Medium | Medium | Each stand-in is checked against its contract spec (contract ownership rules); B2 and B4 are where the real pieces meet it | B2, B3, B4 |
| The contract review's open points (how "server down" is detected, errors from the server mapped to HTTP results, idempotency of a re-run, storage durability) are settled differently in two units | Medium | Medium | Settle them in Functional Design before B1 and B2 build; write the answers into the contract summary | B1, B2 |
| The Backstage workspace scaffold set up in B1 conflicts with how u4 wires the app | Low | Medium | Keep the scaffold bare in B1 and let B4 add wiring only | B1, B4 |
| The requirements and stories fall out of step with the contracts | Medium | Medium | B1 and B3 update them as part of their Definition of Done (Q4: B) | B1, B3 |
| The one-week target slips | Medium | Low | The target is soft (feasibility); B6 can be dropped; a risk accepted by the owner | all |
