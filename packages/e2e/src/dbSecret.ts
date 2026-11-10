import { randomBytes } from 'node:crypto';
import { generatePassword, RandomSource } from './envFile';
import { runKubectl } from './minikubeArgs';
import { Runner } from './runner';

export const SECRET_NAME = 'guardrails-db';
/** The claim the StatefulSet `postgres` creates from its `postgres-data` template. */
export const CLAIM_NAME = 'postgres-data-postgres-0';

const isNotFound = (stderr: string) => /NotFound|not found/i.test(stderr);

function exists(run: Runner, kind: 'secret' | 'pvc', name: string): boolean {
  const result = runKubectl(run, ['get', kind, name, '-o', 'name']);
  if (result.error) {
    throw new Error(
      `kubectl could not be run (${result.error}). Nothing was changed.`,
    );
  }
  if (result.status === 0) return true;
  if (isNotFound(result.stderr)) return false;
  throw new Error(
    `Could not look for ${kind} ${name}: ${result.stderr.trim() || `exit ${result.status}`}. Nothing was changed.`,
  );
}

/**
 * Makes sure the database Secret exists (NFR5.14). An existing Secret is left
 * as it is. A new one gets a random value that goes to `kubectl` on standard
 * input: it is in no argument list, file, log or return value.
 */
export function ensureSecret(
  run: Runner,
  random: RandomSource = randomBytes,
): { created: boolean } {
  if (exists(run, 'secret', SECRET_NAME)) {
    return { created: false };
  }
  if (exists(run, 'pvc', CLAIM_NAME)) {
    throw new Error(
      `The database claim ${CLAIM_NAME} exists but the Secret ${SECRET_NAME} does not, so a new password would not match the stored data. Run "yarn minikube:down" to remove the sample (this deletes the sample data), then start again.`,
    );
  }
  const value = generatePassword(random);
  const result = runKubectl(
    run,
    [
      'create',
      'secret',
      'generic',
      SECRET_NAME,
      '--from-file=POSTGRES_PASSWORD=/dev/stdin',
    ],
    { input: value },
  );
  if (result.error || result.status !== 0) {
    const detail = (result.error ?? result.stderr).split(value).join('***');
    throw new Error(
      `Could not create the Secret ${SECRET_NAME}: ${detail.trim() || `exit ${result.status}`}`,
    );
  }
  return { created: true };
}
