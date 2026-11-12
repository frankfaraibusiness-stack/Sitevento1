'use client';

// components/analytics/useAnalyticsExtras.ts
//
// The data sources the visits query (hooks/useDashboardData.ts) doesn't cover,
// loaded for ONE site and ONE period:
//
//   apiEvents     what the customer's BACKEND sent through /api/ingest —
//                 subscriptions, orders, expenses, sign-ups… (live key only).
//                 Loaded for the period AND the window before it, in one
//                 query, so every "vs previous" figure is real.
//   customEvents  named events fired by the site's own page (sitevento('track'))
//   jsErrors      grouped uncaught browser errors (app/api/js-error)
//   uptimeDays    daily uptime rollups, last 90 days (app/api/uptime-check)
//   apiStats      hourly API outcome tallies (app/api/ingest)
//   apiCatalog    plans + products the backend has sent
//
// Read-saving rules, same spirit as the main hook: bounded queries, loaded
// once per site/period (plus on manual refresh), never polled, and one
// fire-and-forget uptime probe per site per page view (the server throttles it
// to one probe per 5 minutes).
import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, documentId, getDocs, limit, orderBy, query, Timestamp, where, type DocumentData } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { rangeSignature, type ResolvedRange } from '@/lib/dashboardRange';
import { normalizeVisit, toMs, type NormVisit } from '@/lib/dashboardStats';

export interface BackendEvent {
  id: string;
  event: string;
  type: string;
  userId: string | null;
  visitorId: string | null;
  at: number;
  data: Record<string, any>;
}
export interface SiteCustomEvent {
  name: string;
  properties: Record<string, any>;
  visitorId: string;
  ts: number;
}
export interface JsErrorRow {
  id: string;
  message: string;
  path: string;
  browser: string;
  count: number;
  days: Record<string, number>;
  lastSeen: number | null;
}
export interface UptimeDay {
  day: string;
  up: number;
  degraded: number;
  down: number;
  samples: number;
  totalMs: number;
}
export interface ApiHour {
  hour: number;
  accepted: number;
  acceptedTest: number;
  duplicate: number;
  rejPermission: number;
  rejReserved: number;
  rejInvalid: number;
  total: number;
  totalMs: number;
}
export interface CatalogEntry {
  kind: 'plan' | 'product';
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval?: string;
  cost?: number;
  active: boolean;
}

export interface AnalyticsExtras {
  backend: BackendEvent[]; // newest first, live-key events for this site, period + previous window
  backendTruncated: boolean;
  customEvents: SiteCustomEvent[];
  jsErrors: JsErrorRow[];
  uptime: UptimeDay[];
  apiHours: ApiHour[];
  catalog: CatalogEntry[];
}

export const EMPTY_EXTRAS: AnalyticsExtras = {
  backend: [],
  backendTruncated: false,
  customEvents: [],
  jsErrors: [],
  uptime: [],
  apiHours: [],
  catalog: [],
};

const BACKEND_CAP = 4000;
const CUSTOM_CAP = 2000;

const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);

export function useAnalyticsExtras(user: User, siteId: string | null, range: ResolvedRange, enabled: boolean) {
  const [extras, setExtras] = useState<AnalyticsExtras>(EMPTY_EXTRAS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const sig = rangeSignature(range);
  const uid = user.uid;

  const load = useCallback(async () => {
    if (!siteId || !enabled) return;
    const mine = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const db = getFirebaseDb();
      const siteCol = (name: string) => collection(db, 'users', uid, 'sites', siteId, name);
      const winStart = range.prevStart ?? range.start; // null = lifetime: no lower bound
      const hasStart = !!winStart;
      const endTs = Timestamp.fromDate(range.end);

      const backendQ = query(
        collection(db, 'users', uid, 'apiEvents'),
        ...(hasStart ? [where('occurredAt', '>=', Timestamp.fromDate(winStart!))] : []),
        where('occurredAt', '<', endTs),
        orderBy('occurredAt', 'desc'),
        limit(BACKEND_CAP)
      );
      const customQ = query(
        siteCol('customEvents'),
        ...(range.start ? [where('ts', '>=', Timestamp.fromDate(range.start))] : []),
        where('ts', '<', endTs),
        orderBy('ts', 'desc'),
        limit(CUSTOM_CAP)
      );
      const statsQ = query(
        siteCol('apiStats'),
        ...(range.start ? [where('hour', '>=', Timestamp.fromDate(range.start))] : []),
        where('hour', '<', endTs),
        orderBy('hour', 'desc'),
        limit(1000)
      );

      const [backendSnap, customSnap, errSnap, upSnap, statsSnap, catSnap] = await Promise.all([
        getDocs(backendQ),
        getDocs(customQ).catch(() => null),
        getDocs(query(siteCol('jsErrors'), orderBy('lastSeen', 'desc'), limit(100))).catch(() => null),
        getDocs(query(siteCol('uptimeDays'), orderBy(documentId(), 'desc'), limit(90))).catch(() => null),
        getDocs(statsQ).catch(() => null),
        getDocs(query(siteCol('apiCatalog'), limit(500))).catch(() => null),
      ]);
      if (mine !== seq.current) return;

      const backend: BackendEvent[] = [];
      for (const d of backendSnap.docs) {
        const x = d.data() as DocumentData;
        if (x.test === true) continue; // test-key traffic never reaches real analytics
        if (x.siteId && x.siteId !== siteId) continue;
        const at = toMs(x.occurredAt);
        if (at === null) continue;
        backend.push({
          id: d.id,
          event: String(x.event ?? ''),
          type: String(x.type ?? ''),
          userId: typeof x.userId === 'string' ? x.userId : null,
          visitorId: typeof x.visitorId === 'string' ? x.visitorId : null,
          at,
          data: (x.data && typeof x.data === 'object' ? x.data : {}) as Record<string, any>,
        });
      }

      const customEvents: SiteCustomEvent[] = (customSnap?.docs ?? []).flatMap((d) => {
        const x = d.data();
        const ts = toMs(x.ts);
        return ts === null ? [] : [{ name: String(x.name ?? ''), properties: (x.properties ?? {}) as Record<string, any>, visitorId: String(x.visitorId ?? ''), ts }];
      });

      const jsErrors: JsErrorRow[] = (errSnap?.docs ?? []).map((d) => {
        const x = d.data();
        return {
          id: d.id,
          message: String(x.message ?? ''),
          path: String(x.path ?? '/'),
          browser: String(x.browser ?? 'Other'),
          count: num(x.count),
          days: (x.days ?? {}) as Record<string, number>,
          lastSeen: toMs(x.lastSeen),
        };
      });

      const uptime: UptimeDay[] = (upSnap?.docs ?? []).map((d) => {
        const x = d.data();
        return { day: d.id, up: num(x.up), degraded: num(x.degraded), down: num(x.down), samples: num(x.samples), totalMs: num(x.totalMs) };
      });

      const apiHours: ApiHour[] = (statsSnap?.docs ?? []).flatMap((d) => {
        const x = d.data();
        const hour = toMs(x.hour);
        return hour === null
          ? []
          : [
              {
                hour,
                accepted: num(x.accepted),
                acceptedTest: num(x.accepted_test),
                duplicate: num(x.duplicate),
                rejPermission: num(x.rej_permission),
                rejReserved: num(x.rej_reserved),
                rejInvalid: num(x.rej_invalid),
                total: num(x.total),
                totalMs: num(x.totalMs),
              },
            ];
      });

      const catalog: CatalogEntry[] = (catSnap?.docs ?? []).flatMap((d) => {
        const x = d.data();
        if (x.test === true) return [];
        const kind = x.kind === 'product' ? 'product' : 'plan';
        return [
          {
            kind,
            id: String(kind === 'product' ? x.productId ?? d.id : x.planId ?? d.id),
            name: String(x.name ?? ''),
            amount: num(kind === 'product' ? x.price : x.amount),
            currency: String(x.currency ?? ''),
            interval: typeof x.interval === 'string' ? x.interval : undefined,
            cost: typeof x.cost === 'number' ? x.cost : undefined,
            active: x.active !== false,
          } as CatalogEntry,
        ];
      });

      setExtras({ backend, backendTruncated: backendSnap.size >= BACKEND_CAP, customEvents, jsErrors, uptime, apiHours, catalog });
      setLoading(false);
    } catch (err) {
      if (mine !== seq.current) return;
      console.error('analytics extras load failed', err);
      setError('Some figures couldn’t load. Try Refresh.');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, siteId, sig, enabled]);

  useEffect(() => {
    if (!siteId || !enabled) {
      setExtras(EMPTY_EXTRAS);
      return;
    }
    void load();
  }, [load, siteId, enabled]);

  // One uptime probe per site per page view (server throttles to 5 min).
  useEffect(() => {
    if (!siteId || !enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        if (cancelled) return;
        await fetch('/api/uptime-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, siteId }) });
      } catch {
        // Best effort — the daily cron and the next visit will try again.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, siteId, enabled]);

  return { extras, extrasLoading: loading, extrasError: error, reloadExtras: load };
}

/**
 * Last hour of activity for the real-time log when the selected period isn't
 * "now" (a past window has no recent visits loaded). One-shot, three small
 * bounded queries; skipped entirely while the period is live.
 */
export function useRecentActivity(uid: string, siteId: string | null, enabled: boolean) {
  const [recent, setRecent] = useState<{ visits: NormVisit[]; custom: { name: string; ts: number; visitorId: string }[]; backend: BackendEvent[] } | null>(null);
  useEffect(() => {
    if (!enabled || !siteId) {
      setRecent(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const db = getFirebaseDb();
        const cut = Timestamp.fromMillis(Date.now() - 3_600_000);
        const [v, c, b] = await Promise.all([
          getDocs(query(collection(db, 'users', uid, 'sites', siteId, 'visits'), where('ts', '>=', cut), orderBy('ts', 'desc'), limit(60))),
          getDocs(query(collection(db, 'users', uid, 'sites', siteId, 'customEvents'), where('ts', '>=', cut), orderBy('ts', 'desc'), limit(40))).catch(() => null),
          getDocs(query(collection(db, 'users', uid, 'apiEvents'), where('occurredAt', '>=', cut), orderBy('occurredAt', 'desc'), limit(40))).catch(() => null),
        ]);
        if (cancelled) return;
        setRecent({
          visits: v.docs.map((d) => normalizeVisit(d.id, d.data())).filter((x): x is NormVisit => x !== null),
          custom: (c?.docs ?? []).flatMap((d) => {
            const x = d.data();
            const ts = toMs(x.ts);
            return ts === null ? [] : [{ name: String(x.name ?? ''), ts, visitorId: String(x.visitorId ?? '') }];
          }),
          backend: (b?.docs ?? []).flatMap((d) => {
            const x = d.data();
            const at = toMs(x.occurredAt);
            if (at === null || x.test === true || (x.siteId && x.siteId !== siteId)) return [];
            return [{ id: d.id, event: String(x.event ?? ''), type: String(x.type ?? ''), userId: typeof x.userId === 'string' ? x.userId : null, visitorId: typeof x.visitorId === 'string' ? x.visitorId : null, at, data: (x.data ?? {}) as Record<string, any> }];
          }),
        });
      } catch {
        if (!cancelled) setRecent(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid, siteId, enabled]);
  return recent;
}
