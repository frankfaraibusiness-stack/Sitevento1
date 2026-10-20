'use client';

// hooks/useUserSettings.ts
//
// Firestore-backed replacement for the old useSettingsState.ts (which
// was local useState only — nothing persisted, everything reset on
// reload). Same shape as hooks/useUserProfile.ts: live onSnapshot
// subscription on users/{uid}, written into with setDoc(..., { merge: true })
// so this never clobbers sibling fields on that doc (plan, displayName
// cache, etc. — see useUserProfile.ts's own setPlan for the same
// pattern).
//
// All settings live nested under users/{uid}.settings so one Firestore
// listener backs every settings panel, and a brand-new account (no
// settings field yet) degrades to DEFAULT_SETTINGS exactly the way
// useUserProfile.ts degrades a missing `plan` field to 'free'.
//
// Firestore access here is 100% covered by the existing
// `match /users/{uid}/{document=**}` rule in firestore.rules — owner
// read/write only, no rules change needed.
import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';

export interface UserSettings {
  // Account
  timezone: string;
  // Security
  twoFactorEnabled: boolean;
  signInAlerts: boolean;
  // Notifications
  visitAlerts: boolean;
  leadAlerts: boolean;
  weeklySummary: boolean;
  marketingEmails: boolean;
  // Appearance
  fontSize: 'small' | 'medium' | 'large';
  compactMode: boolean;
  landingView: 'overview' | 'visits' | 'leads' | 'sites';
}

export const DEFAULT_SETTINGS: UserSettings = {
  timezone: 'auto',
  twoFactorEnabled: false,
  signInAlerts: true,
  visitAlerts: true,
  leadAlerts: true,
  weeklySummary: false,
  marketingEmails: false,
  fontSize: 'medium',
  compactMode: false,
  landingView: 'overview',
};

// Firestore drops `undefined` fields (and can error on nested
// undefined in some SDK versions), so a partial update merges onto a
// fully-defaulted object before writing rather than spreading a
// possibly-sparse patch straight in.
function sanitize(raw: unknown): UserSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<UserSettings>;
  return { ...DEFAULT_SETTINGS, ...r };
}

export function useUserSettings(user: User | null) {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  // Tracks the most recent write so a slow-to-arrive snapshot from
  // *before* that write can't stomp newly-set local state back to the
  // older server value (same race a plain onSnapshot subscription is
  // prone to right after its own setDoc).
  const latestLocal = useRef<UserSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      latestLocal.current = DEFAULT_SETTINGS;
      setLoaded(false);
      return;
    }
    const db = getFirebaseDb();
    const unsubscribe = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        const next = sanitize(snap.data()?.settings);
        latestLocal.current = next;
        setSettings(next);
        setLoaded(true);
      },
      (err) => {
        console.error('user settings snapshot error', err);
        setLoaded(true);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // Merge a partial patch into settings, update local state
  // immediately (so toggles feel instant), then persist the full
  // merged settings object to Firestore. Returns whether the write
  // succeeded so callers can show a toast/error state.
  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return false;
      const next = { ...latestLocal.current, ...patch };
      latestLocal.current = next;
      setSettings(next);
      setSaving(true);
      try {
        await setDoc(doc(getFirebaseDb(), 'users', user.uid), { settings: next }, { merge: true });
        return true;
      } catch (err) {
        console.error('Failed to save settings', err);
        return false;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return { settings, loaded, saving, updateSettings };
}
