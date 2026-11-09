const USAGE = 'Usage: yarn start:local [--demo]';

export interface StartFlags {
  demo: boolean;
}

/** Reads `--demo`, the only option of `yarn start:local`. */
export function parseStartArgs(args: readonly string[]): StartFlags {
  const flags: StartFlags = { demo: false };
  for (const arg of args) {
    if (arg === '--demo') {
      flags.demo = true;
    } else {
      throw new Error(USAGE);
    }
  }
  return flags;
}

/** Reads `NAME=value` lines of a `.env` file; comments, blanks and other lines are ignored. */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    values[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

/**
 * The environment for a local run: what is already set in the shell wins over
 * the `.env` file, and `--demo` turns the demo sign-in on for this run only
 * (BR4.2, infrastructure specification, Environment Variables).
 */
export function buildStartEnv(
  shell: Record<string, string | undefined>,
  fileValues: Record<string, string>,
  flags: StartFlags,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = { ...fileValues, ...shell };
  if (flags.demo) {
    env.GUARDRAILS_DEMO_SIGN_IN = 'true';
  }
  return env;
}
