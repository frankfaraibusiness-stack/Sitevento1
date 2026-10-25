'use client';

// components/widgets/designer/WidgetPreview.tsx
//
// Replaces PhonePreview.tsx's one-size-fits-all phone mockup with a
// preview whose mock "page" is shaped by what the widget actually IS
// (lib/widgets.ts's WidgetPosition -> PreviewStageKind): a sticky
// strip for a bar, a corner anchor for a floating bubble, a dimmed
// full-page takeover for a scroll-end modal, or a plain content column
// for an inline widget like Reviews. Every widget still renders via
// the exact same real iframe (/w/[widgetId], fed the #cfg hash) that
// ships to production — this file only changes the mock CONTEXT it
// sits inside, never the widget itself, so the preview can never drift
// from what a visitor actually sees.
//
// Desktop/Mobile is a real control here (not just a narrower card):
// several widgets (CountdownBarWidget, CampaignBarWidget) read their
// own window width inside the iframe and change layout at a phone
// breakpoint, so narrowing .wdgp-stage genuinely exercises that path
// instead of just shrinking a static image of it.
import { useRef, useState } from 'react';
import { previewStageKindFor, type WidgetPosition } from '@/lib/widgets';

const STAGE_CONTEXT: Record<WidgetPosition, string> = {
  'fixed-top': 'Pinned to the top of every page',
  'fixed-bottom': 'Pinned to the bottom of every page',
  'corner-bottom-left': 'Floating in the bottom-left corner',
  'corner-bottom-right': 'Floating in the bottom-right corner',
  'scroll-end': 'Appears once a visitor scrolls to the end of the page',
  'manual-only': 'Placed inline, wherever you add it to a page',
};

interface WidgetPreviewProps {
  widgetId: string;
  siteId: string;
  position: WidgetPosition;
  config: Record<string, unknown>;
  visible: boolean;
  onToggle: () => void;
}

type Device = 'desktop' | 'mobile';

export function WidgetPreview({ widgetId, siteId, position, config, visible, onToggle }: WidgetPreviewProps) {
  const [device, setDevice] = useState<Device>('desktop');
  const frameRef = useRef<HTMLIFrameElement>(null);

  // Same #cfg-hash contract PhonePreview used and sitevento.js sets on
  // a real embed (see WidgetRenderer.tsx) — the iframe src is reset
  // (via `key`) rather than updating location.hash on the existing
  // frame, since WidgetRenderer only reads the hash on mount.
  const cfgHash = encodeURIComponent(JSON.stringify({ siteId: siteId || 'preview', widgetId, config }));
  const widgetSrc = `/w/${widgetId}#cfg=${cfgHash}`;
  const stageKind = previewStageKindFor(position);
  const isBar = stageKind === 'bar';
  // Most bar widgets have a fixed top/bottom position (the catalog's
  // own `position`), but campaign-bar exposes it as its own `position`
  // config field (top/bottom toggle in the designer) — when a widget
  // does that, the preview should follow the live draft value instead
  // of the catalog default, so flipping it in the form moves the mock
  // bar immediately.
  const configPos = config.position === 'top' || config.position === 'bottom' ? config.position : null;
  const barPos = configPos ?? (position === 'fixed-bottom' ? 'bottom' : 'top');
  const contextLabel = configPos
    ? `Pinned to the ${configPos} of every page`
    : STAGE_CONTEXT[position];

  if (!visible) {
    return (
      <button type="button" className="wdgp-showbtn" onClick={onToggle}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <path d="M3 9h18" />
        </svg>
        <span>Show preview</span>
      </button>
    );
  }

  return (
    <div className="wdgp">
      <div className="wdgp-hidebar">
        <button type="button" className="wdgp-hidebtn" onClick={onToggle}>
          Hide preview
        </button>
      </div>

      <div className="wdgp-card">
        <div className="wdgp-head">
          <div className="wdgp-head-text">
            <span className="wdgp-eyebrow">Live preview</span>
            <span className="wdgp-context">{contextLabel}</span>
          </div>
          <div className="wdgp-devices" role="group" aria-label="Preview device size">
            <button
              type="button"
              className={`wdgp-device-btn${device === 'desktop' ? ' is-active' : ''}`}
              aria-pressed={device === 'desktop'}
              onClick={() => setDevice('desktop')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="12" rx="1.5" />
                <path d="M8 20h8M12 16v4" />
              </svg>
              Desktop
            </button>
            <button
              type="button"
              className={`wdgp-device-btn${device === 'mobile' ? ' is-active' : ''}`}
              aria-pressed={device === 'mobile'}
              onClick={() => setDevice('mobile')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="7" y="2" width="10" height="20" rx="2.5" />
                <path d="M11 18h2" />
              </svg>
              Mobile
            </button>
          </div>
        </div>

        <div className="wdgp-stage-wrap">
          <div
            className={`wdgp-stage wdgp-stage--${stageKind}${device === 'mobile' ? ' is-mobile' : ''}`}
            data-bar-pos={isBar ? barPos : undefined}
          >
            <div className="wdgp-stage-chrome" aria-hidden="true">
              <span className="wdgp-stage-dot" />
              <span className="wdgp-stage-dot" />
              <span className="wdgp-stage-dot" />
              <span className="wdgp-stage-url" />
            </div>

            <div className="wdgp-stage-body">
              {stageKind === 'inline' ? (
                <div className="wdgp-inline-slot">
                  <div className="wdgp-skel-heading" />
                  <div className="wdgp-skel-line w-full" style={{ marginTop: 10 }} />
                  <div className="wdgp-skel-line w-80" />
                  <iframe
                    key={widgetSrc}
                    ref={frameRef}
                    className="wdgp-widget-frame"
                    src={widgetSrc}
                    title="Widget preview"
                    style={{ marginTop: 16 }}
                  />
                  <div className="wdgp-skel-line w-60" style={{ marginTop: 16 }} />
                  <div className="wdgp-skel-line w-full" />
                </div>
              ) : (
                <>
                  <div className="wdgp-skel-block">
                    <div className="wdgp-skel-heading" />
                    <div className="wdgp-skel-line w-full" />
                    <div className="wdgp-skel-line w-80" />
                    <div className="wdgp-skel-card" />
                    <div className="wdgp-skel-line w-60" />
                  </div>
                  {stageKind === 'takeover' && <div className="wdgp-scroll-cue" aria-hidden="true" />}
                  <iframe
                    key={widgetSrc}
                    ref={frameRef}
                    className="wdgp-widget-frame"
                    src={widgetSrc}
                    title="Widget preview"
                  />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="wdgp-foot">
          <p className="wdgp-caption">
            {stageKind === 'inline'
              ? 'Shown exactly as it will render wherever you place it in your page content.'
              : `${contextLabel} — shown here over a mock page so you can judge the real look and spacing.`}
          </p>
        </div>
      </div>
    </div>
  );
}
