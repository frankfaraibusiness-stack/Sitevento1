'use client';

// Live Visitor Pulse: a quiet, dismissible corner badge showing honest,
// already-tracked signals ("3 people viewing this page", "12 people
// viewed this today"). Ported from widget-drafts/visitor-pulse.html —
// see that file's comments for why this deliberately never claims live
// signups (no signup/conversion event exists in the schema yet, only
// page views). Rotates between the two messages on an interval and
// hides itself for the session once dismissed, same persistence pattern
// as EmailCaptureWidget's "seen" flag.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'visitor-pulse') and
// WidgetRenderer.tsx's switch.
// Messages are placeholder copy here; wiring real /api/track-derived
// counts into `messages` is part of that later step too.
import { useEffect, useRef, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

const MESSAGES = [
  { count: '3 people', suffix: 'viewing this page' },
  { count: '12 people', suffix: 'viewed this today' },
];

export function VisitorPulseWidget({ config }: Props) {
  const accent = /^#[0-9a-f]{6}$/i.test(String(config.accent)) ? String(config.accent) : '#6fae3f';
  const side = config.side === 'right' ? 'right' : 'left';

  const [index, setIndex] = useState(0);
  const [swap, setSwap] = useState(false);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % MESSAGES.length);
      setSwap(true);
      setTimeout(() => setSwap(false), 420);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function dismiss() {
    setDismissed(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    // Real widget persists dismissal per-visitor (localStorage, same as
    // EmailCaptureWidget's hideKey pattern) so it doesn't reappear on
    // every page view once someone's closed it — left for the backend
    // wiring step since it needs a siteId-scoped key.
  }

  const sideStyle = side === 'right' ? { right: 20 } : { left: 20 };
  const current = MESSAGES[index];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 20,
        ...sideStyle,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        border: '1px solid rgba(26,31,10,0.08)',
        borderRadius: 999,
        padding: '9px 16px 9px 10px',
        boxShadow: '0 6px 20px rgba(26,31,10,0.08)',
        maxWidth: 280,
        cursor: 'default',
        opacity: dismissed ? 0 : visible ? 1 : 0,
        transform: visible && !dismissed ? 'translateY(0)' : 'translateY(10px)',
        pointerEvents: dismissed ? 'none' : 'auto',
        transition: 'opacity 500ms cubic-bezier(.22,1,.36,1), transform 500ms cubic-bezier(.22,1,.36,1)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <span style={{ position: 'relative', width: 10, height: 10, flexShrink: 0 }} aria-hidden="true">
        <span
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: accent,
            animation: 'sv-pulse-ring 2.2s ease-out infinite',
          }}
        />
        <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: accent }} />
      </span>
      <span
        style={{
          fontSize: 12.5,
          lineHeight: 1.35,
          color: '#2b3220',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: swap ? 0 : 1,
          transform: swap ? 'translateY(3px)' : 'translateY(0)',
          transition: 'opacity 420ms ease, transform 420ms ease',
        }}
      >
        <strong style={{ fontWeight: 700, color: '#1a1f0a' }}>{current.count}</strong> {current.suffix}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: '#9aa38a',
          fontSize: 13,
          lineHeight: 1,
          cursor: 'pointer',
          padding: '2px 0 2px 6px',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#3a4230')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa38a')}
      >
        {'\u2715'}
      </button>
      <style>{`
        @keyframes sv-pulse-ring {
          0% { opacity: 0.55; transform: scale(1); }
          100% { opacity: 0; transform: scale(2.6); }
        }
      `}</style>
    </div>
  );
}
