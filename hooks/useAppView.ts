// hooks/useAppView.ts
//
// Pre-redesign, this drove an in-page marketing/dashboard view switch
// with scroll-to-section as React state. The dashboard is now its own
// route (see app/dashboard/page.tsx), so this hook's job shrinks to:
// decide whether a "go to dashboard" action should actually navigate
// there (signed in) or open sign-in first (signed out), and build the
// right /dashboard URL — optionally with ?connect=1 so DashboardClient
// knows to open the add-site wizard as soon as it mounts, and
// optionally with #<section> so the browser's own anchor scrolling
// (DashboardShell's panels keep the same element ids they always had)
// takes the user straight to that part of the page.
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

const SECTION_ANCHORS: Record<DashSection, string> = {
  overview: 'dashMain',
  logs: 'panelVisits',
  leads: 'panelLeads',
  overlay: 'panelOverlay',
};

export function useAppView(user: User | null, openAuth: (pane: 'signin' | 'signup') => void) {
  const router = useNavRouter();

  const goToDashboard = useCallback(
    (section?: DashSection) => {
      if (!user) {
        openAuth('signin');
        return;
      }
      const anchor = section ? `#${SECTION_ANCHORS[section] || ''}` : '';
      router.push(`/dashboard${anchor}`);
    },
    [user, openAuth, router]
  );

  const goToProfile = useCallback(() => {
    if (!user) {
      openAuth('signin');
      return;
    }
    router.push('/dashboard/profile');
  }, [user, openAuth, router]);

  const showMarketing = useCallback(() => router.push('/'), [router]);

  // Any "Connect your site" / "Start free" CTA on the marketing page
  // should route by real auth state: signed-in users go straight to
  // /dashboard with the add-site wizard already open; guests get the
  // signup form instead.
  const handleConnectCTA = useCallback(() => {
    if (user) {
      router.push('/dashboard?connect=1');
    } else {
      openAuth('signup');
    }
  }, [user, router, openAuth]);

  return { view: 'marketing' as AppView, goToDashboard, goToProfile, showMarketing, handleConnectCTA };
}
