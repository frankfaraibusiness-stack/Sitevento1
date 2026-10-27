'use client';

// Email Capture — full-screen popup (modern skin). Ported from
// widget-drafts/email-capture.html. Maps to the existing email-capture
// catalog slot per the drafts README (scroll-end position) as an
// alternate look to EmailCaptureWidget's existing overlay/card styles —
// indigo/purple palette, sticky header with a logo mark, icon-in-input
// styling, and a bouncy entrance.
//
// Submit posts a real email to /api/email-capture — the same route
// and `leads` write EmailCaptureWidget's own overlay/card skin
// already uses, so a capture here shows up in the dashboard's
// LeadsPanel the same way. The draft's placeholder "Brand.io" header
// text has been swapped for the shared `widgetLabel` config field
// (lib/widgets.ts's UNIVERSAL_CONFIG_FIELDS) rather than hardcoded
// copy.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'email-capture-modern') and
// WidgetRenderer.tsx's switch.
//
// ── Full-screen on mobile ────────────────────────────────────────────
// Unlike the corner-launcher widgets (support-chat, faq-page, etc.)
// this one mounts via sitevento.js's #sv-auto-scroll-end container,
// which is ALREADY a true `position:fixed;inset:0` box with its iframe
// at width:100%/height:100% — no postMessage/expand bridge needed, the
// iframe itself is always full-viewport. The bug was entirely in this
// component: the card below had no mobile branch at all, so it always
// rendered as a small `maxWidth: 440` rounded card centered inside
// that full-screen backdrop — on a phone that reads as "a centered
// floating popup," not a full-screen takeover, even though the
// backdrop behind it really was covering the whole screen. The isMobile
// branch below makes the card itself go edge-to-edge with a sticky
// header, same pattern as every other widget here.
import { useEffect, useState, type FormEvent } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_BREAKPOINT = 640;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener ? mq.addEventListener('change', update) : mq.addListener(update);
    return () => {
      mq.removeEventListener ? mq.removeEventListener('change', update) : mq.removeListener(update);
    };
  }, []);
  return isMobile;
}

export function ModernEmailCaptureWidget({ config, siteId }: Props) {
  const widgetLabel = str(config.widgetLabel, 'Brand.io');
  const heading = str(config.heading, 'Get 10% Off Your First Order');
  const body = str(config.body, 'Join our newsletter for exclusive drops, early access, and insider-only discounts.');
  const placeholder = str(config.placeholder, 'Enter your email address');
  const buttonLabel = str(config.buttonLabel, 'Subscribe');
  const successText = str(config.successText, 'Success! Check your email \u{1F389}');

  const [open, setOpen] = useState(true);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const isMobile = useIsMobile();

  // Same scroll-lock as the corner-launcher widgets — plain
  // overflow:hidden doesn't stop iOS Safari's rubber-band scroll of the
  // host page behind a fixed overlay.
  useEffect(() => {
    if (!open || !isMobile) return;
    const { body, documentElement: html } = document;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyLeft = body.style.left;
    const prevBodyRight = body.style.right;
    const prevBodyWidth = body.style.width;
    const prevHtmlOverflow = html.style.overflow;
    const scrollY = window.scrollY || window.pageYOffset || 0;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    html.style.overflow = 'hidden';

    return () => {
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.left = prevBodyLeft;
      body.style.right = prevBodyRight;
      body.style.width = prevBodyWidth;
      html.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [open, isMobile]);

  function close() {
    setOpen(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim()) || status !== 'idle') return;
    setStatus('sending');
    setErrorMsg('');
    try {
      const res = await fetch('/api/email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, email: email.trim() }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (!data.ok) {
        setStatus('idle');
        setErrorMsg(
          data.code === 'PAUSED'
            ? 'This form has reached its daily limit. Please try again later.'
            : 'Something went wrong. Please try again.'
        );
        return;
      }
      setStatus('done');
      setTimeout(() => {
        setOpen(false);
      }, 1500);
    } catch {
      setStatus('idle');
      setErrorMsg('Something went wrong. Please try again.');
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={
        isMobile
          ? undefined
          : (e) => {
              if (e.target === e.currentTarget) close();
            }
      }
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        background: isMobile ? '#ffffff' : 'rgba(17,24,39,0.4)',
        backdropFilter: isMobile ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: isMobile ? 'none' : 'blur(8px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isMobile ? 'stretch' : 'center',
        zIndex: 2147483000,
        padding: isMobile ? 0 : 16,
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          ...(isMobile
            ? {
                // True full-screen: edge to edge, no rounded corners,
                // no shadow — a real dedicated screen, same as the
                // other full-screen-on-mobile widgets.
                maxWidth: '100%',
                height: '100%',
                borderRadius: 0,
                boxShadow: 'none',
              }
            : {
                maxWidth: 440,
                borderRadius: 24,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.05)',
              }),
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: isMobile ? 'calc(16px + env(safe-area-inset-top, 0px)) 20px 16px' : '16px 20px',
            background: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid #f3f4f6',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16, color: '#111827', letterSpacing: '-0.5px' }}>
            <div
              style={{
                width: 28,
                height: 28,
                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
              }}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="#fff">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            {widgetLabel}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            style={{
              background: '#f3f4f6',
              border: 'none',
              width: 32,
              height: 32,
              borderRadius: '50%',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#6b7280',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e5e7eb';
              e.currentTarget.style.color = '#111827';
              e.currentTarget.style.transform = 'rotate(90deg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f3f4f6';
              e.currentTarget.style.color = '#6b7280';
              e.currentTarget.style.transform = 'rotate(0deg)';
            }}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        <div
          style={{
            padding: isMobile ? '32px 24px calc(28px + env(safe-area-inset-bottom, 0px))' : '32px 24px 24px 24px',
            textAlign: 'center',
            flex: isMobile ? 1 : undefined,
            overflowY: isMobile ? 'auto' : undefined,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: '#e0e7ff',
              borderRadius: 16,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              margin: '0 auto 20px auto',
            }}
          >
            <svg viewBox="0 0 24 24" width={28} height={28} fill="#4f46e5">
              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
          </div>

          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#111827', marginBottom: 12, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
            {status === 'done' ? successText : heading}
          </h2>
          {status !== 'done' && (
            <p style={{ fontSize: 15, color: '#6b7280', lineHeight: 1.5, marginBottom: 28 }}>{body}</p>
          )}

          {status !== 'done' && (
            <>
              {errorMsg && (
                <div
                  style={{
                    fontSize: 12.5,
                    color: '#b91c1c',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 10,
                    padding: '9px 12px',
                    marginBottom: 14,
                    textAlign: 'left',
                  }}
                >
                  {errorMsg}
                </div>
              )}
              <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
                <div style={{ position: 'relative' }}>
                  <svg
                    viewBox="0 0 24 24"
                    width={18}
                    height={18}
                    fill={email ? '#6366f1' : '#9ca3af'}
                    style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', transition: 'fill 0.2s ease' }}
                  >
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={placeholder}
                    style={{
                      width: '100%',
                      padding: '16px 16px 16px 44px',
                      borderRadius: 14,
                      border: '2px solid #e5e7eb',
                      background: '#f9fafb',
                      fontSize: 15,
                      color: '#111827',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'inherit',
                      transition: 'all 0.2s ease',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#6366f1';
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.boxShadow = '0 0 0 4px rgba(99,102,241,0.1)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = '#f9fafb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={status === 'sending'}
                  style={{
                    width: '100%',
                    padding: 16,
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 14,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: status === 'sending' ? 'default' : 'pointer',
                    opacity: status === 'sending' ? 0.8 : 1,
                    boxShadow: '0 4px 12px rgba(79,70,229,0.3)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {status === 'sending' ? (
                    'Subscribing...'
                  ) : (
                    <>
                      {buttonLabel}
                      <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 16, lineHeight: 1.4 }}>
                By subscribing, you agree to our <a href="#" style={{ color: '#6b7280', textDecoration: 'underline' }}>Terms</a> {'&'}{' '}
                <a href="#" style={{ color: '#6b7280', textDecoration: 'underline' }}>Privacy Policy</a>.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
