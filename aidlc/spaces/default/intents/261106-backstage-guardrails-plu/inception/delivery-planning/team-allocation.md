# Team Allocation

Sources: `bolt-plan.md` (the six Bolts; a **Bolt** is one build pass over a piece of the work, ending in something that runs and has been checked), `unit-of-work.md` (units), `team-practices.md` (branching and review) and answers Q2 and Q6 in `delivery-planning-questions.md`. Team Formation did not run in this plan (the mvp scope skips it), so no mobs (small working groups) are named.

## Who Builds What

All six Bolts are built by the developer agent (AI), one at a time (Q6: A). The project owner, who is also the only decision-maker (stakeholder map), reviews each Bolt in its pull request before it is merged into `main`, and approves each stage and checkpoint.

| Bolt | Unit | Built by | Reviewed and approved by |
|---|---|---|---|
| B1 | u2-plugin-backend (with the workspace and pipeline setup) | developer agent | project owner |
| B2 | u1-data-and-server | developer agent | project owner |
| B3 | u3-plugin-ui | developer agent | project owner |
| B4 | u4-backstage-app | developer agent | project owner |
| B5 | u5-compose-and-ci | developer agent | project owner |
| B6 | u6-minikube-run (should-have) | developer agent | project owner |

## Working Rules

- Each Bolt is its own short-lived branch and pull request; commits go on the branch already in use (team practices).
- Tests are written first for each layer, plugin line coverage stays at least 85%, and CI must be green before merge.
- Because the build is one at a time, there is no Program Board (a cross-team view of who builds what and when) and no coordination between mobs.
- The only person who can hold a Bolt up is the project owner, by not reviewing in time; this is why Bolts are kept small (one unit each).
