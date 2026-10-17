// hooks/useOverlayComposer.ts
//
// Drives the redesigned banner editor (components/dashboard/
// BannerComposer.tsx). Mirrors the siterifty console-site-alert pattern:
// `saved` = what's persisted (and what visitors see if active), `draft`
// = what's being edited, with the draft always driving the live phone
// preview. Picking a template replaces copy + look but preserves
// active/version/ctaUrl/notifyOnClose, same reasoning as siterifty's
// applyTemplate — switching templates on a LIVE banner shouldn't
// silently take it down or drop a CTA link the owner already typed.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import {
  overlayFromTemplate,
  sanitizeSiteOverlay,
  type OverlayTemplateId,
  type SiteOverlayDoc,
  type OverlayTheme,
} from '@/lib/siteAlert';
import type { Site } from '@/lib/types';

function contentKey(o: SiteOverlayDoc): string {
  const { version: _v, updatedAt: _u, ...rest } = o;
  return JSON.stringify(rest);
}

export function useOverlayComposer(uid: string | null, activeSite: Site | null) {
  const [draft, setDraft] = useState<SiteOverlayDoc>(() => overlayFromTemplate('announcement'));
  const [saved, setSaved] = useState<SiteOverlayDoc | null>(null);
  const [busy, setBusy] = useState(false);

  // Repopulate the draft whenever the active site changes — same
  // behavior as the original's renderOverlayPanel() on every site
  // switch. sanitizeSiteOverlay coerces whatever shape is on the doc
  // (including an old pre-redesign overlay) into the new full shape.
  useEffect(() => {
    if (activeSite?.overlay) {
      const clean = sanitizeSiteOverlay(activeSite.overlay);
      setSaved(clean);
      setDraft(clean);
    } else {
      setSaved(null);
      setDraft(overlayFromTemplate('announcement'));
    }
  }, [activeSite?.id, activeSite?.overlay]);

  const patch = useCallback((p: Partial<SiteOverlayDoc>) => {
    setDraft((d) => ({ ...d, ...p }));
  }, []);

  const patchTheme = useCallback((p: Partial<OverlayTheme>) => {
    setDraft((d) => ({ ...d, theme: { ...d.theme, ...p } }));
  }, []);

  const applyTemplate = useCallback((id: OverlayTemplateId) => {
    setDraft((d) => {
      const t = overlayFromTemplate(id);
      return { ...t, active: d.active, ctaUrl: d.ctaUrl, notifyOnClose: d.notifyOnClose, version: d.version };
    });
  }, []);

  const dirty = saved ? contentKey(saved) !== contentKey(draft) : true;
  const isLive = !!saved?.active;

  async function persist(next: SiteOverlayDoc) {
    if (!uid || !activeSite) return false;
    setBusy(true);
    try {
      const db = getFirebaseDb();
      const payload = { ...next, updatedAt: Date.now() };
      // Owner-only site doc — drives the dashboard's own "live now"
      // state and repopulates the form on reload.
      await updateDoc(doc(db, 'users', uid, 'sites', activeSite.id), { overlay: payload });
      // Public siteOverlay doc — the one the live tracking script is
      // allowed to read. Kept separate so a visitor's read access never
      // extends to anything else on the owner-only site doc (name, url,
      // uid, stats, etc).
      await setDoc(doc(db, 'siteOverlay', activeSite.id), { ...payload, updatedAt: serverTimestamp() });
      return true;
    } catch (err) {
      console.error('overlay persist error', err);
      window.alert('Could not save that banner right now.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  // Save as draft = persist with active forced OFF. Never reaches visitors.
  const saveDraft = useCallback(async () => {
    const ok = await persist({ ...draft, active: false });
    return ok;
  }, [draft]);

  // Push = persist with active ON, bumping version so "closed until a
  // new version" logic in the live script treats this as a fresh push.
  const push = useCallback(async () => {
    const nextVersion = (saved?.version ?? 0) + 1;
    const ok = await persist({ ...draft, active: true, version: nextVersion });
    return ok;
  }, [draft, saved]);

  // Keep the content, just switch off — so it can be re-enabled later
  // without retyping everything.
  const stop = useCallback(async () => {
    const base = saved || draft;
    const ok = await persist({ ...base, active: false });
    return ok;
  }, [saved, draft]);

  return {
    draft,
    saved,
    patch,
    patchTheme,
    applyTemplate,
    dirty,
    isLive,
    busy,
    saveDraft,
    push,
    stop,
  };
}
