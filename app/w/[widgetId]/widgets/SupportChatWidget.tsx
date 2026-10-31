'use client';

// app/w/[widgetId]/widgets/SupportChatWidget.tsx
//
// First widget rebuilt into the new (post wipe) WIDGET_CATALOG — see
// lib/widgets.ts's 'support-chat' entry. Full-screen AI support chat,
// ported from the tested standalone HTML/CSS prototype
// (styles/widgets/drafts/support-chat.css — kept byte-for-byte as the
// CSS here) straight into a real component wired to the live backend:
//
//   - Every message the visitor types is POSTed to /api/chat, which
//     (a) resolves siteId -> the owning account via siteIndex,
//     (b) calls assertWidgetWriteAllowed BEFORE generating a reply, so
//         every single chat message counts against that site's daily
//         write limit exactly like every other real-write widget
//         (email capture, bookings, feedback, etc) — see that route's
//         own comments,
//     (c) grounds the AI's reply in whatever this widget's own
//         `siteContext` config field says the site/business is about
//         (plus any FAQ widget content, if enabled) — see
//         lib/aiReply.ts's buildSystemPrompt. That's what lets the
//         exact same widget code give accurate answers whether the
//         site is a shop, a blog, a service business, or anything
//         else, instead of one generic prompt for every install.
//
// Closed-state launcher: a cartoon pill FAB, bottom-right, that
// collapses to a plain round bubble (icon only, no label) under
// 768px so it doesn't crowd small screens — see the @media rule
// below. Opening it is always the same full-screen takeover on every
// breakpoint; only the CLOSED bubble's shape changes on mobile.
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';

export interface SupportChatConfig {
  greeting?: string;
  siteContext?: string;
  // Owner-chosen accent (lib/widgets.ts's 'support-chat' configFields,
  // type 'color' — rendered by CustomColorPicker in the designer).
  // Drives every lime-tinted surface below: the closed-state launcher,
  // header gradient, status dot, user bubbles, and send button — see
  // ACCENT_CSS_VARS and SUPPORT_CHAT_CSS's `var(--sv-accent*)` rules.
  accentColor?: string;
  // Universal branding fields (lib/widgets.ts's UNIVERSAL_CONFIG_FIELDS)
  widgetLabel?: string;
  brandMode?: 'none' | 'text' | 'logo';
  brandText?: string;
  brandLogoUrl?: string;
}

const DEFAULT_ACCENT = '#a3e635';

function isValidHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

// Derives every shade this widget's CSS needs from the one accent hex
// the owner picks, so "change the line colour" is a single config
// field rather than five separately-picked swatches that could drift
// out of sync with each other. --sv-accent-ink and --sv-accent-soft
// are a readable near-black and a very light tint of the accent,
// computed by simple RGB blending (mix toward #1a2e05-equivalent
// black / toward white) rather than true HSL darken/lighten — plenty
// accurate for a chat widget's borders/shadows/background wash, and
// keeps this dependency-free (no color library in a widget bundle
// that ships to every visitor's browser).
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
    '--sv-accent-ink': mix(accent, [26, 46, 5], 0.82), // dark outline/shadow tone, e.g. the default's #1a2e05
    '--sv-accent-hover': mix(accent, [0, 0, 0], 0.12), // slightly darker, for :hover states
    '--sv-accent-soft': mix(accent, [255, 255, 255], 0.75), // lighter pale wash — the gradient's upper stop (was #f4ffe8)
    '--sv-accent-soft-2': mix(accent, [255, 255, 255], 0.35), // deeper pale wash — the gradient's lower stop (was #d5f5b4)
    '--sv-accent-rgb': hexToRgbTriplet(accent), // for rgba() fades that need to track the accent, e.g. the scroll-fade overlay
    '--sv-accent-text': mix(accent, [20, 30, 10], 0.55), // readable small-text tone on a light background (status pill, message label) — was #4b7a1f/#66804c, a softer readable cousin of --sv-accent-ink rather than the high-contrast border/shadow tone
  };
}

export interface SupportChatWidgetProps {
  siteId: string;
  visitorId: string;
  config: Record<string, unknown>;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
}

const SESSION_STORAGE_KEY_PREFIX = 'sitevento_chat_session_';

function getOrCreateSessionId(siteId: string): string {
  if (typeof window === 'undefined') return 'anon';
  const key = SESSION_STORAGE_KEY_PREFIX + siteId;
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const fresh = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(key, fresh);
    return fresh;
  } catch {
    // Private mode / storage blocked — still works, just a fresh
    // thread key every load rather than a persisted one.
    return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
}

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
}

const SUGGESTION_CHIPS = ['What are your business hours?', 'How do I track my order?', 'I need to speak to a human.'];

export function SupportChatWidget({ siteId, visitorId, config }: SupportChatWidgetProps) {
  const cfg = config as SupportChatConfig;
  const greeting = (cfg.greeting && cfg.greeting.trim()) || 'How can we help?';
  const widgetLabel = (cfg.widgetLabel && cfg.widgetLabel.trim()) || 'Support';
  const brandMode = cfg.brandMode || 'none';
  const brandText = cfg.brandText || '';
  const brandLogoUrl = cfg.brandLogoUrl || '';
  const accentVars = accentCssVars(cfg.accentColor);

  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [limitReached, setLimitReached] = useState(false);

  const sessionIdRef = useRef<string>('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sessionIdRef.current = getOrCreateSessionId(siteId);
  }, [siteId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const userMsg: ChatMessage = {
        id: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        role: 'user',
        text: trimmed,
        ts: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSending(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteId,
            sessionId: sessionIdRef.current,
            message: trimmed,
            greeting,
            visitorId,
          }),
        });
        const data = await res.json().catch(() => null);
        const replyText: string =
          data && typeof data.reply === 'string' && data.reply
            ? data.reply
            : "Thanks for your message — we'll get back to you.";

        // The route always responds 200 with a usable reply, even when
        // the daily write limit has been hit (see /api/chat's own
        // comments) — it just swaps in the paused-limit copy as the
        // reply text itself rather than an HTTP error, so the widget
        // never shows a raw error bubble to a visitor. Detect that
        // specific case so we can also disable the input (no point
        // letting them keep typing into a chat that's paused for the
        // rest of the day).
        if (typeof replyText === 'string' && replyText.toLowerCase().includes('daily limit')) {
          setLimitReached(true);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: 'assistant',
            text: replyText,
            ts: Date.now(),
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
            role: 'assistant',
            text: "Sorry, something went wrong sending that. Please try again in a moment.",
            ts: Date.now(),
          },
        ]);
      } finally {
        setSending(false);
      }
    },
    [siteId, visitorId, greeting, sending]
  );

  const handleSend = () => sendMessage(input);

  return (
    <div style={accentVars as CSSProperties}>
      <style>{SUPPORT_CHAT_CSS}</style>

      {!open && (
        <button id="reopen-btn" aria-label="Open support chat" onClick={() => setOpen(true)} style={{ display: 'flex' }}>
          <svg viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.07 4.57 2.82 6.19L4 22l5.07-1.68C10.03 20.75 11 21 12 21c5.52 0 10-4.03 10-9S17.52 2 12 2z" />
          </svg>
          <span className="reopen-label">Chat with us</span>
        </button>
      )}

      <div className={'app-container' + (open ? '' : ' hidden')}>
        <header className="app-header">
          <div className="header-left">
            <div className="logo-placeholder">
              {brandMode === 'logo' && brandLogoUrl ? (
                <img src={brandLogoUrl} alt="" className="logo-icon-img" />
              ) : (
                <div className="logo-icon">
                  <svg viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.07 4.57 2.82 6.19L4 22l5.07-1.68C10.03 20.75 11 21 12 21c5.52 0 10-4.03 10-9S17.52 2 12 2z" />
                  </svg>
                </div>
              )}
              <span>{widgetLabel}</span>
            </div>
            <div className="status-pill">
              <span className="status-dot" />
              Online now
            </div>
          </div>
          <button className="close-btn" aria-label="Close chat" onClick={() => setOpen(false)}>
            <svg viewBox="0 0 24 24">
              <path d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12 5.7 16.89a1 1 0 1 0 1.41 1.41L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.41L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4z" />
            </svg>
          </button>
        </header>

        <main className="chat-scroll-area" ref={scrollRef}>
          <div className="chat-content-wrapper">
            {messages.length === 0 && (
              <div className="welcome-header">
                <div className="avatar-group">
                  <div className="avatar avatar-1" />
                  <div className="avatar avatar-2" />
                  <div className="avatar avatar-3" />
                </div>
                <h1>
                  <svg className="wave-icon" viewBox="0 0 24 24">
                    <path d="M12.4 2.3c-.6-.3-1.3 0-1.6.6-.3.6 0 1.3.6 1.6l2.1 1-1.8 3.9-5.6-2.6c-1.2-.6-2.7-.1-3.3 1.1-.6 1.2-.1 2.7 1.1 3.3l7.7 3.6c-.2.9-.1 1.9.4 2.8l2 3.6c1 1.8 3.1 2.6 5 1.9l3-1.1c.5-.2.8-.8.6-1.3-.2-.5-.8-.8-1.3-.6l-3 1.1c-1 .4-2.2-.1-2.7-1l-2-3.6c-.4-.7-.3-1.6.3-2.2l.1-.1c.7-.7 1.8-.8 2.6-.2l1.9 1.4c.4.3 1 .3 1.4-.1.4-.4.4-1.1-.1-1.4l-1.9-1.4c-1.1-.8-2.5-.9-3.6-.3l1.8-3.9c.4.1.9.1 1.3-.1l2.2-1c.6-.3.9-1 .6-1.6-.3-.6-1-.9-1.6-.6l-2.2 1-3-1.4z" />
                  </svg>
                  {greeting}
                </h1>
                <p>Our team usually replies in a few minutes.</p>
                <div className="suggestion-chips">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button key={chip} className="chip" onClick={() => sendMessage(chip)} disabled={sending || limitReached}>
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => (
              <div key={m.id} className={'message ' + m.role}>
                {m.role === 'assistant' && (
                  <div className="message-label">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.03 2 11c0 2.4 1.07 4.57 2.82 6.19L4 22l5.07-1.68C10.03 20.75 11 21 12 21c5.52 0 10-4.03 10-9S17.52 2 12 2z" />
                    </svg>
                    {widgetLabel} Bot
                  </div>
                )}
                <div className="bubble">{m.text}</div>
                <div className="message-meta">
                  {m.role === 'user' ? (
                    <>
                      <span>{formatTime(m.ts)}</span>
                      <svg className="ticks-icon" viewBox="0 0 24 24">
                        <path d="M18 7l-1.41-1.41-6.34 6.34 1.41 1.41L18 7zm4.24-1.41L11.66 16.17 7.48 12l-1.41 1.41L11.66 19l12-12-1.42-1.41zM.41 13.41L6 19l1.41-1.41L1.83 12 .41 13.41z" />
                      </svg>
                    </>
                  ) : (
                    formatTime(m.ts)
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="typing-indicator" style={{ display: 'block' }}>
                <span />
                <span />
                <span />
              </div>
            )}

            {brandMode === 'text' && brandText ? (
              <div className="owner-credit">{brandText}</div>
            ) : null}

            {/* Siterifty/Sitevento's own permanent promo credit — always
                shown regardless of the site owner's own brandMode
                setting (that controls THEIR branding above, not this). */}
            <div className="sitevento-credit">
              <svg className="bolt" viewBox="0 0 24 24">
                <path d="M11 21v-7H6l7-13v7h5l-7 13z" />
              </svg>
              Powered by
              <a className="brand-link" href="https://sitevento.com" target="_blank" rel="noopener noreferrer">
                sitevento.com
              </a>
            </div>
          </div>
        </main>

        <div className="input-area">
          <div className="input-wrapper-container">
            <div className="chat-input-wrapper">
              <input
                type="text"
                placeholder={limitReached ? 'This chat has reached its daily limit.' : 'Type your message...'}
                autoComplete="off"
                value={input}
                disabled={limitReached}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
              />
              <button className="send-btn" aria-label="Send message" onClick={handleSend} disabled={sending || limitReached || !input.trim()}>
                <svg viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// CSS ported unchanged from styles/widgets/drafts/support-chat.css
// (the tested standalone prototype), plus the mobile-bubble and
// branding-credit additions made during prototyping. Scoped with a
// plain <style> tag (not CSS modules) since this always renders alone
// inside its own sandboxed iframe (app/w/[widgetId]/page.tsx) — no
// risk of colliding with host-page styles to guard against here, same
// reasoning as WidgetRenderer's own WRAP_STYLE.
const SUPPORT_CHAT_CSS = `
  .app-container, .app-container * {
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  #reopen-btn {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background-color: var(--sv-accent);
    color: var(--sv-accent-ink);
    border: 3px solid var(--sv-accent-ink);
    border-radius: 50px;
    padding: 12px 24px 12px 20px;
    font-size: 16px;
    font-weight: 800;
    cursor: pointer;
    align-items: center;
    gap: 10px;
    box-shadow: 4px 4px 0px var(--sv-accent-ink);
    transition: transform 0.1s, box-shadow 0.1s;
    z-index: 100;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  #reopen-btn:hover { transform: translate(-2px, -2px); box-shadow: 6px 6px 0px var(--sv-accent-ink); }
  #reopen-btn:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0px var(--sv-accent-ink); }
  #reopen-btn svg { width: 24px; height: 24px; fill: var(--sv-accent-ink); }

  @media (max-width: 767px) {
    #reopen-btn { padding: 0; width: 56px; height: 56px; justify-content: center; gap: 0; }
    #reopen-btn .reopen-label { display: none; }
    #reopen-btn svg { width: 26px; height: 26px; }
  }

  .app-container {
    width: 100vw;
    height: 100dvh;
    background: linear-gradient(180deg, #ffffff 0%, var(--sv-accent-soft) 35%, var(--sv-accent-soft-2) 100%);
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    transition: opacity 0.3s ease, transform 0.3s ease;
  }
  .app-container.hidden { opacity: 0; pointer-events: none; transform: scale(0.95); }

  .app-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  }

  .header-left { display: flex; align-items: center; gap: 14px; }

  .logo-placeholder {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 18px;
    color: var(--sv-accent-ink);
    letter-spacing: -0.5px;
  }
  .logo-icon {
    width: 30px;
    height: 30px;
    background: var(--sv-accent);
    border: 2px solid var(--sv-accent-ink);
    border-radius: 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 2px 2px 0px var(--sv-accent-ink);
    flex-shrink: 0;
  }
  .logo-icon svg { width: 16px; height: 16px; fill: var(--sv-accent-ink); }
  .logo-icon-img {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    object-fit: cover;
    border: 2px solid var(--sv-accent-ink);
    flex-shrink: 0;
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--sv-accent-text);
    margin-left: 2px;
  }
  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--sv-accent);
    box-shadow: 0 0 0 2px rgba(var(--sv-accent-rgb), 0.3);
  }

  .close-btn {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(0,0,0,0.05);
    border: none;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    color: var(--sv-accent-ink);
    transition: background 0.2s;
  }
  .close-btn:hover { background: rgba(0,0,0,0.1); }
  .close-btn svg { width: 18px; height: 18px; fill: currentColor; }

  .chat-scroll-area {
    flex: 1;
    overflow-y: auto;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    scrollbar-width: none;
  }
  .chat-scroll-area::-webkit-scrollbar { display: none; }

  .chat-content-wrapper {
    width: 100%;
    max-width: 768px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .welcome-header { text-align: center; margin-bottom: 20px; margin-top: 10px; }
  .avatar-group { display: flex; justify-content: center; margin-bottom: 16px; }
  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 3px solid #fff;
    margin-left: -12px;
    background-size: cover;
    background-position: center;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    background-color: var(--sv-accent-soft);
  }
  .avatar:first-child { margin-left: 0; }
  .avatar-1 { background-image: url('https://i.pravatar.cc/100?img=1'); }
  .avatar-2 { background-image: url('https://i.pravatar.cc/100?img=2'); }
  .avatar-3 { background-image: url('https://i.pravatar.cc/100?img=3'); }

  .welcome-header h1 { font-size: 22px; color: var(--sv-accent-ink); font-weight: 700; line-height: 1.3; }
  .welcome-header p { margin-top: 8px; font-size: 14px; color: var(--sv-accent-text); }
  .wave-icon { width: 20px; height: 20px; fill: var(--sv-accent-ink); vertical-align: -3px; margin-right: 2px; }

  .suggestion-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }
  .chip {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.06);
    color: #2c3a1c;
    font-size: 13px;
    font-weight: 600;
    padding: 9px 14px;
    border-radius: 20px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    transition: transform 0.1s, background 0.2s;
  }
  .chip:hover { background: var(--sv-accent-soft); transform: translateY(-1px); }
  .chip:disabled { opacity: 0.5; cursor: default; }

  .message { display: flex; flex-direction: column; max-width: 85%; animation: scFadeIn 0.3s ease-out; }
  @keyframes scFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .message.assistant { align-self: flex-start; }
  .message.user { align-self: flex-end; align-items: flex-end; }

  .message-label {
    font-size: 12px;
    color: var(--sv-accent-text);
    margin-bottom: 6px;
    margin-left: 4px;
    display: flex;
    align-items: center;
    gap: 4px;
    font-weight: 600;
  }
  .message-label svg { width: 14px; height: 14px; fill: var(--sv-accent-text); }

  .bubble { padding: 14px 20px; border-radius: 22px; font-size: 15px; line-height: 1.5; color: #333; white-space: pre-wrap; }
  .assistant .bubble { background-color: #ffffff; border-bottom-left-radius: 6px; box-shadow: 0 4px 15px rgba(0,0,0,0.04); }
  .user .bubble {
    background-color: var(--sv-accent);
    color: var(--sv-accent-ink);
    font-weight: 500;
    border-bottom-right-radius: 6px;
    box-shadow: 0 4px 15px rgba(var(--sv-accent-rgb), 0.3);
  }

  .message-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #777; margin-top: 6px; padding: 0 4px; }
  .user .message-meta { justify-content: flex-end; }
  .ticks-icon { width: 16px; height: 16px; fill: #3b82f6; }

  .input-area {
    position: sticky;
    bottom: 0;
    padding: 16px 20px 24px 20px;
    background: linear-gradient(to top, var(--sv-accent-soft-2) 60%, rgba(var(--sv-accent-rgb), 0));
    z-index: 10;
  }
  .input-wrapper-container { width: 100%; max-width: 768px; margin: 0 auto; }
  .chat-input-wrapper {
    display: flex;
    align-items: center;
    background-color: #ffffff;
    border-radius: 30px;
    padding: 8px 8px 8px 24px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.03);
  }
  .chat-input-wrapper input { flex: 1; border: none; outline: none; font-size: 15px; color: #333; background: transparent; }
  .chat-input-wrapper input::placeholder { color: #aaa; }
  .chat-input-wrapper input:disabled { color: #aaa; }

  .send-btn {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background-color: var(--sv-accent);
    border: 2px solid var(--sv-accent-ink);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: transform 0.1s, background-color 0.2s;
    flex-shrink: 0;
    box-shadow: 2px 2px 0px var(--sv-accent-ink);
  }
  .send-btn:hover:not(:disabled) { background-color: var(--sv-accent-hover); }
  .send-btn:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 0px 0px 0px var(--sv-accent-ink); }
  .send-btn svg { width: 20px; height: 20px; fill: var(--sv-accent-ink); margin-left: 2px; }
  .send-btn:disabled { opacity: 0.5; cursor: default; }

  .typing-indicator {
    padding: 14px 20px;
    background-color: #ffffff;
    border-radius: 22px;
    border-bottom-left-radius: 6px;
    width: fit-content;
    box-shadow: 0 4px 15px rgba(0,0,0,0.04);
    margin-top: -4px;
  }
  .typing-indicator span {
    display: inline-block;
    width: 6px;
    height: 6px;
    background-color: var(--sv-accent);
    border-radius: 50%;
    margin: 0 3px;
    animation: scBounce 1.4s infinite ease-in-out both;
  }
  .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
  .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
  @keyframes scBounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1); } }

  .owner-credit {
    text-align: center;
    font-size: 11px;
    color: #8a8477;
    margin-top: 4px;
  }

  .sitevento-credit {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
    font-size: 11.5px;
    font-weight: 600;
    color: #4b7a1f;
    opacity: 0.85;
  }
  .sitevento-credit .bolt { width: 12px; height: 12px; fill: #4b7a1f; flex-shrink: 0; }
  .sitevento-credit .brand-link { color: var(--sv-accent-ink); font-weight: 800; text-decoration: none; }
  .sitevento-credit .brand-link:hover { text-decoration: underline; }

  @media (min-width: 768px) {
    .message { max-width: 70%; }
    .app-header { padding: 16px 32px; }
    .chat-scroll-area { padding: 32px; }
    .input-area { padding: 16px 32px 32px 32px; }
  }
`;
