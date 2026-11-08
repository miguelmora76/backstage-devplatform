import { createHarness, priya, sam } from '../testing/harness';
import { createTestDatabases } from '../testing/testDatabases';

const databases = createTestDatabases();

function percentile95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

async function timed(call: () => Promise<unknown>): Promise<number> {
  const started = performance.now();
  await call();
  return performance.now() - started;
}

describe('NFR1.3: plan and failed-run reads add little to the server own time', () => {
  it('adds at most 200 ms at the 95th percentile over a server that takes 100 ms', async () => {
    const h = await createHarness(databases, 'SQLITE_3');
    try {
      h.standIn.setToolDelay(100);
      await h.workflow.listPlan(sam, 'orders'); // connects and warms the probe
      const direct: number[] = [];
      const relayed: number[] = [];
      for (let i = 0; i < 20; i++) {
        direct.push(await timed(() => h.client.listUpgradePlan('orders')));
        relayed.push(await timed(() => h.workflow.listPlan(priya, 'orders')));
      }
      expect(percentile95(relayed) - percentile95(direct)).toBeLessThanOrEqual(
        200,
      );
      // The probe result is reused for 5 seconds: one probe for the whole run.
      expect(h.standIn.healthCalls).toBe(1);
    } finally {
      await h.close();
    }
  });
});
