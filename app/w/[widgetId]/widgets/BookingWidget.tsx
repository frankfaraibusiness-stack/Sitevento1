'use client';

// app/w/[widgetId]/widgets/BookingWidget.tsx
//
// Booking Request — a floating "Book now" launcher that expands into
// a full-screen request form on open. This is the first component to
// actually implement the EXPANDABLE_WIDGET_IDS postMessage contract
// public/sitevento.js already reserved 'appointment-booking' for (see
// that file's EXPANDABLE_WIDGET_IDS + startExpandableWidgetBridge): on
// open/close this component posts
// `{ source: 'sitevento-widget', widgetId: 'appointment-booking', open, isMobile }`
// to window.parent, and the loader grows/shrinks THIS SAME iframe
// between its collapsed 336x480 corner box and a full-viewport frame
// accordingly — never a second overlay, never pointer-events:none, so
// the rest of the host page can always scroll and be clicked while
// this widget is collapsed, and only the modal's own backdrop (not
// the whole page) is interactive while it's open.
//
// Deliberately BUTTON-BASED, not time-based: there is no calendar, no
// date picker, no time-slot grid anywhere in this component. A
// visitor picks (optionally) a service, fills in their own details,
// and submits — the business calls/emails them back to actually
// confirm a time. `openHours` (lib/widgets.ts's openHoursFromConfig)
// is pure DISPLAY information so a visitor can see when the business
// is actually open before they ask, and never gates whether the form
// can be submitted — the exact same "Submitted — we'll be in touch
// soon" confirmation shows regardless of current time or day.
//
// Submits to POST /api/appointment-booking ({ siteId, name, email?,
// phone?, service?, message?, visitorId }), which writes into this
// site's `leads` subcollection tagged source:'appointment-booking' —
// see that route's header for exactly what it validates and stores.
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  DAYS_OF_WEEK,
  DEFAULT_OPEN_HOURS,
  openHoursFromConfig,
  servicesFromConfig,
  type BookingService,
  type DayOfWeek,
} from '@/lib/widgets';

export interface BookingConfig {
  heading?: string;
  subtext?: string;
  launcherLabel?: string;
  side?: 'left' | 'right';
  services?: unknown; // BookingService[] | JSON string — see servicesFromConfig
  openHours?: unknown; // Record<DayOfWeek, DayHours> | JSON string — see openHoursFromConfig
  contactMode?: 'email' | 'phone' | 'both';
  currency?: string;
  accentColor?: string;
  widgetLabel?: string;
  brandMode?: 'none' | 'text' | 'logo';
  brandText?: string;
  brandLogoUrl?: string;
}

export interface BookingWidgetProps {
  siteId: string;
  visitorId: string;
  pageUrl?: string;
  config: Record<string, unknown>;
}

const DEFAULT_ACCENT = '#a3e635';
const DEFAULT_HEADING = 'Book an appointment';
const DEFAULT_SUBTEXT = "Tell us a bit about what you need and we'll get back to you to confirm a time.";
const DEFAULT_LAUNCHER_LABEL = 'Book now';

const DAY_LABEL: Record<DayOfWeek, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

// JS's Date#getDay() is 0=Sunday..6=Saturday; DAYS_OF_WEEK is
// Monday-first (matches how a business owner reads a week), so this
// maps one onto the other rather than assuming they already agree.
const JS_DAY_TO_DAY_OF_WEEK: DayOfWeek[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function todayKey(): DayOfWeek {
  return JS_DAY_TO_DAY_OF_WEEK[new Date().getDay()];
}

// "09:00" -> "9:00 AM" — display only; the stored value stays 24h.
function formatTime(hhmm: string): string {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr, 10);
  if (!Number.isFinite(h)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr} ${period}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[\d\s().-]{7,20}$/;

function isValidHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

// Same mix()/accentCssVars() shape as EmailCaptureWidget.tsx /
// SupportChatWidget.tsx — kept as its own copy here for the same
// reason noted in both: cheap, dependency-free math that's cheaper to
// duplicate once per widget than to introduce a shared module into a
// bundle that ships to every visitor's browser.
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

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';

export function BookingWidget({ siteId, visitorId, pageUrl, config }: BookingWidgetProps) {
  const cfg = config as BookingConfig;
  const heading = (cfg.heading && cfg.heading.trim()) || DEFAULT_HEADING;
  const subtext = (cfg.subtext && cfg.subtext.trim()) || DEFAULT_SUBTEXT;
  const launcherLabel = (cfg.launcherLabel && cfg.launcherLabel.trim()) || DEFAULT_LAUNCHER_LABEL;
  const side = cfg.side === 'left' ? 'left' : 'right';
  const contactMode = cfg.contactMode === 'email' || cfg.contactMode === 'phone' ? cfg.contactMode : 'both';
  const currency = (cfg.currency && cfg.currency.trim()) || '$';
  const widgetLabel = (cfg.widgetLabel && cfg.widgetLabel.trim()) || '';
  const brandMode = cfg.brandMode || 'none';
  const brandText = cfg.brandText || '';
  const accentVars = accentCssVars(cfg.accentColor);

  const services = useMemo(() => servicesFromConfig(config), [config]);
  const openHours = useMemo(() => openHoursFromConfig(config), [config]);
  const today = useMemo(() => todayKey(), []);

  const [open, setOpen] = useState(false);
  const [selectedServiceIdx, setSelectedServiceIdx] = useState<number | null>(services.length === 1 ? 0 : null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  // When contactMode === 'both', the visitor picks which field(s) they
  // want to fill in — defaults to email since that's the most
  // universally reachable method, but either works alone.
  const [contactChoice, setContactChoice] = useState<'email' | 'phone' | 'both'>(
    contactMode === 'phone' ? 'phone' : contactMode === 'email' ? 'email' : 'email'
  );
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SubmitState>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const selectedService: BookingService | null = selectedServiceIdx !== null ? services[selectedServiceIdx] : null;
  const total = selectedService ? selectedService.price : 0;

  // Posts the open/close signal to the loader — see this file's
  // header for the exact contract. isMobile is a best-effort viewport
  // read (never user-agent sniffing) the loader can optionally use;
  // harmless if it ignores the field entirely.
  const notifyParent = useCallback((isOpen: boolean) => {
    try {
      window.parent.postMessage(
        {
          source: 'sitevento-widget',
          widgetId: 'appointment-booking',
          open: isOpen,
          isMobile: typeof window !== 'undefined' && window.innerWidth < 640,
        },
        '*'
      );
    } catch {
      // Not embedded in an iframe (standalone preview) — nothing to
      // notify; the modal still opens/closes fine on its own.
    }
  }, []);

  const openModal = useCallback(() => {
    setOpen(true);
    notifyParent(true);
  }, [notifyParent]);

  const closeModal = useCallback(() => {
    setOpen(false);
    notifyParent(false);
  }, [notifyParent]);

  // Lets a hand-placed custom trigger (e.g. the owner's own
  // `<button data-sitevento-widget-open="appointment-booking">`
  // somewhere else on their page, outside this widget's own iframe)
  // open the modal too — the owner's page can't reach directly into
  // this iframe, so it dispatches a postMessage of its own instead;
  // this is the one message type this component LISTENS for (as
  // opposed to the one it SENDS above).
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event && event.data;
      if (data && data.source === 'sitevento-host' && data.action === 'open-appointment-booking') {
        openModal();
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [openModal]);

  // Esc closes the modal, same as the close button — doesn't touch
  // the host page at all (this listener is scoped to this iframe's
  // own window/document only).
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, closeModal]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      const trimmedName = name.trim();
      if (!trimmedName) {
        setState('error');
        setErrorMessage('Enter your name.');
        return;
      }

      const wantsEmail = contactMode === 'email' || (contactMode === 'both' && (contactChoice === 'email' || contactChoice === 'both'));
      const wantsPhone = contactMode === 'phone' || (contactMode === 'both' && (contactChoice === 'phone' || contactChoice === 'both'));

      const trimmedEmail = email.trim();
      const trimmedPhone = phone.trim();

      if (wantsEmail && !EMAIL_RE.test(trimmedEmail)) {
        setState('error');
        setErrorMessage('Enter a valid email address.');
        return;
      }
      if (wantsPhone && !PHONE_RE.test(trimmedPhone)) {
        setState('error');
        setErrorMessage('Enter a valid phone number.');
        return;
      }
      if (!wantsEmail && !wantsPhone) {
        setState('error');
        setErrorMessage('Enter an email or phone number so we can reach you.');
        return;
      }

      setState('submitting');
      setErrorMessage('');

      try {
        const res = await fetch('/api/appointment-booking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            visitorId,
            name: trimmedName,
            email: wantsEmail ? trimmedEmail : '',
            phone: wantsPhone ? trimmedPhone : '',
            service: selectedService ? selectedService.name : '',
            message: message.trim(),
            pageUrl,
          }),
        });
        const data = await res.json().catch(() => null);

        if (data && data.ok) {
          setState('success');
          return;
        }

        setState('error');
        setErrorMessage(
          data && data.reason === 'invalid email'
            ? 'Enter a valid email address.'
            : data && data.reason === 'invalid phone'
              ? 'Enter a valid phone number.'
              : 'Something went wrong — please try again.'
        );
      } catch {
        setState('error');
        setErrorMessage('Something went wrong — please try again.');
      }
    },
    [name, email, phone, message, selectedService, contactMode, contactChoice, siteId, visitorId, pageUrl]
  );

  const resetAndClose = useCallback(() => {
    closeModal();
    // Reset for next time, after the close animation has room to
    // play — a visitor reopening later should see a fresh form, not
    // their last submission still sitting filled in.
    window.setTimeout(() => {
      setState('idle');
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setSelectedServiceIdx(services.length === 1 ? 0 : null);
    }, 300);
  }, [closeModal, services.length]);

  const showForm = state === 'idle' || state === 'submitting' || state === 'error';

  return (
    <div style={accentVars as CSSProperties}>
      <style>{BOOKING_CSS}</style>

      <button
        type="button"
        className={'bk-launcher bk-launcher--' + side + (open ? ' bk-hidden' : '')}
        onClick={openModal}
      >
        <svg viewBox="0 0 24 24" className="bk-launcher-icon">
          <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V9h14v11zM7 11h5v5H7z" />
        </svg>
        {launcherLabel}
      </button>

      <div className={'bk-overlay' + (open ? ' bk-open' : '')}>
        <div className="bk-card" role="dialog" aria-modal="true" aria-labelledby="bk-title">
          <button type="button" className="bk-close" aria-label="Close" onClick={resetAndClose}>
            <svg viewBox="0 0 24 24">
              <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.41 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.29-6.3z" />
            </svg>
          </button>

          <div className="bk-scroll">
            {showForm && (
              <>
                <div className="bk-header">
                  {widgetLabel && <div className="bk-widget-label">{widgetLabel}</div>}
                  <h2 className="bk-title" id="bk-title">
                    {heading}
                  </h2>
                  <p className="bk-subtitle">{subtext}</p>
                </div>

                <div className="bk-body">
                  {services.length > 0 && (
                    <div className="bk-section">
                      <div className="bk-section-label">What do you need?</div>
                      <div className="bk-service-list">
                        {services.map((s, i) => (
                          <button
                            type="button"
                            key={s.name + i}
                            className={'bk-service' + (selectedServiceIdx === i ? ' bk-service--selected' : '')}
                            onClick={() => setSelectedServiceIdx(selectedServiceIdx === i ? null : i)}
                          >
                            <span className="bk-service-name">{s.name}</span>
                            <span className="bk-service-price">
                              {s.price > 0 ? (
                                <>
                                  {currency}
                                  {s.price}
                                  {s.priceUnit ? <span className="bk-service-unit">{s.priceUnit}</span> : null}
                                </>
                              ) : (
                                <span className="bk-service-price--none">{currency}0</span>
                              )}
                            </span>
                          </button>
                        ))}
                      </div>
                      <div className="bk-total-row">
                        <span>Estimated total</span>
                        <span className="bk-total-amount">
                          {currency}
                          {total > 0 ? total : 0}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="bk-section">
                    <div className="bk-section-label">Opening hours</div>
                    <div className="bk-hours-list">
                      {DAYS_OF_WEEK.map((day) => {
                        const hours = openHours[day] || DEFAULT_OPEN_HOURS[day];
                        const isToday = day === today;
                        return (
                          <div key={day} className={'bk-hours-row' + (isToday ? ' bk-hours-row--today' : '')}>
                            <span className="bk-hours-day">
                              {DAY_LABEL[day]}
                              {isToday && <span className="bk-today-dot" aria-hidden="true" />}
                            </span>
                            <span className={'bk-hours-value' + (hours.closed ? ' bk-hours-value--closed' : '')}>
                              {hours.closed ? 'Closed' : `${formatTime(hours.open)} – ${formatTime(hours.close)}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <form className="bk-form" onSubmit={handleSubmit}>
                    <div className="bk-section-label">Your details</div>

                    <input
                      className="bk-input"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      disabled={state === 'submitting'}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (state === 'error') setState('idle');
                      }}
                      required
                    />

                    {contactMode === 'both' && (
                      <div className="bk-contact-toggle" role="group" aria-label="Contact method">
                        {(['email', 'phone', 'both'] as const).map((opt) => (
                          <button
                            type="button"
                            key={opt}
                            className={'bk-toggle-btn' + (contactChoice === opt ? ' bk-toggle-btn--active' : '')}
                            onClick={() => setContactChoice(opt)}
                          >
                            {opt === 'email' ? 'Email' : opt === 'phone' ? 'Phone' : 'Both'}
                          </button>
                        ))}
                      </div>
                    )}

                    {(contactMode === 'email' || (contactMode === 'both' && (contactChoice === 'email' || contactChoice === 'both'))) && (
                      <input
                        className={'bk-input' + (state === 'error' && !EMAIL_RE.test(email.trim()) && email ? ' bk-input-error' : '')}
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
                      />
                    )}

                    {(contactMode === 'phone' || (contactMode === 'both' && (contactChoice === 'phone' || contactChoice === 'both'))) && (
                      <input
                        className="bk-input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder="Phone number"
                        value={phone}
                        disabled={state === 'submitting'}
                        onChange={(e) => {
                          setPhone(e.target.value);
                          if (state === 'error') setState('idle');
                        }}
                      />
                    )}

                    <textarea
                      className="bk-input bk-textarea"
                      placeholder="Anything else we should know? (optional)"
                      value={message}
                      disabled={state === 'submitting'}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                    />

                    {state === 'error' && <p className="bk-error-text">{errorMessage}</p>}

                    <button type="submit" className="bk-submit" disabled={state === 'submitting'}>
                      {state === 'submitting' ? (
                        <span className="bk-spinner" aria-hidden="true" />
                      ) : (
                        <>
                          Request booking
                          <svg viewBox="0 0 24 24">
                            <path d="M4 12h14M13 6l6 6-6 6" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>

                  {brandMode === 'text' && brandText ? <div className="bk-owner-credit">{brandText}</div> : null}

                  <div className="bk-sitevento-credit">
                    <svg className="bk-bolt" viewBox="0 0 24 24">
                      <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                    </svg>
                    Powered by
                    <a className="bk-brand-link" href="https://sitevento.com" target="_blank" rel="noopener noreferrer">
                      sitevento.com
                    </a>
                  </div>
                </div>
              </>
            )}

            {state === 'success' && (
              <div className="bk-resolved">
                <div className="bk-resolved-badge">
                  <svg viewBox="0 0 24 24" className="bk-tick-svg">
                    <path
                      className="bk-tick-path"
                      d="M20 6 9 17l-5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h2 className="bk-resolved-title">Submitted — we'll be in touch soon</h2>
                <p className="bk-resolved-text">
                  Thanks{name.trim() ? `, ${name.trim().split(' ')[0]}` : ''} — we've received your request and will reach out
                  to confirm.
                </p>
                <button type="button" className="bk-submit bk-resolved-close" onClick={resetAndClose}>
                  Close
                </button>
                <div className="bk-sitevento-credit">
                  <svg className="bk-bolt" viewBox="0 0 24 24">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
                  </svg>
                  Powered by
                  <a className="bk-brand-link" href="https://sitevento.com" target="_blank" rel="noopener noreferrer">
                    sitevento.com
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// CSS, in the same cartoonic ink-outline language as EmailCaptureWidget
// /SupportChatWidget's CSS (2.5px ink borders, offset drop-shadow
// buttons, var(--sv-accent*) theming) — a plain JS string injected via
// <style> because this renders inside a sandboxed iframe with no
// guarantee the app's own stylesheets are loaded.
const BOOKING_CSS = `
  * { box-sizing: border-box; }

  .bk-launcher {
    position: fixed;
    bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--sv-accent);
    color: var(--sv-accent-ink);
    border: 2.5px solid var(--sv-accent-ink);
    border-radius: 999px;
    padding: 13px 22px 13px 18px;
    font-size: 14px;
    font-weight: 800;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    cursor: pointer;
    box-shadow: 4px 4px 0 0 var(--sv-accent-ink);
    transition: transform 0.12s ease, box-shadow 0.12s ease, opacity 0.2s ease;
    z-index: 998;
  }
  .bk-launcher--right { right: 20px; }
  .bk-launcher--left { left: 20px; }
  .bk-launcher:hover { transform: translate(-1px, -1px); box-shadow: 5px 5px 0 0 var(--sv-accent-ink); }
  .bk-launcher:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 0 var(--sv-accent-ink); }
  .bk-launcher.bk-hidden { opacity: 0; pointer-events: none; transform: scale(0.9); }
  .bk-launcher-icon { width: 18px; height: 18px; fill: var(--sv-accent-ink); flex-shrink: 0; }

  .bk-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100dvh;
    background: rgba(34, 32, 28, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    padding: 16px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  .bk-overlay.bk-open { opacity: 1; pointer-events: auto; }

  .bk-card {
    position: relative;
    width: 100%;
    max-width: 460px;
    max-height: min(680px, calc(100% - 8px));
    background: #ffffff;
    border: 2.5px solid #22201c;
    border-radius: 24px;
    box-shadow: 8px 8px 0 0 #22201c;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transform: scale(0.94) translateY(14px);
    transition: transform 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  .bk-overlay.bk-open .bk-card { transform: scale(1) translateY(0); }

  .bk-scroll { overflow-y: auto; }

  .bk-close {
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
  .bk-close:hover { background: #d6cef9; transform: rotate(90deg); }
  .bk-close svg { width: 16px; height: 16px; fill: currentColor; }

  .bk-header {
    position: relative;
    padding: 30px 48px 16px 28px;
    background: linear-gradient(160deg, var(--sv-accent-soft) 0%, var(--sv-accent-soft-2) 100%);
  }
  .bk-widget-label { font-size: 12px; font-weight: 700; color: var(--sv-accent-ink); opacity: 0.75; margin-bottom: 4px; }
  .bk-title { font-size: 22px; font-weight: 800; line-height: 1.2; margin: 0 0 6px; color: #22201c; }
  .bk-subtitle { font-size: 14px; line-height: 1.5; color: #51493e; margin: 0; }

  .bk-body { padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 18px; }

  .bk-section-label {
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #8a8477;
    margin-bottom: 8px;
  }

  .bk-service-list { display: flex; flex-direction: column; gap: 8px; }
  .bk-service {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    text-align: left;
    background: #fff;
    border: 2px solid #e8e4de;
    border-radius: 12px;
    padding: 12px 14px;
    cursor: pointer;
    font-family: inherit;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .bk-service:hover { border-color: var(--sv-accent); }
  .bk-service--selected { border-color: var(--sv-accent-ink); background: var(--sv-accent-soft); }
  .bk-service-name { font-size: 14px; font-weight: 700; color: #22201c; }
  .bk-service-price { font-size: 14px; font-weight: 800; color: #22201c; white-space: nowrap; }
  .bk-service-price--none { color: #8a8477; font-weight: 600; }
  .bk-service-unit { font-size: 11px; font-weight: 600; color: #8a8477; margin-left: 2px; }

  .bk-total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1.5px dashed #e8e4de;
    font-size: 13px;
    font-weight: 700;
    color: #51493e;
  }
  .bk-total-amount { font-size: 17px; font-weight: 800; color: #22201c; }

  .bk-hours-list { display: flex; flex-direction: column; gap: 4px; }
  .bk-hours-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 10px;
    border-radius: 8px;
    font-size: 13px;
    color: #51493e;
  }
  .bk-hours-row--today { background: var(--sv-accent-soft); font-weight: 700; color: #22201c; }
  .bk-hours-day { display: flex; align-items: center; gap: 6px; }
  .bk-today-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--sv-accent-ink); display: inline-block; }
  .bk-hours-value--closed { color: #a8a295; }

  .bk-form { display: flex; flex-direction: column; gap: 10px; }

  .bk-input {
    width: 100%;
    padding: 13px 16px;
    border-radius: 12px;
    border: 2px solid #e8e4de;
    background: #faf9f6;
    font-size: 14.5px;
    font-family: inherit;
    color: #22201c;
    outline: none;
    transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }
  .bk-input::placeholder { color: #a8a295; }
  .bk-input:focus {
    border-color: var(--sv-accent);
    background: #fff;
    box-shadow: 0 0 0 4px rgba(var(--sv-accent-rgb), 0.25);
  }
  .bk-input:disabled { opacity: 0.7; }
  .bk-input.bk-input-error { border-color: #b3432b; }
  .bk-textarea { resize: vertical; min-height: 64px; font-family: inherit; }

  .bk-contact-toggle {
    display: flex;
    gap: 6px;
    background: #f1efe9;
    border-radius: 10px;
    padding: 3px;
  }
  .bk-toggle-btn {
    flex: 1;
    padding: 8px 10px;
    border: none;
    border-radius: 8px;
    background: transparent;
    font-size: 12.5px;
    font-weight: 700;
    color: #8a8477;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .bk-toggle-btn--active { background: #fff; color: #22201c; box-shadow: 0 1px 3px rgba(34,32,28,0.15); }

  .bk-error-text { font-size: 12.5px; color: #b3432b; font-weight: 600; margin: 0; padding-left: 4px; }

  .bk-submit {
    width: 100%;
    padding: 15px;
    margin-top: 4px;
    background: var(--sv-accent);
    color: var(--sv-accent-ink);
    border: 2px solid var(--sv-accent-ink);
    border-radius: 14px;
    font-size: 15.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    box-shadow: 3px 3px 0 0 var(--sv-accent-ink);
    transition: transform 0.12s ease, box-shadow 0.12s ease, background 0.15s ease;
    min-height: 51px;
  }
  .bk-submit:hover:not(:disabled) { background: var(--sv-accent-hover); }
  .bk-submit:active:not(:disabled) { transform: translate(3px, 3px); box-shadow: 0 0 0 0 var(--sv-accent-ink); }
  .bk-submit:disabled { opacity: 0.85; cursor: default; }
  .bk-submit svg { width: 17px; height: 17px; fill: currentColor; }

  .bk-spinner {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 2.5px solid rgba(26, 46, 5, 0.25);
    border-top-color: var(--sv-accent-ink);
    animation: bk-spin 0.7s linear infinite;
  }
  @keyframes bk-spin { to { transform: rotate(360deg); } }

  .bk-owner-credit { text-align: center; font-size: 11px; color: #8a8477; margin-top: 2px; }

  .bk-sitevento-credit {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-top: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #4b7a1f;
    opacity: 0.85;
  }
  .bk-bolt { width: 11px; height: 11px; fill: #4b7a1f; flex-shrink: 0; }
  .bk-brand-link { color: #22201c; font-weight: 800; text-decoration: none; }
  .bk-brand-link:hover { text-decoration: underline; }

  /* ---- Resolved (success) state ---- */
  .bk-resolved { padding: 44px 28px 32px; text-align: center; }

  .bk-resolved-badge {
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
    animation: bk-pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
  @keyframes bk-pop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

  .bk-tick-svg { width: 32px; height: 32px; }
  .bk-tick-path {
    stroke-dasharray: 28;
    stroke-dashoffset: 28;
    animation: bk-draw-tick 0.45s 0.2s cubic-bezier(0.65, 0, 0.35, 1) forwards;
  }
  @keyframes bk-draw-tick { to { stroke-dashoffset: 0; } }

  .bk-resolved-title { font-size: 20px; font-weight: 800; margin: 0 0 8px; color: #22201c; }
  .bk-resolved-text { font-size: 14px; line-height: 1.5; color: #51493e; margin: 0 0 20px; }
  .bk-resolved-close { margin-bottom: 18px; }

  @media (prefers-reduced-motion: reduce) {
    .bk-card, .bk-close, .bk-submit, .bk-launcher, .bk-resolved-badge, .bk-tick-path {
      animation: none !important;
      transition: none !important;
    }
    .bk-tick-path { stroke-dashoffset: 0; }
  }

  @media (max-width: 480px) {
    .bk-card { border-radius: 20px; max-height: calc(100% - 8px); }
    .bk-header { padding: 26px 44px 14px 20px; }
    .bk-body { padding: 16px 20px 20px; }
    .bk-title { font-size: 20px; }
  }
`;
