import { resolvePackagePath } from '@backstage/backend-plugin-api';
import type { Knex } from 'knex';

/**
 * Runs the versioned migrations (NFR2.4). Safe to call on every start-up:
 * migrations already applied are skipped.
 */
export async function migrate(knex: Knex): Promise<void> {
  const directory = resolvePackagePath(
    'plugin-guardrails-backend',
    'migrations',
  );
  await knex.migrate.latest({ directory });
}
