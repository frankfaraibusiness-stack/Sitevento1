'use client';

// Support Chat widget: a bubble that opens into a real chat panel.
// Fully functional end to end — typing, sending, and receiving an AI
// reply via this app's own /api/chat route (see lib/aiReply.ts for the
// Groq -> Gemini -> canned-reply fallback chain). Messages persist per
// visitor session (a random id kept in localStorage) so refreshing the
// page doesn't lose the thread for that browser session.
//
// Layout note: the iframe this renders into has a FIXED footprint set
// by public/sitevento.js (#sv-auto-corner-br/-bl .sv-widget-frame),
// the same size whether the launcher is collapsed or the panel is
// open. Both states here are absolutely positioned inside that fixed
// box rather than sized by their own content, so the box the browser
// lays out never resizes — only what's drawn inside it changes. That
// is what keeps the widget from visibly growing from a small circle
// into a full panel on open.
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

interface Props {
  siteId: string;
  config: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

const SESSION_KEY = 'sv_chat_session';

function getSessionId(): string {
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'c' + Math.random().toString(36).slice(2, 10);
  }
}

// Lighten/darken a #rrggbb hex by `amt` (-1..1) for gradients/hovers
// without needing a color library for one small widget.
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + Math.round(255 * amt)));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + Math.round(255 * amt)));
  const b = Math.max(0, Math.min(255, (n & 255) + Math.round(255 * amt)));
  return '#' + [r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('');
}

export function SupportChatWidget({ siteId, config }: Props) {
  const greeting = typeof config.greeting === 'string' && config.greeting ? config.greeting : 'Hi! How can we help?';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';
  const side = config.side === 'left' ? 'left' : 'right';

  const accentLight = shade(accent, 0.14);
  const accentDark = shade(accent, -0.16);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const sessionIdRef = useRef<string>('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    sessionIdRef.current = getSessionId();
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  async function send() {
    const text = input.trim();
    if (!text || sending || !siteId) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setSending(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, sessionId: sessionIdRef.current, message: text, greeting }),
      });
      const data = await res.json().catch(() => ({ reply: 'Sorry, something went wrong.' }));
      setMessages((m) => [...m, { role: 'assistant', text: data.reply || 'Sorry, something went wrong.' }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const sideStyle = side === 'left' ? { left: 0 } : { right: 0 };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Panel — absolutely positioned so it overlays the same fixed
          box the launcher sits in, instead of the box resizing. */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          ...sideStyle,
          width: 320,
          maxWidth: '100%',
          height: 466,
          maxHeight: '100%',
          background: '#fff',
          borderRadius: 20,
          boxShadow:
            '0 1px 1px rgba(20,16,10,0.04), 0 8px 24px rgba(20,16,10,0.10), 0 24px 56px -12px rgba(20,16,10,0.28)',
          border: '1px solid rgba(20,16,10,0.06)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          opacity: open ? 1 : 0,
          transform: open ? 'translateY(0) scale(1)' : 'translateY(10px) scale(0.97)',
          transformOrigin: side === 'left' ? 'bottom left' : 'bottom right',
          pointerEvents: open ? 'auto' : 'none',
          visibility: open ? 'visible' : 'hidden',
          transition: 'opacity 220ms cubic-bezier(.2,.8,.2,1), transform 220ms cubic-bezier(.2,.8,.2,1), visibility 220ms',
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${accentLight} 0%, ${accent} 55%, ${accentDark} 100%)`,
            color: '#fff',
            padding: '16px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 0 3px rgba(255,255,255,0.28)',
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 650, letterSpacing: '-0.01em' }}>Chat with us</span>
          </div>
          <button
            type="button"
            aria-label="Close chat"
            onClick={() => setOpen(false)}
            style={{
              background: 'rgba(255,255,255,0.16)',
              border: 0,
              borderRadius: 999,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        </div>

        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            background: '#fbfaf8',
          }}
        >
          <Bubble role="assistant" text={greeting} accent={accent} />
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} accent={accent} />
          ))}
          {sending && <TypingBubble accent={accent} />}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 12, background: '#fff', borderTop: '1px solid rgba(20,16,10,0.07)' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={'Type a message\u2026'}
            rows={1}
            style={{
              flex: 1,
              resize: 'none',
              border: '1px solid rgba(20,16,10,0.12)',
              borderRadius: 12,
              padding: '10px 12px',
              fontSize: 13.5,
              fontFamily: 'inherit',
              maxHeight: 70,
              background: '#fbfaf8',
              outline: 'none',
              transition: 'border-color 150ms',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(20,16,10,0.12)')}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input.trim() || sending}
            aria-label="Send"
            style={{
              flexShrink: 0,
              background: input.trim() && !sending ? `linear-gradient(135deg, ${accentLight}, ${accent})` : '#e8e4de',
              color: '#fff',
              border: 0,
              borderRadius: 12,
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !sending ? 'pointer' : 'default',
              boxShadow: input.trim() && !sending ? `0 2px 10px ${accent}66` : 'none',
              transition: 'box-shadow 150ms, transform 100ms',
            }}
          >
            <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
              <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Launcher — absolutely positioned at the same corner of the
          fixed box, always present (hidden under the panel via
          opacity when open) so the box itself never changes size. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        style={{
          position: 'absolute',
          bottom: 0,
          ...sideStyle,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${accentLight} 0%, ${accent} 60%, ${accentDark} 100%)`,
          color: '#fff',
          border: 0,
          boxShadow: `0 2px 8px rgba(20,16,10,0.12), 0 10px 28px -6px ${accent}80`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          opacity: open ? 0 : 1,
          transform: open ? 'scale(0.85)' : 'scale(1)',
          pointerEvents: open ? 'none' : 'auto',
          transition: 'opacity 180ms ease, transform 180ms cubic-bezier(.2,.8,.2,1), box-shadow 180ms',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = open ? 'scale(0.85)' : 'scale(1.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = open ? 'scale(0.85)' : 'scale(1)';
        }}
      >
        <svg viewBox="0 0 24 24" width={25} height={25} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: side === 'left' ? 2 : undefined,
            left: side === 'left' ? undefined : 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#4ade80',
            border: '2px solid #fff',
          }}
        />
      </button>
    </div>
  );
}

function Bubble({ role, text, accent }: { role: 'user' | 'assistant'; text: string; accent: string }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '82%',
          background: isUser ? `linear-gradient(135deg, ${shade(accent, 0.1)}, ${accent})` : '#fff',
          color: isUser ? '#fff' : '#22201c',
          border: isUser ? 'none' : '1px solid rgba(20,16,10,0.07)',
          borderRadius: isUser ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
          padding: '9px 13px',
          fontSize: 13,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          boxShadow: isUser ? `0 2px 8px ${accent}33` : '0 1px 2px rgba(20,16,10,0.04)',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function TypingBubble({ accent }: { accent: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: '#fff',
          border: '1px solid rgba(20,16,10,0.07)',
          borderRadius: '14px 14px 14px 3px',
          padding: '11px 14px',
          display: 'flex',
          gap: 4,
          boxShadow: '0 1px 2px rgba(20,16,10,0.04)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: accent,
              opacity: 0.55,
              animation: `sv-chat-bounce 1.1s ${i * 0.15}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes sv-chat-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
