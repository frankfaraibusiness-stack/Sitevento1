'use client';

// components/widgets/designer/PhonePreview.tsx
//
// Shared "see it on your site" preview used by WidgetDesigner for every
// widget page. Two stacked iframes inside one phone chrome:
//
//  1. A background iframe pointed at the connected site's own URL, so
//     the widget previews against a real page instead of a blank
//     canvas. Most third-party sites send X-Frame-Options/CSP that
//     silently block being framed cross-origin — the browser gives no
//     reliable onError for that, so this loads in the background and a
//     short timeout decides whether it actually painted; if it hasn't
//     confirmed by then, it's swapped for a plain white background
//     instead of leaving a dead/blocked frame visible.
//  2. The foreground iframe is this app's own /w/[widgetId] route (see
//     app/w/[widgetId]/page.tsx + WidgetRenderer.tsx) — the exact page
//     sitevento.js mounts on a real customer site — fed live config via
//     the #cfg hash on every draft change. That makes this a true
//     preview of the shipped widget, not a re-implementation of it.
import { useEffect, useRef, useState } from 'react';

function siteHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'This site';
  }
}

interface PhonePreviewProps {
  widgetId: string;
  siteId: string;
  config: Record<string, unknown>;
  siteUrl: string | null;
  visible: boolean;
  onToggle: () => void;
}

type BgState = 'idle' | 'loading' | 'ok' | 'blocked';

export function PhonePreview({ widgetId, siteId, config, siteUrl, visible, onToggle }: PhonePreviewProps) {
  const widgetFrameRef = useRef<HTMLIFrameElement>(null);
  const [bgState, setBgState] = useState<BgState>('idle');
  const bgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Push the latest draft config into the live widget iframe via its
  // #cfg hash, the same contract sitevento.js uses — no reload needed,
  // WidgetRenderer only reads the hash on mount, so the iframe itself
  // has to be recreated (src reset) when the config changes rather
  // than just updating location.hash on the existing one.
  const cfgHash = encodeURIComponent(JSON.stringify({ siteId: siteId || 'preview', widgetId, config }));
  const widgetSrc = `/w/${widgetId}#cfg=${cfgHash}`;

  useEffect(() => {
    if (!visible || !siteUrl) {
      setBgState('idle');
      return;
    }
    setBgState('loading');
    if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    // A blocked cross-origin frame typically never fires load at all,
    // or fires it instantly with nothing painted — either way we can't
    // distinguish "blocked" from "slow" via events alone, so a fixed
    // window stands in for a real paint check: no confirmed load inside
    // it reads as blocked and we fall back to white.
    bgTimerRef.current = setTimeout(() => setBgState((s) => (s === 'loading' ? 'blocked' : s)), 2200);
    return () => {
      if (bgTimerRef.current) clearTimeout(bgTimerRef.current);
    };
  }, [visible, siteUrl]);

  if (!visible) {
    return (
      <button type="button" className="wdg-phone-showbtn" onClick={onToggle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="7" y="2" width="10" height="20" rx="2.5" />
          <path d="M11 18h2" />
        </svg>
        <span>Show phone preview</span>
      </button>
    );
  }

  return (
    <div className="wdg-phone-wrap">
      <div className="wdg-phone-bar">
        <span className="wdg-phone-bar-label">Preview · iPhone 18</span>
        <button type="button" className="wdg-phone-hidebtn" onClick={onToggle}>
          Hide preview
        </button>
      </div>

      <div className="wdg-phone">
        <div className="wdg-phone-dynamic-island" aria-hidden="true" />
        <div className="wdg-phone-screen">
          {siteUrl && bgState !== 'blocked' ? (
            <iframe
              key={siteUrl}
              className="wdg-phone-bg-frame"
              src={siteUrl}
              title="Your site"
              sandbox="allow-same-origin allow-scripts"
              onLoad={() => setBgState('ok')}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="wdg-phone-bg-blank" />
          )}
          <iframe
            ref={widgetFrameRef}
            key={widgetSrc}
            className="wdg-phone-widget-frame"
            src={widgetSrc}
            title="Widget preview"
          />
        </div>
        <div className="wdg-phone-home-indicator" aria-hidden="true" />
      </div>

      {siteUrl && bgState === 'blocked' && (
        <p className="wdg-phone-note">
          {`${siteHostname(siteUrl)} blocks being shown inside another page, so this is a plain background instead — the widget itself above previews exactly as it will look live.`}
        </p>
      )}
      {!siteUrl && (
        <p className="wdg-phone-note">Connect a site to preview against its real page — showing a plain background for now.</p>
      )}
    </div>
  );
}
