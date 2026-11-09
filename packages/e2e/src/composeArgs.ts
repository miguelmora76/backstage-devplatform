import { CommandResult, RunOptions, Runner } from './runner';

export const PROJECT_NAME = 'guardrails-sample';
export const ENV_FILE = '.env.compose';

const FORBIDDEN = new Set(['-p', '--project-name', '--env-file']);

/**
 * The one place that builds the arguments of a `docker compose` call. Every
 * call names the project and the env file, so none of them can read a
 * developer's own `.env` (which holds addresses for `yarn start:local`).
 */
export function composeArgs(extra: string[]): string[] {
  if (extra.some(arg => FORBIDDEN.has(arg))) {
    throw new Error(
      'A compose call must not set its own project name and env file; composeArgs sets them.',
    );
  }
  return [
    'compose',
    '--project-name',
    PROJECT_NAME,
    '--env-file',
    ENV_FILE,
    ...extra,
  ];
}

/** The one call that needs no project or env file: asking for the Compose version. */
export const COMPOSE_VERSION_ARGS = ['compose', 'version'];

export function runCompose(
  run: Runner,
  extra: string[],
  options?: RunOptions,
): CommandResult {
  return run('docker', composeArgs(extra), options);
}
