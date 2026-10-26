'use client';

// FAQ Page — full-screen (mobile) / large centered modal (desktop) FAQ
// overlay, opened from a small corner launcher button.
//
// Content (the `faqs` list, header title, logo, accent color) is
// entirely config-driven — see lib/widgets.ts's 'faq-page' catalog
// entry and components/widgets/designer/FaqListField.tsx, where an
// owner either types their own questions or has them drafted by AI
// from a business description (POST /api/generate-faq). This
// component itself makes no AI calls and reads no site metadata — by
// the time a visitor sees it, `config.faqs` is just a plain, already-
// decided list, exactly like every other config-driven widget here.
//
// ── Sticky header, as specified ─────────────────────────────────────
// Left: logo (if `logoUrl` is set) + the header title text, which
// defaults to "FAQ" but doubles as an editable business-name slot —
// the owner just retypes the Header title field in the designer.
// Right: close button. Pinned to the top with safe-area padding, same
// pattern as LimeSupportChatWidget.tsx's header.
//
// ── Full-screen on mobile, same iframe-resize mechanism as
//    support-chat / appointment-booking / spin-reward ─────────────────
// The iframe sitevento.js mounts for a corner widget is a small fixed
// box, not the full viewport — this component's own position:fixed
// panel would otherwise be clipped to that box. The postMessage below
// tells sitevento.js (see its EXPANDABLE_WIDGET_IDS allowlist, which
// now includes 'faq-page') to grow this iframe to the full viewport
// only while `open` is true, then shrink it back on close.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'faq-page') and
// WidgetRenderer.tsx's switch.
import { useEffect, useState } from 'react';
import { faqsFromConfig } from '@/lib/widgets';

interface Props {
  config: Record<string, unknown>;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

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

export function FaqPageWidget({ config }: Props) {
  const launcherLabel = str(config.launcherLabel, '\u2753 FAQ');
  const heading = str(config.heading, 'FAQ');
  const logoUrl = str(config.logoUrl, '');
  const accent = /^#[0-9a-f]{6}$/i.test(String(config.accent)) ? String(config.accent) : '#6fae3f';
  const faqs = faqsFromConfig(config);

  const [open, setOpen] = useState(false);
  // Only the first item starts expanded — a long AI-generated list
  // reads as a wall of open text otherwise; the rest stay collapsed
  // until tapped, same as any standard FAQ accordion.
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      window.parent.postMessage({ source: 'sitevento-widget', widgetId: 'faq-page', open, isMobile }, '*');
    } catch {
      // Standalone preview (no parent frame) — nothing to notify.
    }
  }, [open, isMobile]);

  // Same scroll-lock as LimeSupportChatWidget.tsx's full-screen mobile
  // panel — plain overflow:hidden doesn't stop iOS Safari's rubber-band
  // scroll of the host page behind a fixed overlay, so position:fixed
  // + restoring scrollY on close is needed instead. Kept inline (not
  // imported from hooks/useScrollLock.ts) since this file ships
  // standalone to third-party sites, same reasoning as that file's.
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

  function toggleItem(i: number) {
    setOpenIndex((cur) => (cur === i ? null : i));
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Launcher — same small fixed corner button every other
          corner widget here uses, just labeled for FAQ. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open FAQ"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 2147483100,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: accent,
            color: '#17210d',
            border: 'none',
            borderRadius: 999,
            padding: '13px 20px',
            fontSize: 13.5,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 22px rgba(0,0,0,0.22)',
            pointerEvents: 'auto',
          }}
        >
          {launcherLabel}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          style={{
            position: 'fixed',
            zIndex: 2147483100,
            pointerEvents: 'auto',
            background: '#fdfdf9',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...(isMobile
              ? {
                  // True full-screen: edge to edge, no rounded corners,
                  // no backdrop to click through — a real dedicated
                  // screen, same as the full-screen chat panel.
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 0,
                }
              : {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 560,
                  maxWidth: 'calc(100vw - 48px)',
                  height: 680,
                  maxHeight: 'calc(100vh - 48px)',
                  borderRadius: 20,
                  boxShadow: '0 24px 70px rgba(0,0,0,0.30)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }),
          }}
        >
          {/* Backdrop — desktop only; a true full-screen mobile panel
              has nothing behind it to dim. Click-to-close on the
              backdrop, same convention as the other modal widgets. */}
          {!isMobile && (
            <div
              onClick={() => setOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                background: 'rgba(17,20,10,0.45)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
              }}
            />
          )}

          {/* Sticky header: logo + editable title on the left, close
              on the right. */}
          <header
            style={{
              position: 'sticky',
              top: 0,
              flexShrink: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              padding: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px' : '16px 20px',
              background: 'rgba(253,253,249,0.9)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderBottom: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    objectFit: 'cover',
                    flexShrink: 0,
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#17210d" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.33c-.75.3-1.4.98-1.4 1.92V14" />
                    <circle cx="12" cy="17.2" r="0.6" fill="#17210d" stroke="none" />
                  </svg>
                </div>
              )}
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 17,
                  color: '#1a1f0a',
                  letterSpacing: '-0.3px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {heading}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.05)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#1a1f0a" strokeWidth={2.4} strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {/* Accordion body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: isMobile ? '18px 18px calc(24px + env(safe-area-inset-bottom, 0px))' : '20px 22px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {faqs.length === 0 ? (
              <div style={{ padding: '40px 8px', textAlign: 'center', color: '#8b8578', fontSize: 14 }}>No questions yet.</div>
            ) : (
              faqs.map((item, i) => {
                const expanded = openIndex === i;
                return (
                  <div
                    key={i}
                    style={{
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 14,
                      background: expanded ? 'rgba(0,0,0,0.015)' : '#fff',
                      overflow: 'hidden',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(i)}
                      aria-expanded={expanded}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '14px 16px',
                        background: 'transparent',
                        border: 'none',
                        textAlign: 'left',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: '#1a1f0a', lineHeight: 1.4 }}>{item.q}</span>
                      <span
                        aria-hidden="true"
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: expanded ? accent : 'rgba(0,0,0,0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: expanded ? 'rotate(45deg)' : 'none',
                          transition: 'transform 0.18s ease, background 0.15s ease',
                        }}
                      >
                        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke={expanded ? '#17210d' : '#5a5648'} strokeWidth={2.4} strokeLinecap="round">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </span>
                    </button>
                    {expanded && (
                      <div style={{ padding: '0 16px 16px', fontSize: 13.5, lineHeight: 1.6, color: '#4a4638' }}>{item.a}</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
