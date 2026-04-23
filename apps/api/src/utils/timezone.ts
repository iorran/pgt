import { sql, type SQL, type AnyColumn } from 'drizzle-orm';

export const DEFAULT_ACADEMY_TIMEZONE = 'Europe/Lisbon';

/** Format a Date as ISO calendar date (YYYY-MM-DD) as seen in the given IANA timezone. */
export function isoDateInTz(ts: Date, tz: string): string {
  // en-CA locale yields YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ts);
}

/** UTC timestamp corresponding to 00:00:00 on `isoDate` (YYYY-MM-DD) in `tz`. */
export function startOfDayInTz(isoDate: string, tz: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const asUtcMidnight = Date.UTC(y, m - 1, d);
  const offset1 = tzOffsetMinutes(new Date(asUtcMidnight), tz);
  const guess = new Date(asUtcMidnight - offset1 * 60_000);
  // Second pass: if the offset at `guess` differs (e.g., we crossed DST), correct.
  const offset2 = tzOffsetMinutes(guess, tz);
  return offset2 === offset1 ? guess : new Date(guess.getTime() - (offset2 - offset1) * 60_000);
}

/** Offset (minutes east of UTC) for the given instant in the given tz. */
function tzOffsetMinutes(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const parts = dtf.formatToParts(at).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const asUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  );
  return (asUtc - at.getTime()) / 60_000;
}

export function weekBoundsInTz(isoDate: string, tz: string): { fromUtc: Date; toUtc: Date } {
  const startOfDate = startOfDayInTz(isoDate, tz);
  // Figure out the weekday (0=Sun…6=Sat) in tz for that date
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(startOfDate);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const daysFromMonday = map[dayName] ?? 0;
  const [y, m, d] = isoDate.split('-').map(Number);
  const mondayIso = addDays(y, m - 1, d, -daysFromMonday);
  const nextMondayIso = addDays(y, m - 1, d, 7 - daysFromMonday);
  return { fromUtc: startOfDayInTz(mondayIso, tz), toUtc: startOfDayInTz(nextMondayIso, tz) };
}

export function monthBoundsInTz(isoDate: string, tz: string): { fromUtc: Date; toUtc: Date } {
  const [y, m] = isoDate.split('-').map(Number);
  const first = `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-01`;
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const nextFirst = `${nextY.toString().padStart(4, '0')}-${nextM.toString().padStart(2, '0')}-01`;
  return { fromUtc: startOfDayInTz(first, tz), toUtc: startOfDayInTz(nextFirst, tz) };
}

function addDays(y: number, mIdx: number, d: number, delta: number): string {
  const dt = new Date(Date.UTC(y, mIdx, d + delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

/** SQL fragment: day-bucket a timestamp column in the given IANA timezone, returning a `date`. */
export function dayInTz(col: AnyColumn | SQL, tz: string): SQL {
  return sql`((${col} AT TIME ZONE 'UTC' AT TIME ZONE ${tz})::date)`;
}
