import { endOfDayIso, formatTime, startOfDayIso } from './formatTime';

describe('formatTime (NFR7.1, answer Q1: A of NFR Design)', () => {
  it('shows year-month-day and hours:minutes in the viewer time zone (pinned to Europe/Berlin)', () => {
    expect(formatTime('2026-11-06T09:42:00.000Z')).toBe('2026-11-06 10:42');
    // Summer time: UTC+2.
    expect(formatTime('2026-07-01T22:30:00.000Z')).toBe('2026-07-02 00:30');
  });

  it('pads single digits', () => {
    expect(formatTime('2026-01-02T03:04:00.000Z')).toBe('2026-01-02 04:04');
  });

  it('never produces a relative time, whatever the clock says', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-11-06T09:43:00.000Z'));
    try {
      expect(formatTime('2026-11-06T09:42:00.000Z')).not.toMatch(
        /ago|minute|now/i,
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a dash-free fallback for a value that is not a date', () => {
    expect(formatTime('not a date')).toBe('not a date');
  });
});

describe('start and end of a day in the viewer zone (D4)', () => {
  it('turns a calendar date into the start of that day', () => {
    expect(startOfDayIso('2026-11-06')).toBe('2026-11-05T23:00:00.000Z');
  });

  it('turns a calendar date into the end of that day', () => {
    expect(endOfDayIso('2026-11-06')).toBe('2026-11-06T22:59:59.999Z');
  });

  it('returns undefined for an empty or invalid date', () => {
    expect(startOfDayIso('')).toBeUndefined();
    expect(endOfDayIso('2026-13-45')).toBeUndefined();
  });
});
