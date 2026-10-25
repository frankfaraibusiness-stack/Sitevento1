'use client';

// hooks/useUserSettings.ts
//
// Firestore-backed settings. Reads stay a live client-side onSnapshot
// subscription on users/{uid} (read-only). Writes now go through
// app/api/user-action/route.ts's 'update-settings' action instead of
// the client SDK's setDoc() — see that route's header comment. Every
// write made this way counts against the account's daily write limit
// (lib/serverAuth.ts).
//
// All settings live nested under users/{uid}.settings so one Firestore
// listener backs every settings panel, and a brand-new account (no
// settings field yet) degrades to DEFAULT_SETTINGS exactly the way
// useUserProfile.ts degrades a missing `plan` field to 'free'.
import { useCallback, useEffect, useRef, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirebaseDb } from '@/lib/firebase';
import { callUserAction } from '@/lib/userActionClient';

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
  // prone to right after its own write).
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
  // immediately (so toggles feel instant), then persist via
  // app/api/user-action's 'update-settings' action. Returns whether
  // the write succeeded so callers can show a toast/error state (incl.
  // a WRITE_LIMIT_REACHED rejection — see lib/userActionClient.ts).
  const updateSettings = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!user) return false;
      const next = { ...latestLocal.current, ...patch };
      latestLocal.current = next;
      setSettings(next);
      setSaving(true);
      try {
        const result = await callUserAction(user, 'update-settings', patch);
        return result.ok;
      } finally {
        setSaving(false);
      }
    },
    [user]
  );

  return { settings, loaded, saving, updateSettings };
}
