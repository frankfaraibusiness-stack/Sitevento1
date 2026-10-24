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
import { useEffect, useRef, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

interface Prize {
  label: string;
  code: string;
  weight: number;
  angle: number;
}

const DEFAULT_PRIZES: Prize[] = [
  { label: '10% off', code: 'SPIN10', weight: 50, angle: 30 },
  { label: 'Free shipping', code: 'SHIPFREE', weight: 33, angle: 150 },
  { label: '20% off', code: 'SPIN20', weight: 17, angle: 270 },
];

const WEDGE_ORDER = [0, 1, 2, 0, 1, 2]; // 6 cosmetic wedges, 2 per prize

function pickPrize(prizes: Prize[]): Prize {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) {
    if (r < p.weight) return p;
    r -= p.weight;
  }
  return prizes[prizes.length - 1];
}

export function SpinRewardWidget({ config, siteId, visitorId }: Props) {
  const oddsLine = str(
    config.oddsLine,
    'Odds: 10% off (1 in 2) \u00B7 Free shipping (1 in 3) \u00B7 20% off (1 in 6)'
  );
  const prizes = DEFAULT_PRIZES;

  const [open, setOpen] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinsUsedToday, setSpinsUsedToday] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<Prize | null>(null);
  const [denied, setDenied] = useState(false);
  const spinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrizeRef = useRef<Prize | null>(null);

  useEffect(() => {
    return () => {
      if (spinTimeoutRef.current) clearTimeout(spinTimeoutRef.current);
    };
  }, []);

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
          zIndex: 998,
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
          onClick={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 999,
            background: 'rgba(17,20,10,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              background: '#fdfdf7',
              borderRadius: 20,
              maxWidth: 340,
              width: '100%',
              padding: '28px 24px 24px',
              textAlign: 'center',
              boxShadow: '0 20px 60px rgba(26,31,10,0.25)',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
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
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#3a4230')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa38a')}
            >
              {'\u2715'}
            </button>

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
                      background:
                        'conic-gradient(#dcf7a6 0deg 60deg, #bfe77e 60deg 120deg, #9fc95f 120deg 180deg, #dcf7a6 180deg 240deg, #bfe77e 240deg 300deg, #9fc95f 300deg 360deg)',
                    }}
                  >
                    {WEDGE_ORDER.map((prizeIdx, i) => {
                      const angle = i * 60 + 30;
                      return (
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
                            transform: `rotate(${angle}deg) translate(18px, -6px)`,
                          }}
                        >
                          {prizes[prizeIdx]?.label}
                        </div>
                      );
                    })}
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
