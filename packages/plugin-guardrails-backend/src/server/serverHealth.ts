import type { Clock } from '../clock';

export interface ServerHealth {
  /** True when the server's health route answered; a result is reused for 5 seconds (BR7.1). */
  isReachable(): Promise<boolean>;
  /** Forgets the cached result (used by tests and after a known change). */
  reset(): void;
}

export interface ServerHealthOptions {
  probe: () => Promise<boolean>;
  clock: Clock;
  ttlMs?: number;
}

const DEFAULT_TTL_MS = 5000;

export function createServerHealth(options: ServerHealthOptions): ServerHealth {
  const ttl = options.ttlMs ?? DEFAULT_TTL_MS;
  let cached: { reachable: boolean; checkedAt: number } | undefined;
  let inFlight: Promise<boolean> | undefined;

  const runProbe = (): Promise<boolean> => {
    // Concurrent reads share one probe.
    if (!inFlight) {
      inFlight = options
        .probe()
        .catch(() => false)
        .then(reachable => {
          cached = { reachable, checkedAt: options.clock().getTime() };
          return reachable;
        })
        .finally(() => {
          inFlight = undefined;
        });
    }
    return inFlight;
  };

  return {
    async isReachable() {
      if (cached && options.clock().getTime() - cached.checkedAt < ttl) {
        return cached.reachable;
      }
      return runProbe();
    },
    reset() {
      cached = undefined;
    },
  };
}
