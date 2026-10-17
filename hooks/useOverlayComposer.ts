// hooks/useOverlayComposer.ts
//
// Replaces the overlay composer's module-level state (overlayType,
// overlayDisplay, overlayBgColor, overlayTextColor) and its
// push/stop/preview functions. Mirrors the active site's overlay into
// the form whenever the active site changes, same as the original
// renderOverlayPanel() did on every site switch.
'use client';

import { useCallback, useEffect, useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { getFirebaseDb } from '@/lib/firebase';
import type { OverlayDisplay, OverlayType, Site } from '@/lib/types';

export const OVERLAY_BG_SWATCHES = ['#22201c', '#6b4a34', '#b3432b', '#6ba84f', '#2f6fb3', '#f6f2e7'];
export const OVERLAY_TEXT_SWATCHES = ['#f6f2e7', '#22201c'];

export function useOverlayComposer(uid: string | null, activeSite: Site | null) {
  const [type, setType] = useState<OverlayType>('announcement');
  const [display, setDisplay] = useState<OverlayDisplay>('fullscreen');
  const [text, setText] = useState('');
  const [bgColor, setBgColor] = useState(OVERLAY_BG_SWATCHES[0]);
  const [textColor, setTextColor] = useState(OVERLAY_TEXT_SWATCHES[0]);

  // Repopulate the form whenever the active site changes — same behavior
  // as renderOverlayPanel() being called from renderActiveSiteHeader().
  useEffect(() => {
    if (activeSite?.overlay?.active) {
      setText(activeSite.overlay.text || '');
      setType(activeSite.overlay.type || 'announcement');
      setDisplay(activeSite.overlay.display || 'fullscreen');
      setBgColor(activeSite.overlay.bgColor || OVERLAY_BG_SWATCHES[0]);
      setTextColor(activeSite.overlay.textColor || OVERLAY_TEXT_SWATCHES[0]);
    } else {
      setText('');
      setType('announcement');
      setDisplay('fullscreen');
      setBgColor(OVERLAY_BG_SWATCHES[0]);
      setTextColor(OVERLAY_TEXT_SWATCHES[0]);
    }
  }, [activeSite?.id, activeSite?.overlay]);

  const push = useCallback(async () => {
    if (!uid || !activeSite) return;
    const trimmed = text.trim();
    if (!trimmed) {
      window.alert('Write what visitors should see first.');
      return;
    }
    const payload = {
      active: true,
      type,
      display,
      text: trimmed,
      bgColor,
      textColor,
      updatedAt: Date.now(),
    };
    try {
      const db = getFirebaseDb();
      // Keep the owner-only site doc in sync (drives the dashboard's own
      // "live now" banner and repopulates the form on reload) ...
      await updateDoc(doc(db, 'users', uid, 'sites', activeSite.id), { overlay: payload });
      // ... and mirror the same payload into the public siteOverlay doc,
      // which is the one the live site's tracking script (sitevento.js) is
      // allowed to read. Keeping this separate from the owner-only site
      // doc means visitors never get read access to anything else on it
      // (name, url, uid, etc).
      await setDoc(doc(db, 'siteOverlay', activeSite.id), { ...payload, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('pushOverlay error', err);
      window.alert('Could not push that overlay right now.');
    }
  }, [uid, activeSite, type, display, text, bgColor, textColor]);

  const stop = useCallback(async () => {
    if (!uid || !activeSite) return;
    const payload = {
      active: false,
      type,
      display,
      text: '',
      bgColor,
      textColor,
      updatedAt: Date.now(),
    };
    try {
      const db = getFirebaseDb();
      await updateDoc(doc(db, 'users', uid, 'sites', activeSite.id), { overlay: payload });
      await setDoc(doc(db, 'siteOverlay', activeSite.id), { ...payload, updatedAt: serverTimestamp() });
    } catch (err) {
      console.error('stopOverlay error', err);
      window.alert('Could not take that overlay down right now.');
    }
  }, [uid, activeSite, type, display, bgColor, textColor]);

  return {
    type,
    setType,
    display,
    setDisplay,
    text,
    setText,
    bgColor,
    setBgColor,
    textColor,
    setTextColor,
    push,
    stop,
  };
}
