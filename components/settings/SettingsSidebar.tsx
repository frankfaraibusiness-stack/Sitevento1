'use client';

// components/settings/SettingsSidebar.tsx
//
// Structure ported from siterifty's SettingsSidebar.tsx (same two-pane
// sidebar shape: grouped sections, nav items with icon + label + an
// optional badge, a footer with Feedback/Sign out). The item list
// itself is sitevento's own — no marketplace sections (Referrals,
// Seller Badge, Affiliates, Linked Accounts) since none of that exists
// here. In their place: the things sitevento's dashboard actually has
// (widgets, overlays, visit tracking) plus the general
// account/security/notifications/appearance group every app needs.
//
// Every entry here is a picker shell for now — selecting a panel just
// navigates to it; the panels themselves (see components/settings/panels/)
// render their controls with no live data wired up yet.
import { signOut } from 'firebase/auth';
import { useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { getFirebaseAuth } from '@/lib/firebase';

export type SettingsPanelId =
  | 'account'
  | 'security'
  | 'notifications'
  | 'appearance'
  | 'billing'
  | 'api'
  | 'webhooks'
  | 'widgets-defaults'
  | 'privacy'
  | 'sessions'
  | 'site-alerts'
  | 'danger';

interface NavItem {
  panel: SettingsPanelId;
  label: string;
  badge?: string;
  icon: React.ReactNode;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    label: 'General',
    items: [
      {
        panel: 'account',
        label: 'Account',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="8" r="4" />
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          </svg>
        ),
      },
      {
        panel: 'security',
        label: 'Security',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        ),
      },
      {
        panel: 'notifications',
        label: 'Notifications',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
        ),
      },
      {
        panel: 'appearance',
        label: 'Appearance',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Billing',
    items: [
      {
        panel: 'billing',
        label: 'Billing & Plans',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
            <line x1="1" y1="10" x2="23" y2="10" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Developer',
    items: [
      {
        panel: 'api',
        label: 'API Keys',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
      },
      {
        panel: 'webhooks',
        label: 'Webhooks',
        badge: 'New',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        ),
      },
      {
        panel: 'widgets-defaults',
        label: 'Widget Defaults',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 9h18" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Data',
    items: [
      {
        panel: 'privacy',
        label: 'Privacy & Data',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        panel: 'sessions',
        label: 'Active Sessions',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="3" ry="3" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        ),
      },
      {
        panel: 'site-alerts',
        label: 'Site Alerts',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <circle cx="12" cy="3" r="1.5" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Other',
    items: [
      {
        panel: 'danger',
        label: 'Danger Zone',
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        ),
      },
    ],
  },
];

interface SettingsSidebarProps {
  activePanel: SettingsPanelId;
  onSelectPanel: (panel: SettingsPanelId) => void;
}

export default function SettingsSidebar({ activePanel, onSelectPanel }: SettingsSidebarProps) {
  const router = useNavRouter();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await signOut(getFirebaseAuth());
    } catch {
      // silent
    }
    window.location.href = window.location.origin + '/';
  }

  return (
    <>
      <nav className="settings-sidebar" id="settingsSidebar">
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ display: 'contents' }}>
            <span className="sidebar-section-label">{section.label}</span>
            {section.items.map((item) => (
              <button
                key={item.panel}
                type="button"
                className={`settings-nav-item${activePanel === item.panel ? ' active' : ''}`}
                data-panel={item.panel}
                onClick={() => onSelectPanel(item.panel)}
              >
                {item.icon}
                {item.badge ? (
                  <>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.label}
                    </span>
                    <span className="nav-badge">{item.badge}</span>
                  </>
                ) : (
                  item.label
                )}
              </button>
            ))}
          </div>
        ))}

        <div className="sidebar-footer">
          <button className="sidebar-footer-btn" onClick={() => router.push('/support')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            Help &amp; Support
          </button>
          <button
            className="sidebar-footer-btn logout"
            onClick={() => setConfirmingLogout(true)}
            disabled={loggingOut}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </nav>

      {confirmingLogout ? (
        <div
          role="dialog"
          aria-modal="true"
          className="settings-logout-backdrop"
          onClick={() => !loggingOut && setConfirmingLogout(false)}
        >
          <div className="settings-logout-card" onClick={(e) => e.stopPropagation()}>
            <h4>Sign out?</h4>
            <p>You&apos;ll need to sign back in to access your account.</p>
            <div className="settings-logout-actions">
              <button className="settings-save-btn" style={{ justifyContent: 'center', width: '100%' }} onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? 'Signing out…' : 'Sign Out'}
              </button>
              <button
                type="button"
                className="settings-back-btn"
                style={{ justifyContent: 'center', width: '100%' }}
                onClick={() => setConfirmingLogout(false)}
                disabled={loggingOut}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
