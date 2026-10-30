'use client';

// Appointment & Demo Booking. Ported from
// widget-drafts/appointment-booking.html. Multi-step flow: choose a
// service -> pick a date/time -> enter details -> status. Built for
// agencies/consultants/SaaS "book a demo" use cases.
//
// Key behavior preserved from the draft: a slot is shown as
// "Requested \u00B7 not yet confirmed" immediately on submit, and only
// flips to "Confirmed" after a simulated backend round-trip
// (simulateBackendConfirm below) — this component never shows a slot
// as booked before a backend would actually confirm it. Availability
// is "fetched" per selected date with a loading state (simulated
// here, fetchAvailability below), modeling where a real
// calendar/freebusy integration would plug in.
//
// `services` is config-driven here (the draft's example 3 services
// are used as the default) rather than hardcoded, so a site owner can
// define their own services from the designer. Availability and
// booking both call /api/appointment-booking: a real per-date read of
// taken slots, and a transactional claim-or-conflict at submit time
// that closes the race between two visitors viewing the same open
// slot — a conflict re-opens the time-picker with fresh availability
// instead of a false confirmation. A successful booking writes a lead
// into the same `leads` collection email-capture/contact-us use.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'appointment-booking')
// and WidgetRenderer.tsx's switch.
import { useEffect, useMemo, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
  pageUrl?: string;
}

function dateKeyFor(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

interface Service {
  id: string;
  name: string;
  meta: string;
  duration: string;
}

const DEFAULT_SERVICES: Service[] = [
  { id: 'demo', name: '30-min product demo', meta: 'Walkthrough with a specialist', duration: '30 min' },
  { id: 'consult', name: 'Strategy consultation', meta: 'For teams evaluating a plan', duration: '45 min' },
  { id: 'onboarding', name: 'Onboarding session', meta: 'For existing customers', duration: '20 min' },
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const ALL_SLOT_TIMES = ['9:00 AM', '9:30 AM', '10:00 AM', '11:00 AM', '1:00 PM', '1:30 PM', '2:30 PM', '3:00 PM', '4:00 PM'];
const EMAIL_RE = /\S+@\S+\.\S+/;

interface Slot {
  time: string;
  taken: boolean;
}

type BookingStatus = 'pending' | 'confirmed';

export function AppointmentBookingWidget({ config, siteId, visitorId, pageUrl }: Props) {
  const title = str(config.heading, 'Book a demo');
  const launcherLabel = str(config.launcherLabel, '\u{1F4C5} Book a demo');
  const services = DEFAULT_SERVICES;

  const dates = useMemo(() => {
    const out: Date[] = [];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0); // 0 service, 1 date/time, 2 details, 3 status
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [dateIdx, setDateIdx] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [slotsForDate, setSlotsForDate] = useState<Slot[] | null>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<BookingStatus>('pending');
  const [confirmedSub, setConfirmedSub] = useState('');
  const [paused, setPaused] = useState(false);
  const isMobile = useIsMobile();

  // ── Tell the host page when the modal opens/closes ──────────────────
  // Same reasoning as SpinRewardWidget.tsx: this widget's modal is
  // `position:fixed;inset:0` INSIDE this iframe, meant to cover the
  // whole screen — but the iframe sitevento.js mounts for a corner
  // widget is a fixed 336x480 box, so without this the modal is
  // clipped to that box instead of the real screen. sitevento.js
  // listens for this message shape and grows this iframe to full-
  // viewport only while open is true. isMobile tells it whether to use
  // the shared edge-to-edge/sticky-header layout or this widget's own
  // desktop-sized centered card.
  useEffect(() => {
    try {
      window.parent.postMessage({ source: 'sitevento-widget', widgetId: 'appointment-booking', open, isMobile }, '*');
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

  function openModal() {
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
  }

  // Real per-date availability read from /api/appointment-booking —
  // never a static client-side list, since availability can change
  // between page load and click.
  async function fetchAvailability(idx: number) {
    setLoadingAvailability(true);
    setSlotsForDate(null);
    try {
      const res = await fetch('/api/appointment-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, action: 'availability', dateKey: dateKeyFor(dates[idx]) }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      setSlotsForDate(data.ok && Array.isArray(data.slots) ? data.slots : ALL_SLOT_TIMES.map((time) => ({ time, taken: false })));
    } catch {
      setSlotsForDate(ALL_SLOT_TIMES.map((time) => ({ time, taken: false })));
    } finally {
      setLoadingAvailability(false);
    }
  }

  function selectDate(idx: number) {
    setDateIdx(idx);
    setSlot(null);
    fetchAvailability(idx);
  }

  function selectedService(): Service | undefined {
    return services.find((s) => s.id === serviceId);
  }

  const canContinue =
    step === 0
      ? !!serviceId
      : step === 1
      ? dateIdx !== null && !!slot
      : step === 2
      ? name.trim().length > 0 && EMAIL_RE.test(email.trim())
      : false;

  function goBack() {
    if (step > 0) setStep(step - 1);
  }

  function goNext() {
    if (step < 2) {
      setStep(step + 1);
    } else if (step === 2) {
      submitBooking();
    }
  }

  async function submitBooking() {
    setStep(3);
    setStatus('pending');
    setPaused(false);
    // ---- IMPORTANT: no slot is ever shown as booked here. ----
    // The UI holds in the "Requested · not yet confirmed" state until
    // the real response comes back from /api/appointment-booking,
    // which re-checks the slot against stored bookings at write time
    // and only returns confirmed:true on a successful claim. A
    // conflict response re-opens the time-slot step with refreshed
    // availability, rather than silently guessing.
    const svc = selectedService();
    try {
      const res = await fetch('/api/appointment-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          action: 'book',
          dateKey: dateIdx !== null ? dateKeyFor(dates[dateIdx]) : '',
          time: slot,
          serviceId,
          name: name.trim(),
          email: email.trim(),
          notes: notes.trim(),
          pageUrl: pageUrl || '',
          visitorId: visitorId || '',
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));

      if (data.code === 'PAUSED') {
        setPaused(true);
        setStep(2);
        return;
      }

      if (data.ok && data.confirmed) {
        setConfirmedSub(
          `Your ${(svc?.name || 'appointment').toLowerCase()} is set for ${slot}. A calendar invite and reminder are on their way to ${email}.`
        );
        setStatus('confirmed');
      } else {
        // Slot taken in the brief window between selection and submit.
        setStep(1);
        if (Array.isArray(data.slots)) setSlotsForDate(data.slots);
        else if (dateIdx !== null) fetchAvailability(dateIdx);
        setSlot(null);
      }
    } catch {
      setStep(1);
      if (dateIdx !== null) fetchAvailability(dateIdx);
      setSlot(null);
    }
  }

  function buildSummary(): string {
    const svc = selectedService();
    if (!svc || dateIdx === null) return '';
    const d = dates[dateIdx];
    const dateLabel = `${d.getMonth() + 1}/${d.getDate()}`;
    return `${svc.name} (${svc.duration}) \u2014 ${dateLabel} at ${slot}`;
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
          padding: '13px 20px 13px 16px',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(26,31,10,0.22)',
        }}
      >
        {launcherLabel}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Book an appointment"
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
                  width: 420,
                  maxWidth: 'calc(100vw - 48px)',
                  maxHeight: 'calc(100vh - 48px)',
                  borderRadius: 18,
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

          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
            {/* Sticky header: title on the left, close on the right —
                same layout as every other full-screen widget here. */}
            <header
              style={{
                position: 'sticky',
                top: 0,
                flexShrink: 0,
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px)) 18px 14px' : '18px 20px 14px',
                background: 'rgba(253,253,249,0.9)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid #eef1e6',
              }}
            >
              <div style={{ fontSize: isMobile ? 17 : 15, fontWeight: 800, color: '#1a1f0a', letterSpacing: '-0.3px' }}>{title}</div>
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

            <div style={{ flex: 1, overflowY: 'auto', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', gap: 6, padding: '14px 20px 0' }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 3,
                    borderRadius: 2,
                    background: i === step || i < step ? '#6fae3f' : '#e5ead9',
                    transition: 'background 200ms ease',
                  }}
                />
              ))}
            </div>

            <div style={{ padding: '18px 20px 20px' }}>
              {step === 0 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 10 }}>
                    Choose a service
                  </div>
                  {services.map((svc) => {
                    const selected = svc.id === serviceId;
                    return (
                      <div
                        key={svc.id}
                        onClick={() => setServiceId(svc.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          width: '100%',
                          textAlign: 'left',
                          background: selected ? '#f3f9ea' : '#fff',
                          border: `1.5px solid ${selected ? '#6fae3f' : '#eef1e6'}`,
                          borderRadius: 10,
                          padding: '12px 14px',
                          marginBottom: 8,
                          cursor: 'pointer',
                          boxSizing: 'border-box',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{svc.name}</div>
                          <div style={{ fontSize: 11.5, color: '#8a9480', marginTop: 2 }}>{svc.meta}</div>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: '#6fae3f',
                            background: '#e9f5db',
                            borderRadius: 6,
                            padding: '3px 7px',
                            flexShrink: 0,
                          }}
                        >
                          {svc.duration}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {step === 1 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 10 }}>
                    Pick a date
                  </div>
                  <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 16 }}>
                    {dates.map((d, idx) => {
                      const selected = idx === dateIdx;
                      return (
                        <div
                          key={idx}
                          onClick={() => selectDate(idx)}
                          style={{
                            flexShrink: 0,
                            width: 54,
                            textAlign: 'center',
                            background: selected ? '#f3f9ea' : '#fff',
                            border: `1.5px solid ${selected ? '#6fae3f' : '#eef1e6'}`,
                            borderRadius: 10,
                            padding: '9px 4px',
                            cursor: 'pointer',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ fontSize: 10, color: '#8a9480', textTransform: 'uppercase' }}>{DAY_NAMES[d.getDay()]}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{d.getDate()}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 10 }}>
                    Pick a time
                  </div>
                  {loadingAvailability || !slotsForDate ? (
                    <div style={{ fontSize: 12, color: '#8a9480', padding: '14px 0', textAlign: 'center' }}>
                      {dateIdx === null ? 'Pick a date to see available times.' : 'Checking live availability\u2026'}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                      {slotsForDate.map((s) => {
                        const selected = s.time === slot;
                        return (
                          <div
                            key={s.time}
                            onClick={() => !s.taken && setSlot(s.time)}
                            style={{
                              background: selected ? '#f3f9ea' : '#fff',
                              border: `1.5px solid ${selected ? '#6fae3f' : '#eef1e6'}`,
                              borderRadius: 8,
                              padding: '9px 4px',
                              fontSize: 12.5,
                              fontWeight: 600,
                              textAlign: 'center',
                              cursor: s.taken ? 'not-allowed' : 'pointer',
                              opacity: s.taken ? 0.4 : 1,
                              textDecoration: s.taken ? 'line-through' : 'none',
                              boxSizing: 'border-box',
                            }}
                          >
                            {s.time}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#9aa38a', marginTop: 10, lineHeight: 1.5 }}>
                    Times shown in your local timezone. Grayed-out times are already booked.
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#7fa84a', marginBottom: 10 }}>
                    Your details
                  </div>
                  <div style={{ background: '#f3f9ea', border: '1px solid #d9ecc0', borderRadius: 10, padding: '12px 14px', fontSize: 12.5, marginBottom: 16, lineHeight: 1.6 }}>
                    {buildSummary()}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#3a4230' }}>Full name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Jordan Lee"
                      style={{ width: '100%', border: '1.5px solid #e5ead9', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#3a4230' }}>Work email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jordan@company.com"
                      style={{ width: '100%', border: '1.5px solid #e5ead9', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#3a4230' }}>Anything we should know? (optional)</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Team size, current tools, specific questions\u2026"
                      style={{ width: '100%', border: '1.5px solid #e5ead9', borderRadius: 8, padding: '9px 11px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 60, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div style={{ textAlign: 'center', padding: '10px 4px 4px' }}>
                  {status === 'pending' ? (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#fdf3d8' }}>
                        {'\u23F3'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Request sent</div>
                      <div style={{ fontSize: 12.5, color: '#6b7560', lineHeight: 1.6, marginBottom: 4 }}>
                        We're confirming your slot with the calendar \u2014 this usually takes a few seconds.
                      </div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          borderRadius: 999,
                          marginTop: 12,
                          background: '#fdf3d8',
                          color: '#9a7b1f',
                        }}
                      >
                        Requested \u00B7 not yet confirmed
                      </span>
                    </>
                  ) : (
                    <>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: '#e9f5db' }}>
                        {'\u2705'}
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>You're booked</div>
                      <div style={{ fontSize: 12.5, color: '#6b7560', lineHeight: 1.6, marginBottom: 4 }}>{confirmedSub}</div>
                      <span
                        style={{
                          display: 'inline-block',
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                          padding: '4px 10px',
                          borderRadius: 999,
                          marginTop: 12,
                          background: '#e9f5db',
                          color: '#4d7d2a',
                        }}
                      >
                        Confirmed
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
            </div>

            {step !== 3 && (
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  gap: 8,
                  padding: isMobile ? '12px 18px calc(16px + env(safe-area-inset-bottom, 0px))' : '4px 20px 20px',
                  borderTop: isMobile ? '1px solid #eef1e6' : 'none',
                  background: '#fdfdf7',
                }}
              >
                <button
                  type="button"
                  onClick={goBack}
                  style={{
                    flex: '0 0 auto',
                    border: 'none',
                    borderRadius: 9,
                    padding: '11px 16px',
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: '#eef1e6',
                    color: '#3a4230',
                    visibility: step === 0 ? 'hidden' : 'visible',
                  }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={!canContinue}
                  style={{
                    flex: 1,
                    border: 'none',
                    borderRadius: 9,
                    padding: 11,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: canContinue ? 'pointer' : 'default',
                    opacity: canContinue ? 1 : 0.4,
                    background: '#1a1f0a',
                    color: '#f5ffe0',
                  }}
                >
                  Continue
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
