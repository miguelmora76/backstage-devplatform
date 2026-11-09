// NFR7.2: a bad start is loud. Starts the real backend (not the test backend)
// with GUARDRAILS_SERVER_URL missing and checks that it exits with a code
// other than 0 and that its output names the setting `guardrails.server.url`,
// so the compose run shows the failure. Never prints a value.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env };
delete env.GUARDRAILS_SERVER_URL;

// The real entry point, run once (not the watching dev server), with the same
// source loader `backstage-cli package start` uses for workspace packages.
const transform = createRequire(import.meta.url).resolve(
  '@backstage/cli/config/nodeTransform.cjs',
);
const result = spawnSync(
  process.execPath,
  ['--require', transform, 'src/index.ts', '--config', 'app-config.yaml'],
  { cwd: root, env, encoding: 'utf8', timeout: 120_000 },
);
const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

if (result.error) {
  console.error(`Could not start the backend: ${result.error.message}`);
  process.exit(1);
}
if (result.status === 0 || result.status === null) {
  console.error(
    `Expected a non-zero exit code when GUARDRAILS_SERVER_URL is missing; got ${result.status}.`,
  );
  process.exit(1);
}
if (!output.includes('guardrails.server.url')) {
  console.error('The start failure does not name guardrails.server.url.');
  console.error(output.split('\n').slice(-15).join('\n'));
  process.exit(1);
}
console.log(
  `Start without GUARDRAILS_SERVER_URL fails loudly (exit code ${result.status}) and names guardrails.server.url.`,
);
