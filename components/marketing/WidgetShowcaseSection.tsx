// components/marketing/WidgetShowcaseSection.tsx
//
// New marketing section, sitting right after LiveStatsSection, that
// promotes one-click widget deployment from the dashboard. Shows 3
// real things from the product — not invented ones:
//
//   1. Support Chat  — WIDGET_CATALOG's 'support-chat' entry
//      (lib/widgets.ts): floating AI chat, answers visitors using
//      what the owner tells it about their site. "24/7" is accurate
//      framing since it's an always-on AI reply, not a claim about a
//      human team.
//   2. Site Alert    — the separate full-screen "overlay" feature
//      (lib/siteAlert.ts / components/site-alert), display:
//      'fullscreen', pushed to the public siteOverlay/{siteId} doc
//      so it goes live to every visitor instantly with no redeploy.
//      This is NOT in WIDGET_CATALOG (it's its own system) but it's
//      exactly the "instant full-screen to all users" feature asked
//      for, so it's promoted here alongside the two real catalog
//      widgets rather than leaving the slot empty.
//   3. Email Capture — WIDGET_CATALOG's 'email-capture' entry:
//      time-driven popup, no manual trigger needed.
//
// Visual approach: each mini-preview reuses LaptopShowcase's own
// dark-panel + perspective-tilt language (gradient #180f2e→#0d0818,
// subtle rotateX, lime/accent glows) instead of a white card dropped
// on the lilac --app-bg — see theme-tokens.css's header comment for
// why a plain white surface reads wrong here. Each card's glow tints
// toward that widget's own accent (lime for chat, the overlay's own
// accent color for site alert, violet for email capture) so they
// still feel like one family rather than three unrelated colors.
//
// Layout: desktop renders all 3 as a fixed 3-column grid (never
// stacked). Mobile keeps the exact same card width and instead
// becomes a horizontal scroll-snap row (same .scroll-snap-type: x
// proximity convention as dashboard-premium.css's sites rail) so it
// never grows tall on a small screen.
'use client';

import { useEffect, useRef, useState } from 'react';

interface WidgetPreview {
  id: 'support-chat' | 'site-alert' | 'email-capture';
  eyebrow: string;
  title: string;
  label: string;
  glow: string;
}

const PREVIEWS: WidgetPreview[] = [
  {
    id: 'support-chat',
    eyebrow: 'Widget',
    title: 'Support Chat',
    label: 'AI replies to visitors 24/7 — answers come from what you tell it about your site.',
    glow: '#b8e843',
  },
  {
    id: 'site-alert',
    eyebrow: 'Sitewide',
    title: 'Site Alert',
    label: 'Push a full-screen message live to every visitor instantly — no redeploy.',
    glow: '#60a5fa',
  },
  {
    id: 'email-capture',
    eyebrow: 'Widget',
    title: 'Email Capture',
    label: 'A time-driven popup that asks for an email — no manual trigger needed.',
    glow: '#a78bfa',
  },
];

function SupportChatDemo() {
  return (
    <div className="wsx-demo wsx-demo-chat" aria-hidden="true">
      <div className="wsx-demo-glow" />
      <div className="wsx-chat-card">
        <div className="wsx-chat-head">
          <span className="wsx-chat-dot" />
          <span className="wsx-chat-head-label">Site Assistant</span>
          <span className="wsx-chat-live">24/7</span>
        </div>
        <div className="wsx-chat-body">
          <div className="wsx-bubble wsx-bubble-in">Do you ship to Canada?</div>
          <div className="wsx-bubble wsx-bubble-out">
            Yes — 3–5 business days, free over $50.
          </div>
        </div>
      </div>
      <div className="wsx-launcher">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3a8.5 8.5 0 0 1 8.5 8.5Z" />
        </svg>
      </div>
    </div>
  );
}

function SiteAlertDemo() {
  return (
    <div className="wsx-demo wsx-demo-alert" aria-hidden="true">
      <div className="wsx-demo-glow" />
      <div className="wsx-alert-screen">
        <span className="wsx-alert-badge">
          <span className="wsx-live-dot" />
          Live now
        </span>
        <div className="wsx-alert-art">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11l18-5v12L3 13v-2Z" />
            <path d="M11 16v3a2 2 0 0 0 4 0v-1" />
          </svg>
        </div>
        <div className="wsx-alert-title">We&apos;re back online</div>
        <div className="wsx-alert-sub">Thanks for your patience</div>
        <span className="wsx-alert-cta">Got it</span>
      </div>
      <div className="wsx-alert-rings">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function EmailCaptureDemo() {
  return (
    <div className="wsx-demo wsx-demo-email" aria-hidden="true">
      <div className="wsx-demo-glow" />
      <div className="wsx-email-card">
        <div className="wsx-email-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2.5" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </div>
        <div className="wsx-email-title">Get 10% off</div>
        <div className="wsx-email-sub">Join the list</div>
        <div className="wsx-email-input">you@email.com</div>
        <span className="wsx-email-btn">Subscribe</span>
      </div>
    </div>
  );
}

function DemoFor({ id }: { id: WidgetPreview['id'] }) {
  if (id === 'support-chat') return <SupportChatDemo />;
  if (id === 'site-alert') return <SiteAlertDemo />;
  return <EmailCaptureDemo />;
}

export function WidgetShowcaseSection() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  // Same IntersectionObserver-gated pattern as LiveStatsSection /
  // LaptopShowcase — the chat demo's typing dots only animate while
  // the section is actually on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.2 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="wsx" ref={rootRef} aria-label="Widgets you can deploy right now">
      <div className="wsx-inner">
        <div className="wsx-intro">
          <span className="wsx-eyebrow">From your dashboard</span>
          <h2 className="wsx-title">Deploy in one click</h2>
          <p className="wsx-copy">
            No code, no redeploy pipeline — pick a widget, style it, and it&apos;s live on your site
            instantly.
          </p>
        </div>

        <div className={`wsx-row${inView ? ' is-in-view' : ''}`}>
          {PREVIEWS.map((p) => (
            <div className="wsx-card" key={p.id} style={{ ['--wsx-glow' as string]: p.glow }}>
              <DemoFor id={p.id} />
              <div className="wsx-card-foot">
                <div className="wsx-card-heading">
                  <span className="wsx-card-eyebrow">{p.eyebrow}</span>
                  <h3 className="wsx-card-title">{p.title}</h3>
                </div>
                <p className="wsx-card-label">{p.label}</p>
                <span className="wsx-deploy-pill">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                  </svg>
                  Deploy in 1 click
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
