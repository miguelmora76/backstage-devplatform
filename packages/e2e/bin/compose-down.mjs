// `yarn compose:down`: see src/commands.ts.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { composeDown } = await load('commands');
  const { realRunner } = await load('runner');
  composeDown({ run: realRunner, root, env: process.env, log: console.log });
});
