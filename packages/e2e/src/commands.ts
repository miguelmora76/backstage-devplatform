import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkDocker } from './checkDocker';
import { ENV_FILE, PROJECT_NAME, runCompose } from './composeArgs';
import { ensureEnvFile, RandomSource, refuseOtherSeed } from './envFile';
import { Runner } from './runner';

export const SERVICES = ['postgres', 'guardrails-server', 'app'];
export const ADDRESS = 'http://localhost:7007';

export interface Deps {
  run: Runner;
  /** The repository root: compose.yaml and the env file live here. */
  root: string;
  env: NodeJS.ProcessEnv;
  log: (message: string) => void;
  random?: RandomSource;
}

const VOLUME = `${PROJECT_NAME}_postgres-data`;

/** The status of every service and each service's log: what a failed start prints (NFR2.6). */
export function printFailure(deps: Deps): void {
  const ps = runCompose(deps.run, ['ps', '--all'], { cwd: deps.root });
  deps.log(ps.stdout || ps.stderr);
  for (const service of SERVICES) {
    const logs = runCompose(deps.run, ['logs', '--no-color', service], {
      cwd: deps.root,
    });
    deps.log(`--- log of ${service} ---\n${logs.stdout || logs.stderr}`);
  }
}

/** `yarn compose:up` (NFR2.2): one command, no other manual step. */
export function composeUp(deps: Deps): void {
  checkDocker(deps.run);
  const envPath = join(deps.root, ENV_FILE);
  refuseOtherSeed(
    deps.env,
    existsSync(envPath) ? readFileSync(envPath, 'utf8') : '',
  );
  const { created } = ensureEnvFile({
    dir: deps.root,
    random: deps.random,
    volumeExists: () =>
      deps.run('docker', ['volume', 'inspect', VOLUME]).status === 0,
  });
  deps.log(
    created
      ? `Created ${ENV_FILE} with a generated database password (not shown).`
      : `Using the existing ${ENV_FILE}.`,
  );
  const up = runCompose(
    deps.run,
    ['up', '--build', '--wait', '--wait-timeout', '180'],
    { cwd: deps.root, inherit: true },
  );
  if (up.status !== 0) {
    printFailure(deps);
    throw new Error(
      'The sample did not become healthy within 180 seconds (see the status and logs above).',
    );
  }
  deps.log(`The sample is running. Open ${ADDRESS}`);
}

function down(deps: Deps, extra: string[], done: string): void {
  checkDocker(deps.run);
  if (!existsSync(join(deps.root, ENV_FILE))) {
    deps.log(`There is no ${ENV_FILE}, so there is nothing to stop.`);
    return;
  }
  const result = runCompose(deps.run, ['down', ...extra], {
    cwd: deps.root,
    inherit: true,
  });
  if (result.status !== 0) {
    throw new Error(
      `docker compose down failed (exit ${result.status}): ${result.stderr}`,
    );
  }
  deps.log(done);
}

/** `yarn compose:down`: stops the containers and keeps the database volume (NFR2.8). */
export function composeDown(deps: Deps): void {
  down(deps, [], 'Stopped. The database volume was kept.');
}

/** `yarn compose:reset`: stops them and removes the volume as well (NFR2.8). */
export function composeReset(deps: Deps): void {
  down(
    deps,
    ['--volumes', '--remove-orphans'],
    'Stopped. The database volume was removed, so the sample data is gone.',
  );
}
