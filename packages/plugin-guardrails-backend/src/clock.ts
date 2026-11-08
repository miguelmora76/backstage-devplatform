/** The current time. Injected so tests can move past the 30 second release without waiting. */
export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function isoNow(clock: Clock): string {
  return clock().toISOString();
}
