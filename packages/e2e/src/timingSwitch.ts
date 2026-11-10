/**
 * Whether the 95th-percentile check of `specs/timing.spec.ts` blocks (NFR1.5).
 * Blocking unless `E2E_TIMING_BLOCKING` is exactly `false`: an empty value or
 * a typo can never switch a blocking check off.
 */
export function timingBlocking(value: string | undefined): boolean {
  return value !== 'false';
}
