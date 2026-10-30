'use client';

// Countdown Timer — cartoonic announcement bar. Ported from
// widget-drafts/countdown-bar.html. Distinct skin from the existing
// slim CountdownTimerWidget (same catalog slot, per the README: "Maps
// to the existing countdown-timer catalog widget, fixed-top position")
// — a bolder two-row sticky bar with a real ticking countdown, a
// promo line with an icon, a CTA button, and a close control that
// collapses the bar closed.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'countdown-bar') and
// WidgetRenderer.tsx's switch.
import { useEffect, useMemo, useState } from 'react';

const MOBILE_BREAKPOINT = 768;

interface Props {
  config: Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

function parseEndsAt(v: unknown): number {
  if (typeof v === 'string' && v) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return Date.now() + 2 * 60 * 60 * 1000;
}

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, '0');
}

export function CountdownBarWidget({ config }: Props) {
  const promoText = str(config.label, 'Flash Sale: 50% Off Pro');
  const ctaLabel = str(config.buttonLabel, 'Claim Now');
  const ctaHref = str(config.buttonUrl, '#');
  const accent = /^#[0-9a-f]{6}$/i.test(String(config.accent)) ? String(config.accent) : '#a3e635';
  const ink = '#1a2e05';
  const endsAt = useMemo(() => parseEndsAt(config.endsAt), [config.endsAt]);

  const [now, setNow] = useState(() => Date.now());
  const [closed, setClosed] = useState(false);
  const [hidden, setHidden] = useState(false);
  // Matches the draft's `@media (max-width: 768px)` rule, which stacked
  // the promo text/CTA row and made the CTA full-width — tracked via
  // resize listener here since this file, like the rest of the widget
  // components, has no stylesheet to put a media query in.
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  function close() {
    setClosed(true);
    setTimeout(() => setHidden(true), 400);
  }

  if (hidden) return null;

  const remaining = Math.max(0, endsAt - now);
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  return (
    <div
      style={{
        width: '100%',
        background: accent,
        color: ink,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        borderBottom: closed ? '0px solid ' + ink : `4px solid ${ink}`,
        boxShadow: '0 6px 0px rgba(26,46,5,0.15)',
        maxHeight: closed ? 0 : 200,
        opacity: closed ? 0 : 1,
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease-in-out, border 0.4s ease',
        fontFamily: '"Comic Sans MS", "Chalkboard SE", "Comic Neue", sans-serif',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#fff',
              border: `3px solid ${ink}`,
              padding: '6px 12px',
              borderRadius: 12,
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 900,
              fontSize: 14,
              boxShadow: `2px 2px 0px ${ink}`,
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 800, color: '#4d7c0f', textTransform: 'uppercase', marginRight: 2 }}>
              Ends:
            </span>
            {pad(hours)}:{pad(minutes)}:{pad(seconds)}
          </div>

          <button
            type="button"
            onClick={close}
            aria-label="Close announcement"
            style={{
              background: '#fff',
              border: `3px solid ${ink}`,
              cursor: 'pointer',
              color: ink,
              padding: '6px 14px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: '0.5px',
              boxShadow: `3px 3px 0px ${ink}`,
              textTransform: 'uppercase',
              transition: 'all 0.1s ease',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.transform = 'translate(2px, 2px)';
              e.currentTarget.style.boxShadow = `1px 1px 0px ${ink}`;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = 'translate(-1px, -1px)';
              e.currentTarget.style.boxShadow = `4px 4px 0px ${ink}`;
            }}
          >
            Close
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isMobile ? 12 : 16,
            width: '100%',
            flexWrap: 'wrap',
            paddingTop: 4,
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 16, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}>
            <svg
              viewBox="0 0 24 24"
              width={20}
              height={20}
              fill={ink}
              style={{ animation: 'sv-countdownbar-bounce 1s infinite alternate' }}
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            {promoText}
          </div>

          <a
            href={ctaHref}
            style={{
              background: ink,
              color: accent,
              textDecoration: 'none',
              padding: '8px 20px',
              borderRadius: 12,
              border: `3px solid ${ink}`,
              fontWeight: 900,
              fontSize: 14,
              whiteSpace: 'nowrap',
              boxShadow: '4px 4px 0px rgba(0,0,0,0.3)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              display: 'inline-block',
              textAlign: 'center',
              width: isMobile ? '100%' : 'auto',
              boxSizing: 'border-box',
              transition: 'all 0.1s ease',
            }}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
      <style>{`
        @keyframes sv-countdownbar-bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
      `}</style>
    </div>
  );
}
