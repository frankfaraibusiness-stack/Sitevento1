// components/analytics/analyticsUtils.ts
//
// Pure helpers for the /dashboard/analytics page (design phase): greeting,
// name + host formatting, the date-range presets and the calendar maths the
// range picker needs. Nothing here touches Firestore or any other
// dashboard module — the analytics page is deliberately self-contained so
// its design can evolve without dragging the old dashboard along.
import type { User } from 'firebase/auth';
import type { Site } from '@/lib/types';

/* ── Greeting / identity ───────────────────────────────────────── */

export function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return 'Working late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Ahmed Khan" -> "Ahmed", "jane.doe@x.com" -> "Jane". '' if nothing usable. */
export function firstNameOf(user: Pick<User, 'displayName' | 'email'>): string {
  const display = (user.displayName || '').trim();
  let first = display ? display.split(/\s+/)[0] : '';
  if (!first && user.email) {
    first = user.email.split('@')[0].split(/[._+\-\d]+/).filter(Boolean)[0] || '';
  }
  if (!first) return '';
  return first.charAt(0).toUpperCase() + first.slice(1);
}

export function siteHost(site: Pick<Site, 'url' | 'name'>): string {
  try {
    const raw = site.url.includes('://') ? site.url : `https://${site.url}`;
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return site.url || site.name || 'your site';
  }
}

export type SiteTone = 'ok' | 'warn' | 'off';

export function siteState(site: Site): { label: string; tone: SiteTone } {
  if (site.paused) return { label: 'Tracking paused', tone: 'off' };
  if (site.status !== 'verified') return { label: 'Needs verification', tone: 'warn' };
  return { label: 'Verified · live', tone: 'ok' };
}

const BADGE_GRADIENTS: [string, string][] = [
  ['#6a48ff', '#b04cf0'],
  ['#2f7bff', '#4fd0ff'],
  ['#ff5fa2', '#ff9a62'],
  ['#0fa37f', '#5fe0b4'],
  ['#f5a524', '#ff6b4a'],
  ['#3d2bd6', '#8a6bff'],
];

/** Stable per-domain gradient so each startup keeps its own colour. */
export function badgeGradient(host: string): string {
  let h = 0;
  for (let i = 0; i < host.length; i++) h = (h * 31 + host.charCodeAt(i)) >>> 0;
  const [a, b] = BADGE_GRADIENTS[h % BADGE_GRADIENTS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

/* ── Date maths ────────────────────────────────────────────────── */

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
export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
export function isSameDay(a: Date | null, b: Date | null): boolean {
  return !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86_400_000) + 1;
}

/** Monday-first grid for a month: leading nulls, then every day. */
export function monthCells(month: Date): (Date | null)[] {
  const first = startOfMonth(month);
  const lead = (first.getDay() + 6) % 7; // Mon = 0
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let i = 1; i <= count; i++) cells.push(new Date(first.getFullYear(), first.getMonth(), i));
  return cells;
}

export const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function monthTitle(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

/* ── Range presets ─────────────────────────────────────────────── */

export type PresetId =
  | 'today'
  | 'yesterday'
  | '7d'
  | '30d'
  | '90d'
  | 'mtd'
  | 'lastMonth'
  | 'qtd'
  | 'ytd'
  | '12m'
  | 'all';

export interface RangeSel {
  preset: PresetId | 'custom';
  /** null only for "All time". */
  from: Date | null;
  to: Date;
}

export const PRESET_LABELS: Record<PresetId, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  mtd: 'This month',
  lastMonth: 'Last month',
  qtd: 'This quarter',
  ytd: 'Year to date',
  '12m': 'Last 12 months',
  all: 'All time',
};

/** Order shown in the picker's side rail. */
export const PRESET_ORDER: PresetId[] = ['today', 'yesterday', '7d', '30d', '90d', 'mtd', 'lastMonth', 'qtd', 'ytd', '12m', 'all'];

/** The quick chips shown directly in the header bar. */
export const QUICK_CHIPS: { id: PresetId; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
  { id: '12m', label: '12M' },
  { id: 'ytd', label: 'YTD' },
  { id: 'all', label: 'All' },
];

export function presetRange(id: PresetId, now: Date = new Date()): RangeSel {
  const today = startOfDay(now);
  switch (id) {
    case 'today':
      return { preset: id, from: today, to: today };
    case 'yesterday': {
      const y = addDays(today, -1);
      return { preset: id, from: y, to: y };
    }
    case '7d':
      return { preset: id, from: addDays(today, -6), to: today };
    case '30d':
      return { preset: id, from: addDays(today, -29), to: today };
    case '90d':
      return { preset: id, from: addDays(today, -89), to: today };
    case 'mtd':
      return { preset: id, from: startOfMonth(today), to: today };
    case 'lastMonth': {
      const first = addMonths(today, -1);
      return { preset: id, from: first, to: new Date(first.getFullYear(), first.getMonth() + 1, 0) };
    }
    case 'qtd':
      return { preset: id, from: new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1), to: today };
    case 'ytd':
      return { preset: id, from: new Date(today.getFullYear(), 0, 1), to: today };
    case '12m':
      return { preset: id, from: addDays(today, -364), to: today };
    case 'all':
    default:
      return { preset: 'all', from: null, to: today };
  }
}

function fmtDay(d: Date, withYear: boolean): string {
  return d.toLocaleDateString(undefined, withYear ? { month: 'short', day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric' });
}

/** "Oct 12 – Nov 10, 2026" / "Nov 10, 2026" / "All time". */
export function formatRange(from: Date | null, to: Date): string {
  if (!from) return 'All time';
  if (isSameDay(from, to)) return fmtDay(to, true);
  const sameYear = from.getFullYear() === to.getFullYear();
  return `${fmtDay(from, !sameYear)} – ${fmtDay(to, true)}`;
}

export function rangeHeadline(sel: RangeSel): string {
  return sel.preset === 'custom' ? 'Custom range' : PRESET_LABELS[sel.preset];
}

/** The equally long window directly before `sel`, or null for All time. */
export function previousWindow(sel: RangeSel): { from: Date; to: Date } | null {
  if (!sel.from) return null;
  const len = daysBetween(sel.from, sel.to);
  const to = addDays(sel.from, -1);
  return { from: addDays(to, -(len - 1)), to };
}
