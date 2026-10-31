'use client';

// app/w/[widgetId]/widgets/EmailCaptureWidget.tsx
//
// Email Capture — a popup that asks visitors for their email. Unlike
// Support Chat (a closed-state launcher the visitor opens themselves),
// this widget has NO manual trigger at all: it opens itself once, on
// one of two signals the owner picks (`triggerType` — see
// lib/widgets.ts's 'email-capture' catalog entry), and is then
// permanently dismissed for that visitor — whether they closed it or
// submitted it — via a localStorage flag, same per-site-keyed pattern
// as SupportChatWidget's getOrCreateSessionId. A visitor who already
// said no (closed it) or yes (submitted it) never sees it again on a
// later page load; there's deliberately no "show again" affordance
// anywhere in the UI, because forcing it back on a visitor who
// dismissed it is exactly the annoyance this design avoids.
//
// The two trigger signals are mutually exclusive, not combined:
//   'time'   — opens after `delaySeconds` on the page (1 second to 1
//              hour, owner-configurable). Available on every plan.
//   'visits' — opens the moment a visitor's own visit count for this
//              site reaches `visitThreshold`, tracked client-side via
//              its own localStorage counter (see bumpVisitCount
//              below). Paid-plan-only — see canUseVisitBasedTrigger in
//              lib/widgets.ts for the gate, enforced server-side at
//              both save time (app/api/site-widget/route.ts) and serve
//              time (app/api/widget/route.ts) via
//              sanitizeEmailCaptureConfig, so this component can trust
//              a 'visits' triggerType at face value if it ever sees
//              one.
//
// Submits to POST /api/email-capture ({ siteId, email }), which:
//   - validates + lowercases the address server-side (never trusts
//     the client's native `type="email"` check alone)
//   - checks this site's own `leads` subcollection for the same email
//     before writing, responding { ok:false, reason:'duplicate' } if
//     it's already there — this widget shows "You're already
//     subscribed" for that case specifically, not a generic error
//   - on success, writes into `leads` tagged source:'email-capture',
//     same collection every other lead source (overlay-notify, etc)
//     writes into, so it shows up in the dashboard's LeadsPanel
//     alongside everything else
//
// Submitting also marks this visitor dismissed (same as closing),
// and triggers the animated checkmark success state below before the
// popup auto-closes a couple seconds later.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

export interface EmailCaptureConfig {
  heading?: string;
  subtext?: string;
  buttonLabel?: string;
  // Which signal opens the popup — see lib/widgets.ts's catalog entry
  // for this field. 'visits' is paid-plan-only; a config that somehow
  // still says 'visits' on a Free site (stale draft from before a
  // downgrade) is already re-written back to 'time' server-side by
  // sanitizeEmailCaptureConfig before this component ever sees it
  // (both at save time in app/api/site-widget/route.ts and at serve
  // time in app/api/widget/route.ts), so this component can trust
  // whatever triggerType arrives here at face value.
  triggerType?: 'time' | 'visits';
  delaySeconds?: number;
  // Only used when triggerType === 'visits': the popup opens once the
  // visitor's own visit count for this site reaches this number (their
  // first-ever visit counts as 1).
  visitThreshold?: number;
  // Owner-chosen accent (lib/widgets.ts's 'email-capture' configFields,
  // type 'color' — rendered by CustomColorPicker in the designer).
  // Same derivation pattern as SupportChatWidget's accentCssVars():
  // one hex drives every tinted surface (badge, button, input focus
  // ring) so site owners can match their own site's colors with a
  // single picker instead of several.
  accentColor?: string;
  // Universal branding fields (lib/widgets.ts's UNIVERSAL_CONFIG_FIELDS)
  widgetLabel?: string;
  brandMode?: 'none' | 'text' | 'logo';
  brandText?: string;
  brandLogoUrl?: string;
}

const DEFAULT_ACCENT = '#a3e635';
const DEFAULT_HEADING = "Don't miss what's next";
const DEFAULT_SUBTEXT =
  "Drop your email and we'll send new posts straight to your inbox — no spam, unsubscribe any time.";
const DEFAULT_BUTTON_LABEL = 'Notify me';
const DEFAULT_TRIGGER_TYPE: 'time' | 'visits' = 'time';
const DEFAULT_DELAY_SECONDS = 4;
const DEFAULT_VISIT_THRESHOLD = 3;
// Matches lib/widgets.ts's declared bounds for these two fields
// (delaySeconds: 1-3600, visitThreshold: 2-100) — clamped again here
// as a last line of defense in case a malformed/out-of-range number
// ever reaches this component directly (e.g. an old cached bundle
// reading a config written before these bounds existed).
const MIN_DELAY_SECONDS = 1;
const MAX_DELAY_SECONDS = 3600;
const MIN_VISIT_THRESHOLD = 2;
const MAX_VISIT_THRESHOLD = 100;

// How long the success state stays on screen before the popup
// auto-closes itself — long enough to read the confirmation, short
// enough not to feel stuck open with nothing left to do.
const SUCCESS_AUTOCLOSE_MS = 2600;

function isValidHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max);
}

// Same mix()/accentCssVars() shape as SupportChatWidget.tsx — kept as
// its own copy here rather than factored into a shared helper, same
// reasoning noted there: this is a tiny, dependency-free bit of math
// that's cheaper to duplicate once than to introduce a shared module
// for across a widget bundle that ships to every visitor's browser.
function mix(hex: string, target: [number, number, number], amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const mr = Math.round(r + (target[0] - r) * amount);
  const mg = Math.round(g + (target[1] - g) * amount);
  const mb = Math.round(b + (target[2] - b) * amount);
  return `#${[mr, mg, mb].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function hexToRgbTriplet(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

function accentCssVars(raw: string | undefined): Record<string, string> {
  const accent = raw && isValidHexColor(raw) ? raw : DEFAULT_ACCENT;
  return {
    '--sv-accent': accent,
    '--sv-accent-ink': mix(accent, [26, 46, 5], 0.82),
    '--sv-accent-hover': mix(accent, [0, 0, 0], 0.12),
    '--sv-accent-soft': mix(accent, [255, 255, 255], 0.75),
    '--sv-accent-soft-2': mix(accent, [255, 255, 255], 0.35),
    '--sv-accent-rgb': hexToRgbTriplet(accent),
  };
}

export interface EmailCaptureWidgetProps {
  siteId: string;
  visitorId: string;
  config: Record<string, unknown>;
}

const DISMISSED_STORAGE_KEY_PREFIX = 'sitevento_ec_dismissed_';

function isDismissed(siteId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY_PREFIX + siteId) === '1';
  } catch {
    // Private mode / storage blocked — can't remember, so it just
    // shows every load rather than throwing.
    return false;
  }
}

function markDismissed(siteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY_PREFIX + siteId, '1');
  } catch {
    // Nothing to persist — silently skip, same as the read above.
  }
}

// Visit-based trigger: counts this visitor's own page loads on this
// site, entirely client-side via localStorage — same per-site-keyed,
// no-backend-write pattern as the dismissed flag above and
// SupportChatWidget's getOrCreateSessionId, rather than a server round
// trip just to know "is this their 3rd visit". A "visit" here means
// "this component mounted once" — i.e. once per page load, not once
// per page navigated within a single session, which matches how an
// owner reading "show on visit number 3" would expect it to count.
const VISIT_COUNT_STORAGE_KEY_PREFIX = 'sitevento_ec_visits_';

// Bumps and returns the new count. Never throws; if storage is
// unavailable (private mode, blocked), returns 1 every time, which
// just means the visit-based trigger never fires rather than firing
// immediately — the safer failure direction for a feature that exists
// specifically to NOT bother a visitor too early.
function bumpVisitCount(siteId: string): number {
  if (typeof window === 'undefined') return 1;
  const key = VISIT_COUNT_STORAGE_KEY_PREFIX + siteId;
  try {
    const current = parseInt(window.localStorage.getItem(key) || '0', 10);
    const next = (Number.isFinite(current) && current > 0 ? current : 0) + 1;
    window.localStorage.setItem(key, String(next));
    return next;
  } catch {
    return 1;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type SubmitState = 'idle' | 'submitting' | 'success' | 'duplicate' | 'error';

export function EmailCaptureWidget({ siteId, visitorId, config }: EmailCaptureWidgetProps) {
  const cfg = config as EmailCaptureConfig;
  const heading = (cfg.heading && cfg.heading.trim()) || DEFAULT_HEADING;
  const subtext = (cfg.subtext && cfg.subtext.trim()) || DEFAULT_SUBTEXT;
  const buttonLabel = (cfg.buttonLabel && cfg.buttonLabel.trim()) || DEFAULT_BUTTON_LABEL;
  // triggerType arrives already-sanitized by the server (see this
  // file's EmailCaptureConfig comment above) — 'visits' only ever
  // reaches a browser whose site is actually on a qualifying plan —
  // so this component just reads it at face value rather than
  // re-checking a plan it has no way to look up itself.
  const triggerType = cfg.triggerType === 'visits' ? 'visits' : DEFAULT_TRIGGER_TYPE;
  const delaySeconds = clamp(
    typeof cfg.delaySeconds === 'number' && Number.isFinite(cfg.delaySeconds) ? cfg.delaySeconds : DEFAULT_DELAY_SECONDS,
    MIN_DELAY_SECONDS,
    MAX_DELAY_SECONDS
  );
  const visitThreshold = clamp(
    typeof cfg.visitThreshold === 'number' && Number.isFinite(cfg.visitThreshold) ? cfg.visitThreshold : DEFAULT_VISIT_THRESHOLD,
    MIN_VISIT_THRESHOLD,
    MAX_VISIT_THRESHOLD
  );
  const widgetLabel = (cfg.widgetLabel && cfg.widgetLabel.trim()) || '';
  const brandMode = cfg.brandMode || 'none';
  const brandText = cfg.brandText || '';
  const accentVars = accentCssVars(cfg.accentColor);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The one real trigger, in one of two mutually-exclusive shapes —
  // only if this visitor hasn't already dismissed or submitted the
  // popup before. No scroll listener, no button either way; purely
  // time- or visit-count-driven per the brief.
  //
  //   'time'   (every plan) — a timer started on mount, opening the
  //            popup once after delaySeconds. Unchanged from the
  //            original behavior.
  //
  //   'visits' (paid plans only — see EmailCaptureConfig's comment on
  //            triggerType) — bumps this visitor's per-site visit
  //            counter once on mount and opens immediately, same
  //            render, if that count has now reached visitThreshold.
  //            No timer: a visitor who already qualifies on page load
  //            shouldn't have to wait delaySeconds's worth of nothing
  //            first, and delaySeconds isn't even part of this mode's
  //            config (see lib/widgets.ts / WidgetDesigner.tsx, which
  //            only show one of the two fields at a time).
  useEffect(() => {
    if (isDismissed(siteId)) return;

    if (triggerType === 'visits') {
      const count = bumpVisitCount(siteId);
      if (count >= visitThreshold) setOpen(true);
      return;
    }

    const timer = setTimeout(() => setOpen(true), delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [siteId, triggerType, delaySeconds, visitThreshold]);

  useEffect(() => {
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
    };
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    // Closing counts as "never show again" too, same as submitting —
    // a visitor who dismissed it has already answered.
    markDismissed(siteId);
  }, [siteId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = email.trim();
      if (!EMAIL_RE.test(trimmed)) {
        setState('error');
        setErrorMessage('Enter a valid email address.');
        return;
      }

      setState('submitting');
      setErrorMessage('');

      try {
        const res = await fetch('/api/email-capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteId, email: trimmed, visitorId }),
        });
        const data = await res.json().catch(() => null);

        if (data && data.ok) {
          setState('success');
          markDismissed(siteId);
          autoCloseTimer.current = setTimeout(() => setOpen(false), SUCCESS_AUTOCLOSE_MS);
          return;
        }

        if (data && data.reason === 'duplicate') {
          setState('duplicate');
          // Already subscribed is also a resolved outcome for this
          // visitor — no reason to keep asking them again later.
          markDismissed(siteId);
          autoCloseTimer.current = setTimeout(() => setOpen(false), SUCCESS_AUTOCLOSE_MS);
          return;
        }

        setState('error');
        setErrorMessage('Something went wrong — please try again.');
      } catch {
        setState('error');
        setErrorMessage('Something went wrong — please try again.');
      }
    },
    [email, siteId, visitorId]
  );

  const showForm = state === 'idle' || state === 'submitting' || state === 'error';
  const showResolved = state === 'success' || state === 'duplicate';

  return (
    <div style={accentVars as CSSProperties}>
      <style>{EMAIL_CAPTURE_CSS}</style>

      <div className={'ec-overlay' + (open ? '' : ' ec-hidden')}>
        <div className="ec-card" role="dialog" aria-modal="true" aria-labelledby="ec-title">
          <button type="button" className="ec-close" aria-label="Close" onClick={close}>
            <svg viewBox="0 0 24 24">
              <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.41 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.29-6.3z" />
            </svg>
          </button>

          {showForm && (
            <>
              <div className="ec-banner">
                <span className="ec-banner-dot d1" />
                <span className="ec-banner-dot d2" />
                <span className="ec-banner-dot d3" />
                <div className="ec-badge">
                  <svg viewBox="0 0 24 24">
                    <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z" />
                  </svg>
                </div>
                {widgetLabel && <div className="ec-widget-label">{widgetLabel}</div>}
                <h2 className="ec-title" id="ec-title">
                  {heading}
                </h2>
                <p className="ec-subtitle">{subtext}</p>
              </div>

              <div className="ec-body">
                <form className="ec-form" onSubmit={handleSubmit}>
                  <div className="ec-input-row">
                    <input
                      className={'ec-input' + (state === 'error' ? ' ec-input-error' : '')}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={email}
                      disabled={state === 'submitting'}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (state === 'error') setState('idle');
                      }}
                      required
                    />
                    <svg viewBox="0 0 24 24">
                      <path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4-8 5-8-5V6l8 5 8-5z" />
                    </svg>
                  </div>
                  {state === 'error' && <p className="ec-error-text">{errorMessage}</p>}

                  <button type="submit" className="ec-submit" disabled={state === 'submitting'}>
                    {state === 'submitting' ? (
                      <span className="ec-spinner" aria-hidden="true" />
                    ) : (
                      <>
                        {buttonLabel}
                        <svg viewBox="0 0 24 24">
                          <path d="M4 12h14M13 6l6 6-6 6" />
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                {brandMode === 'text' && brandText ? <div className="ec-owner-credit">{brandText}</div> : null}

                <p className="ec-fineprint">We&apos;ll only use this to send updates from this site. No spam.</p>
                <div className="ec-sitevento-credit">
                  <svg className="ec-bolt" viewBox="0 0 24 24">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                  </svg>
                  Powered by
                  <a className="ec-brand-link" href="https://sitevento.com" target="_blank" rel="noopener noreferrer">
                    sitevento.com
                  </a>
                </div>
              </div>
            </>
          )}

          {showResolved && (
            <div className="ec-resolved">
              <div className={'ec-resolved-badge' + (state === 'duplicate' ? ' ec-resolved-badge--duplicate' : '')}>
                {state === 'success' ? (
                  <svg viewBox="0 0 24 24" className="ec-tick-svg">
                    <path
                      className="ec-tick-path"
                      d="M20 6 9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2zm0-4h-2V7h2z" />
                  </svg>
                )}
              </div>
              <h2 className="ec-resolved-title">
                {state === 'success' ? "You're on the list!" : "You're already subscribed"}
              </h2>
              <p className="ec-resolved-text">
                {state === 'success'
                  ? 'Thanks — check your inbox for a confirmation shortly.'
                  : 'This email is already signed up on this site.'}
              </p>
              <div className="ec-sitevento-credit">
                <svg className="ec-bolt" viewBox="0 0 24 24">
                  <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                </svg>
                Powered by
                <a className="ec-brand-link" href="https://sitevento.com" target="_blank" rel="noopener noreferrer">
                  sitevento.com
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// CSS, ported from the approved standalone preview (styles/widgets/
// drafts/email-capture.html build) — same cartoonic ink-outline
// language as SupportChatWidget's CSS (2.5px ink borders, offset
// drop-shadow buttons, var(--sv-accent*) theming), as a plain
// JS string injected via <style> for the same reason support-chat's
// is: this renders inside a sandboxed iframe with no guarantee the
// app's own stylesheets are loaded, so the widget has to ship fully
// self-contained CSS.
const EMAIL_CAPTURE_CSS = `
  * { box-sizing: border-box; }

  .ec-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    background: transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 16px;
    opacity: 1;
    transition: opacity 0.25s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    pointer-events: none;
  }
  .ec-overlay.ec-hidden {
    opacity: 0;
    pointer-events: none;
  }

  .ec-card {
    position: relative;
    width: 100%;
    max-width: 420px;
    background: #ffffff;
    border: 2.5px solid #22201c;
    border-radius: 24px;
    box-shadow: 8px 8px 0 0 #22201c;
    overflow: hidden;
    transform: scale(1) translateY(0);
    transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    pointer-events: auto;
  }
  .ec-overlay.ec-hidden .ec-card {
    transform: scale(0.92) translateY(16px);
  }

  .ec-close {
    position: absolute;
    top: 14px;
    right: 14px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: 1.5px solid #22201c;
    background: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: #22201c;
    z-index: 2;
    transition: transform 0.15s ease, background 0.15s ease;
  }
  .ec-close:hover { background: #f6f2e7; transform: rotate(90deg); }
  .ec-close svg { width: 16px; height: 16px; fill: currentColor; }

  .ec-banner {
    position: relative;
    padding: 34px 28px 20px;
    background: linear-gradient(160deg, var(--sv-accent-soft) 0%, var(--sv-accent-soft-2) 100%);
    text-align: center;
    overflow: hidden;
  }

  .ec-banner-dot {
    position: absolute;
    border-radius: 50%;
    background: var(--sv-accent);
    border: 1.5px solid var(--sv-accent-ink);
    opacity: 0.7;
  }
  .ec-banner-dot.d1 { width: 14px; height: 14px; top: 14px; left: 28px; }
  .ec-banner-dot.d2 { width: 9px; height: 9px; top: 64px; right: 36px; background: #fff; }
  .ec-banner-dot.d3 { width: 10px; height: 10px; bottom: 14px; left: 54px; background: #fff; }

  .ec-badge {
    width: 60px;
    height: 60px;
    margin: 0 auto 14px;
    border-radius: 18px;
    background: var(--sv-accent);
    border: 2.5px solid var(--sv-accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 3px 3px 0 0 var(--sv-accent-ink);
  }
  .ec-badge svg { width: 28px; height: 28px; fill: var(--sv-accent-ink); }

  .ec-widget-label {
    font-size: 12px;
    font-weight: 700;
    color: var(--sv-accent-ink);
    opacity: 0.75;
    margin-bottom: 4px;
  }

  .ec-title {
    font-size: 23px;
    font-weight: 800;
    line-height: 1.22;
    margin: 0 0 8px;
    color: #22201c;
  }

  .ec-subtitle {
    font-size: 14.5px;
    line-height: 1.5;
    color: #51493e;
    margin: 0;
  }

  .ec-body { padding: 22px 28px 28px; }

  .ec-form { display: flex; flex-direction: column; gap: 10px; }

  .ec-input-row { position: relative; }

  .ec-input-row svg {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    width: 18px;
    height: 18px;
    fill: #8a8477;
    pointer-events: none;
  }

  .ec-input {
    width: 100%;
    padding: 15px 16px 15px 44px;
    border-radius: 14px;
    border: 2px solid #e8e4de;
    background: #f6f2e7;
    font-size: 15px;
    color: #22201c;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }
  .ec-input::placeholder { color: #a8a295; }
  .ec-input:focus {
    border-color: var(--sv-accent);
    background: #fff;
    box-shadow: 0 0 0 4px rgba(var(--sv-accent-rgb), 0.25);
  }
  .ec-input:disabled { opacity: 0.7; }
  .ec-input.ec-input-error { border-color: #b3432b; }

  .ec-error-text {
    font-size: 12.5px;
    color: #b3432b;
    font-weight: 600;
    margin: 0;
    padding-left: 4px;
  }

  .ec-submit {
    width: 100%;
    padding: 15px;
    margin-top: 4px;
    background: var(--sv-accent);
    color: var(--sv-accent-ink);
    border: 2px solid var(--sv-accent-ink);
    border-radius: 14px;
    font-size: 15.5px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    box-shadow: 3px 3px 0 0 var(--sv-accent-ink);
    transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease;
    min-height: 51px;
  }
  .ec-submit:hover:not(:disabled) { background: var(--sv-accent-hover); }
  .ec-submit:active:not(:disabled) {
    transform: translate(3px, 3px);
    box-shadow: 0 0 0 0 var(--sv-accent-ink);
  }
  .ec-submit:disabled { opacity: 0.85; cursor: default; }
  .ec-submit svg { width: 17px; height: 17px; fill: currentColor; }

  .ec-spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2.5px solid rgba(26, 46, 5, 0.25);
    border-top-color: var(--sv-accent-ink);
    animation: ec-spin 0.7s linear infinite;
  }
  @keyframes ec-spin { to { transform: rotate(360deg); } }

  .ec-owner-credit {
    text-align: center;
    font-size: 11px;
    color: #8a8477;
    margin-top: 4px;
  }

  .ec-fineprint {
    font-size: 11.5px;
    color: #8a8477;
    text-align: center;
    line-height: 1.4;
    margin: 14px 0 0;
  }

  .ec-sitevento-credit {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-top: 8px;
    font-size: 11px;
    font-weight: 600;
    color: #4b7a1f;
    opacity: 0.85;
  }
  .ec-bolt { width: 11px; height: 11px; fill: #4b7a1f; flex-shrink: 0; }
  .ec-brand-link { color: #22201c; font-weight: 800; text-decoration: none; }
  .ec-brand-link:hover { text-decoration: underline; }

  /* ---- Resolved state (success / duplicate) ---- */
  .ec-resolved {
    padding: 44px 28px 36px;
    text-align: center;
  }

  .ec-resolved-badge {
    width: 68px;
    height: 68px;
    margin: 0 auto 18px;
    border-radius: 50%;
    background: var(--sv-accent);
    border: 2.5px solid var(--sv-accent-ink);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 3px 3px 0 0 var(--sv-accent-ink);
    color: var(--sv-accent-ink);
    animation: ec-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .ec-resolved-badge--duplicate {
    background: #fff1e4;
    border-color: #e5832c;
    box-shadow: 3px 3px 0 0 #e5832c;
  }
  .ec-resolved-badge--duplicate svg { fill: #9a5313; }
  @keyframes ec-pop {
    0% { transform: scale(0.4); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .ec-resolved-badge svg:not(.ec-tick-svg) { width: 32px; height: 32px; }

  /* Animated checkmark: the path's full length is drawn via
     stroke-dasharray/stroke-dashoffset, then animated from fully
     hidden to fully revealed, so the tick visibly draws itself in
     rather than just popping into view — the badge's own ec-pop
     scale-in plays at the same time for a combined "pop + draw"
     entrance. 28 is comfortably longer than this path's actual
     length (~26) so it starts fully hidden with no visible sliver. */
  .ec-tick-svg { width: 32px; height: 32px; }
  .ec-tick-path {
    stroke-dasharray: 28;
    stroke-dashoffset: 28;
    animation: ec-draw-tick 0.45s 0.2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
  @keyframes ec-draw-tick {
    to { stroke-dashoffset: 0; }
  }

  .ec-resolved-title {
    font-size: 21px;
    font-weight: 800;
    margin: 0 0 8px;
    color: #22201c;
  }
  .ec-resolved-text {
    font-size: 14.5px;
    line-height: 1.5;
    color: #51493e;
    margin: 0 0 18px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ec-card, .ec-close, .ec-submit, .ec-resolved-badge, .ec-tick-path {
      animation: none !important;
      transition: none !important;
    }
    .ec-tick-path { stroke-dashoffset: 0; }
  }

  @media (max-width: 480px) {
    .ec-card { border-radius: 20px; }
    .ec-banner { padding: 28px 22px 16px; }
    .ec-body { padding: 18px 22px 22px; }
    .ec-title { font-size: 21px; }
  }
`;
