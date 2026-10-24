'use client';

// hooks/useAppliedAppearance.ts
//
// Applies the signed-in user's Settings > Appearance preferences
// (hooks/useUserSettings.ts) to <html> as data attributes, globally —
// not just while /settings is mounted. Call this once near the root of
// every real entry point (AppRoot.tsx for the legacy "/" view-switcher,
// DashboardClient.tsx for the standalone /dashboard routes,
// SettingsPageClient.tsx for /settings itself) so Font Size and
// Compact Mode actually change how the app looks everywhere, not just
// on the page where they were set.
//
// Reads are cheap: useUserSettings already de-dupes its Firestore
// listener per uid at the SDK level (onSnapshot), so mounting this
// hook from more than one root at a time (e.g. during a route
// transition) does not mean extra reads — each call just attaches its
// own listener to the same already-open snapshot stream.
import { useEffect } from 'react';
import type { User } from 'firebase/auth';
import { useUserSettings } from '@/hooks/useUserSettings';

export function useAppliedAppearance(user: User | null) {
  const { settings, loaded } = useUserSettings(user);

  useEffect(() => {
    if (!loaded) return;
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
    document.documentElement.toggleAttribute('data-compact', settings.compactMode);
    return () => {
      document.documentElement.removeAttribute('data-font-size');
      document.documentElement.removeAttribute('data-compact');
    };
  }, [loaded, settings.fontSize, settings.compactMode]);

  return { settings, loaded };
}
