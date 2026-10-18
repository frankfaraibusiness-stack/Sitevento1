// hooks/useSiteWidget.ts
//
// Drives one widget's config panel for the active site (components/
// dashboard/WidgetConfigPanel.tsx). Mirrors useOverlayComposer.ts's
// draft/saved/persist shape: `saved` is what's in
// users/{uid}/sites/{siteId}/widgets/{widgetId} right now (and what
// app/api/widget/route.ts will actually serve to visitors), `draft` is
// what's being edited. Enabling and editing config are independent —
// you can fill in config before turning a widget on, or turn it off
// without losing what you'd set up.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import { defaultConfigFor } from '@/lib/widgets';
import type { Site } from '@/lib/types';

export interface SiteWidgetState {
  enabled: boolean;
  config: Record<string, unknown>;
  version: number;
}

function emptyState(widgetId: string): SiteWidgetState {
  return { enabled: false, config: defaultConfigFor(widgetId), version: 1 };
}

export function useSiteWidget(uid: string | null, activeSite: Site | null, widgetId: string | null) {
  const [saved, setSaved] = useState<SiteWidgetState | null>(null);
  const [draft, setDraft] = useState<SiteWidgetState>(() => emptyState(widgetId || ''));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid || !activeSite || !widgetId) {
      setSaved(null);
      setDraft(emptyState(widgetId || ''));
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const ref = doc(db, 'users', uid, 'sites', activeSite.id, 'widgets', widgetId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SiteWidgetState>;
          const next: SiteWidgetState = {
            enabled: !!data.enabled,
            config: { ...defaultConfigFor(widgetId), ...(data.config || {}) },
            version: typeof data.version === 'number' ? data.version : 1,
          };
          setSaved(next);
          setDraft(next);
        } else {
          const next = emptyState(widgetId);
          setSaved(null);
          setDraft(next);
        }
        setLoading(false);
      },
      (err) => {
        console.error('site widget snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, activeSite?.id, widgetId]);

  const patchConfig = useCallback((p: Record<string, unknown>) => {
    setDraft((d) => ({ ...d, config: { ...d.config, ...p } }));
  }, []);

  async function persist(next: SiteWidgetState) {
    if (!uid || !activeSite || !widgetId) return false;
    setBusy(true);
    try {
      const db = getFirebaseDb();
      await setDoc(
        doc(db, 'users', uid, 'sites', activeSite.id, 'widgets', widgetId),
        next,
        { merge: true }
      );
      return true;
    } catch (err) {
      console.error('site widget persist error', err);
      window.alert('Could not save that widget right now.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Save config without necessarily turning the widget on.
  const saveConfig = useCallback(async () => {
    return persist({ ...draft });
  }, [draft, uid, activeSite?.id, widgetId]);

  // Turn the widget on for this site, bumping version so the loader's
  // ETag (see app/api/widget/route.ts) reflects the change immediately.
  const enable = useCallback(async () => {
    const nextVersion = (saved?.version ?? 0) + 1;
    const next = { ...draft, enabled: true, version: nextVersion };
    const ok = await persist(next);
    return ok;
  }, [draft, saved, uid, activeSite?.id, widgetId]);

  const disable = useCallback(async () => {
    const base = saved || draft;
    const ok = await persist({ ...base, enabled: false });
    return ok;
  }, [saved, draft, uid, activeSite?.id, widgetId]);

  const dirty = saved ? JSON.stringify(saved.config) !== JSON.stringify(draft.config) : true;
  const isLive = !!saved?.enabled;

  return { draft, saved, loading, busy, dirty, isLive, patchConfig, saveConfig, enable, disable };
}
