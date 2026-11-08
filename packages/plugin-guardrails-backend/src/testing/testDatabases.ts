import { TestDatabases, TestDatabaseId } from '@backstage/backend-test-utils';
import type { Knex } from 'knex';
import { migrate } from '../database/migrate';

export const POSTGRES_CONNECTION_ENV =
  'BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING';

/** True when a PostgreSQL 16 connection string is set for the rule tests. */
export const postgresConfigured = Boolean(process.env[POSTGRES_CONNECTION_ENV]);

/**
 * Test databases: in-memory SQLite always, real PostgreSQL only when the
 * connection string variable is set. Docker is never started from tests, so
 * the PostgreSQL cases skip cleanly when the variable is unset.
 */
export function createTestDatabases(): TestDatabases {
  const ids: TestDatabaseId[] = ['SQLITE_3'];
  if (postgresConfigured) {
    ids.push('POSTGRES_16');
  }
  return TestDatabases.create({ ids });
}

/** A fresh migrated database for one test. */
export async function initMigrated(
  databases: TestDatabases,
  id: TestDatabaseId,
): Promise<Knex> {
  const knex = await databases.init(id);
  await migrate(knex);
  return knex;
}
