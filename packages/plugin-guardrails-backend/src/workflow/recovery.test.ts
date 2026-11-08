import { createTestDatabases, initMigrated } from '../testing/testDatabases';
import { createCapturingLogger } from '../testing/harness';
import { createFakeClock } from '../testing/fakeClock';
import { createAuditStore } from '../store/auditStore';
import { createChangeStore } from '../store/changeStore';
import { createRecovery, entryFromChange } from './recovery';
import type { Knex } from 'knex';
import type { NewChange } from '../store/types';

const databases = createTestDatabases();

const base: NewChange = {
  changeId: 'chg-1',
  kind: 'upgrade',
  service: 'orders',
  target: 'dep-1',
  summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
  proposedBy: 'sam',
  proposedAt: '2026-01-01T09:00:00.000Z',
};

describe.each(databases.eachSupportedId())('recovery on %s', dbId => {
  let knex: Knex;

  beforeEach(async () => {
    knex = await initMigrated(databases, dbId);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  function setup() {
    const clock = createFakeClock();
    const logger = createCapturingLogger();
    const changes = createChangeStore(knex);
    const audit = createAuditStore(knex);
    const recovery = createRecovery({ changes, audit, clock, logger });
    return { clock, logger, changes, audit, recovery };
  }

  it('releases a claim only after 30 seconds, using the controlled clock', async () => {
    const { clock, changes, audit, recovery, logger } = setup();
    await changes.insert(base);
    await changes.claim('chg-1', {
      expectedStatus: 'pending',
      token: 't',
      at: clock().toISOString(),
      by: 'priya',
      action: 'approve',
      reason: 'secret reason text',
    });

    clock.advance(29_000);
    await recovery.releaseStale();
    expect((await changes.get('chg-1'))?.status).toBe('deciding');

    clock.advance(2_000);
    await recovery.releaseStale();
    expect(await changes.get('chg-1')).toMatchObject({
      status: 'failed',
      failureMessage: 'Interrupted',
    });
    const page = await audit.read('orders', {});
    expect(page.items.filter(e => e.outcome === 'failed')).toHaveLength(1);
    expect(logger.lines.join('\n')).toMatch(/released/i);
    expect(logger.lines.join('\n')).not.toContain('secret reason text');
  });

  it('releases only once when two readers run at the same time', async () => {
    const { clock, changes, audit, recovery } = setup();
    await changes.insert(base);
    await changes.claim('chg-1', {
      expectedStatus: 'pending',
      token: 't',
      at: clock().toISOString(),
      by: 'priya',
      action: 'approve',
      reason: 'go',
    });
    clock.advance(31_000);
    await Promise.all([recovery.releaseStale(), recovery.releaseStale()]);
    const page = await audit.read('orders', {});
    expect(page.items.filter(e => e.outcome === 'failed')).toHaveLength(1);
  });

  it('rebuilds a missing proposal entry from the change record, once', async () => {
    const { audit, changes, recovery, logger } = setup();
    await changes.insert(base);
    await recovery.repairService('orders');
    await recovery.repairService('orders');
    const page = await audit.read('orders', {});
    expect(page.items).toHaveLength(1);
    expect(page.items[0]).toMatchObject({
      actor: 'sam',
      action: 'propose',
      outcome: 'proposed',
      time: '2026-01-01T09:00:00.000Z',
      decisionNumber: 0,
      changeId: 'chg-1',
    });
    expect(page.items[0].reason).toBeUndefined();
    expect(logger.lines.join('\n')).toMatch(/rebuilt/i);
  });

  it('rebuilds a missing decision entry from the change record', async () => {
    const { clock, audit, changes, recovery } = setup();
    await changes.insert(base, {
      time: base.proposedAt,
      actor: 'sam',
      action: 'propose',
      service: 'orders',
      target: 'dep-1',
      outcome: 'proposed',
      changeId: 'chg-1',
      decisionNumber: 0,
    });
    await changes.claim('chg-1', {
      expectedStatus: 'pending',
      token: 't',
      at: clock().toISOString(),
      by: 'priya',
      action: 'approve',
      reason: ' as typed ',
    });
    // The final write happened but the entry was lost (no audit builder given).
    await changes.finish('chg-1', 't', {
      status: 'applied',
      decidedBy: 'priya',
      reason: ' as typed ',
      decidedAt: '2026-01-01T10:00:05.000Z',
      action: 'approve',
      outcome: 'applied',
    });
    await recovery.repairService('orders');
    const [latest] = (await audit.read('orders', {})).items;
    expect(latest).toMatchObject({
      actor: 'priya',
      action: 'approve',
      outcome: 'applied',
      reason: ' as typed ',
      time: '2026-01-01T10:00:05.000Z',
      decisionNumber: 1,
    });
  });

  it('logs and carries on when a repair cannot be written', async () => {
    const { audit, changes, recovery, logger } = setup();
    await changes.insert(base);
    jest.spyOn(audit, 'append').mockRejectedValueOnce(new Error('disk full'));
    await expect(recovery.repairService('orders')).resolves.toBeUndefined();
    expect(logger.lines.join('\n')).toMatch(/error/i);
    await recovery.repairService('orders');
    expect((await audit.read('orders', {})).total).toBe(1);
  });

  it('repairChange (before a decision) raises the error instead of hiding it', async () => {
    const { audit, changes, recovery } = setup();
    const change = await changes.insert(base);
    jest.spyOn(audit, 'append').mockRejectedValueOnce(new Error('disk full'));
    await expect(recovery.repairChange(change)).rejects.toThrow('disk full');
  });

  it('builds the entry for a change from its record', () => {
    expect(
      entryFromChange({
        ...base,
        status: 'rejected',
        decidedBy: 'priya',
        decisionReason: 'no',
        decidedAt: '2026-01-01T10:00:00.000Z',
        decisionCount: 3,
        lastAction: 'reject',
        lastOutcome: 'rejected',
      }),
    ).toEqual({
      time: '2026-01-01T10:00:00.000Z',
      actor: 'priya',
      action: 'reject',
      service: 'orders',
      target: 'dep-1',
      outcome: 'rejected',
      reason: 'no',
      changeId: 'chg-1',
      decisionNumber: 3,
    });
  });
});
