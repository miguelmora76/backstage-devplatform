# External Dependency Map

Sources: `unit-of-work.md` and `unit-of-work-dependency.md` (which unit needs what), `contract-summary.md` (the MCP and Backstage pieces the contracts name), `requirements.md` (constraints: local only, GitHub Actions, docker compose primary, minikube optional), `team-practices.md` (pull requests, CI before merge) and answer Q7 in `delivery-planning-questions.md`. A **Bolt** is one build pass over a piece of the work, ending in something that runs and has been checked; see `bolt-plan.md` for the six Bolts (B1 to B6).

Nothing here is owned by another team (Q7: A). Each item is something outside the code that must be in place before the Bolt that needs it.

| Item | Owner | Lead time | Bolts that need it | If it slips or fails |
|---|---|---|---|---|
| A GitHub repository with Actions enabled for the project | Project owner | Minutes, once the repository exists; the local git history has no commits yet and no remote was confirmed | B1 (pipeline setup), B5 | B1 can build and test locally, but the "CI green before merge" rule cannot be met; create the repository before B1 opens its first pull request |
| Docker (with docker compose) on the project owner's machine | Project owner | Already needed for local runs; confirm before B2 | B2 (server container), B4 (manual run with the server), B5, B6 | B1 and B3 do not need it; B2 can be tested without the container but not shown; B5 cannot be done |
| The public Backstage packages and the public MCP software kit from the package registry | Public registries | Minutes at install; versions are fixed by the lock file | B1, B2, B3, B4 | Pin versions at B1; if a version cannot be installed, pick the nearest working one and note it in Functional Design |
| minikube and a local Kubernetes tool on the project owner's machine | Project owner | Install time, only needed for the should-have | B6 | B6 is dropped without affecting any other Bolt |

## Notes

- The real guardrails server is not an external dependency: the sample stands in for it (intent capture Q5, an assumption not yet verified). If the stand-in's behavior is later found unlike the real one, that is a change to u1, not a delay.
- No approvals, data windows or hand-offs from other people are needed. The project owner's own reviews of each pull request are the only waiting time and are covered in `team-allocation.md`.
