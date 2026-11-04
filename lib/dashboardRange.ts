// lib/dashboardRange.ts
//
// Period switcher maths for the main dashboard (today / yesterday / 7d /
// 30d / 90d / lifetime / custom). Everything here works in the VIEWER'S
// local calendar days — same convention as lib/analytics.ts's dayKey —
// so "today" means the viewer's today, not UTC's.
//
// `end` is always EXCLUSIVE (start of the day after the last included
// day), which is what the Firestore range queries in
// hooks/useDashboardData.ts want (`ts >= start && ts < end`).
export type RangeId = 'today' | 'yesterday' | '7d' | '30d' | '90d' | 'lifetime' | 'custom';

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: 'lifetime', label: 'Lifetime' },
];

/** Local YYYY-MM-DD keys. */
export interface CustomRange {
  from: string;
  to: string;
}

export interface ResolvedRange {
  id: RangeId;
  label: string;
  /** null only for lifetime (no lower bound on the query). */
  start: Date | null;
  /** Exclusive upper bound. */
  end: Date;
  /** Same-length window directly before this one; null for lifetime. */
  prevStart: Date | null;
  prevEnd: Date | null;
  /** Calendar days covered (>= 1). For lifetime: days since the site's first data. */
  days: number;
  /** True when the window still includes "now", so polling/incremental fetches make sense. */
  live: boolean;
  /** Single-day ranges chart by hour instead of by day. */
  hourly: boolean;
}

const DAY_MS = 86_400_000;

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function resolveRange(
  id: RangeId,
  custom: CustomRange,
  lifetimeStart: Date | null,
  now: Date = new Date()
): ResolvedRange {
  const today = startOfDay(now);
  const tomorrow = addDays(today, 1);

  let start: Date | null;
  let end: Date = tomorrow;
  let label: string;

  switch (id) {
    case 'today':
      start = today;
      label = 'Today';
      break;
    case 'yesterday':
      start = addDays(today, -1);
      end = today;
      label = 'Yesterday';
      break;
    case '7d':
      start = addDays(today, -6);
      label = 'Last 7 days';
      break;
    case '30d':
      start = addDays(today, -29);
      label = 'Last 30 days';
      break;
    case '90d':
      start = addDays(today, -89);
      label = 'Last 90 days';
      break;
    case 'custom': {
      const f = parseDayKey(custom.from);
      const t = parseDayKey(custom.to);
      if (f && t) {
        const a = f <= t ? f : t;
        const b = f <= t ? t : f;
        start = a;
        end = addDays(b, 1);
        label = a.getTime() === b.getTime() ? fmtShort(a) : `${fmtShort(a)} – ${fmtShort(b)}`;
      } else {
        start = addDays(today, -6);
        label = 'Last 7 days';
      }
      break;
    }
    default:
      start = null;
      label = 'Lifetime';
  }

  const effectiveStart = start ?? startOfDay(lifetimeStart ?? today);
  const days = Math.max(1, Math.round((end.getTime() - effectiveStart.getTime()) / DAY_MS));

  return {
    id,
    label,
    start,
    end,
    prevStart: start ? addDays(start, -days) : null,
    prevEnd: start ? start : null,
    days,
    live: end.getTime() > now.getTime(),
    hourly: days === 1,
  };
}

/** Stable string identity for a resolved range — used as a hook dependency. */
export function rangeSignature(r: ResolvedRange): string {
  return `${r.id}|${r.start ? r.start.getTime() : 'x'}|${r.end.getTime()}`;
}
