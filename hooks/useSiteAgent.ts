// hooks/useSiteAgent.ts
//
// Drives the AI Agent builder (components/agent/AgentPageClient.tsx)
// for the active site. Mirrors hooks/useSiteWidget.ts's draft/saved/
// persist shape exactly — `saved` is what's in
// users/{uid}/sites/{siteId}/agent/config right now, `draft` is what's
// being edited; reads stay on the client Firestore SDK (live
// onSnapshot, already safe under the existing users/{uid}/{document=**}
// rule), writes go through POST /api/site-agent (Admin SDK,
// server-side plan clamp — see that route's header for why this can't
// just be a direct client setDoc()).
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { DEFAULT_AGENT_CONFIG, type AgentConfig, type AgentModelId } from '@/lib/agent';
import type { Site } from '@/lib/types';

export interface SiteAgentState extends AgentConfig {}

function emptyState(): SiteAgentState {
  return { ...DEFAULT_AGENT_CONFIG };
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  return a.every((x) => setB.has(x));
}

function configsEqual(a: SiteAgentState, b: SiteAgentState): boolean {
  return (
    a.active === b.active &&
    a.model === b.model &&
    a.timezone === b.timezone &&
    sameSet(a.enabledFeatureIds, b.enabledFeatureIds) &&
    sameSet(a.blockedCountries, b.blockedCountries)
  );
}

export function useSiteAgent(uid: string | null, activeSite: Site | null) {
  const [saved, setSaved] = useState<SiteAgentState | null>(null);
  const [draft, setDraft] = useState<SiteAgentState>(emptyState());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Set only when the server actually had to drop something the
  // client asked for (plan downgrade mid-session, stale tab, etc.) —
  // surfaced honestly in the UI rather than silently accepted.
  const [wasClamped, setWasClamped] = useState(false);

  useEffect(() => {
    if (!uid || !activeSite) {
      setSaved(null);
      setDraft(emptyState());
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirebaseDb();
    const ref = doc(db, 'users', uid, 'sites', activeSite.id, 'agent', 'config');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<AgentConfig>;
          const next: SiteAgentState = {
            active: !!data.active,
            model: (data.model as AgentModelId) || 'ventol',
            enabledFeatureIds: Array.isArray(data.enabledFeatureIds) ? data.enabledFeatureIds : [],
            blockedCountries: Array.isArray(data.blockedCountries) ? data.blockedCountries : [],
            timezone: typeof data.timezone === 'string' ? data.timezone : DEFAULT_AGENT_CONFIG.timezone,
          };
          setSaved(next);
          setDraft(next);
        } else {
          const next = emptyState();
          setSaved(null);
          setDraft(next);
        }
        setLoading(false);
      },
      (err) => {
        console.error('site agent snapshot error', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid, activeSite?.id]);

  const toggleFeature = useCallback((featureId: string, next: boolean) => {
    setDraft((d) => ({
      ...d,
      enabledFeatureIds: next ? [...new Set([...d.enabledFeatureIds, featureId])] : d.enabledFeatureIds.filter((id) => id !== featureId),
    }));
  }, []);

  const setModel = useCallback((model: AgentModelId) => {
    setDraft((d) => ({ ...d, model }));
  }, []);

  const toggleCountry = useCallback((code: string, next: boolean) => {
    setDraft((d) => ({
      ...d,
      blockedCountries: next ? [...new Set([...d.blockedCountries, code])] : d.blockedCountries.filter((c) => c !== code),
    }));
  }, []);

  const setTimezone = useCallback((timezone: string) => {
    setDraft((d) => ({ ...d, timezone }));
  }, []);

  const setActive = useCallback((active: boolean) => {
    setDraft((d) => ({ ...d, active }));
  }, []);

  // Posts the full draft to the server route, which re-clamps it
  // against the site's real current plan before writing anything —
  // see app/api/site-agent/route.ts. Returns `clamped: true` when the
  // server had to drop something the UI already should have
  // prevented (stale tab, concurrent downgrade), so the caller can
  // surface that honestly instead of claiming a clean save.
  async function persist(next: SiteAgentState): Promise<{ ok: boolean; clamped: boolean }> {
    if (!uid || !activeSite) return { ok: false, clamped: false };
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        console.error('site agent persist error: no signed-in user');
        window.alert('Your session has expired. Please sign in again.');
        return { ok: false, clamped: false };
      }
      const idToken = await user.getIdToken();

      const res = await fetch('/api/site-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          siteId: activeSite.id,
          active: next.active,
          model: next.model,
          enabledFeatureIds: next.enabledFeatureIds,
          blockedCountries: next.blockedCountries,
          timezone: next.timezone,
        }),
      });

      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));

      if (!res.ok || !data.ok) {
        console.error('site agent persist error', data.error || res.status);
        window.alert(data.error || 'Could not save your agent right now.');
        return { ok: false, clamped: false };
      }

      if (data.agent) {
        const confirmed: SiteAgentState = {
          active: !!data.agent.active,
          model: data.agent.model,
          enabledFeatureIds: data.agent.enabledFeatureIds || [],
          blockedCountries: data.agent.blockedCountries || [],
          timezone: data.agent.timezone,
        };
        setSaved(confirmed);
        setDraft(confirmed);
      }
      setWasClamped(!!data.clamped);

      return { ok: true, clamped: !!data.clamped };
    } catch (err) {
      console.error('site agent persist error', err);
      window.alert('Could not save your agent right now.');
      return { ok: false, clamped: false };
    } finally {
      setBusy(false);
    }
  }

  const save = useCallback(async () => persist(draft), [draft, uid, activeSite?.id]);

  // Order-insensitive: toggleFeature/toggleCountry rebuild their arrays
  // via Set spreads, so `draft`'s array order can legitimately differ
  // from `saved`'s even when the actual selected sets are identical —
  // a naive JSON.stringify comparison would then report dirty: true
  // forever after the first toggle, even after toggling back off.
  const dirty = saved ? !configsEqual(saved, draft) : true;

  return {
    draft,
    saved,
    loading,
    busy,
    dirty,
    wasClamped,
    toggleFeature,
    setModel,
    toggleCountry,
    setTimezone,
    setActive,
    save,
  };
}
