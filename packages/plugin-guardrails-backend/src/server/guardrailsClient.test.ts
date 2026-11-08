import {
  startStandIn,
  type StandIn,
  loadC2Spec,
} from '../testing/standInServer';
import {
  createGuardrailsClient,
  GuardrailsCallError,
  type GuardrailsClient,
} from './guardrailsClient';

describe('guardrails client against a stand-in built from the C2 spec', () => {
  let standIn: StandIn;
  let client: GuardrailsClient;

  const make = (readTimeoutMs = 3000, writeTimeoutMs = 10000) =>
    createGuardrailsClient({ url: standIn.url, readTimeoutMs, writeTimeoutMs });

  beforeEach(async () => {
    standIn = await startStandIn();
    client = make();
  });

  afterEach(async () => {
    await client.close();
    await standIn.close();
  });

  it('reads the plan and the failed runs by the tool names of the spec', async () => {
    const plan = await client.listUpgradePlan('orders');
    expect(plan.map(d => d.dependencyKey)).toEqual(['dep-1', 'dep-2']);
    const runs = await client.listFailedCiRuns('orders');
    expect(runs).toEqual([
      {
        runKey: 'run-1',
        runNumber: 12,
        status: 'failed',
        cause: 'Test timeout in checkout suite',
      },
    ]);
    const names = loadC2Spec().tools.map(t => t.name);
    for (const call of standIn.calls) {
      expect(names).toContain(call.tool);
    }
    expect(await client.listUpgradePlan('billing')).toEqual([]);
  });

  it('applies an upgrade and starts a re-run', async () => {
    expect(await client.applyDependencyUpgrade('orders', 'dep-1')).toEqual({
      result: 'applied',
    });
    expect(await client.applyDependencyUpgrade('orders', 'dep-1')).toEqual({
      result: 'already-current',
    });
    expect(await client.rerunCiJob('orders', 'run-1')).toEqual({
      result: 'rerun-started',
    });
    expect(standIn.calls.map(c => c.tool)).toEqual([
      'apply_dependency_upgrade',
      'apply_dependency_upgrade',
      'rerun_ci_job',
    ]);
  });

  it('turns a known tool error into a call error with its code', async () => {
    await expect(client.listUpgradePlan('nowhere')).rejects.toMatchObject({
      name: 'GuardrailsCallError',
      kind: 'tool-error',
      code: 'UNKNOWN_SERVICE',
    });
    await expect(
      client.applyDependencyUpgrade('orders', 'nope'),
    ).rejects.toMatchObject({
      kind: 'tool-error',
      code: 'UNKNOWN_DEPENDENCY',
    });
    standIn.setFailureMode(true);
    await expect(client.rerunCiJob('orders', 'run-1')).rejects.toMatchObject({
      kind: 'tool-error',
      code: 'FORCED_FAILURE',
    });
  });

  it('treats an unfamiliar error code as a failed call with the generic code', async () => {
    standIn.setToolError('apply_dependency_upgrade', 'SOMETHING_NEW');
    const error = await client
      .applyDependencyUpgrade('orders', 'dep-1')
      .catch(e => e);
    expect(error).toBeInstanceOf(GuardrailsCallError);
    expect(error).toMatchObject({ kind: 'tool-error', code: 'UNKNOWN' });
    expect(error.message).not.toContain('SOMETHING_NEW');
  });

  it('times out a read after the read timeout and does not retry', async () => {
    const slow = make(80, 10000);
    standIn.setToolDelay(400);
    const started = Date.now();
    await expect(slow.listUpgradePlan('orders')).rejects.toMatchObject({
      kind: 'timeout',
    });
    expect(Date.now() - started).toBeLessThan(350);
    await new Promise(r => setTimeout(r, 500));
    expect(
      standIn.calls.filter(c => c.tool === 'list_upgrade_plan'),
    ).toHaveLength(1);
    await slow.close();
  });

  it('uses the write timeout for writes and the read timeout for reads', async () => {
    const mixed = make(2000, 80);
    standIn.setToolDelay(250);
    expect((await mixed.listFailedCiRuns('orders')).length).toBe(1);
    await expect(mixed.rerunCiJob('orders', 'run-1')).rejects.toMatchObject({
      kind: 'timeout',
    });
    await mixed.close();
  });

  it('reports an unavailable server as a call error', async () => {
    const dead = createGuardrailsClient({
      url: 'http://127.0.0.1:1',
      readTimeoutMs: 500,
      writeTimeoutMs: 500,
    });
    await expect(dead.listUpgradePlan('orders')).rejects.toMatchObject({
      kind: expect.stringMatching(/unavailable|timeout/),
    });
    await dead.close();
  });

  it('keeps working after a tool error', async () => {
    await client.listUpgradePlan('orders');
    standIn.setToolError('list_upgrade_plan', 'INTERNAL_ERROR');
    await expect(client.listUpgradePlan('orders')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
    });
    standIn.setToolError('list_upgrade_plan', undefined);
    expect((await client.listUpgradePlan('orders')).length).toBe(2);
  });

  it('checks the health route', async () => {
    expect(await client.checkHealth()).toBe(true);
    standIn.setHealthy(false);
    expect(await client.checkHealth()).toBe(false);
    standIn.setHealthy(true);
    standIn.setHealthDelay(300);
    expect(await client.checkHealth(50)).toBe(false);
    await standIn.close();
    expect(await client.checkHealth()).toBe(false);
    standIn = await startStandIn();
  });
});
