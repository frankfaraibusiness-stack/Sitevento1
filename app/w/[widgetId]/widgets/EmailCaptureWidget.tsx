'use client';

// Email Capture widget: a full-screen (or corner-card) email signup
// that the site's embed script (public/sitevento.js) mounts once a
// visitor scrolls near the bottom of the page — not on load like every
// other widget — and never shows again to that same visitor once they
// see it, whether or not they submit.
//
// "Hides for that visitor" is tracked in this iframe's own localStorage
// (keyed by siteId, since each site's widget lives in the same /w/
// origin but visitors shouldn't be keyed across sites), the same
// per-visitor persistence pattern public/sitevento.js already uses for
// its own dismissed-overlay flag. There's no visitor account system on
// a third-party site, so a per-browser flag is the only notion of "this
// visitor" available — same tradeoff the rest of this app already
// makes (see SupportChatWidget's session id).
//
// Submission posts to this app's own /api/email-capture route (Admin
// SDK, same trust boundary as /api/overlay-notify), which writes into
// the site's existing `leads` subcollection — so captured emails show
// up in the dashboard's LeadsPanel like every other lead source,
// instead of a parallel list only this widget knows about.
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';

interface Props {
  siteId: string;
  config: Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

// Lighten/darken a #rrggbb hex by `amt` (-1..1) — same small helper as
// SupportChatWidget's, duplicated rather than shared since each widget
// is meant to stay a self-contained file (see WidgetRenderer.tsx).
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * amt)));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Matches sitevento.js's armScrollEndWidget() key pattern exactly
// (sv_{widgetId with - -> _}_seen_{siteId}) so the loader's fast-path
// check (skip even arming a scroll listener for a visitor who's
// already dismissed this) and this iframe's own check agree on the
// same flag.
function hideKey(siteId: string) {
  return 'sv_email_capture_seen_' + siteId;
}

export function EmailCaptureWidget({ siteId, config }: Props) {
  const eyebrow = str(config.eyebrow, 'Before you go');
  const heading = str(config.heading, 'Stay in the loop');
  const body = str(config.body, "Drop your email and we'll let you know when there's something new.");
  const placeholder = str(config.placeholder, 'you@example.com');
  const buttonLabel = str(config.buttonLabel, 'Notify me');
  const successText = str(config.successText, "You're on the list!");
  const accent = /^#[0-9a-f]{6}$/i.test(String(config.accent)) ? String(config.accent) : '#8a5a3c';
  const style = config.style === 'card' ? 'card' : 'overlay';

  const accentLight = shade(accent, 0.14);
  const accentDark = shade(accent, -0.16);

  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  // Shown by the loader once the visitor has scrolled to the bottom —
  // see sitevento.js's scroll-end handling, which only mounts this
  // iframe at all once that happens and the visitor hasn't seen it
  // before. This effect is the second, belt-and-suspenders check: it
  // also hides itself immediately if, for any reason (a cached iframe,
  // a direct open), the flag is already set.
  useEffect(() => {
    if (!siteId) {
      setVisible(true);
      return;
    }
    try {
      if (localStorage.getItem(hideKey(siteId))) {
        setVisible(false);
        return;
      }
    } catch {
      // Storage unavailable — fall through and show it anyway rather
      // than silently never showing a widget the owner turned on.
    }
    // Small delay so the takeover doesn't flash in the instant the
    // iframe mounts — gives the entrance transition below something to
    // animate from.
    const id = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(id);
  }, [siteId]);

  function markSeen() {
    try {
      localStorage.setItem(hideKey(siteId), '1');
    } catch {
      // Best-effort — if storage isn't available the widget may show
      // again next visit, which is an acceptable fallback, not a
      // functional break.
    }
  }

  function dismiss() {
    markSeen();
    setVisible(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed) || status === 'sending') return;
    setStatus('sending');
    try {
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, email: trimmed }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data && data.ok) {
        setStatus('done');
        markSeen();
      } else {
        setStatus('error');
      }
    } catch {
      setStatus('error');
    }
  }

  if (!visible) return null;

  const isCard = style === 'card';

  const wrapStyle: CSSProperties = isCard
    ? {
        position: 'fixed',
        bottom: 16,
        right: 16,
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        borderRadius: 20,
      }
    : {
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        borderRadius: 0,
      };

  return (
    <div
      style={{
        ...wrapStyle,
        zIndex: 2147483000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isCard ? 0 : 24,
        boxSizing: 'border-box',
        background: isCard ? 'transparent' : 'rgba(10,8,6,0.55)',
        backdropFilter: isCard ? 'none' : 'blur(6px)',
        WebkitBackdropFilter: isCard ? 'none' : 'blur(6px)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 260ms cubic-bezier(.2,.8,.2,1), transform 260ms cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: isCard ? '100%' : 420,
          background: '#fff',
          borderRadius: isCard ? 20 : 26,
          boxShadow:
            '0 1px 1px rgba(20,16,10,0.05), 0 12px 32px rgba(20,16,10,0.14), 0 32px 72px -16px rgba(20,16,10,0.34)',
          border: '1px solid rgba(20,16,10,0.07)',
          padding: isCard ? '24px 22px 22px' : '40px 32px 34px',
          boxSizing: 'border-box',
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <button
          type="button"
          aria-label="Dismiss"
          onClick={dismiss}
          style={{
            position: 'absolute',
            top: 14,
            right: 14,
            width: 30,
            height: 30,
            borderRadius: '50%',
            border: '1px solid rgba(20,16,10,0.08)',
            background: 'rgba(20,16,10,0.04)',
            color: '#6b655c',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>

        {status === 'done' ? (
          <div style={{ padding: isCard ? '10px 0' : '20px 0' }}>
            <div
              style={{
                width: 52,
                height: 52,
                margin: '0 auto 16px',
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${accentLight}, ${accent})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: `0 8px 22px ${accent}55`,
              }}
            >
              <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div style={{ fontSize: isCard ? 16 : 19, fontWeight: 750, color: '#22201c', letterSpacing: '-0.01em' }}>
              {successText}
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'inline-flex',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: accent,
                background: `${accent}18`,
                border: `1px solid ${accent}35`,
                borderRadius: 999,
                padding: '5px 12px',
                marginBottom: isCard ? 12 : 16,
              }}
            >
              {eyebrow}
            </div>
            <h3
              style={{
                margin: isCard ? '0 0 8px' : '0 0 10px',
                fontSize: isCard ? 18 : 24,
                fontWeight: 800,
                color: '#22201c',
                letterSpacing: '-0.015em',
                lineHeight: 1.2,
              }}
            >
              {heading}
            </h3>
            <p
              style={{
                margin: isCard ? '0 0 18px' : '0 0 22px',
                fontSize: isCard ? 13 : 14.5,
                lineHeight: 1.55,
                color: '#6b655c',
              }}
            >
              {body}
            </p>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: isCard ? 'column' : 'row', gap: 10 }}>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === 'error') setStatus('idle');
                }}
                placeholder={placeholder}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: isCard ? '11px 14px' : '13px 16px',
                  borderRadius: 12,
                  border: `1.5px solid ${status === 'error' ? '#e0574f' : 'rgba(20,16,10,0.14)'}`,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: '#fbfaf8',
                  color: '#22201c',
                  transition: 'border-color 150ms',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  if (status !== 'error') e.currentTarget.style.borderColor = accent;
                }}
                onBlur={(e) => {
                  if (status !== 'error') e.currentTarget.style.borderColor = 'rgba(20,16,10,0.14)';
                }}
              />
              <button
                type="submit"
                disabled={status === 'sending'}
                style={{
                  flexShrink: 0,
                  padding: isCard ? '11px 16px' : '13px 22px',
                  borderRadius: 12,
                  border: 0,
                  background: `linear-gradient(135deg, ${accentLight}, ${accent} 60%, ${accentDark})`,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: status === 'sending' ? 'default' : 'pointer',
                  opacity: status === 'sending' ? 0.75 : 1,
                  boxShadow: `0 6px 18px ${accent}55`,
                  transition: 'opacity 150ms, transform 100ms',
                  whiteSpace: 'nowrap',
                }}
              >
                {status === 'sending' ? '\u2026' : buttonLabel}
              </button>
            </form>
            {status === 'error' && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: '#c0453d' }}>
                {'That didn\u2019t go through \u2014 check the address and try again.'}
              </div>
            )}
            <div style={{ marginTop: isCard ? 12 : 16, fontSize: 11, color: '#a39c91' }}>
              No spam. Unsubscribe anytime.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
