'use client';

// Support Chat widget: a bubble that opens into a real chat panel.
// Fully functional end to end — typing, sending, and receiving an AI
// reply via this app's own /api/chat route (see lib/aiReply.ts for the
// Groq -> Gemini -> canned-reply fallback chain). Messages persist per
// visitor session (a random id kept in localStorage) so refreshing the
// page doesn't lose the thread for that browser session.
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

export function SupportChatWidget({ siteId, config }: Props) {
  const greeting = typeof config.greeting === 'string' && config.greeting ? config.greeting : 'Hi! How can we help?';
  const accent = typeof config.accent === 'string' && /^#[0-9a-f]{6}$/i.test(config.accent) ? config.accent : '#8a5a3c';

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

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
      {open ? (
        <div
          style={{
            width: 300,
            maxWidth: '100%',
            height: '100%',
            maxHeight: 460,
            background: '#fff',
            borderRadius: 14,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              background: accent,
              color: '#fff',
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            <span>Chat with us</span>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              style={{ background: 'none', border: 0, color: '#fff', fontSize: 18, cursor: 'pointer', opacity: 0.9 }}
            >
              &times;
            </button>
          </div>

          <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Bubble role="assistant" text={greeting} accent={accent} />
            {messages.map((m, i) => (
              <Bubble key={i} role={m.role} text={m.text} accent={accent} />
            ))}
            {sending && <Bubble role="assistant" text="\u2026" accent={accent} />}
          </div>

          <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid #e8e4de' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message\u2026"
              rows={1}
              style={{
                flex: 1,
                resize: 'none',
                border: '1px solid #e8e4de',
                borderRadius: 10,
                padding: '8px 10px',
                fontSize: 13,
                fontFamily: 'inherit',
                maxHeight: 70,
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || sending}
              aria-label="Send"
              style={{
                flexShrink: 0,
                background: accent,
                color: '#fff',
                border: 0,
                borderRadius: 10,
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !sending ? 'pointer' : 'default',
                opacity: input.trim() && !sending ? 1 : 0.5,
              }}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor">
                <path d="M3 20l18-8L3 4v6l12 2-12 2z" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open chat"
          style={{
            width: 54,
            height: 54,
            borderRadius: '50%',
            background: accent,
            color: '#fff',
            border: 0,
            boxShadow: '0 4px 18px rgba(0,0,0,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg viewBox="0 0 24 24" width={24} height={24} fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}

function Bubble({ role, text, accent }: { role: 'user' | 'assistant'; text: string; accent: string }) {
  const isUser = role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '80%',
          background: isUser ? accent : '#f6f2e7',
          color: isUser ? '#fff' : '#22201c',
          borderRadius: 12,
          padding: '7px 11px',
          fontSize: 12.5,
          lineHeight: 1.4,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
}
