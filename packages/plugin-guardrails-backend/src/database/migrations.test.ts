import type { Knex } from 'knex';
import { migrate } from './migrate';
import {
  AUDIT_COLUMNS,
  AUDIT_TABLE,
  CHANGES_TABLE,
  CHANGE_COLUMNS,
} from './tables';
import { expectDatabaseError } from '../testing/expectDatabaseError';
import { createTestDatabases } from '../testing/testDatabases';

const databases = createTestDatabases();

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    time: new Date('2026-01-01T10:00:00Z').toISOString(),
    actor: 'sam',
    action: 'propose',
    service: 'orders',
    target: 'dep-1',
    outcome: 'proposed',
    change_id: 'c1',
    decision_number: 0,
    ...overrides,
  };
}

async function indexNames(knex: Knex, table: string): Promise<string[]> {
  if (knex.client.dialect === 'postgresql') {
    const res = await knex.raw(
      'select indexname from pg_indexes where tablename = ?',
      [table],
    );
    return res.rows.map((r: { indexname: string }) => r.indexname);
  }
  const res = await knex.raw(`pragma index_list(${table})`);
  return (res as Array<{ name: string }>).map(r => r.name);
}

describe.each(databases.eachSupportedId())('migrations on %s', id => {
  let knex: Knex;

  beforeEach(async () => {
    knex = await databases.init(id);
    await migrate(knex);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('creates the changes and audit_entries tables with the columns of entities.md', async () => {
    const changes = Object.keys(await knex(CHANGES_TABLE).columnInfo());
    const audit = Object.keys(await knex(AUDIT_TABLE).columnInfo());
    expect(changes.sort()).toEqual([...CHANGE_COLUMNS].sort());
    expect(audit.sort()).toEqual([...AUDIT_COLUMNS].sort());
  });

  it('indexes the audit table by service and time', async () => {
    expect(await indexNames(knex, 'audit_entries')).toContain(
      'audit_entries_service_time_idx',
    );
  });

  it('keeps (change_id, decision_number) unique and allows entries without a decision number', async () => {
    await knex('audit_entries').insert(auditRow());
    await expectDatabaseError(knex('audit_entries').insert(auditRow()));
    // refused entries have no decision number: several for one change are fine
    await knex('audit_entries').insert(
      auditRow({ outcome: 'refused', decision_number: null }),
    );
    await knex('audit_entries').insert(
      auditRow({ outcome: 'refused', decision_number: null }),
    );
    const [{ count }] = await knex('audit_entries').count({ count: '*' });
    expect(Number(count)).toBe(3);
  });

  it('raises an error on update of an audit entry and leaves it unchanged', async () => {
    await knex('audit_entries').insert(auditRow());
    await expectDatabaseError(
      knex('audit_entries').update({ actor: 'priya' }),
      /append-only/,
    );
    const row = await knex('audit_entries').first();
    expect(row.actor).toBe('sam');
  });

  it('raises an error on delete of an audit entry and leaves it in place', async () => {
    await knex('audit_entries').insert(auditRow());
    await expectDatabaseError(knex('audit_entries').delete(), /append-only/);
    const [{ count }] = await knex('audit_entries').count({ count: '*' });
    expect(Number(count)).toBe(1);
  });

  it('is repeatable: running the migrations again changes nothing and fails nothing', async () => {
    await knex('audit_entries').insert(auditRow());
    await migrate(knex);
    await migrate(knex);
    const [{ count }] = await knex('audit_entries').count({ count: '*' });
    expect(Number(count)).toBe(1);
  });

  it('defaults a new change to decision_count 0', async () => {
    await knex('changes').insert({
      change_id: 'c1',
      kind: 'upgrade',
      service: 'orders',
      target: 'dep-1',
      summary: 's',
      proposed_by: 'sam',
      status: 'pending',
      proposed_at: new Date().toISOString(),
    });
    const row = await knex('changes').first();
    expect(Number(row.decision_count)).toBe(0);
  });
});

const postgresOnly = databases.supports('POSTGRES_16')
  ? describe
  : describe.skip;

postgresOnly('PostgreSQL-only audit rules', () => {
  it('blocks truncate of the audit table', async () => {
    const knex = await databases.init('POSTGRES_16');
    await migrate(knex);
    await knex('audit_entries').insert(auditRow());
    await expectDatabaseError(
      knex.raw('truncate table audit_entries'),
      /append-only/,
    );
    const [{ count }] = await knex('audit_entries').count({ count: '*' });
    expect(Number(count)).toBe(1);
    await knex.destroy();
  });
});
