import { randomUUID } from 'node:crypto';
import type { Clock } from './clock';

export interface IdGenerator {
  /** Opaque, increases over time so equal times can be ordered (entities.md). */
  changeId(): string;
  /** Unique per claim. */
  token(): string;
}

/**
 * Change ids carry the time in milliseconds, zero padded, then a counter that
 * keeps growing within one millisecond (and when the clock steps back), so a
 * later id always sorts after an earlier one from the same process.
 */
export function createIdGenerator(clock: Clock): IdGenerator {
  let lastMs = 0;
  let counter = 0;
  return {
    changeId() {
      const now = clock().getTime();
      if (now > lastMs) {
        lastMs = now;
        counter = 0;
      } else {
        counter += 1;
      }
      return `chg-${String(lastMs).padStart(14, '0')}-${String(counter).padStart(4, '0')}`;
    },
    token() {
      return randomUUID();
    },
  };
}
