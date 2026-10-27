'use client';

// Feedback & Satisfaction Survey. Ported from
// widget-drafts/feedback-survey.html. Covers NPS (0-10 + reason), CSAT
// (star rating), and a short exit-intent survey from one widget, each
// ending in a shared "thanks" state.
//
// The draft's trigger-simulation buttons (time-on-page, a custom
// "export_clicked" event, exit-intent) were preview-only scaffolding
// standing in for real trigger conditions — not ported. For now this
// component defaults to showing the NPS step on mount so it's visible
// for preview; wiring the real trigger conditions (time-on-page timer,
// a site-owner-fired custom event hook, a mouseleave-toward-top
// exit-intent heuristic) and the per-visitor frequency cap are left
// for later, same as VisitorPulseWidget's deferred dismissal
// persistence. The submit itself is real: finish() posts
// { siteId, type, score/rating/chip, reason, pageUrl, visitorId } to
// /api/feedback-survey.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'feedback-survey') and
// WidgetRenderer.tsx's switch.
//
// ── Full-screen on mobile, same iframe-resize mechanism as
//    support-chat / faq-page / contact-us / appointment-booking /
//    spin-reward ──────────────────────────────────────────────────────
// The iframe sitevento.js mounts for a corner widget is a small fixed
// box, not the full viewport — this component's own position:fixed
// card would otherwise be clipped to that box. The postMessage below
// tells sitevento.js (see its EXPANDABLE_WIDGET_IDS allowlist, which
// now includes 'feedback-survey') to grow this iframe to the full
// viewport only while `open` is true, then shrink it back on close. On
// mobile the survey becomes a true edge-to-edge screen with a sticky
// header instead of a small bottom-right card.
import { useEffect, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
  pageUrl?: string;
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

type SurveyType = 'nps' | 'csat' | 'exit';
type Step = 'nps-0' | 'nps-1' | 'csat-0' | 'exit-0' | 'thanks';

const EXIT_CHIPS = [
  { val: 'research', label: 'Researching options' },
  { val: 'pricing', label: 'Checking pricing' },
  { val: 'support', label: 'Looking for support' },
  { val: 'other', label: 'Just browsing' },
];

function npsFollowupHeading(score: number | null): string {
  if (score === null) return "What's the main reason for your score?";
  if (score >= 9) return 'What do you like most?';
  if (score >= 7) return 'What would make it better?';
  return 'Sorry to hear that \u2014 what went wrong?';
}

export function FeedbackSurveyWidget({ config, siteId, visitorId, pageUrl }: Props) {
  const surveyType: SurveyType = config.surveyType === 'csat' || config.surveyType === 'exit' ? config.surveyType : 'nps';

  const [open, setOpen] = useState(true);
  const [step, setStep] = useState<Step>(
    surveyType === 'csat' ? 'csat-0' : surveyType === 'exit' ? 'exit-0' : 'nps-0'
  );
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [npsReason, setNpsReason] = useState('');
  const [csatVal, setCsatVal] = useState<number | null>(null);
  const [exitVal, setExitVal] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    try {
      window.parent.postMessage({ source: 'sitevento-widget', widgetId: 'feedback-survey', open, isMobile }, '*');
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

  function close() {
    setOpen(false);
    // Real widget: beacon a "dismissed" event (distinct from "skipped
    // after partial answer") so the dashboard can tell response rate
    // apart from pure ignore rate.
  }

  function finish() {
    setStep('thanks');
    setTimeout(() => setOpen(false), 2200);

    const payload: Record<string, unknown> = {
      siteId,
      type: surveyType,
      pageUrl: pageUrl || '',
      visitorId: visitorId || '',
    };
    if (surveyType === 'nps') {
      payload.score = npsScore;
      payload.reason = npsReason;
    } else if (surveyType === 'csat') {
      payload.rating = csatVal;
    } else {
      payload.chip = exitVal;
    }

    fetch('/api/feedback-survey', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {
      // Thanks state already shown; a failed submit here isn't worth
      // surfacing to the visitor after they've answered — same
      // "never break the widget's own UX over a backend hiccup"
      // principle every other visitor-facing route in this app follows.
    });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal={isMobile ? true : undefined}
      aria-label="Feedback survey"
      style={{
        position: 'fixed',
        zIndex: 2147483100,
        pointerEvents: 'auto',
        background: '#fdfdf7',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        ...(isMobile
          ? {
              // True full-screen: edge to edge, no rounded corners —
              // same pattern as the other full-screen-on-mobile widgets.
              inset: 0,
              width: '100%',
              height: '100%',
              borderRadius: 0,
            }
          : {
              right: 20,
              bottom: 20,
              width: 300,
              maxWidth: 'calc(100vw - 32px)',
              borderRadius: 16,
              boxShadow: '0 16px 40px rgba(26,31,10,0.18)',
              border: '1px solid rgba(26,31,10,0.06)',
            }),
      }}
    >
      {isMobile ? (
        // Sticky header: title on the left, close on the right — same
        // layout as every other full-screen widget here.
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
            padding: 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px',
            background: 'rgba(253,253,249,0.9)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0,0,0,0.06)',
          }}
        >
          <span style={{ fontWeight: 800, fontSize: 17, color: '#1a1f0a', letterSpacing: '-0.3px' }}>Quick feedback</span>
          <button
            type="button"
            onClick={close}
            aria-label="Dismiss"
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
          onClick={close}
          aria-label="Dismiss"
          style={{ position: 'absolute', top: 10, right: 12, background: 'none', border: 'none', color: '#9aa38a', fontSize: 14, cursor: 'pointer', lineHeight: 1 }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#3a4230')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa38a')}
        >
          {'\u2715'}
        </button>
      )}

      <div style={{ padding: isMobile ? '18px 18px calc(24px + env(safe-area-inset-bottom, 0px))' : '18px 18px 16px', flex: isMobile ? 1 : undefined, overflowY: isMobile ? 'auto' : undefined, boxSizing: 'border-box' }}>
        {step === 'nps-0' && (
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, paddingRight: 16 }}>
              How likely are you to recommend us?
            </div>
            <div style={{ fontSize: 12, color: '#6b7560', marginBottom: 14, lineHeight: 1.5 }}>
              0 = not at all likely, 10 = extremely likely
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(11, 1fr)', gap: 3, marginBottom: 8 }}>
              {Array.from({ length: 11 }, (_, n) => n).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setNpsScore(n)}
                  style={{
                    aspectRatio: '1',
                    border: `1.5px solid ${npsScore === n ? '#1a1f0a' : '#eef1e6'}`,
                    background: npsScore === n ? '#1a1f0a' : '#fff',
                    color: npsScore === n ? '#f5ffe0' : 'inherit',
                    borderRadius: 6,
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9aa38a', marginBottom: 16 }}>
              <span>0</span>
              <span>10</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={close} style={textBtnStyle}>
                Not now
              </button>
              <button
                type="button"
                disabled={npsScore === null}
                onClick={() => setStep('nps-1')}
                style={primaryBtnStyle(npsScore === null)}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 'nps-1' && (
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, paddingRight: 16 }}>
              {npsFollowupHeading(npsScore)}
            </div>
            <textarea
              value={npsReason}
              onChange={(e) => setNpsReason(e.target.value)}
              placeholder="Optional \u2014 a sentence or two helps a lot"
              style={{
                width: '100%',
                border: '1.5px solid #e5ead9',
                borderRadius: 8,
                padding: '9px 11px',
                fontSize: 13,
                fontFamily: 'inherit',
                outline: 'none',
                resize: 'vertical',
                minHeight: 56,
                marginBottom: 12,
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#6fae3f')}
              onBlur={(e) => (e.currentTarget.style.borderColor = '#e5ead9')}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setStep('nps-0')} style={textBtnStyle}>
                Back
              </button>
              <button type="button" onClick={finish} style={primaryBtnStyle(false)}>
                Submit
              </button>
            </div>
          </div>
        )}

        {step === 'csat-0' && (
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, paddingRight: 16 }}>How was that export?</div>
            <div style={{ fontSize: 12, color: '#6b7560', marginBottom: 14, lineHeight: 1.5 }}>Rate your experience just now</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, justifyContent: 'center' }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setCsatVal(v)}
                  style={{
                    fontSize: 26,
                    cursor: 'pointer',
                    color: csatVal !== null && v <= csatVal ? '#e8b23f' : '#e5ead9',
                    background: 'none',
                    border: 'none',
                    lineHeight: 1,
                    transition: 'color 120ms ease, transform 120ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  {'\u2605'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={close} style={textBtnStyle}>
                Skip
              </button>
              <button type="button" disabled={csatVal === null} onClick={finish} style={primaryBtnStyle(csatVal === null)}>
                Submit
              </button>
            </div>
          </div>
        )}

        {step === 'exit-0' && (
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4, paddingRight: 16 }}>
              Before you go \u2014 what brought you here today?
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10, marginBottom: 14 }}>
              {EXIT_CHIPS.map((chip) => (
                <button
                  key={chip.val}
                  type="button"
                  onClick={() => setExitVal(chip.val)}
                  style={{
                    border: `1.5px solid ${exitVal === chip.val ? '#1a1f0a' : '#eef1e6'}`,
                    background: exitVal === chip.val ? '#1a1f0a' : '#fff',
                    color: exitVal === chip.val ? '#f5ffe0' : 'inherit',
                    borderRadius: 999,
                    padding: '6px 11px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={close} style={textBtnStyle}>
                Dismiss
              </button>
              <button type="button" disabled={exitVal === null} onClick={finish} style={primaryBtnStyle(exitVal === null)}>
                Submit
              </button>
            </div>
          </div>
        )}

        {step === 'thanks' && (
          <div style={{ textAlign: 'center', padding: '6px 0 2px' }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{'\u{1F64F}'}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 4 }}>Thanks for the feedback</div>
            <div style={{ fontSize: 12, color: '#6b7560' }}>It goes straight to the team \u2014 genuinely helps us prioritize.</div>
          </div>
        )}
      </div>
    </div>
  );
}

const textBtnStyle = {
  background: 'none',
  color: '#9aa38a',
  flex: '0 0 auto',
  padding: '10px 6px',
  border: 'none',
  borderRadius: 9,
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
} as const;

function primaryBtnStyle(disabled: boolean) {
  return {
    flex: 1,
    border: 'none',
    borderRadius: 9,
    padding: 10,
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    background: '#1a1f0a',
    color: '#f5ffe0',
    transition: 'opacity 120ms ease',
  } as const;
}
