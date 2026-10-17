// hooks/useAppView.ts
//
// Replaces showDashboard/showMarketing/goToDashboard/scrollToDashSection/
// handleConnectCTA. Drives which top-level view renders (marketing vs
// dashboard) and which dashboard section to scroll to, as React state
// instead of toggling element display styles directly.
'use client';

import { useCallback, useState } from 'react';
import type { User } from 'firebase/auth';

export type AppView = 'marketing' | 'dashboard';
export type DashSection = 'overview' | 'logs' | 'leads' | 'overlay';

const SECTION_ELEMENT_IDS: Record<DashSection, string> = {
  overview: 'dashMain',
  logs: 'panelVisits',
  leads: 'panelLeads',
  overlay: 'panelOverlay',
};

export function useAppView(user: User | null, openAuth: (pane: 'signin' | 'signup') => void) {
  const [view, setView] = useState<AppView>('marketing');
  const [pendingScrollSection, setPendingScrollSection] = useState<DashSection | null>(null);

  const scrollToDashSection = useCallback((section: DashSection) => {
    const el = document.getElementById(SECTION_ELEMENT_IDS[section] || 'dashMain');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const goToDashboard = useCallback(
    (section?: DashSection) => {
      if (!user) {
        openAuth('signin');
        return;
      }
      setView('dashboard');
      window.scrollTo({ top: 0, behavior: 'instant' in window ? ('instant' as ScrollBehavior) : 'auto' });
      if (section) {
        setPendingScrollSection(section);
        setTimeout(() => {
          scrollToDashSection(section);
          setPendingScrollSection(null);
        }, 50);
      }
    },
    [user, openAuth, scrollToDashSection]
  );

  const showMarketing = useCallback(() => setView('marketing'), []);

  // Any "Connect your site" / "Start free" CTA on the marketing page
  // should route by real auth state: signed-in users go straight to the
  // dashboard (and the caller opens the add-site modal), guests get the
  // signup form.
  const handleConnectCTA = useCallback(
    (openAddSiteModal: () => void) => {
      if (user) {
        goToDashboard('overview');
        setTimeout(openAddSiteModal, 250);
      } else {
        openAuth('signup');
      }
    },
    [user, goToDashboard, openAuth]
  );

  return { view, setView, goToDashboard, showMarketing, handleConnectCTA, pendingScrollSection };
}
