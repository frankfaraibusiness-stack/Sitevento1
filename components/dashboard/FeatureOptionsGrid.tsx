'use client';

// components/dashboard/FeatureOptionsGrid.tsx
//
// The dashboard's "Features" hub — seven tap-to-open growth/ops
// modules, replacing the old approach of cramming the banner composer
// directly into the main dashboard scroll. Every tile, Site Alert
// included, now routes to its own standalone page — Site Alert used
// to be the one feature that opened an in-place full-screen panel
// over /dashboard instead (see DashboardShell's old siteAlertOpen
// state), but that popup has been removed in favor of a real page at
// /dashboard/features/site-alert (components/site-alert/SiteAlertPageClient.tsx).
// Every stub that had no href yet (Visitor Data API, CRM Sync,
// Slack & Webhook Alerts, Company Identification, Email Capture
// Widget, Zapier & Make, Automation Workflows) has been removed from
// this lineup rather than shown disabled — they can come back once
// each is actually built, same as Advertise and Monetization did.
//
// Lineup skews toward startup-stage value, not big-company-only infra
// — each one is something a small team can turn on themselves and get
// value from same-day:
//   1. Site Alert     — on-site banners (live — routes to /dashboard/features/site-alert)
//   2. Widgets         — on-site widget picker: support chat, countdown timer (live — routes to /widgets)
//   3. Monetization    — turn on ad monetization for a verified site (live — routes to /dashboard/monetization)
//   4. Advertise        — run their own ads across the network (live — routes to /dashboard/advertise)
//   5. AI Support Agent — 24/7 AI agent that replies to customers automatically
//   6. Users            — unique-visitor directory with restrict/block/message/delete (live — routes to /dashboard/users)
//   7. Bot Shield        — in-house (non-AI) auto-block for scripted refresh/click/form bursts (live — routes to /dashboard/bot-shield)
import type { ReactNode } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';

interface FeatureOption {
  id: string;
  name: string;
  description: string;
  icon: ReactNode;
  href: string | null;
}

const FEATURE_OPTIONS: FeatureOption[] = [
  {
    id: 'site-alert',
    name: 'Site Alert',
    description: 'Push a live banner to every visitor — announcements, outages, sales — no redeploy needed.',
    href: '/dashboard/features/site-alert',
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
    id: 'monetization',
    name: 'Monetization',
    description: 'Turn on ad monetization for your site — instantly approved once your site is verified.',
    href: '/dashboard/monetization',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M15 9.5c0-1.4-1.3-2.5-3-2.5s-3 1-3 2.3c0 3 6 1.4 6 4.4 0 1.3-1.3 2.3-3 2.3s-3-1.1-3-2.5" />
      </svg>
    ),
  },
  {
    id: 'advertise',
    name: 'Advertise',
    description: 'Run your own banner, link, or text ads across the network — set your creative, pick your CTA, go live.',
    href: '/dashboard/advertise',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <rect x="3" y="5" width="18" height="10" rx="2" />
        <path d="M7 9h6M7 12h4" />
        <path d="M15 19h4M17 17v4" />
      </svg>
    ),
  },
  {
    id: 'ai-agent',
    name: 'AI Support Agent',
    description: 'An always-on AI agent trained on your business that replies to customers instantly, day or night.',
    href: '/dashboard/agent',
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
    id: 'users',
    name: 'Users',
    description: 'Every unique visitor your site has ever had — country flag, first/last seen, and quick restrict, block, message, or delete controls.',
    href: '/dashboard/users',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="9" cy="8" r="3.4" />
        <path d="M2.5 19c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
        <path d="M16.3 13.2c2.9.5 4.7 2.8 4.7 5.8" />
        <circle cx="16" cy="7.2" r="2.4" />
      </svg>
    ),
  },
  {
    id: 'bot-shield',
    name: 'Bot Shield',
    description: 'Automatic, in-house detection for scripted refresh/click/form bursts — auto-blocks on the spot, no AI model, no extra cost.',
    href: '/dashboard/bot-shield',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];

// "Quick Tools" header + the full set of tiles, colour-coded the same
// way as the stat cards above. Every stub without a built page has
// been removed from FEATURE_OPTIONS entirely (see this file's header
// comment), so there's no longer a disabled state to show and nothing
// left to collapse behind "More options" — all six tiles here are
// live and tappable, and every one of them is a plain route push.
const QUICK_TOOL_IDS = ['site-alert', 'widgets', 'monetization', 'advertise', 'ai-agent', 'users', 'bot-shield'] as const;
const QUICK_TOOL_TONES: Record<(typeof QUICK_TOOL_IDS)[number], 'green' | 'purple' | 'blue' | 'orange'> = {
  'site-alert': 'green',
  widgets: 'orange',
  monetization: 'blue',
  advertise: 'green',
  'ai-agent': 'purple',
  users: 'blue',
  'bot-shield': 'orange',
};
const QUICK_TOOL_SUBTITLES: Record<(typeof QUICK_TOOL_IDS)[number], string> = {
  'site-alert': 'Push live banners',
  widgets: 'Add on-site widgets',
  monetization: 'Start earning',
  advertise: 'Run your own ads',
  'ai-agent': 'Automate replies',
  users: 'See who visits',
  'bot-shield': 'Auto-block bots',
};

export function FeatureOptionsGrid() {
  const router = useNavRouter();
  const quickTools = QUICK_TOOL_IDS.map((id) => FEATURE_OPTIONS.find((o) => o.id === id)!);

  function handleTap(opt: FeatureOption) {
    if (opt.href) {
      router.push(opt.href);
    }
  }

  return (
    <div className="dnx-qt-section" id="panelQuickTools">
      <div className="dnx-qt-head">
        <h3>Quick Tools</h3>
      </div>

      <div className="dnx-qt-grid dnx-qt-grid-7">
        {quickTools.map((opt) => {
          const tone = QUICK_TOOL_TONES[opt.id as (typeof QUICK_TOOL_IDS)[number]];
          return (
            <button key={opt.id} type="button" className={`dnx-qt-card dnx-tone-${tone}`} onClick={() => handleTap(opt)}>
              <span className="dnx-qt-card-icon">{opt.icon}</span>
              <span className="dnx-qt-card-body">
                <span className="dnx-qt-card-name">{opt.name}</span>
                <span className="dnx-qt-card-sub">{QUICK_TOOL_SUBTITLES[opt.id as (typeof QUICK_TOOL_IDS)[number]]}</span>
              </span>
              <span className="dnx-qt-card-arrow" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
