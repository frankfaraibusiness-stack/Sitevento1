'use client';

// components/dashboard/FeatureOptionsGrid.tsx
//
// The dashboard's "Features" hub — ten tap-to-open growth/ops modules,
// replacing the old approach of cramming the banner composer directly
// into the main dashboard scroll. "Site Alert" opens its own in-place
// panel (the one feature that still works that way — see
// onOpenSiteAlert) and "Widgets" now routes to its own standalone,
// SEO-indexable page at /widgets (see app/widgets/page.tsx — it used
// to be an in-place panel here too, WidgetsPanel, but that couldn't be
// crawled or linked to, so it moved out to a real route); the other
// eight render as the same card, same icon treatment, same tap target,
// but are intentionally inert (a "Coming soon" pill, no navigation)
// until each is actually built.
//
// Lineup skews toward startup-stage value, not big-company-only infra
// — each one is something a small team can turn on themselves and get
// value from same-day, either by surfacing data they can act on,
// plugging into a tool they already run, or automating something
// they'd otherwise do by hand:
//   1. Site Alert            — on-site banners (live)
//   2. Widgets                — on-site widget picker: support chat, countdown timer (live — routes to /widgets)
//   3. Visitor Data API      — pull visits/leads into their own systems
//   4. CRM Sync              — push leads to Salesforce/HubSpot/Pipedrive
//   5. Slack & Webhook Alerts— real-time ping on high-value visits
//   6. Company Identification— name the company behind anonymous visits
//   7. Email Capture Widget  — on-site popup/embed that turns visits into leads
//   8. Zapier & Make         — no-code routing to anywhere
//   9. AI Support Agent      — 24/7 AI agent that replies to customers automatically
//   10. Automation Workflows — simple if-this-then-that rules ("new lead → tag + notify")
import { useState, type ReactNode } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';

interface FeatureOption {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  href: string | null; // null = not wired up yet
  live?: boolean; // true = tappable even without an href (opens an in-place panel, like Site Alert and Widgets)
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    id: 'site-alert',
    name: 'Site Alert',
    description: 'Push a live banner to every visitor — announcements, outages, sales — no redeploy needed.',
    href: '/dashboard/features/site-alert',
    live: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 12h16M4 6h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'widgets',
    name: 'Widgets',
    description: 'Drop-in on-site widgets — support chat and a countdown timer — no code, no redeploy.',
    href: '/widgets',
    live: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'visitor-api',
    name: 'Visitor Data API',
    description: 'A REST API for your visit and lead data — pull it straight into your own warehouse or app.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3m0-8V5a2 2 0 0 0-2-2h-3" />
        <path d="M8 12h3m2 0h3M9.5 9.5v5M14.5 9.5v5" />
      </svg>
    ),
  },
  {
    id: 'crm-sync',
    name: 'CRM Sync',
    description: 'Every captured lead lands in Salesforce, HubSpot, or Pipedrive automatically — no manual export.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="4" width="7" height="7" rx="1.5" />
        <rect x="14" y="4" width="7" height="7" rx="1.5" />
        <rect x="8.5" y="14" width="7" height="7" rx="1.5" />
        <path d="M6.5 11v2.5a1.5 1.5 0 0 0 1.5 1.5h2M17.5 11v2.5A1.5 1.5 0 0 1 16 15h-2" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    name: 'Slack & Webhook Alerts',
    description: 'Get pinged the moment a high-value visitor or lead hits your site — Slack, email, or your own webhook.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  },
  {
    id: 'company-id',
    name: 'Company Identification',
    description: 'Unmask anonymous B2B traffic — see which companies are visiting, even before they fill out a form.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="9" width="7" height="12" rx="1" />
        <rect x="13" y="3" width="7" height="18" rx="1" />
        <path d="M7 13h1M7 16h1M16 7h1M16 10h1M16 13h1" />
      </svg>
    ),
  },
  {
    id: 'email-capture',
    name: 'Email Capture Widget',
    description: 'A lightweight popup or embed that turns anonymous visits into leads — same place your leads already live.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 9h18M7 13h4M7 16h7" />
      </svg>
    ),
  },
  {
    id: 'zapier',
    name: 'Zapier & Make',
    description: 'No-code connector — route visits and leads to thousands of other tools without writing a line of code.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M13 3 4 14h6l-1 7 9-11h-6l1-7z" />
      </svg>
    ),
  },
  {
    id: 'ai-agent',
    name: 'AI Support Agent',
    description: 'An always-on AI agent trained on your business that replies to customers instantly, day or night.',
    href: '/dashboard/agent',
    live: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="4" y="7" width="16" height="12" rx="3" />
        <path d="M9 2.5 12 7M12 7l3-4.5" />
        <circle cx="9" cy="13" r="1.1" fill="currentColor" stroke="none" />
        <circle cx="15" cy="13" r="1.1" fill="currentColor" stroke="none" />
        <path d="M9.5 16.5h5" />
      </svg>
    ),
  },
  {
    id: 'automations',
    name: 'Automation Workflows',
    description: 'Simple if-this-then-that rules — "new lead → tag it, notify the team, add to a list" — no code needed.',
    href: null,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="5" cy="6" r="2.2" />
        <circle cx="5" cy="18" r="2.2" />
        <circle cx="19" cy="12" r="2.2" />
        <path d="M7.2 6h5a4 4 0 0 1 4 4M7.2 18h5a4 4 0 0 0 4-4" />
      </svg>
    ),
  },
];

interface FeatureOptionsGridProps {
  // Site Alert is the one tile that still opens an in-place panel over
  // the dashboard (it needs DashboardShell's own activeSite state).
  // Widgets instead routes to its own standalone page (see
  // FEATURE_OPTIONS' href above) via this component's own router — it
  // doesn't need anything from DashboardShell's state tree. The other
  // 8 tiles have no href and stay inert ("Coming soon").
  onOpenSiteAlert: () => void;
}

// "Quick Tools" header + a compact 2x2 preview of the four most useful
// tiles (matching the siterifty-style reference), colour-coded the same
// way as the stat cards above. Expanding "More options" reveals the
// full remaining-tile grid underneath — nothing from the original
// lineup is removed, just collapsed by default so the page reads
// cleanly.
const QUICK_TOOL_IDS = ['site-alert', 'widgets', 'ai-agent', 'crm-sync'] as const;
const QUICK_TOOL_TONES: Record<(typeof QUICK_TOOL_IDS)[number], 'green' | 'purple' | 'blue' | 'orange'> = {
  'site-alert': 'green',
  widgets: 'orange',
  'ai-agent': 'purple',
  'crm-sync': 'blue',
};
const QUICK_TOOL_SUBTITLES: Record<(typeof QUICK_TOOL_IDS)[number], string> = {
  'site-alert': 'Push live banners',
  widgets: 'Add on-site widgets',
  'ai-agent': 'Automate replies',
  'crm-sync': 'Auto lead sync',
};

export function FeatureOptionsGrid({ onOpenSiteAlert }: FeatureOptionsGridProps) {
  const router = useNavRouter();
  const [expanded, setExpanded] = useState(false);
  const quickTools = QUICK_TOOL_IDS.map((id) => FEATURE_OPTIONS.find((o) => o.id === id)!);
  const restTools = FEATURE_OPTIONS.filter((o) => !QUICK_TOOL_IDS.includes(o.id as (typeof QUICK_TOOL_IDS)[number]));

  function handleTap(opt: FeatureOption) {
    if (opt.id === 'site-alert') {
      onOpenSiteAlert();
      return;
    }
    if (opt.href) {
      router.push(opt.href);
    }
  }

  return (
    <div className="qt-section" id="panelQuickTools">
      <div className="qt-head">
        <h3>Quick Tools</h3>
        <button type="button" className="qt-more-btn" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Fewer options' : 'More options'}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={expanded ? 'is-open' : ''}>
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div className="qt-grid">
        {quickTools.map((opt) => {
          const disabled = !opt.href && !opt.live;
          const tone = QUICK_TOOL_TONES[opt.id as (typeof QUICK_TOOL_IDS)[number]];
          return (
            <button
              key={opt.id}
              type="button"
              className={`qt-card qt-tone-${tone}${disabled ? ' qt-card-disabled' : ''}`}
              onClick={() => handleTap(opt)}
              disabled={disabled}
              aria-disabled={disabled}
            >
              <span className="qt-card-icon">{opt.icon}</span>
              <span className="qt-card-body">
                <span className="qt-card-name">{opt.name}</span>
                <span className="qt-card-sub">
                  {disabled ? 'Coming soon' : QUICK_TOOL_SUBTITLES[opt.id as (typeof QUICK_TOOL_IDS)[number]]}
                </span>
              </span>
              {!disabled && (
                <span className="qt-card-arrow" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {expanded && (
        <div className="feat-grid">
          {restTools.map((opt) => {
            const disabled = !opt.href && !opt.live;
            return (
              <button
                key={opt.id}
                type="button"
                className={`feat-card${disabled ? ' feat-card-disabled' : ''}`}
                onClick={() => handleTap(opt)}
                disabled={disabled}
                aria-disabled={disabled}
              >
                <span className="feat-card-icon">{opt.icon}</span>
                <span className="feat-card-body">
                  <span className="feat-card-name">
                    {opt.name}
                    {disabled && <span className="feat-card-soon">Coming soon</span>}
                  </span>
                  <span className="feat-card-desc">{opt.description}</span>
                </span>
                {!disabled && (
                  <span className="feat-card-arrow" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
