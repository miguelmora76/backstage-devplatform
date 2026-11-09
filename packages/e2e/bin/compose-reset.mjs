// `yarn compose:reset`: see src/commands.ts.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { composeReset } = await load('commands');
  const { realRunner } = await load('runner');
  composeReset({ run: realRunner, root, env: process.env, log: console.log });
});
