import { knex as createKnex } from 'knex';
import { migrate } from '../database/migrate';
import { createAuditStore } from '../store/auditStore';
import { createChangeStore } from '../store/changeStore';
import {
  alex,
  createHarness,
  priya,
  sam,
  type Harness,
} from '../testing/harness';
import {
  createTestDatabases,
  postgresConfigured,
} from '../testing/testDatabases';

/**
 * Rule tests on a real PostgreSQL (NFR2.9): the claim, the release, the repair,
 * the append-only rule, a restart and concurrency only mean something on a real
 * engine. Skipped when BACKSTAGE_TEST_DATABASE_POSTGRES16_CONNECTION_STRING is
 * not set; CI sets it from its service container.
 */
const describePostgres = postgresConfigured ? describe : describe.skip;

const databases = createTestDatabases();

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

async function timed<T>(call: () => Promise<T>): Promise<number> {
  const started = performance.now();
  await call();
  return performance.now() - started;
}

describePostgres('rule tests on PostgreSQL', () => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness(databases, 'POSTGRES_16');
  });

  afterEach(async () => {
    await h.close();
  });

  const entries = async () =>
    (await h.audit.read('orders', { pageSize: 100 })).items;

  it('NFR1.7: ten simultaneous decisions give one winner and nine ALREADY_DECIDED', async () => {
    const { changeId } = await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        h.workflow.decide(priya, 'approve', changeId, `attempt ${i}`).then(
          () => 'won',
          (e: { code: string }) => e.code,
        ),
      ),
    );
    expect(results.filter(r => r === 'won')).toHaveLength(1);
    expect(results.filter(r => r === 'ALREADY_DECIDED')).toHaveLength(9);
    const all = await entries();
    expect(all.filter(e => e.outcome === 'applied')).toHaveLength(1);
    expect(all.filter(e => e.outcome === 'refused')).toHaveLength(9);
    expect(
      h.standIn.calls.filter(c => c.tool === 'apply_dependency_upgrade'),
    ).toHaveLength(1);
    expect((await h.changes.get(changeId))?.status).toBe('applied');
  });

  it('NFR1.7: ten simultaneous claims through the store have exactly one winner', async () => {
    await h.changes.insert({
      changeId: 'race',
      kind: 'upgrade',
      service: 'orders',
      target: 'dep-1',
      summary: 's',
      proposedBy: 'sam',
      proposedAt: h.clock().toISOString(),
    });
    const claims = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        h.changes.claim('race', {
          expectedStatus: 'pending',
          token: `t${i}`,
          at: h.clock().toISOString(),
          by: 'priya',
          action: 'approve',
          reason: 'x',
        }),
      ),
    );
    expect(claims.filter(Boolean)).toHaveLength(1);
  });

  it('NFR1.8: a claim older than 30 seconds is released within the next read, with its entry', async () => {
    const { changeId } = await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    await h.changes.claim(changeId, {
      expectedStatus: 'pending',
      token: 'stuck',
      at: h.clock().toISOString(),
      by: 'priya',
      action: 'approve',
      reason: 'go',
    });
    h.clock.advance(29_000);
    expect((await h.changes.get(changeId))?.status).toBe('deciding');
    await h.workflow.listChanges(sam, 'orders', 'open');
    expect((await h.changes.get(changeId))?.status).toBe('deciding');

    h.clock.advance(2_000);
    const [view] = await h.workflow.listChanges(sam, 'orders', 'open');
    expect(view).toMatchObject({
      status: 'failed',
      failureMessage: 'Interrupted',
    });
    const [latest] = await entries();
    expect(latest).toMatchObject({
      action: 'approve',
      outcome: 'failed',
      decisionNumber: 1,
    });
  });

  it('NFR5.9: a failure after the claim leaves a change that is released and recorded after 30 seconds', async () => {
    const { changeId } = await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    const spy = jest
      .spyOn(h.changes, 'finish')
      .mockRejectedValueOnce(new Error('forced failure'));
    await expect(
      h.workflow.decide(priya, 'approve', changeId, 'go'),
    ).rejects.toThrow('forced failure');
    spy.mockRestore();

    h.clock.advance(31_000);
    const [view] = await h.workflow.listChanges(sam, 'orders', 'open');
    expect(view).toMatchObject({
      status: 'failed',
      failureMessage: 'Interrupted',
    });
    expect((await entries())[0]).toMatchObject({
      outcome: 'failed',
      decisionNumber: 1,
    });
  });

  it('NFR5.10: every change and entry survives a restart against the same database', async () => {
    const { changeId } = await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    await h.workflow.decide(priya, 'approve', changeId, 'kept');

    const restarted = createKnex({
      client: 'pg',
      connection: h.knex.client.config.connection,
    });
    try {
      await migrate(restarted);
      const change = await createChangeStore(restarted).get(changeId);
      expect(change).toMatchObject({
        status: 'applied',
        decisionReason: 'kept',
      });
      const page = await createAuditStore(restarted).read('orders', {});
      expect(page.total).toBe(2);
    } finally {
      await restarted.destroy();
    }
  });

  it('NFR5.5: the database refuses to change, remove or truncate an audit entry', async () => {
    await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    await expect(
      h.knex('audit_entries').update({ actor: 'alex' }),
    ).rejects.toThrow(/append-only/);
    await expect(h.knex('audit_entries').delete()).rejects.toThrow(
      /append-only/,
    );
    await expect(h.knex.raw('truncate table audit_entries')).rejects.toThrow(
      /append-only/,
    );
    expect(await entries()).toHaveLength(1);
  });

  it('NFR5.7: text with quote and statement characters is stored and filtered as plain text', async () => {
    const hostile = `x'; drop table audit_entries; delete from changes; --`;
    const { changeId } = await h.workflow.propose(sam, 'orders', {
      kind: 'upgrade',
      target: 'dep-1',
    });
    await h.workflow.decide(priya, 'reject', changeId, hostile);
    const [latest] = await entries();
    expect(latest.reason).toBe(hostile);
    expect((await h.changes.get(changeId))?.decisionReason).toBe(hostile);

    expect(await h.workflow.listChanges(sam, hostile, 'open')).toEqual([]);
    const page = await h.workflow.readAudit(hostile, { actor: hostile });
    expect(page.total).toBe(0);
    await h.audit.append({
      time: h.clock().toISOString(),
      actor: 'sam',
      action: 'propose',
      service: hostile,
      target: hostile,
      outcome: 'refused',
      reason: hostile,
    });
    const found = await h.workflow.readAudit(hostile, {});
    expect(found.items[0].target).toBe(hostile);
    expect(await h.knex.schema.hasTable('audit_entries')).toBe(true);
    expect(await h.knex.schema.hasTable('changes')).toBe(true);
  });

  it('NFR1.4: a filtered page read stays within 300 ms at the 95th percentile with 100,000 entries', async () => {
    await h.knex.raw(`
      insert into audit_entries (time, actor, action, service, target, outcome)
      select to_char(timestamp '2026-01-01 00:00:00' + (g * interval '1 second'),
                     'YYYY-MM-DD"T"HH24:MI:SS".000Z"'),
             case when g % 3 = 0 then 'priya' when g % 3 = 1 then 'sam' else 'alex' end,
             'approve', 'orders', 'dep-' || (g % 50), 'applied'
      from generate_series(1, 100000) as g
    `);
    const total = (await h.audit.read('orders', { pageSize: 1 })).total;
    expect(total).toBe(100000);

    const { workflow } = h;
    await workflow.readAudit('orders', { actor: 'priya' }); // warm-up
    const durations: number[] = [];
    for (let i = 0; i < 20; i++) {
      durations.push(
        await timed(() =>
          workflow.readAudit('orders', {
            actor: 'priya',
            outcome: 'applied',
            from: '2026-01-01T06:00:00.000Z',
            page: 2,
            pageSize: 20,
          }),
        ),
      );
    }
    expect(percentile95(durations)).toBeLessThanOrEqual(300);
  });

  it('NFR1.1: reads of changes and of the audit log stay within 300 ms at the 95th percentile', async () => {
    for (let i = 0; i < 100; i++) {
      const id = `seed-${String(i).padStart(4, '0')}`;
      await h.changes.insert(
        {
          changeId: id,
          kind: 'upgrade',
          service: 'orders',
          target: 'dep-1',
          summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
          proposedBy: 'sam',
          proposedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
        },
        {
          time: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          actor: 'sam',
          action: 'propose',
          service: 'orders',
          target: 'dep-1',
          outcome: 'proposed',
          changeId: id,
          decisionNumber: 0,
        },
      );
    }
    const changeReads: number[] = [];
    const auditReads: number[] = [];
    const { workflow } = h;
    await workflow.listChanges(priya, 'orders', 'open'); // warm-up
    for (let i = 0; i < 20; i++) {
      changeReads.push(
        await timed(() => workflow.listChanges(priya, 'orders', 'open')),
      );
      auditReads.push(await timed(() => workflow.readAudit('orders', {})));
    }
    expect(percentile95(changeReads)).toBeLessThanOrEqual(300);
    expect(percentile95(auditReads)).toBeLessThanOrEqual(300);
  });

  it('NFR1.2: a decision answers within 1.2 seconds at the 95th percentile with a server that takes 200 ms', async () => {
    h.standIn.setToolDelay(200);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) {
      const id = `decide-${String(i).padStart(3, '0')}`;
      ids.push(id);
      await h.changes.insert(
        {
          changeId: id,
          kind: 'upgrade',
          service: 'orders',
          target: 'dep-1',
          summary: 's',
          proposedBy: 'sam',
          proposedAt: h.clock().toISOString(),
        },
        {
          time: h.clock().toISOString(),
          actor: 'sam',
          action: 'propose',
          service: 'orders',
          target: 'dep-1',
          outcome: 'proposed',
          changeId: id,
          decisionNumber: 0,
        },
      );
    }
    const durations: number[] = [];
    const { workflow } = h;
    for (const id of ids) {
      durations.push(
        await timed(() => workflow.decide(priya, 'approve', id, 'timing')),
      );
    }
    expect(percentile95(durations)).toBeLessThanOrEqual(1200);
  });

  it('NFR1.5 and NFR1.6: ten simultaneous mixed requests all succeed and memory stays far below 512 MB', async () => {
    const before = process.memoryUsage().rss;
    for (let round = 0; round < 5; round++) {
      const mixed = [
        h.workflow.listChanges(sam, 'orders', 'open'),
        h.workflow.listChanges(alex, 'orders', 'open'),
        h.workflow.readAudit('orders', {}),
        h.workflow.readAudit('orders', { actor: 'sam' }),
        h.workflow.listPlan(sam, 'orders'),
        h.workflow.listCiRuns(priya, 'orders'),
        h.workflow.propose(sam, 'orders', { kind: 'rerun', target: 'run-1' }),
        h.workflow.propose(priya, 'orders', { kind: 'rerun', target: 'run-1' }),
        h.workflow.listChanges(priya, 'billing', 'open'),
        h.workflow.readAudit('billing', {}),
      ];
      const settled = await Promise.allSettled(mixed);
      expect(settled.filter(s => s.status === 'rejected')).toEqual([]);
    }
    const grown = process.memoryUsage().rss - before;
    expect(grown).toBeLessThan(512 * 1024 * 1024);
  });
});
