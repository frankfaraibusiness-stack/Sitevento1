// lib/apiEvents.ts
//
// Server-side validation + normalisation for every event the customer API
// accepts (the catalog lives in lib/apiPermissions.ts — this file is the
// enforcement half). Pure functions, no Firestore: app/api/ingest calls
// validateApiEvent() after it has authenticated the key, resolved the site
// and checked the permission.
//
// Output is deliberately flat and typed so the Analytics page can aggregate
// it without guessing: money is a finite number >= 0, currency is an
// upper-case ISO code, ids are clipped strings, dates are real Dates.
import { permissionForEvent, RESERVED_METRICS } from './apiPermissions';

export type Json = Record<string, unknown>;

export interface ValidEvent {
  event: string;
  /** Permission id from the catalog (e.g. "orders"). */
  type: string;
  userId: string | null;
  visitorId: string | null;
  /** When it really happened. */
  occurredAt: Date;
  /** Normalised fields (what the dashboard reads). */
  data: Json;
  /** Same id again = the same event: the second one is ignored, never double counted. */
  dedupeId: string | null;
  /** Same id again = replace the earlier one (daily ad spend, catalog entries). */
  upsertId: string | null;
  /** Catalog entries (plans/products) are also kept in a per-site catalog. */
  catalog: { kind: 'plan' | 'product'; id: string } | null;
}

export type ValidationResult = { ok: true; value: ValidEvent } | { ok: false; error: string; field?: string };

const MAX_STR = 200;
const MAX_ID = 200;
const MAX_ITEMS = 100;
const MAX_PROPS_BYTES = 4 * 1024;
const DAY = 86_400_000;

const RESERVED_NAMES = new Set(RESERVED_METRICS.flatMap((m) => m.blocks.map((b) => b.toLowerCase())));

/** True for event names that would write traffic/visitor numbers. */
export function isReservedEvent(event: string): boolean {
  const e = event.trim().toLowerCase();
  if (RESERVED_NAMES.has(e)) return true;
  // Anything shaped like a traffic event in any casing/separator: "page-view", "PageView", "visit.created"…
  const squashed = e.replace(/[^a-z]/g, '');
  return ['pageview', 'pageviews', 'visit', 'visits', 'visitor', 'visitors', 'click', 'clicks', 'session', 'sessions', 'bounce', 'botblocked'].includes(squashed) || /^(visit|visitor|session|pageview|page_view|click)\./.test(e);
}

class Bad extends Error {
  field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

function str(b: Json, key: string, required: boolean, max = MAX_STR): string | null {
  const v = b[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new Bad(`"${key}" is required.`, key);
    return null;
  }
  if (typeof v !== 'string' && typeof v !== 'number') throw new Bad(`"${key}" must be text.`, key);
  const s = String(v).trim();
  if (!s) {
    if (required) throw new Bad(`"${key}" is required.`, key);
    return null;
  }
  return s.slice(0, max);
}

function num(b: Json, key: string, required: boolean, opts: { min?: number; max?: number; int?: boolean } = {}): number | null {
  const v = b[key];
  if (v === undefined || v === null || v === '') {
    if (required) throw new Bad(`"${key}" is required.`, key);
    return null;
  }
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  if (!Number.isFinite(n)) throw new Bad(`"${key}" must be a number.`, key);
  const min = opts.min ?? 0;
  const max = opts.max ?? 1e12;
  if (n < min) throw new Bad(`"${key}" must be at least ${min}.`, key);
  if (n > max) throw new Bad(`"${key}" is too large.`, key);
  if (opts.int && !Number.isInteger(n)) throw new Bad(`"${key}" must be a whole number.`, key);
  return opts.int ? n : Math.round(n * 100) / 100;
}

function currency(b: Json, required = true): string | null {
  const c = str(b, 'currency', required, 3);
  if (c === null) return null;
  if (!/^[A-Za-z]{3}$/.test(c)) throw new Bad('"currency" must be a 3-letter code like "USD".', 'currency');
  return c.toUpperCase();
}

function oneOf(b: Json, key: string, allowed: string[], required: boolean): string | null {
  const v = str(b, key, required, 40);
  if (v === null) return null;
  const s = v.toLowerCase();
  if (!allowed.includes(s)) throw new Bad(`"${key}" must be one of: ${allowed.join(', ')}.`, key);
  return s;
}

function parseDate(v: unknown, field: string): Date {
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' ? new Date(v) : null;
  if (!d || isNaN(d.getTime())) throw new Bad(`"${field}" must be an ISO date-time like 2026-11-10T14:30:00Z.`, field);
  return d;
}

function safeId(s: string): string {
  return s.replace(/[^A-Za-z0-9_.-]/g, '_').slice(0, 120);
}

const INTERVALS = ['week', 'month', 'quarter', 'year'];
const EXPENSE_TYPES = ['hosting', 'payment_fees', 'fulfillment', 'team', 'tools', 'marketing', 'other'];

/** Validates one event body. `body` is the parsed JSON object (flat fields or under `data`). */
export function validateApiEvent(event: string, body: Json, now = new Date()): ValidationResult {
  try {
    const perm = permissionForEvent(event);
    if (!perm) return { ok: false, error: `Unknown event "${event}".` };

    const userId = str(body, 'userId', false, MAX_ID);
    const visitorId = str(body, 'visitorId', false, MAX_ID);

    let occurredAt = now;
    if (body.occurredAt !== undefined && body.occurredAt !== null && body.occurredAt !== '') {
      occurredAt = parseDate(body.occurredAt, 'occurredAt');
      if (occurredAt.getTime() > now.getTime() + 5 * 60_000) throw new Bad('"occurredAt" is in the future.', 'occurredAt');
      if (occurredAt.getTime() < now.getTime() - 800 * DAY) throw new Bad('"occurredAt" is more than 2 years ago.', 'occurredAt');
    }

    const data: Json = {};
    let dedupeId: string | null = null;
    let upsertId: string | null = null;
    let catalog: ValidEvent['catalog'] = null;
    const need = (k: string) => {
      const v = str(body, k, true, MAX_ID)!;
      return v;
    };

    switch (event) {
      case 'subscription.started':
      case 'subscription.renewed':
      case 'subscription.changed': {
        data.subscriptionId = need('subscriptionId');
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        data.plan = str(body, 'plan', true, 100);
        data.amount = num(body, 'amount', true);
        data.currency = currency(body);
        data.interval = oneOf(body, 'interval', INTERVALS, true);
        data.quantity = num(body, 'quantity', false, { min: 1, max: 100000, int: true }) ?? 1;
        const planId = str(body, 'planId', false, 100);
        if (planId) data.planId = planId;
        if (event === 'subscription.changed') {
          const fp = str(body, 'fromPlan', false, 100);
          if (fp) data.fromPlan = fp;
          const fa = num(body, 'fromAmount', false);
          if (fa !== null) data.fromAmount = fa;
        }
        if (event === 'subscription.started') dedupeId = `substart_${safeId(String(data.subscriptionId))}`;
        break;
      }
      case 'subscription.canceled': {
        data.subscriptionId = need('subscriptionId');
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        const r = str(body, 'reason', false, 200);
        if (r) data.reason = r;
        dedupeId = `subcancel_${safeId(String(data.subscriptionId))}`;
        break;
      }
      case 'subscription.payment_failed': {
        data.subscriptionId = need('subscriptionId');
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        const a = num(body, 'amount', false);
        if (a !== null) data.amount = a;
        const c = currency(body, false);
        if (c) data.currency = c;
        break;
      }
      case 'plan.upsert': {
        const id = need('planId');
        data.planId = id;
        data.name = str(body, 'name', true, 100);
        data.amount = num(body, 'amount', true);
        data.currency = currency(body);
        data.interval = oneOf(body, 'interval', INTERVALS, true);
        data.active = body.active === false || body.active === 'false' ? false : true;
        upsertId = `plan_${safeId(id)}`;
        catalog = { kind: 'plan', id: safeId(id) };
        break;
      }
      case 'order.completed': {
        const id = need('orderId');
        data.orderId = id;
        data.total = num(body, 'total', true);
        data.currency = currency(body);
        const raw = body.items;
        if (!Array.isArray(raw) || raw.length === 0) throw new Bad('"items" must be a list with at least one item.', 'items');
        if (raw.length > MAX_ITEMS) throw new Bad(`"items" can hold up to ${MAX_ITEMS} items.`, 'items');
        data.items = raw.map((it, i) => {
          if (!it || typeof it !== 'object' || Array.isArray(it)) throw new Bad(`items[${i}] must be an object.`, 'items');
          const o = it as Json;
          const name = str(o, 'name', false, 150) ?? str(o, 'productId', false, 150);
          if (!name) throw new Bad(`items[${i}] needs a "name" or "productId".`, 'items');
          const out: Json = { name, price: num(o, 'price', true), quantity: num(o, 'quantity', false, { min: 1, max: 100000, int: true }) ?? 1 };
          const pid = str(o, 'productId', false, 150);
          if (pid) out.productId = pid;
          const cost = num(o, 'cost', false);
          if (cost !== null) out.cost = cost;
          return out;
        });
        for (const k of ['discount', 'tax', 'shipping', 'fee']) {
          const v = num(body, k, false);
          if (v !== null) data[k] = v;
        }
        dedupeId = `order_${safeId(id)}`;
        break;
      }
      case 'order.refunded':
      case 'order.chargeback': {
        data.orderId = need('orderId');
        data.amount = num(body, 'amount', true);
        data.currency = currency(body);
        const r = str(body, 'reason', false, 200);
        if (r) data.reason = r;
        const sid = str(body, 'subscriptionId', false, MAX_ID);
        if (sid) data.subscriptionId = sid;
        const rid = str(body, 'refundId', false, MAX_ID);
        if (rid) dedupeId = `refund_${safeId(rid)}`;
        break;
      }
      case 'product.upsert': {
        const id = need('productId');
        data.productId = id;
        data.name = str(body, 'name', true, 150);
        data.price = num(body, 'price', true);
        data.currency = currency(body);
        const cost = num(body, 'cost', false);
        if (cost !== null) data.cost = cost;
        const cat = str(body, 'category', false, 100);
        if (cat) data.category = cat;
        data.active = body.active === false || body.active === 'false' ? false : true;
        upsertId = `product_${safeId(id)}`;
        catalog = { kind: 'product', id: safeId(id) };
        break;
      }
      case 'expense.recorded': {
        data.category = oneOf(body, 'category', ['cogs', 'opex'], true);
        data.type = oneOf(body, 'type', EXPENSE_TYPES, true);
        data.amount = num(body, 'amount', true);
        data.currency = currency(body);
        const d = str(body, 'description', false, 200);
        if (d) data.description = d;
        const rec = oneOf(body, 'recurring', ['month', 'year', 'none'], false);
        if (rec && rec !== 'none') data.recurring = rec;
        break;
      }
      case 'adspend.recorded': {
        data.source = str(body, 'source', true, 100)!.toLowerCase();
        data.amount = num(body, 'amount', true);
        data.currency = currency(body);
        const date = str(body, 'date', true, 10)!;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00Z`).getTime())) throw new Bad('"date" must look like 2026-11-10.', 'date');
        data.date = date;
        const medium = str(body, 'medium', false, 100);
        const campaign = str(body, 'campaign', false, 150);
        if (medium) data.medium = medium.toLowerCase();
        if (campaign) data.campaign = campaign;
        const imp = num(body, 'impressions', false, { int: true });
        if (imp !== null) data.impressions = imp;
        const clk = num(body, 'clicks', false, { int: true });
        if (clk !== null) data.clicks = clk;
        occurredAt = new Date(`${date}T12:00:00Z`);
        upsertId = `adspend_${safeId(`${data.source}_${medium ?? ''}_${campaign ?? ''}_${date}`)}`;
        break;
      }
      case 'user.signed_up': {
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        const plan = str(body, 'plan', false, 100);
        if (plan) data.plan = plan;
        const method = str(body, 'method', false, 60);
        if (method) data.method = method;
        dedupeId = `signup_${safeId(userId)}`;
        break;
      }
      case 'user.deleted': {
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        const r = str(body, 'reason', false, 200);
        if (r) data.reason = r;
        dedupeId = `deleted_${safeId(userId)}`;
        break;
      }
      case 'user.logged_in': {
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        const m = str(body, 'method', false, 60);
        if (m) data.method = m;
        break;
      }
      case 'trial.started': {
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        data.plan = str(body, 'plan', true, 100);
        if (body.endsAt) data.endsAt = parseDate(body.endsAt, 'endsAt').toISOString();
        break;
      }
      case 'trial.ended': {
        if (!userId) throw new Bad('"userId" is required.', 'userId');
        data.outcome = oneOf(body, 'outcome', ['converted', 'expired'], true);
        const plan = str(body, 'plan', false, 100);
        if (plan) data.plan = plan;
        break;
      }
      case 'goal.completed': {
        data.goal = str(body, 'goal', true, 100);
        const v = num(body, 'value', false);
        if (v !== null) {
          data.value = v;
          data.currency = currency(body);
        }
        break;
      }
      case 'search.performed': {
        data.term = str(body, 'term', true, 100)!.toLowerCase();
        data.results = num(body, 'results', true, { int: true, max: 10_000_000 });
        break;
      }
      case 'server.error': {
        data.status = num(body, 'status', true, { min: 400, max: 599, int: true });
        const p = str(body, 'path', true, 300)!;
        data.path = p.split('?')[0];
        const m = str(body, 'method', false, 10);
        if (m) data.method = m.toUpperCase();
        const msg = str(body, 'message', false, 200);
        if (msg) data.message = msg;
        data.count = num(body, 'count', false, { min: 1, max: 1_000_000, int: true }) ?? 1;
        break;
      }
      case 'server.metrics': {
        data.requests = num(body, 'requests', true, { int: true, max: 1e10 });
        data.errors = num(body, 'errors', true, { int: true, max: 1e10 });
        if ((data.errors as number) > (data.requests as number)) throw new Bad('"errors" can’t be more than "requests".', 'errors');
        const avg = num(body, 'avgMs', false, { max: 600_000 });
        if (avg !== null) data.avgMs = avg;
        const p95 = num(body, 'p95Ms', false, { max: 600_000 });
        if (p95 !== null) data.p95Ms = p95;
        data.windowSeconds = num(body, 'windowSeconds', false, { min: 10, max: 3600, int: true }) ?? 60;
        break;
      }
      default: {
        if (event.startsWith('custom.')) {
          const name = event.slice('custom.'.length);
          if (!/^[A-Za-z0-9_.-]{1,60}$/.test(name)) throw new Bad('Custom event names use letters, numbers, "_", "-" or "." (max 60).');
          const props = body.properties;
          if (props !== undefined && props !== null) {
            if (typeof props !== 'object' || Array.isArray(props)) throw new Bad('"properties" must be an object.', 'properties');
            if (Object.keys(props as Json).length > 20) throw new Bad('"properties" can hold up to 20 keys.', 'properties');
            if (JSON.stringify(props).length > MAX_PROPS_BYTES) throw new Bad('"properties" is too large (4 KB max).', 'properties');
            data.properties = props;
          }
          data.name = name;
          break;
        }
        return { ok: false, error: `Unknown event "${event}".` };
      }
    }

    return { ok: true, value: { event, type: perm.id, userId, visitorId, occurredAt, data, dedupeId, upsertId, catalog } };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, error: e.message, field: e.field };
    throw e;
  }
}
