// `yarn e2e:timing`: see src/e2eRun.ts. Exits non-zero when the 95th
// percentile of 20 loads of any view is over 5000 ms.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { runTiming } = await load('e2eRun');
  const { realRunner } = await load('runner');
  runTiming({ run: realRunner, root, log: console.log });
});
