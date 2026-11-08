import { createTestDatabases } from '../testing/testDatabases';
import {
  alex,
  createHarness,
  priya,
  sam,
  type Harness,
} from '../testing/harness';
import type { ChangeView } from './changeWorkflow';

const databases = createTestDatabases();

async function waitFor(condition: () => boolean, ms = 3000): Promise<void> {
  const start = Date.now();
  while (!condition()) {
    if (Date.now() - start > ms) throw new Error('condition not met in time');
    await new Promise(r => setTimeout(r, 5));
  }
}

describe.each(databases.eachSupportedId())('change workflow on %s', dbId => {
  let h: Harness;

  beforeEach(async () => {
    h = await createHarness(databases, dbId);
  });

  afterEach(async () => {
    await h.close();
  });

  const propose = (
    kind: 'upgrade' | 'rerun' = 'upgrade',
    target = kind === 'upgrade' ? 'dep-1' : 'run-1',
  ) => h.workflow.propose(sam, 'orders', { kind, target });
  const entries = async (service = 'orders') =>
    (await h.audit.read(service, { pageSize: 100 })).items;
  const writeCalls = () =>
    h.standIn.calls.filter(
      c => c.tool === 'apply_dependency_upgrade' || c.tool === 'rerun_ci_job',
    );

  describe('propose (W2)', () => {
    it('creates a pending change with its summary and a proposed entry', async () => {
      const view = await propose();
      expect(view).toMatchObject({
        changeId: 'chg-0001',
        kind: 'upgrade',
        service: 'orders',
        target: 'dep-1',
        summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
        status: 'pending',
        proposedBy: { userId: 'sam', name: 'Sam', role: 'service-owner' },
      });
      expect(view.allowedActions.find(a => a.action === 'approve')).toEqual({
        action: 'approve',
        allowed: false,
        reason: 'PROPOSER_CANNOT_DECIDE',
      });
      const [entry] = await entries();
      expect(entry).toMatchObject({
        actor: 'sam',
        action: 'propose',
        outcome: 'proposed',
        changeId: 'chg-0001',
        decisionNumber: 0,
      });
      expect(entry.reason).toBeUndefined();
    });

    it('writes the summary once: later server changes do not alter it', async () => {
      await propose();
      await h.client.applyDependencyUpgrade('orders', 'dep-1');
      const [view] = await h.workflow.listChanges(sam, 'orders', 'open');
      expect(view.summary).toBe('Upgrade lodash from 4.0.0 to 4.17.21');
    });

    it('creates a second change for the same target', async () => {
      await propose();
      await propose();
      const open = await h.workflow.listChanges(sam, 'orders', 'open');
      expect(open).toHaveLength(2);
    });

    it('proposes a CI re-run with the run number and cause in the summary', async () => {
      const view = await propose('rerun');
      expect(view.kind).toBe('rerun');
      expect(view.summary).toContain('12');
      expect(view.summary).toContain('Test timeout in checkout suite');
    });

    it('refuses an auditor and records a refused entry without a change', async () => {
      await expect(
        h.workflow.propose(alex, 'orders', {
          kind: 'upgrade',
          target: 'dep-1',
        }),
      ).rejects.toMatchObject({ code: 'AUDITOR_READ_ONLY' });
      const all = await entries();
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({
        actor: 'alex',
        action: 'propose',
        outcome: 'refused',
        target: 'dep-1',
      });
      expect(all[0].changeId).toBeUndefined();
      expect(await h.workflow.listChanges(sam, 'orders', 'open')).toEqual([]);
    });

    it('refuses an unknown service or target with NOT_FOUND and writes nothing', async () => {
      await expect(
        h.workflow.propose(sam, 'nowhere', {
          kind: 'upgrade',
          target: 'dep-1',
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      await expect(
        h.workflow.propose(sam, 'orders', { kind: 'upgrade', target: 'nope' }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await entries()).toEqual([]);
    });

    it('refuses an upgrade already at the recommended version, and a run that is not failed, with NOT_ELIGIBLE', async () => {
      await expect(
        h.workflow.propose(sam, 'orders', { kind: 'upgrade', target: 'dep-2' }),
      ).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
      await expect(
        h.workflow.propose(sam, 'orders', { kind: 'rerun', target: 'run-2' }),
      ).rejects.toMatchObject({ code: 'NOT_ELIGIBLE' });
      expect(await entries()).toEqual([]);
      expect(await h.workflow.listChanges(sam, 'orders', 'open')).toEqual([]);
    });

    it('refuses with SERVER_UNREACHABLE and writes nothing when the server is down or forced to fail on the read', async () => {
      h.standIn.setHealthy(false);
      h.health.reset();
      await expect(propose()).rejects.toMatchObject({
        code: 'SERVER_UNREACHABLE',
      });
      h.standIn.setHealthy(true);
      h.health.reset();
      h.standIn.setFailureMode(true);
      await expect(propose()).rejects.toMatchObject({
        code: 'SERVER_UNREACHABLE',
      });
      expect(await entries()).toEqual([]);
    });
  });

  describe('decide (W3)', () => {
    it('approve applies through the server and records the reason exactly as submitted', async () => {
      const { changeId } = await propose();
      const view = await h.workflow.decide(
        priya,
        'approve',
        changeId,
        '  Safe to ship.  ',
      );
      expect(view).toMatchObject({
        status: 'applied',
        decidedBy: { userId: 'priya' },
        decisionReason: '  Safe to ship.  ',
      });
      expect(writeCalls()).toEqual([
        {
          tool: 'apply_dependency_upgrade',
          args: { service: 'orders', dependencyKey: 'dep-1' },
        },
      ]);
      const [latest] = await entries();
      expect(latest).toMatchObject({
        actor: 'priya',
        action: 'approve',
        outcome: 'applied',
        reason: '  Safe to ship.  ',
        decisionNumber: 1,
        changeId,
      });
      expect((await h.client.listUpgradePlan('orders'))[0].currentVersion).toBe(
        '4.17.21',
      );
    });

    it('approving a re-run calls rerun_ci_job', async () => {
      const { changeId } = await propose('rerun');
      const view = await h.workflow.decide(priya, 'approve', changeId, 'go');
      expect(view.status).toBe('applied');
      expect(writeCalls()[0]).toEqual({
        tool: 'rerun_ci_job',
        args: { service: 'orders', runKey: 'run-1' },
      });
    });

    it('treats an already-current answer as applied', async () => {
      const { changeId } = await propose();
      await h.client.applyDependencyUpgrade('orders', 'dep-1');
      const view = await h.workflow.decide(priya, 'approve', changeId, 'ok');
      expect(view.status).toBe('applied');
    });

    it('reject makes no write call to the server', async () => {
      const { changeId } = await propose();
      const view = await h.workflow.decide(
        priya,
        'reject',
        changeId,
        'Not now',
      );
      expect(view.status).toBe('rejected');
      expect(writeCalls()).toEqual([]);
      const [latest] = await entries();
      expect(latest).toMatchObject({
        action: 'reject',
        outcome: 'rejected',
        decisionNumber: 1,
      });
    });

    it('writes nothing for an empty or whitespace reason, even for an auditor', async () => {
      const { changeId } = await propose();
      for (const actor of [priya, alex, sam]) {
        for (const reason of ['', '   ', '\n\t']) {
          await expect(
            h.workflow.decide(actor, 'approve', changeId, reason),
          ).rejects.toMatchObject({ code: 'EMPTY_REASON' });
        }
      }
      expect(await entries()).toHaveLength(1);
      expect((await h.changes.get(changeId))?.status).toBe('pending');
    });

    it('refuses an auditor, keeps the change and records the reason as submitted', async () => {
      const { changeId } = await propose();
      await expect(
        h.workflow.decide(alex, 'approve', changeId, ' <b>please</b> '),
      ).rejects.toMatchObject({ code: 'AUDITOR_READ_ONLY' });
      const [latest] = await entries();
      expect(latest).toMatchObject({
        actor: 'alex',
        action: 'approve',
        outcome: 'refused',
        reason: ' <b>please</b> ',
        changeId,
      });
      expect(latest.decisionNumber).toBeUndefined();
      expect((await h.changes.get(changeId))?.status).toBe('pending');
      expect(writeCalls()).toEqual([]);
    });

    it('refuses the proposer with SELF_DECISION and records it', async () => {
      const { changeId } = await propose();
      await expect(
        h.workflow.decide(sam, 'approve', changeId, 'I approve my own'),
      ).rejects.toMatchObject({ code: 'SELF_DECISION' });
      await expect(
        h.workflow.decide(sam, 'reject', changeId, 'mine'),
      ).rejects.toMatchObject({ code: 'SELF_DECISION' });
      const refused = (await entries()).filter(e => e.outcome === 'refused');
      expect(refused).toHaveLength(2);
      expect((await h.changes.get(changeId))?.status).toBe('pending');
    });

    it('refuses a second decision with ALREADY_DECIDED and records it; the first stands', async () => {
      const { changeId } = await propose();
      await h.workflow.decide(priya, 'approve', changeId, 'first');
      await expect(
        h.workflow.decide(priya, 'reject', changeId, 'second'),
      ).rejects.toMatchObject({ code: 'ALREADY_DECIDED' });
      const stored = await h.changes.get(changeId);
      expect(stored).toMatchObject({
        status: 'applied',
        decisionReason: 'first',
        decisionCount: 1,
      });
      const [latest] = await entries();
      expect(latest).toMatchObject({
        outcome: 'refused',
        action: 'reject',
        reason: 'second',
      });
    });

    it('with ten simultaneous approvals exactly one wins and nine are refused and recorded', async () => {
      const { changeId } = await propose();
      const results = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          h.workflow.decide(priya, 'approve', changeId, `try ${i}`).then(
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
      expect(writeCalls()).toHaveLength(1);
    });

    it('answers NOT_FOUND for an unknown change and writes nothing', async () => {
      await expect(
        h.workflow.decide(priya, 'approve', 'missing', 'x'),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(await entries()).toEqual([]);
    });

    it('checks the role before the server, and the server before any claim', async () => {
      const { changeId } = await propose();
      h.standIn.setHealthy(false);
      h.health.reset();

      await expect(
        h.workflow.decide(alex, 'reject', changeId, 'no'),
      ).rejects.toMatchObject({ code: 'AUDITOR_READ_ONLY' });
      expect((await entries())[0]).toMatchObject({
        outcome: 'refused',
        actor: 'alex',
      });

      const before = (await entries()).length;
      await expect(
        h.workflow.decide(priya, 'reject', changeId, 'no'),
      ).rejects.toMatchObject({ code: 'SERVER_UNREACHABLE' });
      expect(await entries()).toHaveLength(before);
      expect((await h.changes.get(changeId))?.status).toBe('pending');
    });

    it('marks the change failed when the server returns an error, with a fixed message naming the code', async () => {
      const { changeId } = await propose();
      h.standIn.setFailureMode(true);
      const view = await h.workflow.decide(
        priya,
        'approve',
        changeId,
        'try it',
      );
      expect(view.status).toBe('failed');
      expect(view.failureMessage).toContain('FORCED_FAILURE');
      const [latest] = await entries();
      expect(latest).toMatchObject({
        action: 'approve',
        outcome: 'failed',
        decisionNumber: 1,
      });
      expect(view.allowedActions.find(a => a.action === 'retry')?.allowed).toBe(
        true,
      );
    });

    it('treats an unfamiliar server error code as a failed write with the generic message', async () => {
      const { changeId } = await propose();
      h.standIn.setToolError('apply_dependency_upgrade', 'BRAND_NEW_CODE');
      const view = await h.workflow.decide(priya, 'approve', changeId, 'go');
      expect(view.status).toBe('failed');
      expect(view.failureMessage).not.toContain('BRAND_NEW_CODE');
    });

    it('marks the change failed when the server does not answer within the write timeout', async () => {
      await h.close();
      h = await createHarness(databases, dbId, { writeTimeoutMs: 80 });
      const { changeId } = await propose();
      h.standIn.setToolDelay(400);
      const view = await h.workflow.decide(priya, 'approve', changeId, 'slow');
      expect(view.status).toBe('failed');
      expect(view.failureMessage).toMatch(/did not answer/);
    });

    it('answers CLAIM_RELEASED and appends nothing when the claim was released while the server call ran', async () => {
      const { changeId } = await propose();
      h.standIn.setToolDelay(400);
      const decision = h.workflow
        .decide(priya, 'approve', changeId, 'slowly')
        .then(
          () => undefined,
          (e: unknown) => e,
        );
      await waitFor(() => writeCalls().length > 0);
      h.clock.advance(31_000);
      const [seen] = await h.workflow.listChanges(sam, 'orders', 'open');
      expect(seen).toMatchObject({
        status: 'failed',
        failureMessage: 'Interrupted',
      });

      expect(await decision).toMatchObject({ code: 'CLAIM_RELEASED' });
      const all = await entries();
      expect(all).toHaveLength(2); // the proposal and the release entry
      expect(all[0]).toMatchObject({
        outcome: 'failed',
        action: 'approve',
        actor: 'priya',
      });
    });

    it('leaves no stuck or half-recorded change when the write after the claim fails', async () => {
      const { changeId } = await propose();
      const spy = jest
        .spyOn(h.changes, 'finish')
        .mockRejectedValueOnce(new Error('db down'));
      await expect(
        h.workflow.decide(priya, 'approve', changeId, 'go'),
      ).rejects.toThrow('db down');
      spy.mockRestore();
      expect((await h.changes.get(changeId))?.status).toBe('deciding');

      h.clock.advance(31_000);
      const [seen] = await h.workflow.listChanges(sam, 'orders', 'open');
      expect(seen).toMatchObject({
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

    it('rebuilds a missing proposal entry before a new decision', async () => {
      await h.changes.insert({
        changeId: 'orphan',
        kind: 'upgrade',
        service: 'orders',
        target: 'dep-1',
        summary: 'Upgrade lodash from 4.0.0 to 4.17.21',
        proposedBy: 'sam',
        proposedAt: '2026-01-01T09:00:00.000Z',
      });
      await h.workflow.decide(priya, 'approve', 'orphan', 'go');
      const numbers = (await entries())
        .map(e => `${e.action}:${e.decisionNumber}`)
        .sort();
      expect(numbers).toEqual(['approve:1', 'propose:0']);
    });
  });

  describe('retry (W4)', () => {
    const failedChange = async () => {
      const { changeId } = await propose();
      h.standIn.setFailureMode(true);
      await h.workflow.decide(priya, 'approve', changeId, 'first try');
      return changeId;
    };

    it('applies on success, clears the failure message and adds its own entry', async () => {
      const changeId = await failedChange();
      h.standIn.setFailureMode(false);
      const view = await h.workflow.decide(
        priya,
        'retry',
        changeId,
        'server is back',
      );
      expect(view.status).toBe('applied');
      expect(view.failureMessage).toBeUndefined();
      const [latest] = await entries();
      expect(latest).toMatchObject({
        action: 'retry',
        outcome: 'applied',
        decisionNumber: 2,
      });
    });

    it('adds another failed entry when the retry fails again', async () => {
      const changeId = await failedChange();
      const view = await h.workflow.decide(priya, 'retry', changeId, 'again');
      expect(view.status).toBe('failed');
      const failed = (await entries()).filter(e => e.outcome === 'failed');
      expect(failed.map(e => e.decisionNumber).sort()).toEqual([1, 2]);
    });

    it('refuses a retry on a change that is not failed with NOT_FAILED and records it', async () => {
      const { changeId } = await propose();
      await expect(
        h.workflow.decide(priya, 'retry', changeId, 'why not'),
      ).rejects.toMatchObject({ code: 'NOT_FAILED' });
      expect((await entries())[0]).toMatchObject({
        action: 'retry',
        outcome: 'refused',
      });
    });

    it('refuses the proposer and the auditor on retry', async () => {
      const changeId = await failedChange();
      await expect(
        h.workflow.decide(sam, 'retry', changeId, 'mine'),
      ).rejects.toMatchObject({
        code: 'SELF_DECISION',
      });
      await expect(
        h.workflow.decide(alex, 'retry', changeId, 'look'),
      ).rejects.toMatchObject({
        code: 'AUDITOR_READ_ONLY',
      });
    });
  });

  describe('reads (W5, W6, W7)', () => {
    it('lists open changes by default, newest first, with the allowed actions for the reader', async () => {
      const first = await propose();
      h.clock.advance(1000);
      const second = await propose('rerun');
      h.clock.advance(1000);
      const third = await propose();
      await h.workflow.decide(priya, 'reject', first.changeId, 'no');

      const open = await h.workflow.listChanges(priya, 'orders', 'open');
      expect(open.map(c => c.changeId)).toEqual([
        third.changeId,
        second.changeId,
      ]);
      expect(open[0].allowedActions.map(a => a.action)).toEqual([
        'approve',
        'reject',
        'retry',
      ]);
      expect(open[0].allowedActions[0].allowed).toBe(true);

      const rejected = await h.workflow.listChanges(
        priya,
        'orders',
        'rejected',
      );
      expect(rejected.map(c => c.changeId)).toEqual([first.changeId]);
      expect(await h.workflow.listChanges(priya, 'billing', 'open')).toEqual(
        [],
      );
    });

    it('returns at most the newest 200 changes', async () => {
      for (let i = 0; i < 205; i++) {
        await h.changes.insert(
          {
            changeId: `bulk-${String(i).padStart(4, '0')}`,
            kind: 'upgrade',
            service: 'orders',
            target: 'dep-1',
            summary: 's',
            proposedBy: 'sam',
            proposedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
          },
          {
            time: '2026-01-01T00:00:00.000Z',
            actor: 'sam',
            action: 'propose',
            service: 'orders',
            target: 'dep-1',
            outcome: 'proposed',
            changeId: `bulk-${String(i).padStart(4, '0')}`,
            decisionNumber: 0,
          },
        );
      }
      const open = await h.workflow.listChanges(priya, 'orders', 'open');
      expect(open).toHaveLength(200);
      expect(open[0].changeId).toBe('bulk-0204');
    });

    it('never returns the deciding state: it shows the previous status with IN_PROGRESS', async () => {
      const { changeId } = await propose();
      await h.changes.claim(changeId, {
        expectedStatus: 'pending',
        token: 'other',
        at: h.clock().toISOString(),
        by: 'priya',
        action: 'approve',
        reason: 'busy',
      });
      const [view] = await h.workflow.listChanges(alex, 'orders', 'open');
      expect(view.status).toBe('pending');
      const forPriya = (await h.workflow.getChange(priya, changeId))
        .allowedActions;
      expect(forPriya.every(a => a.reason === 'IN_PROGRESS')).toBe(true);
    });

    it('still reads changes and the audit log when the server is down, with all writes disabled', async () => {
      const { changeId } = await propose();
      h.standIn.setHealthy(false);
      h.health.reset();
      const [view] = await h.workflow.listChanges(priya, 'orders', 'open');
      expect(
        view.allowedActions.every(a => a.reason === 'SERVER_UNREACHABLE'),
      ).toBe(true);
      expect((await h.workflow.getChange(priya, changeId)).changeId).toBe(
        changeId,
      );
      const page = await h.workflow.readAudit('orders', {});
      expect(page.total).toBe(1);
      expect(page.items[0].actor).toEqual({
        userId: 'sam',
        name: 'Sam',
        role: 'service-owner',
      });
    });

    it('answers NOT_FOUND for an unknown change', async () => {
      await expect(h.workflow.getChange(sam, 'missing')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });

    it('relays the plan with allowed actions, ALREADY_CURRENT for a current dependency', async () => {
      const plan = await h.workflow.listPlan(sam, 'orders');
      expect(plan.service).toBe('orders');
      expect(plan.items.map(i => i.dependencyKey)).toEqual(['dep-1', 'dep-2']);
      expect(plan.items[0].allowedActions).toEqual([
        { action: 'propose', allowed: true },
      ]);
      expect(plan.items[1].allowedActions).toEqual([
        { action: 'propose', allowed: false, reason: 'ALREADY_CURRENT' },
      ]);
      const forAuditor = await h.workflow.listPlan(alex, 'orders');
      expect(forAuditor.items[0].allowedActions[0].reason).toBe(
        'AUDITOR_READ_ONLY',
      );
    });

    it('relays the failed runs, an empty list, NOT_FOUND and SERVER_UNREACHABLE', async () => {
      const runs = await h.workflow.listCiRuns(priya, 'orders');
      expect(runs.items).toEqual([
        {
          runKey: 'run-1',
          runNumber: 12,
          status: 'failed',
          cause: 'Test timeout in checkout suite',
          allowedActions: [{ action: 'propose', allowed: true }],
        },
      ]);
      expect((await h.workflow.listCiRuns(priya, 'billing')).items).toEqual([]);
      await expect(
        h.workflow.listCiRuns(priya, 'nowhere'),
      ).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
      h.standIn.setFailureMode(true);
      await expect(
        h.workflow.listCiRuns(priya, 'orders'),
      ).rejects.toMatchObject({
        code: 'SERVER_UNREACHABLE',
      });
      h.standIn.setFailureMode(false);
      h.standIn.setHealthy(false);
      h.health.reset();
      await expect(h.workflow.listPlan(priya, 'orders')).rejects.toMatchObject({
        code: 'SERVER_UNREACHABLE',
      });
    });

    it('reads the audit log filtered, with actors as users', async () => {
      const { changeId } = await propose();
      await h.workflow.decide(priya, 'approve', changeId, 'ok');
      const onlyPriya = await h.workflow.readAudit('orders', {
        actor: 'priya',
      });
      expect(onlyPriya.items).toHaveLength(1);
      expect(onlyPriya.items[0].actor.role).toBe('platform-engineer');
      expect((await h.workflow.readAudit('billing', {})).items).toEqual([]);
    });

    it('view type keeps the internal claim fields out', async () => {
      const view: ChangeView = await propose();
      expect(Object.keys(view)).not.toEqual(
        expect.arrayContaining(['claimToken', 'claimedBy', 'decisionCount']),
      );
    });
  });
});
