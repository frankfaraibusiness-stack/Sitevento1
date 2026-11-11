// hooks/useProfileActivity.ts
//
// The "Recent activity" log on /profile: the newest real events across every
// connected site, merged into one timeline —
//
//   - visits        users/{uid}/sites/{siteId}/visits       (page views)
//   - leads         users/{uid}/sites/{siteId}/leads        (emails / bookings)
//   - security      users/{uid}/sites/{siteId}/botShieldLog (Security Bot actions)
//
// Each source is a small bounded query (PER_SOURCE docs per site, newest
// first), so the cost is flat no matter how much traffic a site has. It loads
// once on mount, refreshes when the tab regains focus after a minute away, and
// has a manual refresh — there are no always-on listeners.
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs, limit as fsLimit, orderBy, query } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { normalizeVisit } from '@/lib/dashboardStats';
import { countryCodeToFlag, getCountryName } from '@/lib/countries';
import type { Site } from '@/lib/types';

const PER_SOURCE = 4;
const STALE_MS = 60_000;
const MAX_ITEMS = 40;

export type ActivityKind = 'visit' | 'lead' | 'security';
export type ActivityTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  ts: number;
  siteId: string;
  siteHost: string;
  title: string;
  detail: string;
  tone: ActivityTone;
  /** Where "open" goes — the real page that manages this kind of event. */
  href: string;
}

function toMs(ts: unknown): number | null {
  if (typeof ts === 'number' && isFinite(ts)) return ts;
  if (ts && typeof ts === 'object') {
    const t = ts as { toMillis?: () => number; toDate?: () => Date };
    if (typeof t.toMillis === 'function') return t.toMillis();
    if (typeof t.toDate === 'function') return t.toDate().getTime();
  }
  return null;
}

function hostOf(site: Site): string {
  try {
    const raw = site.url.includes('://') ? site.url : `https://${site.url}`;
    return new URL(raw).hostname.replace(/^www\./, '');
  } catch {
    return site.url || site.name;
  }
}

async function loadSite(uid: string, site: Site): Promise<ActivityItem[]> {
  const db = getFirebaseDb();
  const host = hostOf(site);
  const col = (name: string) => collection(db, 'users', uid, 'sites', site.id, name);
  const newest = (name: string) => query(col(name), orderBy('ts', 'desc'), fsLimit(PER_SOURCE));
  const out: ActivityItem[] = [];

  const [visitSnap, leadSnap, botSnap] = await Promise.all([
    getDocs(newest('visits')).catch((err) => {
      console.error('[profile] visits activity failed', err);
      return null;
    }),
    getDocs(newest('leads')).catch((err) => {
      console.error('[profile] leads activity failed', err);
      return null;
    }),
    getDocs(newest('botShieldLog')).catch((err) => {
      console.error('[profile] security activity failed', err);
      return null;
    }),
  ]);

  visitSnap?.forEach((d) => {
    const v = normalizeVisit(d.id, d.data());
    if (!v) return;
    const where = v.country ? getCountryName(v.country) : '';
    out.push({
      id: `visit:${site.id}:${d.id}`,
      kind: 'visit',
      ts: v.ts,
      siteId: site.id,
      siteHost: host,
      title: `${countryCodeToFlag(v.country)}  ${v.path}`,
      detail: [v.device, v.browser, where].filter((x) => x && x !== 'Unknown').join(' · '),
      tone: v.blocked ? 'bad' : 'neutral',
      href: '/dashboard',
    });
  });

  leadSnap?.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    if (typeof data.deletedAt === 'number' && data.deletedAt > 0) return;
    const ts = toMs(data.ts);
    if (ts === null) return;
    const isBooking = data.source === 'appointment-booking';
    const who = typeof data.name === 'string' && data.name ? data.name : '';
    const email = typeof data.email === 'string' ? data.email : '';
    const phone = typeof data.phone === 'string' ? data.phone : '';
    out.push({
      id: `lead:${site.id}:${d.id}`,
      kind: 'lead',
      ts,
      siteId: site.id,
      siteHost: host,
      title: isBooking ? 'New booking request' : data.source === 'overlay-notify' ? 'New "notify me" signup' : 'New email captured',
      detail: [who, email || phone].filter(Boolean).join(' · '),
      tone: 'good',
      href: '/dashboard/leads',
    });
  });

  botSnap?.forEach((d) => {
    const data = d.data() as Record<string, unknown>;
    const ts = toMs(data.ts);
    if (ts === null) return;
    const action = data.action === 'block' || data.action === 'restrict' ? data.action : 'none';
    const reason = typeof data.reason === 'string' && data.reason ? data.reason : '';
    out.push({
      id: `security:${site.id}:${d.id}`,
      kind: 'security',
      ts,
      siteId: site.id,
      siteHost: host,
      title:
        action === 'block'
          ? 'Security Bot blocked a visitor'
          : action === 'restrict'
          ? 'Security Bot restricted a visitor'
          : 'Security Bot flagged activity',
      detail: reason,
      tone: action === 'block' ? 'bad' : 'warn',
      href: '/dashboard/bot-shield',
    });
  });

  return out;
}

export function useProfileActivity(uid: string | null, sites: Site[], enabled: boolean) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const siteKey = useMemo(() => sites.map((s) => s.id).join(','), [sites]);
  const sitesRef = useRef(sites);
  sitesRef.current = sites;
  const busy = useRef(false);

  const load = useCallback(
    async (initial: boolean) => {
      if (!uid || busy.current) return;
      busy.current = true;
      if (initial) setLoading(true);
      else setRefreshing(true);
      try {
        const lists = await Promise.all(sitesRef.current.map((s) => loadSite(uid, s)));
        const merged = lists.flat().sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
        setItems(merged);
        setUpdatedAt(Date.now());
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [uid]
  );

  useEffect(() => {
    if (!uid || !enabled) return;
    if (sites.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, enabled, siteKey, load]);

  useEffect(() => {
    if (!uid || !enabled) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (updatedAt !== null && Date.now() - updatedAt < STALE_MS) return;
      load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [uid, enabled, updatedAt, load]);

  const refresh = useCallback(() => load(false), [load]);

  return { items, loading, refreshing, updatedAt, refresh };
}
