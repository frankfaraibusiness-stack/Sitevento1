'use client';

// components/dashboard/BannerCard.tsx
//
// Pure presentation component for sitevento's live banner — the exact
// same visual as public/sitevento.js renders on a connected site (hand-
// mirrored there since that script ships to arbitrary third-party pages
// and can't import React/TS). Used inside the Site Alert page's
// phone/desktop preview (components/site-alert/SiteAlertPageClient.tsx),
// with the owner's unsaved draft, so "what I see in the preview" and
// "what visitors get" can never visually drift in intent — same
// convention siterifty's SiteAlertCard/console preview pairing uses.
import type { CSSProperties } from 'react';
import type { OverlayArt, SiteOverlayDoc } from '@/lib/siteAlert';

const ART_PATHS: Record<Exclude<OverlayArt, 'none'>, string[]> = {
  megaphone: [
    'M10 28V20l54-20v56L10 36v-8z',
    'M10 36l6 24h12l-6-24',
  ],
  wrench: ['M58 14a20 20 0 0 0-24 27L12 63a9 9 0 0 0 13 13l22-22a20 20 0 0 0 27-24l-13 13-11-3-3-11 13-13z'],
  tag: [
    'M8 36V10a4 4 0 0 1 4-4h26l32 32a4 4 0 0 1 0 6L42 72a4 4 0 0 1-6 0L8 36z',
  ],
  spark: ['M40 6l7 20 20 7-20 7-7 20-7-20-20-7 20-7 7-20z'],
  confetti: [
    'M14 70l12-40 26 26-38 14z',
    'M42 18v-6',
    'M58 28l5-5',
    'M66 44h6',
    'M50 8l2 3',
    'M70 26l3 2',
  ],
  bell: [
    'M20 58c6-5 8-13 8-24a12 12 0 0 1 24 0c0 11 2 19 8 24H20z',
    'M34 66a6 6 0 0 0 12 0',
  ],
};

function ArtIcon({ art }: { art: OverlayArt }) {
  if (art === 'none' || !ART_PATHS[art as Exclude<OverlayArt, 'none'>]) return null;
  const paths = ART_PATHS[art as Exclude<OverlayArt, 'none'>];
  return (
    <svg viewBox="0 0 80 80" fill="none" stroke="currentColor" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

function themeVars(o: SiteOverlayDoc): CSSProperties {
  return {
    ['--sv-accent' as string]: o.theme.accent,
    ['--sv-accent-text' as string]: o.theme.accentText,
    ['--sv-title' as string]: o.theme.titleColor,
    ['--sv-text' as string]: o.theme.textColor,
  } as CSSProperties;
}

export function BannerCard({
  overlay,
  interactive = false,
}: {
  overlay: SiteOverlayDoc;
  // true only for the owner's live-dashboard "take down" context — the
  // phone preview always renders this inert (no pointer events) so a
  // click inside the preview never navigates the dashboard away.
  interactive?: boolean;
}) {
  const isPopup = overlay.display === 'popup';
  const cardStyle: CSSProperties = {
    ...themeVars(overlay),
    background: overlay.theme.card === 'solid'
      ? overlay.theme.bgTo
      : `linear-gradient(160deg, ${overlay.theme.bgFrom}, ${overlay.theme.bgTo})`,
  };

  return (
    <div className={`bc-stage${isPopup ? ' bc-popup' : ''}`}>
      <div className={`bc-card bc-card-${overlay.theme.card}`} style={cardStyle}>
        {overlay.closable && (
          <button type="button" className="bc-close" aria-label="Dismiss" tabIndex={interactive ? 0 : -1}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
              <path d="M5 5l14 14M19 5L5 19" />
            </svg>
          </button>
        )}

        {overlay.art !== 'none' && (
          <div className="bc-art">
            <ArtIcon art={overlay.art} />
          </div>
        )}

        {overlay.badge && <span className="bc-badge">{overlay.badge}</span>}
        {overlay.title && <h2 className="bc-title">{overlay.title}</h2>}
        {overlay.description && <p className="bc-desc">{overlay.description}</p>}

        {overlay.ctaLabel && (
          <button type="button" className="bc-cta" tabIndex={interactive ? 0 : -1}>
            <span>{overlay.ctaLabel}</span>
            {overlay.ctaUrl && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            )}
          </button>
        )}

        {!overlay.closable && overlay.notifyOnClose && (
          <div className="bc-notify-row">
            <input className="bc-notify-input" placeholder="you@email.com" readOnly={!interactive} tabIndex={interactive ? 0 : -1} />
            <button type="button" className="bc-notify-btn" tabIndex={interactive ? 0 : -1}>
              Notify me
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
