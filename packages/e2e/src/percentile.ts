/**
 * Nearest-rank percentile: the smallest sample such that at least `p` percent
 * of the samples are at or below it. For 20 samples and p = 95 that is the
 * 19th smallest (NFR1.1). `expectedCount` makes a run with a wrong number of
 * loads fail instead of quietly passing.
 */
export function percentile(
  samples: readonly number[],
  p: number,
  expectedCount?: number,
): number {
  if (expectedCount !== undefined && samples.length !== expectedCount) {
    throw new Error(
      `Percentile: expected ${expectedCount} samples, got ${samples.length}.`,
    );
  }
  if (samples.length === 0) {
    throw new Error('Percentile: there are no samples.');
  }
  if (!(p > 0 && p <= 100)) {
    throw new Error(
      `Percentile: the percentage must be in (0, 100], got ${p}.`,
    );
  }
  if (!samples.every(Number.isFinite)) {
    throw new Error('Percentile: every sample must be a finite number.');
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[rank - 1];
}
