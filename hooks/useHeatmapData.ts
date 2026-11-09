// hooks/useHeatmapData.ts
//
// Live subscription to users/{uid}/sites/{siteId}/heatmaps — ONE doc
// per distinct page path, server-aggregated click buckets written by
// app/api/heatmap-sample (see lib/types.ts's HeatmapPage for the full
// storage-shape reasoning). Deliberately NOT shaped like
// useCustomEvents.ts's raw-event feed: there is at most a few dozen
// docs here (one per page the site actually has, not one per click or
// per visit), so this is a plain, unbounded onSnapshot with no
// FETCH_LIMIT needed — the doc count scales with the SITE's page
// count, never with traffic.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { HeatmapPage } from '@/lib/types';

export function useHeatmapData(uid: string | null, siteId: string | null) {
  const [pages, setPages] = useState<HeatmapPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setPages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    // Ordered by totalClicks so the most-sampled page is picked by
    // default below without a separate client-side sort every render.
    const q = query(collection(db, 'users', uid, 'sites', siteId, 'heatmaps'), orderBy('totalClicks', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as HeatmapPage)));
        setLoading(false);
      },
      (err) => {
        console.error('heatmaps snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, siteId]);

  // Sparse buckets -> a dense gridSize*gridSize array, once per page
  // doc, so the renderer never has to re-walk the sparse object on
  // every cell it draws.
  const withGrid = useMemo(
    () =>
      pages.map((p) => {
        const size = p.gridSize || 20;
        const grid: number[] = new Array(size * size).fill(0);
        let max = 0;
        for (const key in p.buckets || {}) {
          if (!Object.prototype.hasOwnProperty.call(p.buckets, key)) continue;
          const [gx, gy] = key.split('_').map(Number);
          if (!Number.isFinite(gx) || !Number.isFinite(gy) || gx < 0 || gx >= size || gy < 0 || gy >= size) continue;
          const n = p.buckets[key] || 0;
          grid[gy * size + gx] = n;
          if (n > max) max = n;
        }
        return { page: p, size, grid, max };
      }),
    [pages]
  );

  return { pages: withGrid, loading };
}
