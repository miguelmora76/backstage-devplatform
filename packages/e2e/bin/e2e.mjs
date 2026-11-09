// `yarn e2e [specs|checks]`: see src/e2eRun.ts. With no argument it runs the
// specs and then the checks (start from `yarn compose:reset` and
// `yarn compose:up`).
import { load, main, root } from './common.mjs';

await main(async () => {
  const { runChecks, runSpecs } = await load('e2eRun');
  const { realRunner } = await load('runner');
  const deps = { run: realRunner, root, log: console.log };
  const part = process.argv[2];
  if (part !== undefined && part !== 'specs' && part !== 'checks') {
    throw new Error('Use "yarn e2e", "yarn e2e specs" or "yarn e2e checks".');
  }
  if (part !== 'checks') runSpecs(deps);
  if (part !== 'specs') runChecks(deps);
});
