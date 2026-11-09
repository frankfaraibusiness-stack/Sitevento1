'use client';

// app/w/[widgetId]/widgets/AnnouncementBarWidget.tsx
//
// Announcement Bar — a slim bar pinned to the very top of the page:
// heading/message on the left, an optional CTA button on the right,
// and a close button that slides the whole bar up and out before it
// unmounts. Unlike SupportChatWidget/EmailCaptureWidget (always a
// full-viewport, pointer-events:none wrapper, self-positioned by
// their own CSS because they can open into something bigger than
// their closed state), this widget is a plain in-flow bar: its iframe
// is sized to its own small fixed height by sitevento.js (see
// ANNOUNCEMENT_BAR_WIDGET_ID there) rather than full-viewport, since
// it never needs to cover more than a thin strip at the top of the
// screen.
//
// Dismissal: closing the bar marks this visitor dismissed for this
// site via a localStorage flag — same per-site-keyed pattern as
// EmailCaptureWidget's isDismissed/markDismissed and SupportChatWidget's
// getOrCreateSessionId — so it never comes back for that visitor,
// consistent with how every other dismissible widget on this app works.
// No submit/duplicate states here (there's nothing to submit) — just
// open or dismissed.
import { useCallback, useEffect, useState, type CSSProperties } from 'react';

export interface AnnouncementBarConfig {
  heading?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  backgroundColor?: string;
  textColor?: string;
  buttonColor?: string;
  // Universal branding fields (lib/widgets.ts's UNIVERSAL_CONFIG_FIELDS).
  // widgetLabel/brandMode/brandText/brandLogoUrl exist on every widget's
  // config for consistency, but a one-line bar has no natural place to
  // show owner branding without crowding the heading/CTA layout this
  // widget is actually about — intentionally unused here, same as
  // WidgetRenderer's unused `pageUrl`.
  widgetLabel?: string;
  brandMode?: 'none' | 'text' | 'logo';
  brandText?: string;
  brandLogoUrl?: string;
}

const DEFAULT_HEADING = 'Free shipping on orders over $50 — this week only.';
const DEFAULT_CTA_LABEL = 'Shop now';
const DEFAULT_BACKGROUND = '#1a2e05';
const DEFAULT_TEXT_COLOR = '#f4ffe8';
const DEFAULT_BUTTON_COLOR = '#a3e635';

function isValidHexColor(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v);
}

// isValidHttpUrl, not isValidWidgetId-style regex: ctaUrl is owner-
// supplied free text (the 'url' field type in lib/widgets.ts has no
// server-side protocol check of its own), so this is the widget's own
// last line of defense against a malformed value — a bad/missing URL
// just means the CTA renders as an inert span instead of a link,
// never a broken or unsafe href, same "fail quiet" posture as the
// rest of this widget's config reading.
function isValidHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

const DISMISSED_STORAGE_KEY_PREFIX = 'sitevento_ab_dismissed_';

function isDismissed(siteId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY_PREFIX + siteId) === '1';
  } catch {
    // Private mode / storage blocked — can't remember, so it just
    // shows every load rather than throwing.
    return false;
  }
}

function markDismissed(siteId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY_PREFIX + siteId, '1');
  } catch {
    // Nothing to persist — silently skip, same as the read above.
  }
}

// How long the slide-up/collapse close animation takes before the bar
// actually unmounts (sets `open` to false under the hood) — long
// enough to read as a deliberate motion, short enough not to feel
// sluggish for something a visitor is actively dismissing.
const CLOSE_ANIMATION_MS = 420;

export interface AnnouncementBarWidgetProps {
  siteId: string;
  visitorId: string;
  config: Record<string, unknown>;
}

export function AnnouncementBarWidget({ siteId, config }: AnnouncementBarWidgetProps) {
  const cfg = config as AnnouncementBarConfig;
  const heading = (cfg.heading && cfg.heading.trim()) || DEFAULT_HEADING;
  const ctaLabel = (cfg.ctaLabel && cfg.ctaLabel.trim()) || '';
  const ctaUrl = (cfg.ctaUrl && cfg.ctaUrl.trim()) || '';
  const showCta = Boolean(ctaLabel && ctaUrl && isValidHttpUrl(ctaUrl));

  const backgroundColor =
    cfg.backgroundColor && isValidHexColor(cfg.backgroundColor) ? cfg.backgroundColor : DEFAULT_BACKGROUND;
  const textColor = cfg.textColor && isValidHexColor(cfg.textColor) ? cfg.textColor : DEFAULT_TEXT_COLOR;
  const buttonColor = cfg.buttonColor && isValidHexColor(cfg.buttonColor) ? cfg.buttonColor : DEFAULT_BUTTON_COLOR;

  // Three states rather than a single boolean: 'hidden' never renders
  // anything (dismissed in an earlier session, or not mounted yet);
  // 'visible' is the normal resting state; 'closing' is the brief
  // window where the slide-up/collapse animation is playing, after
  // which the close handler's timeout flips this to 'hidden' for
  // good. Separating 'closing' from 'hidden' is what lets the CSS
  // transition actually play instead of the bar just vanishing the
  // instant the visitor clicks close.
  const [state, setState] = useState<'hidden' | 'visible' | 'closing'>('hidden');

  useEffect(() => {
    if (isDismissed(siteId)) return;
    setState('visible');
  }, [siteId]);

  const close = useCallback(() => {
    setState('closing');
    markDismissed(siteId);
    window.setTimeout(() => setState('hidden'), CLOSE_ANIMATION_MS);
  }, [siteId]);

  if (state === 'hidden') return null;

  const vars = {
    '--ab-bg': backgroundColor,
    '--ab-text': textColor,
    '--ab-button': buttonColor,
    '--ab-button-ink': backgroundColor,
  } as CSSProperties;

  return (
    <div style={vars}>
      <style>{ANNOUNCEMENT_BAR_CSS}</style>
      <div className={'ab-bar' + (state === 'closing' ? ' ab-closing' : '')} role="region" aria-label="Announcement">
        <div className="ab-inner">
          <p className="ab-heading">{heading}</p>
          <div className="ab-actions">
            {showCta && (
              <a className="ab-cta" href={ctaUrl}>
                {ctaLabel}
              </a>
            )}
            <button type="button" className="ab-close" aria-label="Dismiss announcement" onClick={close}>
              <svg viewBox="0 0 24 24">
                <path d="M18.3 5.71 12 12l6.3 6.29-1.42 1.42L10.59 13.41 4.3 19.71 2.88 18.29 9.17 12 2.88 5.71 4.3 4.29l6.29 6.3 6.29-6.3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// CSS, as a plain JS string injected via <style> — same reasoning as
// SupportChatWidget/EmailCaptureWidget: this renders inside a
// sandboxed iframe with no guarantee the host app's own stylesheets
// are loaded, so the widget has to ship fully self-contained CSS.
//
// The close animation is a height+opacity+transform collapse on
// .ab-bar itself (not just a fade on its contents), so the bar
// visibly slides up and tucks away rather than just disappearing in
// place — max-height is the trick that lets a height-unknown-in-
// advance element (text can wrap to 1 or 2 lines depending on the
// owner's message length and the viewport width) still animate
// smoothly to 0, since you can't transition to/from `height: auto`.
// 160px comfortably covers this bar's tallest realistic state (two
// lines of wrapped heading text plus padding on a narrow phone).
const ANNOUNCEMENT_BAR_CSS = `
  * { box-sizing: border-box; }

  .ab-bar {
    width: 100%;
    background: var(--ab-bg);
    color: var(--ab-text);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    overflow: hidden;
    max-height: 160px;
    opacity: 1;
    transform: translateY(0);
    transition: max-height 0.42s cubic-bezier(0.65, 0, 0.35, 1),
      opacity 0.3s ease, transform 0.42s cubic-bezier(0.65, 0, 0.35, 1);
  }
  .ab-bar.ab-closing {
    max-height: 0;
    opacity: 0;
    transform: translateY(-100%);
  }

  .ab-inner {
    max-width: 1180px;
    margin: 0 auto;
    padding: 12px 44px 12px 20px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    min-height: 24px;
  }

  .ab-heading {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.4;
    text-align: center;
    flex: 1 1 auto;
  }

  .ab-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .ab-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 7px 16px;
    border-radius: 999px;
    background: var(--ab-button);
    color: var(--ab-button-ink);
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
    transition: transform 0.12s ease, filter 0.15s ease;
  }
  .ab-cta:hover { filter: brightness(1.06); transform: translateY(-1px); }
  .ab-cta:active { transform: translateY(0); }

  .ab-close {
    position: absolute;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: var(--ab-text);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0.75;
    transition: opacity 0.15s ease, background 0.15s ease, transform 0.15s ease;
    flex-shrink: 0;
  }
  .ab-close:hover { opacity: 1; background: rgba(255, 255, 255, 0.14); transform: translateY(-50%) rotate(90deg); }
  .ab-close svg { width: 14px; height: 14px; fill: currentColor; }

  /* Desktop: heading left-aligned, actions pinned right, close sits
     inline with the CTA instead of absolutely positioned in the
     corner — the "heading left, CTA right" layout the bar is meant to
     have above ~640px, where there's room for both without wrapping. */
  @media (min-width: 641px) {
    .ab-inner {
      justify-content: space-between;
      padding: 13px 24px;
    }
    .ab-heading { text-align: left; }
    .ab-close { position: static; transform: none; }
    .ab-close:hover { transform: rotate(90deg); }
  }

  /* Phone: center the message, drop the CTA down to a slightly
     smaller pill so it never competes with the heading for space, and
     keep the close button fixed in the top-right corner regardless of
     how many lines the heading wraps to. A visibly different, more
     compact arrangement from the desktop row, not just a shrunk copy
     of it. */
  @media (max-width: 640px) {
    .ab-inner {
      flex-direction: column;
      gap: 8px;
      padding: 12px 40px 12px 16px;
    }
    .ab-heading { font-size: 13px; }
    .ab-cta { padding: 6px 14px; font-size: 12.5px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ab-bar { transition: none !important; }
    .ab-cta, .ab-close { transition: none !important; }
  }
`;
