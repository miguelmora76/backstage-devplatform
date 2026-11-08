import type { Knex } from 'knex';
import { initMigrated, createTestDatabases } from '../testing/testDatabases';
import { createAuditStore } from './auditStore';
import { createChangeStore } from './changeStore';
import type { AuditStore, ChangeStore, NewChange } from './types';

const databases = createTestDatabases();

const T0 = '2026-01-01T10:00:00.000Z';
const T1 = '2026-01-01T10:00:10.000Z';
const T2 = '2026-01-01T10:01:00.000Z';

function newChange(overrides: Partial<NewChange> = {}): NewChange {
  return {
    changeId: 'chg-001',
    kind: 'upgrade',
    service: 'orders',
    target: 'dep-1',
    summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
    proposedBy: 'sam',
    proposedAt: T0,
    ...overrides,
  };
}

describe.each(databases.eachSupportedId())('change store on %s', id => {
  let knex: Knex;
  let changes: ChangeStore;
  let audit: AuditStore;

  beforeEach(async () => {
    knex = await initMigrated(databases, id);
    changes = createChangeStore(knex);
    audit = createAuditStore(knex);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  it('inserts a pending change with decision count 0 and reads it back', async () => {
    const created = await changes.insert(newChange());
    expect(created).toMatchObject({
      changeId: 'chg-001',
      kind: 'upgrade',
      service: 'orders',
      target: 'dep-1',
      status: 'pending',
      proposedBy: 'sam',
      proposedAt: T0,
      decisionCount: 0,
    });
    expect(created.claimToken).toBeUndefined();
    expect(await changes.get('chg-001')).toEqual(created);
    expect(await changes.get('missing')).toBeUndefined();
  });

  it('inserts the proposal audit entry in the same transaction when one is given', async () => {
    await changes.insert(newChange(), {
      time: T0,
      actor: 'sam',
      action: 'propose',
      service: 'orders',
      target: 'dep-1',
      outcome: 'proposed',
      changeId: 'chg-001',
      decisionNumber: 0,
    });
    const page = await audit.read('orders', {});
    expect(page.total).toBe(1);
    expect(page.items[0]).toMatchObject({
      outcome: 'proposed',
      changeId: 'chg-001',
    });
  });

  it('lists the changes of one service newest first with a status filter and a limit', async () => {
    await changes.insert(newChange({ changeId: 'a', proposedAt: T0 }));
    await changes.insert(newChange({ changeId: 'b', proposedAt: T1 }));
    await changes.insert(newChange({ changeId: 'c', proposedAt: T1 }));
    await changes.insert(newChange({ changeId: 'x', service: 'billing' }));
    await changes.claim('a', {
      expectedStatus: 'pending',
      token: 't',
      at: T1,
      by: 'priya',
      action: 'approve',
      reason: 'ok',
    });

    const all = await changes.list('orders', { limit: 200 });
    expect(all.map(c => c.changeId)).toEqual(['c', 'b', 'a']);
    const onlyPending = await changes.list('orders', {
      statuses: ['pending'],
      limit: 200,
    });
    expect(onlyPending.map(c => c.changeId)).toEqual(['c', 'b']);
    const limited = await changes.list('orders', { limit: 2 });
    expect(limited.map(c => c.changeId)).toEqual(['c', 'b']);
    expect(await changes.list('none', { limit: 200 })).toEqual([]);
  });

  it('claims with one conditional update and exactly one winner', async () => {
    await changes.insert(newChange());
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        changes.claim('chg-001', {
          expectedStatus: 'pending',
          token: `token-${i}`,
          at: T1,
          by: 'priya',
          action: 'approve',
          reason: `reason ${i}`,
        }),
      ),
    );
    const winners = attempts.filter(Boolean);
    expect(winners).toHaveLength(1);
    const stored = await changes.get('chg-001');
    expect(stored).toMatchObject({
      status: 'deciding',
      claimedBy: 'priya',
      claimedAction: 'approve',
      claimPreviousStatus: 'pending',
      claimedAt: T1,
    });
    expect(stored?.claimToken).toBe(winners[0]?.claimToken);
  });

  it('claims a failed change only for a retry and a pending one only for approve or reject', async () => {
    await changes.insert(newChange());
    const wrong = await changes.claim('chg-001', {
      expectedStatus: 'failed',
      token: 't1',
      at: T1,
      by: 'priya',
      action: 'retry',
      reason: 'again',
    });
    expect(wrong).toBeUndefined();
    expect((await changes.get('chg-001'))?.status).toBe('pending');
  });

  it('finishes only with the caller own claim token, clears the claim and appends the entry in one transaction', async () => {
    await changes.insert(newChange());
    const claim = await changes.claim('chg-001', {
      expectedStatus: 'pending',
      token: 'mine',
      at: T1,
      by: 'priya',
      action: 'approve',
      reason: '  keep spaces  ',
    });
    expect(claim?.claimToken).toBe('mine');

    const wrongToken = await changes.finish(
      'chg-001',
      'someone-else',
      {
        status: 'applied',
        decidedBy: 'priya',
        reason: '  keep spaces  ',
        decidedAt: T2,
        action: 'approve',
        outcome: 'applied',
      },
      c => ({
        time: T2,
        actor: 'priya',
        action: 'approve',
        service: c.service,
        target: c.target,
        outcome: 'applied',
        changeId: c.changeId,
        decisionNumber: c.decisionCount,
      }),
    );
    expect(wrongToken).toBeUndefined();
    expect((await audit.read('orders', {})).total).toBe(0);

    const done = await changes.finish(
      'chg-001',
      'mine',
      {
        status: 'applied',
        decidedBy: 'priya',
        reason: '  keep spaces  ',
        decidedAt: T2,
        action: 'approve',
        outcome: 'applied',
      },
      c => ({
        time: T2,
        actor: 'priya',
        action: 'approve',
        service: c.service,
        target: c.target,
        outcome: 'applied',
        reason: '  keep spaces  ',
        changeId: c.changeId,
        decisionNumber: c.decisionCount,
      }),
    );
    expect(done).toMatchObject({
      status: 'applied',
      decidedBy: 'priya',
      decisionReason: '  keep spaces  ',
      decisionCount: 1,
      lastAction: 'approve',
      lastOutcome: 'applied',
    });
    expect(done?.claimToken).toBeUndefined();
    expect(done?.claimedAt).toBeUndefined();
    const page = await audit.read('orders', {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      decisionNumber: 1,
      reason: '  keep spaces  ',
    });
  });

  it('sets a failure message on a failed finish and clears it when a retry succeeds', async () => {
    await changes.insert(newChange());
    await changes.claim('chg-001', {
      expectedStatus: 'pending',
      token: 't1',
      at: T1,
      by: 'priya',
      action: 'approve',
      reason: 'go',
    });
    const failed = await changes.finish('chg-001', 't1', {
      status: 'failed',
      decidedBy: 'priya',
      reason: 'go',
      decidedAt: T1,
      action: 'approve',
      outcome: 'failed',
      failureMessage: 'The guardrails server failed (FORCED_FAILURE).',
    });
    expect(failed?.failureMessage).toMatch(/FORCED_FAILURE/);

    await changes.claim('chg-001', {
      expectedStatus: 'failed',
      token: 't2',
      at: T2,
      by: 'priya',
      action: 'retry',
      reason: 'again',
    });
    const applied = await changes.finish('chg-001', 't2', {
      status: 'applied',
      decidedBy: 'priya',
      reason: 'again',
      decidedAt: T2,
      action: 'retry',
      outcome: 'applied',
    });
    expect(applied?.failureMessage).toBeUndefined();
    expect(applied?.decisionCount).toBe(2);
  });

  it('releases an approve claim older than the cutoff to failed Interrupted with its entry, once', async () => {
    await changes.insert(newChange());
    await changes.claim('chg-001', {
      expectedStatus: 'pending',
      token: 't1',
      at: T0,
      by: 'priya',
      action: 'approve',
      reason: 'go ahead',
    });
    const released = await changes.releaseStale('2026-01-01T09:59:59.000Z', T2);
    expect(released).toHaveLength(0);

    const first = await changes.releaseStale('2026-01-01T10:00:30.000Z', T2);
    expect(first).toHaveLength(1);
    const row = await changes.get('chg-001');
    expect(row).toMatchObject({
      status: 'failed',
      failureMessage: 'Interrupted',
      decisionCount: 1,
      decidedBy: 'priya',
      decisionReason: 'go ahead',
      lastAction: 'approve',
      lastOutcome: 'failed',
    });
    expect(row?.claimToken).toBeUndefined();

    const second = await changes.releaseStale('2026-01-01T10:00:30.000Z', T2);
    expect(second).toHaveLength(0);
    const page = await audit.read('orders', {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actor: 'priya',
      action: 'approve',
      outcome: 'failed',
      reason: 'go ahead',
      decisionNumber: 1,
    });
  });

  it('releases a reject claim back to pending without changing the decision count', async () => {
    await changes.insert(newChange());
    await changes.claim('chg-001', {
      expectedStatus: 'pending',
      token: 't1',
      at: T0,
      by: 'priya',
      action: 'reject',
      reason: 'no thanks',
    });
    await changes.releaseStale('2026-01-01T10:00:30.000Z', T2);
    const row = await changes.get('chg-001');
    expect(row).toMatchObject({ status: 'pending', decisionCount: 0 });
    const page = await audit.read('orders', {});
    expect(page.items[0]).toMatchObject({
      action: 'reject',
      outcome: 'failed',
      reason: 'no thanks',
    });
    expect(page.items[0].decisionNumber).toBeUndefined();
  });

  it('refuses a finish after the claim was released', async () => {
    await changes.insert(newChange());
    await changes.claim('chg-001', {
      expectedStatus: 'pending',
      token: 't1',
      at: T0,
      by: 'priya',
      action: 'approve',
      reason: 'go',
    });
    await changes.releaseStale('2026-01-01T10:00:30.000Z', T2);
    const late = await changes.finish('chg-001', 't1', {
      status: 'applied',
      decidedBy: 'priya',
      reason: 'go',
      decidedAt: T2,
      action: 'approve',
      outcome: 'applied',
    });
    expect(late).toBeUndefined();
    expect((await changes.get('chg-001'))?.status).toBe('failed');
  });

  it('finds changes whose latest proposal or decision has no audit entry', async () => {
    await changes.insert(newChange({ changeId: 'no-entry' }));
    await changes.insert(newChange({ changeId: 'with-entry' }), {
      time: T0,
      actor: 'sam',
      action: 'propose',
      service: 'orders',
      target: 'dep-1',
      outcome: 'proposed',
      changeId: 'with-entry',
      decisionNumber: 0,
    });
    await changes.insert(newChange({ changeId: 'other', service: 'billing' }));
    const missing = await changes.findMissingLatestEntries('orders');
    expect(missing.map(c => c.changeId)).toEqual(['no-entry']);
  });

  it('stores quote and statement characters as plain text', async () => {
    const hostile = `x'; drop table changes; --`;
    await changes.insert(
      newChange({ changeId: 'h1', service: hostile, summary: hostile }),
    );
    const listed = await changes.list(hostile, { limit: 200 });
    expect(listed).toHaveLength(1);
    expect(listed[0].summary).toBe(hostile);
    expect(await changes.get('h1')).toBeDefined();
  });
});
