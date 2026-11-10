// `yarn e2e [specs|checks]`: see src/e2eRun.ts. With no argument it runs the
// specs and then the checks (start from `yarn compose:reset` and
// `yarn compose:up`).
//
// The minikube run (u6-minikube-run) adds four subcommands, each a call into
// a tested module: `minikube-checks` and `minikube-closed`
// (src/minikubeChecks.ts), `plan-snapshot <file>` and
// `plan-compare <first> <second>` (src/planCompare.ts).
import { load, main, root } from './common.mjs';

const USAGE =
  'Use "yarn e2e", "yarn e2e specs", "yarn e2e checks", "yarn e2e minikube-checks", "yarn e2e minikube-closed", "yarn e2e plan-snapshot <file>" or "yarn e2e plan-compare <first> <second>".';

await main(async () => {
  const part = process.argv[2];
  const rest = process.argv.slice(3);
  if (part === 'minikube-checks' || part === 'minikube-closed') {
    const { realChecksDeps, runClosedCheck, runMinikubeChecks } =
      await load('minikubeChecks');
    const deps = realChecksDeps(root, console.log);
    await (part === 'minikube-checks' ? runMinikubeChecks : runClosedCheck)(
      deps,
    );
    return;
  }
  if (part === 'plan-snapshot' && rest.length === 1) {
    const { snapshotPlan } = await load('planCompare');
    await snapshotPlan(rest[0], fetch, console.log);
    return;
  }
  if (part === 'plan-compare' && rest.length === 2) {
    const { comparePlanFiles } = await load('planCompare');
    comparePlanFiles(rest[0], rest[1], console.log);
    return;
  }
  if (part !== undefined && part !== 'specs' && part !== 'checks') {
    throw new Error(USAGE);
  }
  const { runChecks, runSpecs } = await load('e2eRun');
  const { realRunner } = await load('runner');
  const deps = { run: realRunner, root, log: console.log };
  if (part !== 'checks') runSpecs(deps);
  if (part !== 'specs') runChecks(deps);
});
