'use client';

// components/settings/SettingsPageClient.tsx
//
// Structure ported from siterifty's SettingsPageClient.tsx — two-pane
// sidebar + detail-panel layout, mobile list/panel toggle, scroll-reset
// on panel switch. Reuses sitevento's own Header/Sidebar (same as every
// other dashboard route) instead of siterifty's AnnouncementBar/Header,
// and its own BootSplash for the loading state.
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import '@/styles/settings-page.css';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { BootSplash } from '@/components/BootSplash';
import SettingsSidebar from '@/components/settings/SettingsSidebar';
import type { SettingsPanelId } from '@/components/settings/SettingsSidebar';
import { useSettingsState } from '@/hooks/useSettingsState';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import AccountPanel from '@/components/settings/panels/AccountPanel';
import SecurityPanel from '@/components/settings/panels/SecurityPanel';
import NotificationsPanel from '@/components/settings/panels/NotificationsPanel';
import AppearancePanel from '@/components/settings/panels/AppearancePanel';
import BillingPanel from '@/components/settings/panels/BillingPanel';
import ApiPanel from '@/components/settings/panels/ApiPanel';
import WebhooksPanel from '@/components/settings/panels/WebhooksPanel';
import WidgetDefaultsPanel from '@/components/settings/panels/WidgetDefaultsPanel';
import PrivacyPanel from '@/components/settings/panels/PrivacyPanel';
import SessionsPanel from '@/components/settings/panels/SessionsPanel';
import SiteAlertsPanel from '@/components/settings/panels/SiteAlertsPanel';
import DangerZonePanel from '@/components/settings/panels/DangerZonePanel';

const PANEL_PATHS: Partial<Record<SettingsPanelId, string>> = {
  security: '/settings/security',
  notifications: '/settings/notifications',
  appearance: '/settings/appearance',
  billing: '/settings/billing',
  api: '/settings/api',
  webhooks: '/settings/webhooks',
  'widgets-defaults': '/settings/widgets-defaults',
  privacy: '/settings/privacy',
  sessions: '/settings/sessions',
  'site-alerts': '/settings/site-alerts',
  danger: '/settings/danger',
};

export default function SettingsPageClient({ initialPanel }: { initialPanel: SettingsPanelId }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, authReady } = useAuth();
  const sidebarNav = useSidebar();
  const { state, setState } = useSettingsState();

  const [activePanel, setActivePanel] = useState<SettingsPanelId>(initialPanel);
  const [mobileView, setMobileView] = useState<'list' | 'panel'>(initialPanel === 'account' ? 'list' : 'panel');

  function selectPanel(panel: SettingsPanelId) {
    setActivePanel(panel);
    setMobileView('panel');
    const target = panel === 'account' ? '/settings' : PANEL_PATHS[panel]!;
    if (pathname !== target) {
      router.push(target);
    }
  }

  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.getElementById('settingsDetailPanel')?.scrollTo({ top: 0 });
      if (mobileView === 'list') {
        document.getElementById('settingsSidebar')?.scrollTo({ top: 0 });
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [activePanel, mobileView]);

  useEffect(() => {
    if (authReady && !user) router.push('/');
  }, [authReady, user, router]);

  function renderPanel() {
    switch (activePanel) {
      case 'account':
        return <AccountPanel user={user} />;
      case 'security':
        return <SecurityPanel />;
      case 'notifications':
        return <NotificationsPanel state={state} setState={setState} />;
      case 'appearance':
        return <AppearancePanel state={state} setState={setState} />;
      case 'billing':
        return <BillingPanel />;
      case 'api':
        return <ApiPanel />;
      case 'webhooks':
        return <WebhooksPanel />;
      case 'widgets-defaults':
        return <WidgetDefaultsPanel />;
      case 'privacy':
        return <PrivacyPanel />;
      case 'sessions':
        return <SessionsPanel />;
      case 'site-alerts':
        return <SiteAlertsPanel />;
      case 'danger':
        return <DangerZonePanel />;
      default:
        return null;
    }
  }

  if (!authReady) return <BootSplash />;

  if (!user) {
    return null;
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => {}}
        onProfileClick={() => router.push('/dashboard')}
        onHamburgerClick={() => sidebarNav.setOpen(true)}
      />

      <Sidebar
        open={sidebarNav.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebarNav.setOpen(false)}
        onSignIn={() => {}}
        onNavigate={() => {
          sidebarNav.setOpen(false);
          router.push('/dashboard');
        }}
        onOpenProfile={() => {
          sidebarNav.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      <div className="settings-wrap">
        <div className="settings-topbar">
          <button type="button" className="settings-back-btn" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Dashboard
          </button>
          <h1>Settings</h1>
        </div>

        <div className="settings-main" data-mobile-view={mobileView}>
          <SettingsSidebar activePanel={activePanel} onSelectPanel={selectPanel} />
          <div className="settings-detail-panel" id="settingsDetailPanel">
            <button type="button" className="settings-mobile-back-btn" onClick={() => setMobileView('list')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Settings
            </button>
            {renderPanel()}
          </div>
        </div>
      </div>
    </>
  );
}
