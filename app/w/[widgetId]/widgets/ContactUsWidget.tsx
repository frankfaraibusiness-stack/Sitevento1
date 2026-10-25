'use client';

// Contact Us: a real, direct contact form (name, email, message,
// submit) — not the AI/chat-thread experience Support Chat offers.
// Ported from widget-drafts/contact-us.html. Validates each field
// inline (red outline + inline error, not a generic alert), shows a
// spinner while "sending," and only plays the animated checkmark
// success state after a send would actually succeed.
//
// Sends { siteId, name, email, message, pageUrl, visitorId } to
// /api/contact-us, which writes into the same `leads` collection
// email-capture already uses, so submissions land in the dashboard's
// LeadsPanel. A failed send shows the inline error banner and
// preserves what was typed rather than pretending it worked. A
// `code: 'PAUSED'` response (the owning account hit its daily write
// cap) shows a distinct message rather than the generic error, since
// retrying immediately won't help there.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'contact-us') and
// WidgetRenderer.tsx's switch.
import { useState, type CSSProperties, type ReactNode } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
  pageUrl?: string;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

const EMAIL_RE = /\S+@\S+\.\S+/;

export function ContactUsWidget({ config, siteId, visitorId, pageUrl }: Props) {
  const title = str(config.heading, 'Get in touch');
  const subtitle = str(config.subheading, 'We typically reply within a day.');
  const accent = /^#[0-9a-f]{6}$/i.test(String(config.accent)) ? String(config.accent) : '#6fae3f';

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [invalid, setInvalid] = useState<{ name?: boolean; email?: boolean; message?: boolean }>({});
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [paused, setPaused] = useState(false);
  const [success, setSuccess] = useState(false);
  const [firstName, setFirstName] = useState('there');

  function openModal() {
    setOpen(true);
    setSuccess(false);
  }
  function closeModal() {
    setOpen(false);
  }

  function validate(): boolean {
    const next: typeof invalid = {};
    if (!name.trim()) next.name = true;
    if (!EMAIL_RE.test(email.trim())) next.email = true;
    if (!message.trim()) next.message = true;
    setInvalid(next);
    setSendError(false);
    return Object.keys(next).length === 0;
  }

  async function submit() {
    if (sending) return;
    if (!validate()) return;
    setSending(true);
    setPaused(false);
    try {
      const res = await fetch('/api/contact-us', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId,
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
          pageUrl: pageUrl || '',
          visitorId: visitorId || '',
        }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      setSending(false);
      if (!data.ok) {
        if (data.code === 'PAUSED') {
          setPaused(true);
        } else {
          setSendError(true);
        }
        return;
      }
      setFirstName(name.trim().split(' ')[0] || 'there');
      setSuccess(true);
    } catch {
      setSending(false);
      setSendError(true);
    }
  }

  function done() {
    closeModal();
    setName('');
    setEmail('');
    setMessage('');
    setInvalid({});
    setSuccess(false);
    setSendError(false);
    setPaused(false);
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
          padding: '13px 20px 13px 16px',
          fontSize: 13.5,
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 22px rgba(26,31,10,0.22)',
        }}
      >
        {'\u2709\uFE0F'} Contact us
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contact us"
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
              borderRadius: 18,
              maxWidth: 380,
              width: '100%',
              boxShadow: '0 20px 60px rgba(26,31,10,0.25)',
              position: 'relative',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            {!success ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 22px 14px' }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
                    <div style={{ fontSize: 12.5, color: '#6b7560', marginTop: 3 }}>{subtitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close"
                    style={{ background: 'none', border: 'none', color: '#9aa38a', fontSize: 16, cursor: 'pointer', lineHeight: 1, flexShrink: 0 }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#3a4230')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = '#9aa38a')}
                  >
                    {'\u2715'}
                  </button>
                </div>

                <div style={{ padding: '4px 22px 22px' }}>
                  {sendError && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#c05050',
                        background: '#fbecec',
                        border: '1px solid #f0d0d0',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginBottom: 12,
                      }}
                    >
                      Something went wrong sending your message. Please try again.
                    </div>
                  )}
                  {paused && (
                    <div
                      style={{
                        fontSize: 11.5,
                        color: '#9a7b1f',
                        background: '#fdf3d8',
                        border: '1px solid #f0e0b0',
                        borderRadius: 8,
                        padding: '8px 10px',
                        marginBottom: 12,
                      }}
                    >
                      This form has reached its daily limit. Please try again later.
                    </div>
                  )}

                  <Field label="Name" error="Please enter your name." invalid={!!invalid.name}>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setInvalid((v) => ({ ...v, name: false }));
                      }}
                      placeholder="Jordan Lee"
                      style={fieldInputStyle(!!invalid.name)}
                      onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = invalid.name ? '#e0a0a0' : '#e5ead9')}
                    />
                  </Field>

                  <Field label="Email" error="Please enter a valid email." invalid={!!invalid.email}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setInvalid((v) => ({ ...v, email: false }));
                      }}
                      placeholder="jordan@example.com"
                      style={fieldInputStyle(!!invalid.email)}
                      onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = invalid.email ? '#e0a0a0' : '#e5ead9')}
                    />
                  </Field>

                  <Field label="What can we help with?" error="Please add a short message." invalid={!!invalid.message}>
                    <textarea
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        setInvalid((v) => ({ ...v, message: false }));
                      }}
                      placeholder="Tell us a bit about what you need\u2026"
                      style={{ ...fieldInputStyle(!!invalid.message), resize: 'vertical', minHeight: 84 }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = invalid.message ? '#e0a0a0' : '#e5ead9')}
                    />
                  </Field>

                  <button
                    type="button"
                    onClick={submit}
                    disabled={sending}
                    style={{
                      width: '100%',
                      background: '#1a1f0a',
                      color: '#f5ffe0',
                      border: 'none',
                      borderRadius: 9,
                      padding: 12,
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: sending ? 'default' : 'pointer',
                      opacity: sending ? 0.55 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'opacity 120ms ease',
                    }}
                  >
                    {sending && (
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          border: '2px solid rgba(245,255,224,0.35)',
                          borderTopColor: '#f5ffe0',
                          borderRadius: '50%',
                          display: 'inline-block',
                          animation: 'sv-contactus-spin 700ms linear infinite',
                        }}
                      />
                    )}
                    <span style={{ opacity: sending ? 0.8 : 1 }}>Send message</span>
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '36px 22px 32px' }}>
                <div style={{ width: 64, height: 64, margin: '0 auto 16px' }}>
                  <svg viewBox="0 0 64 64" width={64} height={64}>
                    <circle
                      cx={32}
                      cy={32}
                      r={26}
                      style={{
                        stroke: accent,
                        strokeWidth: 3,
                        fill: 'none',
                        strokeDasharray: 166,
                        strokeDashoffset: 0,
                        strokeLinecap: 'round',
                        animation: 'sv-contactus-tick-circle 480ms cubic-bezier(0.65,0,0.45,1) forwards',
                      }}
                    />
                    <polyline
                      points="20,33 28,41 45,23"
                      style={{
                        stroke: accent,
                        strokeWidth: 3.5,
                        fill: 'none',
                        strokeDasharray: 48,
                        strokeDashoffset: 0,
                        strokeLinecap: 'round',
                        strokeLinejoin: 'round',
                        animation: 'sv-contactus-tick-check 320ms cubic-bezier(0.65,0,0.45,1) 460ms forwards',
                      }}
                    />
                  </svg>
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Message sent</div>
                <div style={{ fontSize: 12.5, color: '#6b7560', lineHeight: 1.6 }}>
                  {'Thanks, '}
                  {firstName}
                  {' \u2014 we\u2019ve got your message and will get back to you soon.'}
                </div>
                <button
                  type="button"
                  onClick={done}
                  style={{
                    marginTop: 18,
                    background: '#eef3e4',
                    border: 'none',
                    borderRadius: 9,
                    padding: '9px 18px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: '#3a4230',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e5ead9')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#eef3e4')}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <style>{`
        @keyframes sv-contactus-spin { to { transform: rotate(360deg); } }
        @keyframes sv-contactus-tick-circle { from { stroke-dashoffset: 166; } to { stroke-dashoffset: 0; } }
        @keyframes sv-contactus-tick-check { from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; } }
      `}</style>
    </div>
  );
}

function fieldInputStyle(invalid: boolean): CSSProperties {
  return {
    width: '100%',
    border: `1.5px solid ${invalid ? '#e0a0a0' : '#e5ead9'}`,
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 13.5,
    fontFamily: 'inherit',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 120ms ease',
  };
}

function Field({
  label,
  error,
  invalid,
  children,
}: {
  label: string;
  error: string;
  invalid: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 13 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 5, color: '#3a4230' }}>{label}</label>
      {children}
      {invalid && <div style={{ fontSize: 11, color: '#c05050', marginTop: 4 }}>{error}</div>}
    </div>
  );
}
