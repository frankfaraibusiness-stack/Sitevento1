'use client';

// Smart Announcement & Campaign Bar. Ported from
// widget-drafts/campaign-bar.html. One general-purpose bar covering
// launches, promos, alerts, and maintenance notices as swappable
// variant themes (config.variant) rather than four separate widgets,
// with a configurable top/bottom position.
//
// The draft's variant-switcher, position-switcher, page-target-switcher
// buttons and the "showing here / hidden here" meta chip were preview
// controls only (demo-only scaffolding, not part of the widget) and
// are not ported. Page-targeting (showing a bar only on /pricing, say)
// and per-variant click/dismissal beacons are backend/routing concerns
// — noted here, wired later alongside the rest of lib/widgets.ts.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'campaign-bar') and
// WidgetRenderer.tsx's switch.
import { useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

type Variant = 'launch' | 'promo' | 'alert' | 'maint';

const VARIANTS: Record<Variant, { background: string; color: string; borderBottom?: string; icon: string; defaultText: string; ctaHoverBg: string }> = {
  launch: {
    background: '#1a1f0a',
    color: '#f5ffe0',
    icon: '\u{1F680}',
    defaultText: 'We just launched <strong>Workflows 2.0</strong> \u2014 automate your whole pipeline.',
    ctaHoverBg: '#f5ffe0',
  },
  promo: {
    background: 'linear-gradient(90deg, #bfe77e, #9fc95f)',
    color: '#1a1f0a',
    icon: '\u{1F3F7}\uFE0F',
    defaultText: '<strong>20% off</strong> annual plans this week only.',
    ctaHoverBg: 'rgba(0,0,0,0.08)',
  },
  alert: {
    background: '#fdf3d8',
    color: '#6b5215',
    borderBottom: '1px solid #f0dfa0',
    icon: '\u{1F4E3}',
    defaultText: 'New: team roles and permissions are now available.',
    ctaHoverBg: 'rgba(0,0,0,0.08)',
  },
  maint: {
    background: '#f3e8e8',
    color: '#7a3a3a',
    borderBottom: '1px solid #e8d0d0',
    icon: '\u{1F6E0}\uFE0F',
    defaultText: 'Scheduled maintenance <strong>Sat 11PM\u20131AM ET</strong>. Brief downtime possible.',
    ctaHoverBg: 'rgba(0,0,0,0.08)',
  },
};

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

export function CampaignBarWidget({ config }: Props) {
  const variantKey: Variant = ['launch', 'promo', 'alert', 'maint'].includes(String(config.variant))
    ? (config.variant as Variant)
    : 'launch';
  const variant = VARIANTS[variantKey];
  const position = config.position === 'bottom' ? 'bottom' : 'top';
  const text = str(config.text, variant.defaultText);
  const ctaLabel = str(config.buttonLabel, 'Learn more');
  const ctaHref = str(config.buttonUrl, '#');

  const [closed, setClosed] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);

  return (
    <div
      role="region"
      aria-label="Site announcement"
      style={{
        position: 'fixed',
        top: position === 'top' ? 0 : 'auto',
        bottom: position === 'bottom' ? 0 : 'auto',
        left: 0,
        right: 0,
        zIndex: 999,
        overflow: 'hidden',
        maxHeight: closed ? 0 : 200,
        opacity: closed ? 0 : 1,
        transition: 'max-height 380ms cubic-bezier(0.4,0,0.2,1), opacity 280ms ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
          padding: '11px 44px 11px 16px',
          fontSize: 13,
          fontWeight: 600,
          position: 'relative',
          flexWrap: 'wrap',
          textAlign: 'center',
          background: variant.background,
          color: variant.color,
          borderBottom: variant.borderBottom,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ flexShrink: 0, fontSize: 15 }}>{variant.icon}</span>
        {/* eslint-disable-next-line react/no-danger */}
        <span dangerouslySetInnerHTML={{ __html: text }} />
        <a
          href={ctaHref}
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            flexShrink: 0,
            border: '1.5px solid currentColor',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 11.5,
            fontWeight: 700,
            textDecoration: 'none',
            color: 'inherit',
            cursor: 'pointer',
            background: ctaHover ? variant.ctaHoverBg : 'transparent',
            transition: 'background 120ms ease, color 120ms ease',
          }}
        >
          {ctaLabel}
        </a>
        <button
          type="button"
          onClick={() => setClosed(true)}
          aria-label="Dismiss announcement"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            fontSize: 14,
            cursor: 'pointer',
            color: 'inherit',
            opacity: 0.65,
            padding: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.65')}
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  );
}
