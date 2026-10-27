'use client';

// Daily Spin Reward. Ported from widget-drafts/spin-reward.html. A
// closeable "Spin & save" tab that opens a prize wheel. Real, listed
// odds — the wheel's stopping angle is computed FROM the chosen
// prize's slice, never the other way around, so the displayed result
// always matches where the wheel visually lands (no "so close!" fake
// near-miss rigging).
//
// The one-spin-per-visitor-per-24h gate is real and server-side via
// /api/spin-reward: an 'status' check on open (so the button is
// already disabled before any animation starts if the visitor already
// spun today — never let them watch the wheel spin and then get
// denied), and a 'claim' call once the wheel's own animation finishes,
// which atomically re-checks the gate and records the redemption
// (siteId, prize, visitorId) so the dashboard owner can see real
// volume per prize. The prize table and its weights are config-driven
// here instead of the draft's hardcoded array, so a site owner can set
// their own prizes/odds from the designer.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'spin-reward') and
// WidgetRenderer.tsx's switch.
import { useEffect, useMemo, useRef, useState } from 'react';
import { prizesFromConfig, type Prize as ConfigPrize } from '@/lib/widgets';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
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

// Config prizes (lib/widgets.ts) don't carry a wheel angle — that's a
// purely visual concern of this component, derived here from however
// many prizes the site owner configured (evenly spaced around the
// wheel) rather than stored alongside the odds data.
interface Prize extends ConfigPrize {
  angle: number;
}

function withAngles(prizes: ConfigPrize[]): Prize[] {
  const slice = 360 / prizes.length;
  return prizes.map((p, i) => ({ ...p, angle: slice * i + slice / 2 }));
}

function pickPrize(prizes: Prize[]): Prize {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return prizes[prizes.length - 1];
}

// Auto-generated fallback for the odds-line caption when the site
// owner hasn't typed a custom override — keeps the on-screen odds
// honest and in sync with the configured prize weights without
// requiring the owner to hand-write/update it every time they change
// a prize.
function autoOddsLine(prizes: Prize[]): string {
  const total = prizes.reduce((s, p) => s + p.weight, 0) || 1;
  return (
    'Odds: ' +
    prizes
      .map((p) => {
        const pct = Math.round((p.weight / total) * 100);
        return `${p.label} (${pct}%)`;
      })
      .join(' · ')
  );
}

const WHEEL_TONES = ['#dcf7a6', '#bfe77e', '#9fc95f'];

export function SpinRewardWidget({ config, siteId, visitorId }: Props) {
  const prizes = useMemo(() => withAngles(prizesFromConfig(config)), [config]);
  const oddsLine = str(config.oddsLine, '') || autoOddsLine(prizes);
  // Evenly-sliced conic-gradient wedge per prize, cycling through
  // WHEEL_TONES so neighboring slices never share a color — works for
  // any prize count, not just the old fixed 3-prize/6-wedge layout.
  const wheelGradient = useMemo(() => {
    const slice = 360 / prizes.length;
    const stops = prizes.map((_, i) => {
      const tone = WHEEL_TONES[i % WHEEL_TONES.length];
      const from = (i * slice).toFixed(2);
      const to = ((i + 1) * slice).toFixed(2);
      return `${tone} ${from}deg ${to}deg`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [prizes]);

  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinsUsedToday, setSpinsUsedToday] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [denied, setDenied] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrizeRef = useRef<Prize | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

  // ── Tell the host page when the modal opens/closes ──────────────────
  // This widget's modal is `position:fixed;inset:0` INSIDE this iframe,
  // meant to cover the whole screen with a backdrop — but the iframe
  // sitevento.js mounts for a corner widget is a fixed 336x480 box, so
  // without this, inset:0 only covers that 336x480 box, not the real
  // screen: the launcher button still works, but the modal that opens
  // is clipped/invisible, which looks like "I click and nothing
  // happens." sitevento.js listens for this exact message shape and
  // grows this iframe to full-viewport only while open is true.
  // isMobile tells it whether to use the shared edge-to-edge/sticky-
  // header layout or this widget's own desktop-sized centered card.
  useEffect(() => {
    try {
      window.parent.postMessage({ source: 'sitevento-widget', widgetId: 'spin-reward', open, isMobile }, '*');
    } catch {
      // Standalone preview (no parent frame) — nothing to notify.
    }
  }, [open, isMobile]);

  // Same scroll-lock as the other full-screen-on-mobile widgets — plain
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

  async function openModal() {
    setOpen(true);
    if (!siteId || !visitorId) return;
    try {
      const res = await fetch('/api/spin-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, action: 'status', visitorId }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (data.ok && data.alreadySpun) setSpinsUsedToday(true);
    } catch {
      // Status check failing just means the button stays enabled and
      // the 'claim' call at spin-completion makes the real decision.
    }
  }
  function closeModal() {
    setOpen(false);
  }

  function spin() {
    if (spinning || spinsUsedToday) return;
    setSpinning(true);
    setDenied(false);
    const prize = pickPrize(prizes);
    pendingPrizeRef.current = prize;
    const jitter = (Math.random() - 0.5) * 30;
    const targetRotation = 360 * 5 + (360 - prize.angle) + jitter;
    setRotation(targetRotation);

    spinTimeoutRef.current = setTimeout(async () => {
      setSpinning(false);
      const chosenPrize = pendingPrizeRef.current;
      if (!chosenPrize || !siteId || !visitorId) {
        setResult(chosenPrize);
        return;
      }
      try {
        const res = await fetch('/api/spin-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            action: 'claim',
            visitorId,
            prizeLabel: chosenPrize.label,
            prizeCode: chosenPrize.code,
            pageUrl: typeof document !== 'undefined' ? document.referrer : '',
          }),
        });
        const data = await res.json().catch(() => ({ ok: false }));
        if (data.code === 'PAUSED' || (data.ok && data.allowed === false)) {
          setSpinsUsedToday(true);
          setDenied(true);
          setRotation(0);
          return;
        }
        setResult(chosenPrize);
      } catch {
        // Network failure on the claim: show the result anyway rather
        // than strand the visitor on a spun wheel with no outcome —
        // the next 'status' check (next open) is the real source of
        // truth for whether today's spin is used.
        setResult(chosenPrize);
      }
    }, 3700);
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      <button
        type="button"
        onClick={openModal}
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          zIndex: 2147483100,
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          gap: 8,
          background: '#1a1f0a',
          color: '#f5ffe0',
          border: 'none',
          borderRadius: 999,
          padding: '12px 18px 12px 14px',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(26,31,10,0.22)',
        }}
      >
        <span style={{ fontSize: 16, display: 'inline-block', animation: 'sv-spin-idle 3.6s ease-in-out infinite' }}>{'\u{1F3A1}'}</span>
        Spin & save
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Daily spin reward"
          style={{
            position: 'fixed',
            zIndex: 2147483100,
            pointerEvents: 'auto',
            background: '#fdfdf7',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...(isMobile
              ? {
                  // True full-screen: edge to edge, no rounded corners —
                  // same pattern as the other full-screen-on-mobile
                  // widgets.
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 0,
                }
              : {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 340,
                  maxWidth: 'calc(100vw - 48px)',
                  maxHeight: 'calc(100vh - 48px)',
                  borderRadius: 20,
                  boxShadow: '0 20px 60px rgba(26,31,10,0.25)',
                }),
          }}
        >
          {/* Backdrop — desktop only; a true full-screen mobile panel
              has nothing behind it to dim. */}
          {!isMobile && (
            <div
              onClick={closeModal}
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

          {/* Sticky header: title on the left, close on the right —
              same layout as every other full-screen widget here. Only
              shown on mobile; desktop keeps the small absolute close
              button over the centered card. */}
          {isMobile ? (
            <header
              style={{
                position: 'sticky',
                top: 0,
                flexShrink: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px',
                background: 'rgba(253,253,249,0.9)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 17, color: '#1a1f0a', letterSpacing: '-0.3px' }}>Daily spin reward</span>
              <button
                type="button"
                onClick={closeModal}
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
          ) : (
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              style={{
                position: 'absolute',
                top: 12,
                right: 14,
                background: 'none',
                border: 'none',
                color: '#9aa38a',
                fontSize: 16,
                cursor: 'pointer',
                lineHeight: 1,
                zIndex: 11,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#3a4230')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa38a')}
            >
              {'\u2715'}
            </button>
          )}

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              textAlign: 'center',
              boxSizing: 'border-box',
              padding: isMobile ? '24px 24px calc(28px + env(safe-area-inset-bottom, 0px))' : '28px 24px 24px',
            }}
          >
            {!result ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 6 }}>
                  One spin, once a day
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, marginBottom: 4 }}>Try your luck</div>
                <div style={{ fontSize: 13, color: '#6b7560', marginBottom: 20, lineHeight: 1.5 }}>
                  Every visitor gets one real spin per day. No purchase needed to play.
                </div>
                {denied && (
                  <div style={{ fontSize: 11.5, color: '#9a7b1f', background: '#fdf3d8', border: '1px solid #f0e0b0', borderRadius: 8, padding: '8px 10px', marginBottom: 16 }}>
                    Looks like today's spin was already used. Come back tomorrow!
                  </div>
                )}

                <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto 20px' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 0,
                      height: 0,
                      borderLeft: '9px solid transparent',
                      borderRight: '9px solid transparent',
                      borderTop: '16px solid #1a1f0a',
                      zIndex: 2,
                    }}
                  />
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      position: 'relative',
                      transition: 'transform 3.6s cubic-bezier(0.1, 0.5, 0.15, 1)',
                      transform: `rotate(${rotation}deg)`,
                      boxShadow: '0 0 0 5px #1a1f0a, 0 8px 20px rgba(26,31,10,0.2)',
                      background: wheelGradient,
                    }}
                  >
                    {prizes.map((p, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          width: 72,
                          textAlign: 'center',
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: '#1a1f0a',
                          transformOrigin: '0 0',
                          transform: `rotate(${p.angle}deg) translate(18px, -6px)`,
                        }}
                      >
                        {p.label}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: 36,
                      height: 36,
                      background: '#fdfdf7',
                      border: '3px solid #1a1f0a',
                      borderRadius: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 2,
                    }}
                  />
                </div>

                <button
                  type="button"
                  onClick={spin}
                  disabled={spinning || spinsUsedToday}
                  style={{
                    width: '100%',
                    background: '#1a1f0a',
                    color: '#f5ffe0',
                    border: 'none',
                    borderRadius: 10,
                    padding: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: spinning || spinsUsedToday ? 'default' : 'pointer',
                    opacity: spinning || spinsUsedToday ? 0.45 : 1,
                  }}
                >
                  {spinsUsedToday ? 'Come back tomorrow' : spinning ? 'Spinning\u2026' : 'Spin the wheel'}
                </button>
                <div style={{ marginTop: 12, fontSize: 10.5, color: '#9aa38a', lineHeight: 1.5 }}>{oddsLine}</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 6 }}>
                  You got
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>{result.label}</div>
                <div
                  style={{
                    display: 'inline-block',
                    margin: '14px 0',
                    background: '#eef3e4',
                    border: '1.5px dashed #9fc95f',
                    borderRadius: 8,
                    padding: '10px 16px',
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {result.code}
                </div>
                <div style={{ fontSize: 13, color: '#6b7560', lineHeight: 1.5 }}>
                  Copy this code at checkout. Come back tomorrow for another spin.
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes sv-spin-idle {
          0%, 100% { transform: rotate(0deg); }
          50%      { transform: rotate(-14deg); }
        }
      `}</style>
    </div>
  );
}
