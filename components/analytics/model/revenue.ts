// components/analytics/model/revenue.ts
//
// Revenue, profit, subscriptions and product sales — computed ONLY from what
// the customer's backend sent through the API (lib/apiEvents.ts shapes). Pure
// functions over BackendEvent[]; no sample numbers anywhere.
import type { BackendEvent, CatalogEntry } from '../useAnalyticsExtras';
import type { Dir } from '../sections/analyticsTypes';

export const MONTH_MS = 30.4375 * 86_400_000;
const DAY_MS = 86_400_000;

export function fmtMoney(n: number, currency: string): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  try {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: abs >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    });
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function deltaOf(now: number, before: number | null): { text: string; dir: Dir } | null {
  if (before === null) return null;
  if (before === 0) return now === 0 ? { text: 'no change', dir: 'flat' } : { text: 'new vs prior period', dir: 'up' };
  const pct = ((now - before) / Math.abs(before)) * 100;
  if (Math.abs(pct) < 0.05) return { text: 'no change', dir: 'flat' };
  const v = Math.abs(pct) >= 100 ? Math.round(Math.abs(pct)) : Math.round(Math.abs(pct) * 10) / 10;
  return { text: `${v}% vs prior period`, dir: pct > 0 ? 'up' : 'down' };
}

/** Monthly value of a recurring price. */
export function monthly(amount: number, interval: string, qty = 1): number {
  const a = amount * qty;
  switch (interval) {
    case 'week':
      return a * 4.345;
    case 'quarter':
      return a / 3;
    case 'year':
      return a / 12;
    default:
      return a;
  }
}

const money = (e: BackendEvent) => (typeof e.data.currency === 'string' ? (e.data.currency as string) : null);
const n = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** The currency most money events use; the rest are excluded (and counted) rather than silently mixed. */
export function pickCurrency(events: BackendEvent[]): { currency: string; excluded: number } {
  const counts = new Map<string, number>();
  let total = 0;
  for (const e of events) {
    const c = money(e);
    if (!c) continue;
    counts.set(c, (counts.get(c) || 0) + 1);
    total += 1;
  }
  let best = '';
  let bestN = 0;
  counts.forEach((v, k) => {
    if (v > bestN) {
      best = k;
      bestN = v;
    }
  });
  return { currency: best, excluded: total - bestN };
}

export interface PeriodTotals {
  revenue: number;
  saasRevenue: number;
  productRevenue: number;
  refunded: number;
  cogs: number;
  opex: number;
  orders: number;
  units: number;
  refundedOrders: number;
  chargebacks: number;
  marketing: number;
}

const EMPTY: PeriodTotals = { revenue: 0, saasRevenue: 0, productRevenue: 0, refunded: 0, cogs: 0, opex: 0, orders: 0, units: 0, refundedOrders: 0, chargebacks: 0, marketing: 0 };

/** Money in and out for [from, to). Recurring expenses are spread evenly per day from the day they were sent. */
export function totalsFor(events: BackendEvent[], from: number, to: number, currency: string): PeriodTotals {
  const t = { ...EMPTY };
  const refundedIds = new Set<string>();
  for (const e of events) {
    const c = money(e);
    if (c && c !== currency) continue;
    const d = e.data;
    const inWin = e.at >= from && e.at < to;
    switch (e.event) {
      case 'order.completed':
        if (!inWin) break;
        t.orders += 1;
        t.productRevenue += n(d.total) - n(d.tax);
        t.cogs += n(d.fee);
        for (const it of Array.isArray(d.items) ? d.items : []) {
          t.units += n(it.quantity) || 1;
          t.cogs += n(it.cost) * (n(it.quantity) || 1);
        }
        break;
      case 'subscription.started':
      case 'subscription.renewed':
        if (inWin) t.saasRevenue += n(d.amount) * (n(d.quantity) || 1);
        break;
      case 'order.refunded':
      case 'order.chargeback':
        if (!inWin) break;
        t.refunded += n(d.amount);
        if (e.event === 'order.chargeback') t.chargebacks += 1;
        if (typeof d.orderId === 'string') refundedIds.add(d.orderId);
        break;
      case 'expense.recorded': {
        const amount = n(d.amount);
        let part = 0;
        if (d.recurring === 'month' || d.recurring === 'year') {
          const perDay = amount / (d.recurring === 'month' ? 30.4375 : 365.25);
          const lo = Math.max(from, e.at);
          if (to > lo) part = perDay * ((to - lo) / DAY_MS);
        } else if (inWin) {
          part = amount;
        }
        if (d.category === 'cogs') t.cogs += part;
        else t.opex += part;
        break;
      }
      case 'adspend.recorded':
        if (inWin) {
          t.opex += n(d.amount);
          t.marketing += n(d.amount);
        }
        break;
    }
  }
  t.refundedOrders = refundedIds.size;
  t.revenue = t.saasRevenue + t.productRevenue - t.refunded;
  return t;
}

/* ── Subscriptions ───────────────────────────────────────────────── */

interface SubState {
  plan: string;
  mrr: number;
  amount: number;
  interval: string;
  active: boolean;
}

/** State of every subscription after replaying events up to `until` (oldest first). */
function replay(events: BackendEvent[], until: number, currency: string): Map<string, SubState> {
  const subs = new Map<string, SubState>();
  for (const e of events) {
    if (e.at >= until || !e.event.startsWith('subscription.')) continue;
    const c = money(e);
    if (c && c !== currency) continue;
    const id = String(e.data.subscriptionId ?? '');
    if (!id) continue;
    if (e.event === 'subscription.canceled') {
      const s = subs.get(id);
      if (s) s.active = false;
    } else if (e.event === 'subscription.started' || e.event === 'subscription.renewed' || e.event === 'subscription.changed') {
      const interval = String(e.data.interval ?? 'month');
      subs.set(id, {
        plan: String(e.data.plan ?? 'Plan'),
        amount: n(e.data.amount),
        interval,
        mrr: monthly(n(e.data.amount), interval, n(e.data.quantity) || 1),
        active: true,
      });
    }
  }
  return subs;
}

export interface SaasModel {
  mrr: number;
  prevMrr: number | null;
  arr: number;
  subscribers: number;
  newSubs: number;
  canceled: number;
  churnRate: number | null;
  arpu: number | null;
  plans: { plan: string; price: string; subscribers: number; mrr: number }[];
  movement: { label: string; value: number; dir: 'pos' | 'neg' | 'flat' }[];
  failedPayments: number;
  trialsStarted: number;
  trialsConverted: number;
  trialsEnded: number;
  hasData: boolean;
}

export function saasFor(allAsc: BackendEvent[], catalog: CatalogEntry[], from: number, to: number, currency: string): SaasModel {
  const before = replay(allAsc, from, currency);
  const after = replay(allAsc, to, currency);
  const live = Array.from(after.values()).filter((s) => s.active);
  const mrr = live.reduce((a, s) => a + s.mrr, 0);
  const startActive = Array.from(before.values()).filter((s) => s.active);
  const prevMrr = startActive.length || before.size ? startActive.reduce((a, s) => a + s.mrr, 0) : null;

  // MRR movement inside the period.
  const run = new Map<string, SubState>();
  before.forEach((v, k) => run.set(k, { ...v }));
  let nu = 0;
  let expansion = 0;
  let contraction = 0;
  let churned = 0;
  let newSubs = 0;
  let canceled = 0;
  let failed = 0;
  let trialsStarted = 0;
  let trialsConverted = 0;
  let trialsEnded = 0;
  for (const e of allAsc) {
    if (e.at < from || e.at >= to) continue;
    if (e.event === 'trial.started') trialsStarted += 1;
    if (e.event === 'trial.ended') {
      trialsEnded += 1;
      if (e.data.outcome === 'converted') trialsConverted += 1;
    }
    if (!e.event.startsWith('subscription.')) continue;
    const c = money(e);
    if (c && c !== currency) continue;
    const id = String(e.data.subscriptionId ?? '');
    if (e.event === 'subscription.payment_failed') {
      failed += 1;
      continue;
    }
    const prev = run.get(id);
    if (e.event === 'subscription.canceled') {
      if (prev?.active) {
        churned += prev.mrr;
        canceled += 1;
        prev.active = false;
      }
      continue;
    }
    const interval = String(e.data.interval ?? 'month');
    const next: SubState = {
      plan: String(e.data.plan ?? 'Plan'),
      amount: n(e.data.amount),
      interval,
      mrr: monthly(n(e.data.amount), interval, n(e.data.quantity) || 1),
      active: true,
    };
    if (!prev || !prev.active) {
      if (e.event === 'subscription.started' || !prev) {
        nu += next.mrr;
        newSubs += 1;
      }
    } else if (next.mrr > prev.mrr + 0.005) expansion += next.mrr - prev.mrr;
    else if (next.mrr < prev.mrr - 0.005) contraction += prev.mrr - next.mrr;
    run.set(id, next);
  }

  // Plans: live subscriptions grouped by plan, plus catalog plans with nobody on them.
  const byPlan = new Map<string, { price: string; subscribers: number; mrr: number }>();
  const priceLabel = (amount: number, interval: string) => `${fmtMoney(amount, currency)}/${interval === 'month' ? 'mo' : interval === 'year' ? 'yr' : interval === 'week' ? 'wk' : 'qtr'}`;
  for (const s of live) {
    const cur = byPlan.get(s.plan) ?? { price: priceLabel(s.amount, s.interval), subscribers: 0, mrr: 0 };
    cur.subscribers += 1;
    cur.mrr += s.mrr;
    byPlan.set(s.plan, cur);
  }
  for (const p of catalog) {
    if (p.kind !== 'plan' || !p.active || (p.currency && p.currency !== currency)) continue;
    if (!byPlan.has(p.name)) byPlan.set(p.name, { price: priceLabel(p.amount, p.interval ?? 'month'), subscribers: 0, mrr: 0 });
  }
  const plans = Array.from(byPlan.entries())
    .map(([plan, v]) => ({ plan, ...v }))
    .sort((a, b) => b.mrr - a.mrr || b.subscribers - a.subscribers);

  const mv = (label: string, value: number, sign: 1 | -1) => ({ label, value: value * sign, dir: (value === 0 ? 'flat' : sign > 0 ? 'pos' : 'neg') as 'pos' | 'neg' | 'flat' });
  const hasData = allAsc.some((e) => e.event.startsWith('subscription.')) || catalog.some((c) => c.kind === 'plan');
  return {
    mrr,
    prevMrr,
    arr: mrr * 12,
    subscribers: live.length,
    newSubs,
    canceled,
    churnRate: startActive.length ? canceled / startActive.length : null,
    arpu: live.length ? mrr / live.length : null,
    plans,
    movement: [mv('New business', nu, 1), mv('Expansion', expansion, 1), mv('Contraction', contraction, -1), mv('Churned', churned, -1)],
    failedPayments: failed,
    trialsStarted,
    trialsConverted,
    trialsEnded,
    hasData,
  };
}

/* ── Product sales ───────────────────────────────────────────────── */

export interface ProductModel {
  orders: number;
  revenue: number;
  aov: number | null;
  units: number;
  itemsPerOrder: number | null;
  refundRate: number | null;
  refunded: number;
  best: { name: string; revenue: number; units: number }[];
  hasData: boolean;
}

export function productsFor(events: BackendEvent[], catalog: CatalogEntry[], from: number, to: number, currency: string, totals: PeriodTotals): ProductModel {
  const by = new Map<string, { revenue: number; units: number }>();
  for (const e of events) {
    if (e.event !== 'order.completed' || e.at < from || e.at >= to) continue;
    const c = money(e);
    if (c && c !== currency) continue;
    for (const it of Array.isArray(e.data.items) ? e.data.items : []) {
      const key = String(it.name ?? it.productId ?? 'Item');
      const q = n(it.quantity) || 1;
      const cur = by.get(key) ?? { revenue: 0, units: 0 };
      cur.revenue += n(it.price) * q;
      cur.units += q;
      by.set(key, cur);
    }
  }
  for (const p of catalog) if (p.kind === 'product' && p.active && !by.has(p.name)) by.set(p.name, { revenue: 0, units: 0 });
  const best = Array.from(by.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 6);
  const hasData = events.some((e) => e.type === 'orders' || e.type === 'refunds') || catalog.some((c) => c.kind === 'product');
  return {
    orders: totals.orders,
    revenue: totals.productRevenue,
    aov: totals.orders ? totals.productRevenue / totals.orders : null,
    units: totals.units,
    itemsPerOrder: totals.orders ? totals.units / totals.orders : null,
    refundRate: totals.orders ? totals.refundedOrders / totals.orders : null,
    refunded: totals.refunded,
    best,
    hasData,
  };
}
