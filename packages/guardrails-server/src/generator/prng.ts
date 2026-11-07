const TWO_POW_32 = 4294967296;

/**
 * A small seeded random number generator that uses whole-number arithmetic
 * only (mulberry32), so results do not depend on the machine or the Node.js
 * version. It never reads the clock or the platform's random function.
 */
export interface Prng {
  /** The next whole number from 0 to 4294967295. */
  next(): number;
  /** A whole number from 0 up to, but not including, `limit`. */
  int(limit: number): number;
  /** `count` different items of `items`, in a seed-derived order. */
  sample<T>(items: readonly T[], count: number): T[];
}

/** Folds any whole-number seed (negative or large included) into 32 bits. */
function foldSeed(seed: number): number {
  const low = seed >>> 0;
  const high = Math.floor(seed / TWO_POW_32) >>> 0;
  return (low ^ Math.imul(high, 0x9e3779b1)) >>> 0;
}

export function createPrng(seed: number): Prng {
  let state = foldSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };

  const int = (limit: number): number => next() % limit;

  const sample = <T>(items: readonly T[], count: number): T[] => {
    if (count > items.length) {
      throw new Error('Cannot sample more items than there are');
    }
    const pool = items.slice();
    for (let i = 0; i < count; i++) {
      const j = i + int(pool.length - i);
      const swap = pool[i];
      pool[i] = pool[j];
      pool[j] = swap;
    }
    return pool.slice(0, count);
  };

  return { next, int, sample };
}
