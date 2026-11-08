import { createFakeClock } from '../testing/fakeClock';
import { startStandIn } from '../testing/standInServer';
import { createGuardrailsClient } from './guardrailsClient';
import { createServerHealth } from './serverHealth';

describe('server health', () => {
  it('reuses a result for 5 seconds and probes again afterwards', async () => {
    const clock = createFakeClock();
    const probe = jest.fn().mockResolvedValue(true);
    const health = createServerHealth({ probe, clock });

    expect(await health.isReachable()).toBe(true);
    clock.advance(4999);
    expect(await health.isReachable()).toBe(true);
    expect(probe).toHaveBeenCalledTimes(1);

    clock.advance(2);
    probe.mockResolvedValue(false);
    expect(await health.isReachable()).toBe(false);
    expect(probe).toHaveBeenCalledTimes(2);
  });

  it('lets concurrent reads share one probe', async () => {
    const clock = createFakeClock();
    let release!: (value: boolean) => void;
    const probe = jest.fn(
      () => new Promise<boolean>(resolve => (release = resolve)),
    );
    const health = createServerHealth({ probe, clock });

    const reads = Promise.all(
      Array.from({ length: 10 }, () => health.isReachable()),
    );
    release(true);
    expect(await reads).toEqual(Array(10).fill(true));
    expect(probe).toHaveBeenCalledTimes(1);
  });

  it('counts a probe that fails or throws as unreachable and does not keep a failed probe in flight', async () => {
    const clock = createFakeClock();
    const probe = jest
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValue(true);
    const health = createServerHealth({ probe, clock });
    expect(await health.isReachable()).toBe(false);
    clock.advance(5001);
    expect(await health.isReachable()).toBe(true);
  });

  it('forgets the cached result on reset', async () => {
    const clock = createFakeClock();
    const probe = jest
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);
    const health = createServerHealth({ probe, clock });
    expect(await health.isReachable()).toBe(false);
    health.reset();
    expect(await health.isReachable()).toBe(true);
  });

  it('counts a server that answers but is forced to fail as reachable, and a stopped one as not', async () => {
    const standIn = await startStandIn();
    const client = createGuardrailsClient({
      url: standIn.url,
      readTimeoutMs: 1000,
      writeTimeoutMs: 1000,
    });
    const clock = createFakeClock();
    const health = createServerHealth({
      probe: () => client.checkHealth(),
      clock,
    });

    standIn.setFailureMode(true);
    expect(await health.isReachable()).toBe(true);

    await standIn.close();
    clock.advance(6000);
    expect(await health.isReachable()).toBe(false);
    await client.close();
  });
});
