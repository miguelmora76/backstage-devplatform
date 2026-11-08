import type { Knex } from 'knex';
import { initMigrated, createTestDatabases } from '../testing/testDatabases';
import { createAuditStore } from './auditStore';
import type { AuditStore, NewAuditEntry } from './types';

const databases = createTestDatabases();

function entry(overrides: Partial<NewAuditEntry> = {}): NewAuditEntry {
  return {
    time: '2026-01-01T10:00:00.000Z',
    actor: 'sam',
    action: 'propose',
    service: 'orders',
    target: 'dep-1',
    outcome: 'proposed',
    changeId: 'c1',
    decisionNumber: 0,
    ...overrides,
  };
}

describe.each(databases.eachSupportedId())('audit store on %s', id => {
  let knex: Knex;
  let audit: AuditStore;

  beforeEach(async () => {
    knex = await initMigrated(databases, id);
    audit = createAuditStore(knex);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('appends an entry and reads every field back', async () => {
    await audit.append(
      entry({
        action: 'approve',
        outcome: 'applied',
        reason: '  as submitted ',
        decisionNumber: 1,
      }),
    );
    const page = await audit.read('orders', {});
    expect(page).toMatchObject({ page: 1, pageSize: 20, total: 1 });
    expect(page.items[0]).toMatchObject({
      time: '2026-01-01T10:00:00.000Z',
      actor: 'sam',
      action: 'approve',
      service: 'orders',
      target: 'dep-1',
      outcome: 'applied',
      reason: '  as submitted ',
      changeId: 'c1',
      decisionNumber: 1,
    });
    expect(typeof page.items[0].entryId).toBe('string');
  });

  it('has no effect when the same (changeId, decisionNumber) is appended twice', async () => {
    await audit.append(entry());
    await audit.append(entry({ actor: 'priya', outcome: 'applied' }));
    const page = await audit.read('orders', {});
    expect(page.total).toBe(1);
    expect(page.items[0].actor).toBe('sam');
  });

  it('keeps several refused entries that have no decision number', async () => {
    await audit.append(
      entry({ outcome: 'refused', decisionNumber: undefined }),
    );
    await audit.append(
      entry({ outcome: 'refused', decisionNumber: undefined }),
    );
    expect((await audit.read('orders', {})).total).toBe(2);
  });

  it('reads newest first by time, then by entry id for equal times', async () => {
    await audit.append(
      entry({ changeId: 'a', time: '2026-01-01T10:00:00.000Z' }),
    );
    await audit.append(
      entry({ changeId: 'b', time: '2026-01-01T11:00:00.000Z' }),
    );
    await audit.append(
      entry({ changeId: 'c', time: '2026-01-01T10:00:00.000Z' }),
    );
    await audit.append(
      entry({ changeId: 'd', time: '2026-01-01T10:00:00.000Z' }),
    );
    const page = await audit.read('orders', {});
    expect(page.items.map(e => e.changeId)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('scopes reads to one service and returns an empty page when there are none', async () => {
    await audit.append(entry({ service: 'billing', changeId: 'x' }));
    const page = await audit.read('orders', {});
    expect(page).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it('filters by from and to (inclusive), actor, action and outcome', async () => {
    await audit.append(
      entry({ changeId: 'a', time: '2026-01-01T09:00:00.000Z' }),
    );
    await audit.append(
      entry({
        changeId: 'b',
        time: '2026-01-01T10:00:00.000Z',
        actor: 'priya',
        action: 'approve',
        outcome: 'applied',
        decisionNumber: 1,
      }),
    );
    await audit.append(
      entry({
        changeId: 'c',
        time: '2026-01-01T11:00:00.000Z',
        actor: 'priya',
        action: 'reject',
        outcome: 'rejected',
        decisionNumber: 1,
      }),
    );
    const ids = async (q: object) =>
      (await audit.read('orders', q)).items.map(e => e.changeId);

    expect(
      await ids({
        from: '2026-01-01T10:00:00.000Z',
        to: '2026-01-01T11:00:00.000Z',
      }),
    ).toEqual(['c', 'b']);
    expect(await ids({ from: '2026-01-01T10:00:00.001Z' })).toEqual(['c']);
    expect(await ids({ to: '2026-01-01T09:00:00.000Z' })).toEqual(['a']);
    expect(await ids({ actor: 'priya' })).toEqual(['c', 'b']);
    expect(await ids({ action: 'approve' })).toEqual(['b']);
    expect(await ids({ outcome: 'rejected' })).toEqual(['c']);
    expect(await ids({ actor: 'priya', outcome: 'applied' })).toEqual(['b']);
  });

  it('pages with default 20 and at most 100, and counts the total', async () => {
    for (let i = 0; i < 25; i++) {
      await audit.append(
        entry({
          changeId: `c${i}`,
          time: new Date(Date.UTC(2026, 0, 1, 10, 0, i)).toISOString(),
        }),
      );
    }
    const first = await audit.read('orders', {});
    expect(first.items).toHaveLength(20);
    expect(first.total).toBe(25);
    const second = await audit.read('orders', { page: 2 });
    expect(second.items).toHaveLength(5);
    expect(second.items[0].changeId).toBe('c4');
    const small = await audit.read('orders', { page: 3, pageSize: 10 });
    expect(small.items).toHaveLength(5);
    await expect(audit.read('orders', { pageSize: 101 })).rejects.toThrow(
      RangeError,
    );
    await expect(audit.read('orders', { page: 0 })).rejects.toThrow(RangeError);
  });

  it('exposes no way to update or delete an entry, and the database refuses it too', async () => {
    const methods = Object.getOwnPropertyNames(
      Object.getPrototypeOf(audit),
    ).concat(Object.keys(audit));
    expect(
      methods.filter(m => /update|delete|remove|truncate|clear/i.test(m)),
    ).toEqual([]);

    await audit.append(entry());
    await expect(
      knex('audit_entries').update({ actor: 'priya' }),
    ).rejects.toThrow(/append-only/);
    await expect(knex('audit_entries').delete()).rejects.toThrow(/append-only/);
    expect((await audit.read('orders', {})).items[0].actor).toBe('sam');
  });

  it('lists which (changeId, decisionNumber) pairs already have an entry', async () => {
    await audit.append(entry({ changeId: 'a', decisionNumber: 0 }));
    await audit.append(
      entry({
        changeId: 'a',
        decisionNumber: 1,
        outcome: 'applied',
        action: 'approve',
      }),
    );
    const keys = await audit.findDecisionKeys(['a', 'b']);
    expect([...keys].sort()).toEqual(['a:0', 'a:1']);
    expect((await audit.findDecisionKeys([])).size).toBe(0);
  });

  it('stores hostile text in filters and reasons as plain text', async () => {
    const hostile = `'; delete from audit_entries; --`;
    await audit.append(entry({ service: hostile, reason: hostile }));
    const page = await audit.read(hostile, { actor: hostile });
    expect(page.total).toBe(0);
    const ok = await audit.read(hostile, {});
    expect(ok.items[0].reason).toBe(hostile);
  });
});
