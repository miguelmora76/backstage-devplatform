const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Date-times show as `YYYY-MM-DD HH:mm` in the viewer's time zone, never as a
 * relative time (NFR7.1; NFR Design answer Q1: A). One function, so tests that
 * pin the zone and the clock get the same text every run.
 */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseDay(day: string): [number, number, number] | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const check = new Date(y, mo - 1, d);
  if (
    check.getFullYear() !== y ||
    check.getMonth() !== mo - 1 ||
    check.getDate() !== d
  ) {
    return undefined;
  }
  return [y, mo, d];
}

/** The start of a calendar day in the viewer's zone, as a date-time (D4). */
export function startOfDayIso(day: string): string | undefined {
  const p = parseDay(day);
  return p
    ? new Date(p[0], p[1] - 1, p[2], 0, 0, 0, 0).toISOString()
    : undefined;
}

/** The end of a calendar day in the viewer's zone, as a date-time (D4). */
export function endOfDayIso(day: string): string | undefined {
  const p = parseDay(day);
  return p
    ? new Date(p[0], p[1] - 1, p[2], 23, 59, 59, 999).toISOString()
    : undefined;
}
