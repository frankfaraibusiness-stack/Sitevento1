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
//
// ── Reads vs. writes ──────────────────────────────────────────────────
// READS still use the client Firestore SDK's onSnapshot — that's a
// live, read-only listener, already safe under the existing
// users/{uid}/{document=**} rule (owner-only), and keeping it
// client-side means the panel reflects changes instantly with no
// polling.
//
// WRITES go through POST /api/site-widget (Admin SDK, server-side)
// instead of a direct client setDoc(). The route re-verifies the
// caller's Firebase ID token and confirms they own the target site
// before writing anything — see that route's comments for why this
// check has to live in code once the write itself bypasses Firestore
// rules. This hook's job is just to attach the current user's ID
// token to every write call; getIdToken() returns the already-cached
// token instantly unless it's within ~5 minutes of expiry, in which
// case the SDK refreshes it first — either way this stays fast.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { defaultConfigFor } from '@/lib/widgets';
import type { Site } from '@/lib/types';

export interface SiteWidgetState {
  enabled: boolean;
  config: Record<string, unknown>;
  version: number;
}

// Mirrors the LiveStatus union in app/api/site-widget/route.ts. A
// successful save (persist() returning true) no longer implies the
// widget is actually visible to visitors — this is the honest,
// separate signal for that. null means "no save has happened yet in
// this session" (not the same as "unknown failure").
export type LiveStatus =
  | { state: 'live'; message: string }
  | { state: 'saved_but_blocked'; reason: string; message: string }
  | { state: 'saved_off'; message: string };

function emptyState(widgetId: string): SiteWidgetState {
  return { enabled: false, config: defaultConfigFor(widgetId), version: 1 };
}

export function useSiteWidget(uid: string | null, activeSite: Site | null, widgetId: string | null) {
  const [saved, setSaved] = useState<SiteWidgetState | null>(null);
  const [draft, setDraft] = useState<SiteWidgetState>(() => emptyState(widgetId || ''));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveStatus, setLiveStatus] = useState<LiveStatus | null>(null);

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

  // Posts a write to the server route instead of writing Firestore
  // directly. Always attaches a fresh ID token — this is the piece
  // that lets the server route recover the real, unforgeable uid.
  //
  // Returns { ok, liveStatus } rather than a plain boolean: `ok` means
  // "the save request completed", liveStatus is the separate, honest
  // answer to "will a visitor actually see this" — a caller must not
  // collapse these into one "success" message, since a save can
  // succeed while the widget stays invisible to visitors (unverified
  // site, disabled catalog entry, etc. — see the route for the full
  // list of gates this reflects).
  async function persist(
    nextEnabled: boolean,
    nextConfig: Record<string, unknown>
  ): Promise<{ ok: boolean; liveStatus: LiveStatus | null }> {
    if (!uid || !activeSite || !widgetId) return { ok: false, liveStatus: null };
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        console.error('site widget persist error: no signed-in user');
        window.alert('Your session has expired. Please sign in again.');
        return { ok: false, liveStatus: null };
      }
      const idToken = await user.getIdToken();

      const res = await fetch('/api/site-widget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          siteId: activeSite.id,
          widgetId,
          enabled: nextEnabled,
          config: nextConfig,
        }),
      });

      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));

      if (!res.ok || !data.ok) {
        console.error('site widget persist error', data.error || res.status);
        window.alert(data.error || 'Could not save that widget right now.');
        setLiveStatus(null);
        return { ok: false, liveStatus: null };
      }

      // The onSnapshot listener above will also pick up this change,
      // but updating local state immediately keeps the toggle feeling
      // instant rather than waiting a round trip for Firestore's own
      // push to arrive.
      if (data.widget) {
        const next: SiteWidgetState = {
          enabled: !!data.widget.enabled,
          config: { ...defaultConfigFor(widgetId), ...(data.widget.config || {}) },
          version: typeof data.widget.version === 'number' ? data.widget.version : 1,
        };
        setSaved(next);
        setDraft(next);
      }

      const status: LiveStatus | null = data.liveStatus || null;
      setLiveStatus(status);
      return { ok: true, liveStatus: status };
    } catch (err) {
      console.error('site widget persist error', err);
      window.alert('Could not save that widget right now.');
      setLiveStatus(null);
      return { ok: false, liveStatus: null };
    } finally {
      setBusy(false);
    }
  }

  // Save config without necessarily turning the widget on.
  const saveConfig = useCallback(async () => {
    return persist(saved?.enabled ?? false, draft.config);
  }, [draft, saved, uid, activeSite?.id, widgetId]);

  const enable = useCallback(async () => {
    return persist(true, draft.config);
  }, [draft, uid, activeSite?.id, widgetId]);

  const disable = useCallback(async () => {
    const base = saved?.config || draft.config;
    return persist(false, base);
  }, [saved, draft, uid, activeSite?.id, widgetId]);

  const dirty = saved ? JSON.stringify(saved.config) !== JSON.stringify(draft.config) : true;
  // isLive now reflects the server's confirmed liveStatus, not just the
  // enabled flag — a widget that's "enabled" in Firestore but blocked
  // by an unverified site / missing catalog entry is NOT live, and the
  // UI should not claim it is. Falls back to the enabled flag only
  // before any liveStatus has been reported yet (e.g. right after
  // load, before the user has toggled anything in this session).
  const isLive = liveStatus ? liveStatus.state === 'live' : !!saved?.enabled;

  return { draft, saved, loading, busy, dirty, isLive, liveStatus, patchConfig, saveConfig, enable, disable };
}
