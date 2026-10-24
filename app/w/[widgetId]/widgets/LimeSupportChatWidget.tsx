'use client';

// Support Chat — lime AI chat bubble. Ported from
// widget-drafts/support-chat.html. A richer, full-panel alternative
// skin to the existing SupportChatWidget: welcome header, timestamped
// bubbles with read-tick icons on user messages, a typing indicator,
// and a reopen FAB once closed.
//
// send() posts to the same /api/chat route SupportChatWidget's own
// skin already calls — real AI reply chain, real message persistence
// under users/{uid}/sites/{siteId}/chats/{sessionId}/messages, same
// hard-pause-on-daily-cap behavior. sessionId is derived from the
// visitorId this widget is given (prefixed, so it can't collide with
// a sessionId SupportChatWidget's own localStorage-based scheme might
// generate) rather than a separate persistence mechanism — stable for
// the visitor's session, not a secret, same trust level as siteId
// itself (see /api/chat's own header comment). The draft's hardcoded
// "Marina" greeting and pravatar.cc demo avatar images have been
// replaced with generic placeholders — a real visitor's name isn't
// known, and hot-linking a third-party avatar service isn't something
// to ship.
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'lime-support-chat') and
// WidgetRenderer.tsx's switch.
import { useEffect, useRef, useState } from 'react';

interface Props {
  config: Record<string, unknown>;
  siteId?: string;
  visitorId?: string;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v ? v : fallback;
}

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const INITIAL_MESSAGES: Message[] = [{ role: 'ai', text: 'Hi, how can I help?', time: nowLabel() }];

export function LimeSupportChatWidget({ config, siteId, visitorId }: Props) {
  const agentName = str(config.greeting, 'Lime AI');
  const heading = str(config.heading, "We're here to help.");
  const greetingLine = 'Hi, how can I help?';

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionId = visitorId ? `lime_${visitorId}` : 'anon';

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  async function send() {
    const text = input.trim();
    if (!text || typing) return;
    setMessages((m) => [...m, { role: 'user', text, time: nowLabel() }]);
    setInput('');
    setTyping(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, sessionId, message: text, greeting: greetingLine }),
      });
      const data = await res.json().catch(() => ({ ok: false, reply: '' }));
      setTyping(false);
      setMessages((m) => [
        ...m,
        { role: 'ai', text: data.reply || "Sorry, we're having trouble replying right now.", time: nowLabel() },
      ]);
    } catch {
      setTyping(false);
      setMessages((m) => [
        ...m,
        { role: 'ai', text: "Sorry, we're having trouble replying right now. Please try again.", time: nowLabel() },
      ]);
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Reopen FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open support chat"
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          background: '#a3e635',
          color: '#1a2e05',
          border: '3px solid #1a2e05',
          borderRadius: 50,
          padding: '12px 24px 12px 20px',
          fontSize: 16,
          fontWeight: 800,
          cursor: 'pointer',
          display: open ? 'none' : 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '4px 4px 0px #1a2e05',
          transition: 'transform 0.1s, box-shadow 0.1s',
          zIndex: 100,
        }}
      >
        <svg viewBox="0 0 24 24" width={24} height={24} fill="#1a2e05">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
        </svg>
        Support
      </button>

      {/* Main panel */}
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'linear-gradient(180deg, #ffffff 0%, #f4ffe8 35%, #d5f5b4 100%)',
          display: open ? 'flex' : 'none',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px 20px',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 800, fontSize: 18, color: '#1a2e05', letterSpacing: '-0.5px' }}>
            <div
              style={{
                width: 30,
                height: 30,
                background: '#a3e635',
                border: '2px solid #1a2e05',
                borderRadius: 10,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                boxShadow: '2px 2px 0px #1a2e05',
              }}
            >
              <svg viewBox="0 0 24 24" width={16} height={16} fill="#1a2e05">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            {agentName}
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: 'rgba(0,0,0,0.05)',
              border: 'none',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              cursor: 'pointer',
              color: '#1a2e05',
              transition: 'background 0.2s',
            }}
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </header>

        <main
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px 20px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ width: '100%', maxWidth: 768, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ textAlign: 'center', marginBottom: 20, marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: '50%',
                      border: '3px solid #fff',
                      marginLeft: i === 0 ? 0 : -12,
                      background: 'linear-gradient(135deg, #bfe77e, #6fae3f)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    }}
                  />
                ))}
              </div>
              <h1 style={{ fontSize: 22, color: '#1a2e05', fontWeight: 700, lineHeight: 1.3, margin: 0 }}>{heading}</h1>
            </div>

            {messages.map((m, i) => (
              <ChatBubble key={i} message={m} />
            ))}

            {typing && (
              <div
                style={{
                  display: 'flex',
                  gap: 0,
                  padding: '14px 20px',
                  background: '#ffffff',
                  borderRadius: 22,
                  borderBottomLeftRadius: 6,
                  width: 'fit-content',
                  boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                  marginTop: 10,
                }}
              >
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      background: '#a3e635',
                      borderRadius: '50%',
                      margin: '0 3px',
                      animation: `sv-limechat-bounce 1.4s infinite ease-in-out both`,
                      animationDelay: `${-0.32 + i * 0.16}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </main>

        <footer
          style={{
            position: 'sticky',
            bottom: 0,
            padding: '16px 20px 24px 20px',
            background: 'linear-gradient(to top, #d5f5b4 60%, rgba(213,245,180,0))',
            zIndex: 10,
          }}
        >
          <div style={{ width: '100%', maxWidth: 768, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                borderRadius: 30,
                padding: '8px 8px 8px 24px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
                border: '1px solid rgba(0,0,0,0.03)',
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') send();
                }}
                placeholder="Type your message here..."
                autoComplete="off"
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  fontSize: 15,
                  color: '#333',
                  background: 'transparent',
                }}
              />
              <button
                type="button"
                onClick={send}
                aria-label="Send"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#a3e635',
                  border: '2px solid #1a2e05',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  boxShadow: '2px 2px 0px #1a2e05',
                  transition: 'transform 0.1s, background-color 0.2s',
                }}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="#1a2e05" style={{ marginLeft: 2 }}>
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </footer>
      </div>
      <style>{`
        @keyframes sv-limechat-bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
        @keyframes sv-limechat-fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '85%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        animation: 'sv-limechat-fade-in 0.3s ease-out',
      }}
    >
      {!isUser && (
        <div style={{ fontSize: 12, color: '#66804c', marginBottom: 6, marginLeft: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="#66804c">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          Fin {'\u2022'} AI Agent
        </div>
      )}
      <div
        style={{
          padding: '14px 20px',
          borderRadius: 22,
          fontSize: 15,
          lineHeight: 1.5,
          color: isUser ? '#1a2e05' : '#333',
          background: isUser ? '#a3e635' : '#ffffff',
          fontWeight: isUser ? 500 : 400,
          borderBottomRightRadius: isUser ? 6 : 22,
          borderBottomLeftRadius: isUser ? 22 : 6,
          boxShadow: isUser ? '0 4px 15px rgba(163,230,53,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
        }}
      >
        {message.text}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: '#777',
          marginTop: 6,
          padding: '0 4px',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        <span>{message.time}</span>
        {isUser && (
          <svg viewBox="0 0 24 24" width={16} height={16} fill="#3b82f6">
            <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
          </svg>
        )}
      </div>
    </div>
  );
}
