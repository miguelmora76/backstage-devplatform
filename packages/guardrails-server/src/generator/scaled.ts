import { buildDataSet } from './generator';
import type { SeedDataSet } from './types';

/**
 * TEST-ONLY entry point: builds a data set `factor` times the default size
 * (about 50 services, 500 dependencies and 1,000 runs for a factor of 10) and
 * skips the default size check (NFR1.5). It is not a setting, is never read
 * from the environment and is not reachable from the tools or the start-up
 * path; only tests import this file.
 */
export function generateScaledDataSet(
  seed: number,
  factor: number,
): SeedDataSet {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error('The size factor must be a whole number of at least 1');
  }
  return buildDataSet(seed, factor);
}
