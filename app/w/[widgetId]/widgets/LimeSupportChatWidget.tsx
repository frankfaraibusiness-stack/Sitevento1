'use client';

// Support Chat — lime AI chat bubble, bottom-left launcher.
//
// ── Starts closed ───────────────────────────────────────────────────
// Previously `open` defaulted to true, so every visitor landed on a
// page with the full chat panel already covering a corner of their
// screen. It's a toggle now: visitors see only the launcher bubble
// (labeled "Chat with support" — a real call-to-action, not just an
// icon) until they tap it.
//
// ── Fixed to the bottom-left, independent of other widgets ─────────
// lib/widgets.ts gives this widget `position: 'corner-bottom-left'`,
// its own auto-mount slot (see sitevento.js's
// AUTO_MOUNT_CONTAINER_IDS), and public/sitevento.js gives this
// widget's specific mount element (and nothing else) a dedicated
// `[data-sitevento-widget="support-chat"]{position:fixed;inset:0}`
// override — so its on-screen position comes from THIS component's
// own `position:fixed` + `bottom`/`left` styling below, never from
// whatever box/flex layout its parent auto-mount container happens to
// apply that day. A sibling widget sharing the bottom-left slot (e.g.
// Live Visitor Pulse, when its own `side` config is set to left)
// stacks next to this one in that shared flex container, but can
// never push, resize, or cover this widget's own launcher/panel,
// since those are positioned against the viewport, not the shared
// container's box.
//
// ── Mobile: true full-screen panel ──────────────────────────────────
// Below MOBILE_BREAKPOINT the open panel switches from a floating
// bottom-left card to `position:fixed;inset:0` — the whole viewport —
// with its header pinned to the very top (its own sticky bar, clear
// of the status bar via safe-area padding) and the message input
// pinned to the bottom, exactly like a native chat screen. Desktop
// keeps the original floating card anchored bottom-left.
//
// send() posts to the same /api/chat route SupportChatWidget's own
// skin already calls — real AI reply chain, real message persistence
// under users/{uid}/sites/{siteId}/chats/{sessionId}/messages, same
// hard-pause-on-daily-cap behavior. sessionId is derived from the
// visitorId this widget is given (prefixed, so it can't collide with
// a sessionId SupportChatWidget's own localStorage-based scheme might
// generate) rather than a separate persistence mechanism — stable for
// the visitor's session, not a secret, same trust level as siteId
// itself (see /api/chat's own header comment).
//
// Wired into lib/widgets.ts's WIDGET_CATALOG (id 'support-chat') and
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

// Panel goes full-screen at/under this width — matches the common
// phone/small-tablet breakpoint used elsewhere in this app's own CSS
// (styles/widgets/*), so the chat's own notion of "mobile" agrees
// with the rest of the product.
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

export function LimeSupportChatWidget({ config, siteId, visitorId }: Props) {
  const agentName = str(config.greeting, 'Lime AI');
  const heading = str(config.heading, "We're here to help.");
  const greetingLine = 'Hi, how can I help?';

  // Closed by default — see header comment. The visitor opts in via
  // the launcher bubble instead of the panel appearing unprompted.
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionId = visitorId ? `lime_${visitorId}` : 'anon';
  const isMobile = useIsMobile();

  // ── Tell the host page whether we're open or closed ────────────────
  // The iframe sitevento.js mounts for this widget is deliberately kept
  // SMALL (just the launcher bubble's own footprint) rather than full-
  // viewport, so it never blocks clicks on the rest of the host page.
  // That means when the panel opens and needs to cover the whole
  // screen (mobile) or a 384x600 card (desktop), something OUTSIDE
  // this iframe has to grow the iframe itself — pointer-events CSS
  // from the parent page cannot be "given back" to content inside a
  // cross-origin-sized iframe, so the previous approach (full-
  // viewport iframe + pointer-events:none, hoping this component's
  // own pointer-events:auto would override it) never actually worked:
  // the parent page's pointer-events:none on the <iframe> element
  // itself blocks all clicks reaching this document, full stop.
  // postMessage is the only real way to coordinate this across the
  // frame boundary. sitevento.js listens for this exact shape.
  useEffect(() => {
    try {
      window.parent.postMessage({ source: 'sitevento-widget', widgetId: 'support-chat', open, isMobile }, '*');
    } catch {
      // Standalone preview (no parent frame) — nothing to notify.
    }
  }, [open, isMobile]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Focus the input the moment the panel opens, same as any chat app
  // — mainly matters on desktop where there's no on-screen keyboard
  // to bring up automatically.
  useEffect(() => {
    if (open && !isMobile) {
      inputRef.current?.focus();
    }
  }, [open, isMobile]);

  // Lock the host page's own scroll while the full-screen mobile panel
  // is open, so a swipe inside the chat can't also scroll the page
  // behind it (the iframe sits over the page, but the page itself is
  // still live underneath). Plain `overflow: hidden` on
  // documentElement doesn't actually stop this on iOS Safari — it
  // only blocks the mouse-wheel/scrollbar path, not touch-driven
  // rubber-band scrolling of a page that has a fixed-position overlay
  // on top of it, which is exactly this widget's situation on the
  // host page. Same fix as every modal in the main sitevento app
  // (hooks/useScrollLock.ts) — this file stays self-contained (it
  // ships standalone to third-party sites) so the fix is duplicated
  // here inline rather than importing that hook.
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
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
      {/* Launcher bubble — fixed to the viewport's bottom-left corner
          regardless of anything else on the page. Icon-only, compact
          round bubble — large enough to tap comfortably, small enough
          not to cover page content underneath. The "Chat with
          support" meaning still reaches screen readers via aria-label
          and sighted visitors via the title tooltip. */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Chat with support"
          title="Chat with support"
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            width: 56,
            height: 56,
            background: '#a3e635',
            color: '#1a2e05',
            border: '2px solid #1a2e05',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(26,46,5,0.35)',
            transition: 'transform 0.15s ease',
            zIndex: 2147483100,
            pointerEvents: 'auto',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.06)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg viewBox="0 0 24 24" width={24} height={24} fill="#1a2e05">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
          </svg>
        </button>
      )}

      {/* Panel — floating bottom-left card on desktop, true full-screen
          (sticky header, sticky input) on mobile. */}
      {open && (
        <div
          style={{
            position: 'fixed',
            zIndex: 2147483100,
            pointerEvents: 'auto',
            background: 'linear-gradient(180deg, #ffffff 0%, #f4ffe8 35%, #d5f5b4 100%)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxSizing: 'border-box',
            ...(isMobile
              ? {
                  // Full viewport, edge to edge — a real full-screen
                  // chat screen, not a corner card scaled up.
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: 0,
                }
              : {
                  bottom: 16,
                  left: 16,
                  width: 384,
                  maxWidth: 'calc(100vw - 32px)',
                  height: 600,
                  maxHeight: 'calc(100vh - 32px)',
                  borderRadius: 20,
                  boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
                  border: '1px solid rgba(0,0,0,0.06)',
                }),
          }}
        >
          <header
            style={{
              position: 'sticky',
              top: 0,
              flexShrink: 0,
              zIndex: 10,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: isMobile ? 'calc(14px + env(safe-area-inset-top, 0px)) 20px 14px' : '16px 20px',
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
                  flexShrink: 0,
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
                flexShrink: 0,
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
              minHeight: 0,
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              padding: '24px 20px',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: '100%', maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
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
              flexShrink: 0,
              padding: isMobile
                ? '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))'
                : '16px 20px 24px 20px',
              background: 'linear-gradient(to top, #d5f5b4 70%, rgba(213,245,180,0))',
              zIndex: 10,
            }}
          >
            <div style={{ width: '100%', maxWidth: 560, margin: '0 auto' }}>
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
                  ref={inputRef}
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
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    fontSize: 16,
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
      )}

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
