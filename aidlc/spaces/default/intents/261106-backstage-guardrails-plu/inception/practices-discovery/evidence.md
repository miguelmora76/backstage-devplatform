# Evidence

Practices below were confirmed by the human in the interview; where the answer differed from the suggested default, the answer was used.

## Inspected

- aidlc/spaces/default/memory/org.md: the five matching sections, used as suggested defaults for the interview.
- ideation/scope-definition/scope-document.md: scope mvp; capabilities S1-S9; coverage floor number was undecided.
- ideation/feasibility/constraint-register.md: C1 TypeScript on Backstage, C4 local docker compose with optional minikube, C5 GitHub Actions green, C8 no cloud, C9 coverage floor on plugin code.
- Repository: no commits yet, greenfield, so no git history or CI configuration to infer from.
- Collaborators were off, so no support-agent reviews or contribution files exist.

## Inferred

- Backstage's usual Prettier and ESLint conventions are inferred from the framework, not observed in this repository.
- Naming (camelCase, PascalCase) is language-idiomatic, inferred and not asked in the interview.

## Interview decisions

- Q1 Way of working: B, short-lived feature branches merged through pull requests (differs from the trunk/squash default).
- Q2 Walking skeleton: B, no; build piece by piece in the planned order.
- Q3 Testing: B, test-driven; write a failing test before the code.
- Q4 Coverage: X, at least 85% of lines on the plugin code.
- Q5 Deployment: X, local only, with future ability to deploy to hosted environments.
- Q6 Code style: A, Prettier and ESLint with Backstage's usual settings, enforced in CI.
- Summary confirmation: "Looks correct".

## Unresolved uncertainty

- Hard constraints: the human stated only the 85% coverage floor as a rule to mandate; test-first and the other items were stated as practices, so Forbidden is empty.
- Whether "future ability to deploy to hosted environments" implies any concrete preparation now is not specified.
- Pull-request review requirements (approvals, protected branch settings) were not specified.
