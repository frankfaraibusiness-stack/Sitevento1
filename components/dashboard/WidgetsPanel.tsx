'use client';

// components/dashboard/WidgetsPanel.tsx
//
// Full-screen "Widgets" picker, opened from the Quick Tools row right
// after Site Alert. Same full-screen-takeover-with-sticky-header
// pattern as the Site Alert panel (DashboardShell's .feat-panel-screen)
// rather than a sheet/dropdown, so it reads as one consistent "opens
// over everything" interaction across the dashboard.
//
// Ten on-site widgets a visitor-facing site could embed. Only Support
// Chat and Spin-the-Wheel are plausible first builds given what this
// app already does (visit tracking + banners); the rest are listed as
// "Coming soon" the same way FeatureOptionsGrid's non-Site-Alert tiles
// are — present for the picker to feel complete, inert until built.
// Swap `live: true` once a given widget actually has a builder behind
// it.
import type { ReactNode } from 'react';

interface WidgetOption {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  live: boolean;
}

const WIDGET_OPTIONS: WidgetOption[] = [
  {
    id: 'support-chat',
    name: 'Support Chat',
    description: 'A live chat bubble in the corner of your site so visitors can message you directly, no extra tool needed.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    id: 'spin-wheel',
    name: 'Spin-the-Wheel',
    description: 'A playful discount wheel visitors spin once to unlock a coupon or offer in exchange for their email.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v9l6.4 3.7M12 12 5.6 15.7" />
        <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'exit-intent',
    name: 'Exit-Intent Popup',
    description: 'Catches a visitor the moment their cursor heads for the tab bar, with one last offer or message.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M14 9l4 4-4 4M18 13H9" />
      </svg>
    ),
  },
  {
    id: 'countdown-timer',
    name: 'Countdown Timer',
    description: 'A sticky bar or badge counting down to a sale, launch, or deadline to create urgency on-page.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2.5M9.5 1.5h5M12 1.5V3" />
      </svg>
    ),
  },
  {
    id: 'social-proof',
    name: 'Social Proof Popups',
    description: 'Small "Someone in Cape Town just signed up" toasts that build trust from real-time activity.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="8" cy="9" r="3" />
        <path d="M2.5 19c0-2.8 2.5-5 5.5-5s5.5 2.2 5.5 5" />
        <circle cx="17.5" cy="7.5" r="2.2" />
        <path d="M14.8 12.3a4.2 4.2 0 0 1 6.7 3.4" />
      </svg>
    ),
  },
  {
    id: 'reviews-widget',
    name: 'Reviews & Ratings',
    description: 'Show off your star rating and recent reviews right on the page, pulled from one place you manage.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9L12 3.5z" />
      </svg>
    ),
  },
  {
    id: 'video-popup',
    name: 'Video Popup',
    description: 'An auto-play or click-to-play video overlay for product demos, welcome messages, or promos.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M10 9.3v5.4l5-2.7-5-2.7z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'feedback-widget',
    name: 'Feedback Tab',
    description: 'A small side tab visitors can click to leave quick feedback or report a bug, no page reload needed.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 5h13a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9l-5 4V5z" />
        <path d="M8 9h7M8 12h4" />
      </svg>
    ),
  },
  {
    id: 'referral-widget',
    name: 'Referral Program',
    description: 'A built-in "Invite a friend, get a reward" panel that turns happy visitors into a referral channel.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="7" cy="8" r="2.6" />
        <circle cx="17" cy="8" r="2.6" />
        <path d="M2.5 19c0-2.6 2-4.6 4.5-4.6s4.5 2 4.5 4.6M12.5 19c0-2.6 2-4.6 4.5-4.6s4.5 2 4.5 4.6" />
      </svg>
    ),
  },
  {
    id: 'announcement-bar',
    name: 'Announcement Bar',
    description: 'A slim bar pinned to the top of the page for ongoing promos or news — lighter-weight than a full banner.',
    live: false,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4" width="18" height="4.5" rx="1.2" />
        <path d="M3 13h18M3 17h12" />
      </svg>
    ),
  },
];

interface WidgetsPanelProps {
  onClose: () => void;
}

export function WidgetsPanel({ onClose }: WidgetsPanelProps) {
  return (
    <div className="feat-panel-screen" role="dialog" aria-modal="true" aria-label="Widgets">
      <div className="feat-panel-head">
        <div className="feat-panel-head-text">
          <h2>Widgets</h2>
          <span>Drop-in, on-site widgets you can turn on for this site — no code, no redeploy.</span>
        </div>
        <button type="button" className="feat-panel-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <div className="feat-panel-body">
        <div className="wg-grid">
          {WIDGET_OPTIONS.map((w) => (
            <button
              key={w.id}
              type="button"
              className={`wg-card${w.live ? '' : ' wg-card-disabled'}`}
              disabled={!w.live}
              aria-disabled={!w.live}
            >
              <span className="wg-card-icon">{w.icon}</span>
              <span className="wg-card-body">
                <span className="wg-card-name">
                  {w.name}
                  {!w.live && <span className="wg-card-soon">Coming soon</span>}
                </span>
                <span className="wg-card-desc">{w.description}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
