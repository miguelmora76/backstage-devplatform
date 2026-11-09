// `yarn compose:up`: see src/commands.ts.
import { load, main, root } from './common.mjs';

await main(async () => {
  const { composeUp } = await load('commands');
  const { realRunner } = await load('runner');
  composeUp({ run: realRunner, root, env: process.env, log: console.log });
});
