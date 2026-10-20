// hooks/useSiteWidgetsList.ts
//
// Live listing of every widget doc under a site's own
// users/{uid}/sites/{siteId}/widgets subcollection (lib/widgets.ts's
// SiteWidgetDoc shape) — distinct from hooks/useSiteWidget.ts, which
// only tracks ONE widget's config for the edit panel. This is the
// "does this site have any widgets enabled at all, and which ones"
// read the site-manage page (components/dashboard/SiteManagePage.tsx)
// needs, so it can show a plain enabled/disabled summary without the
// page having to know about every individual widget id up front.
//
// Read-only client SDK listener — already safe under the existing
// users/{uid}/{document=**} firestore.rules entry (owner-only), same
// pattern as useSiteWidget.ts and useActiveSiteData.ts.
'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { getWidgetCatalogEntry } from '@/lib/widgets';

export interface SiteWidgetSummary {
  id: string;
  name: string;
  enabled: boolean;
}

export function useSiteWidgetsList(uid: string | null, siteId: string | null) {
  const [widgets, setWidgets] = useState<SiteWidgetSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid || !siteId) {
      setWidgets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const unsub = onSnapshot(
      collection(db, 'users', uid, 'sites', siteId, 'widgets'),
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as { enabled?: boolean };
          const catalogEntry = getWidgetCatalogEntry(d.id);
          return {
            id: d.id,
            name: catalogEntry?.name || d.id,
            enabled: !!data.enabled,
          };
        });
        setWidgets(next);
        setLoading(false);
      },
      (err) => {
        console.error('site widgets list snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, siteId]);

  const enabledWidgets = widgets.filter((w) => w.enabled);

  return { widgets, enabledWidgets, hasAnyEnabled: enabledWidgets.length > 0, loading };
}
