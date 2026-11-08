import type { Clock } from '../clock';

export interface FakeClock extends Clock {
  advance(ms: number): void;
  set(iso: string): void;
}

/** A clock the tests control: nothing waits in real time for the 30 second release. */
export function createFakeClock(
  startIso = '2026-01-01T10:00:00.000Z',
): FakeClock {
  let current = new Date(startIso).getTime();
  const clock = (() => new Date(current)) as FakeClock;
  clock.advance = ms => {
    current += ms;
  };
  clock.set = iso => {
    current = new Date(iso).getTime();
  };
  return clock;
}
