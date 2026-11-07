// components/dashboard/quickToolOptions.tsx
//
// Single source of truth for the "Quick Tools" lineup, shared by
// ManageSiteModal.tsx (new dashboard) and, until it's removed
// in the cleanup pass, the old FeatureOptionsGrid.tsx. Mirrors that
// file's FEATURE_OPTIONS + QUICK_TOOL_TONES + QUICK_TOOL_SUBTITLES
// exactly — same seven tools, same ids, same hrefs, same icons — so
// behavior doesn't drift between the old and new dashboards while
// both exist side by side.
import type { ReactNode } from 'react';

export interface QuickToolOption {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  icon: ReactNode;
  href: string | null;
  tone: 'green' | 'purple' | 'blue' | 'orange';
}

export const QUICK_TOOL_OPTIONS: QuickToolOption[] = [
  {
    id: 'site-alert',
    name: 'Site Alert',
    subtitle: 'Push live banners',
    description: 'Push a live banner to every visitor — announcements, outages, sales — no redeploy needed.',
    href: '/dashboard/features/site-alert',
    tone: 'green',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M4 12h16M4 6h16M4 18h10" />
      </svg>
    ),
  },
  {
    id: 'widgets',
    name: 'Widgets',
    subtitle: 'Add on-site widgets',
    description: 'Drop-in on-site widgets — support chat and a countdown timer — no code, no redeploy.',
    href: '/widgets',
    tone: 'orange',
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
    subtitle: 'Start earning',
    description: 'Turn on ad monetization for your site — instantly approved once your site is verified.',
    href: '/dashboard/monetization',
    tone: 'blue',
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
    subtitle: 'Run your own ads',
    description: 'Run your own banner, link, or text ads across the network — set your creative, pick your CTA, go live.',
    href: '/dashboard/advertise',
    tone: 'green',
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
    subtitle: 'Automate replies',
    description: 'An always-on AI agent trained on your business that replies to customers instantly, day or night.',
    href: '/dashboard/agent',
    tone: 'purple',
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
    subtitle: 'See who visits',
    description: 'Every unique visitor your site has ever had — country flag, first/last seen, and quick restrict, block, message, or delete controls.',
    href: '/dashboard/users',
    tone: 'blue',
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
    name: 'SECURITY BOT',
    subtitle: 'Auto-block bots',
    description: 'Automatic, in-house detection for scripted refresh/click/form bursts — auto-blocks on the spot, no AI model, no extra cost.',
    href: '/dashboard/bot-shield',
    tone: 'orange',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
];
