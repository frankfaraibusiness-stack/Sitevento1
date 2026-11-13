// hooks/useAppView.ts
//
// Decides whether a "go to my stats" action should actually navigate
// there (signed in) or open sign-in first (signed out). The Dashboard
// overview page has been removed — Analytics (/dashboard/analytics) is
// the main stats page, so every "go to dashboard" action lands there.
// The `section` argument is kept only so existing callers and
// Sidebar/Header prop shapes don't change; the old per-section anchors
// no longer exist.
//
// AppRoot itself only ever renders the marketing view now — "view" is
// kept here as a type for Sidebar/Header's existing prop shapes, not
// because AppRoot still switches on it.
'use client';

import { useCallback } from 'react';
import type { User } from 'firebase/auth';
import { useNavRouter } from '@/hooks/useNavPending';

export type AppView = 'marketing' | 'dashboard';
export type DashSection = 'overview' | 'logs' | 'leads' | 'overlay';

export function useAppView(user: User | null, openAuth: (pane: 'signin' | 'signup') => void) {
  const router = useNavRouter();

  const goToDashboard = useCallback(
    (_section?: DashSection) => {
      if (!user) {
        openAuth('signin');
        return;
      }
      router.push('/dashboard/analytics');
    },
    [user, openAuth, router]
  );

  const showMarketing = useCallback(() => router.push('/'), [router]);

  // Any "Connect your site" / "Start free" CTA on the marketing page
  // should route by real auth state: signed-in users go straight to
  // the connect-site flow's own page; guests get the signup form
  // instead.
  const handleConnectCTA = useCallback(() => {
    if (user) {
      router.push('/dashboard/connect');
    } else {
      openAuth('signup');
    }
  }, [user, router, openAuth]);

  return { view: 'marketing' as AppView, goToDashboard, showMarketing, handleConnectCTA };
}
