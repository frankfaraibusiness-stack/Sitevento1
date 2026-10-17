'use client';

// components/dashboard/OverlayComposer.tsx — replaces #panelOverlay + the
// renderOverlayPanel/renderOverlayPreview/push/stopOverlay wiring. Driven
// entirely by useOverlayComposer's state; the live-now banner and
// "Take down" button derive from activeSite.overlay just like the
// original's renderOverlayPanel() did.
import { OVERLAY_BG_SWATCHES, OVERLAY_TEXT_SWATCHES, useOverlayComposer } from '@/hooks/useOverlayComposer';
import { ColorSwatches } from './ColorSwatches';
import type { OverlayDisplay, OverlayType, Site } from '@/lib/types';

interface OverlayComposerProps {
  uid: string | null;
  activeSite: Site | null;
}

const TYPE_OPTIONS: { value: OverlayType; label: string }[] = [
  { value: 'announcement', label: 'Announcement' },
  { value: 'maintenance', label: 'Maintenance mode' },
  { value: 'message', label: 'Custom message' },
];

export function OverlayComposer({ uid, activeSite }: OverlayComposerProps) {
  const { type, setType, display, setDisplay, text, setText, bgColor, setBgColor, textColor, setTextColor, push, stop } =
    useOverlayComposer(uid, activeSite);

  const isLive = !!activeSite?.overlay?.active;
  const trimmed = text.trim();

  return (
    <div className="dash-panel" id="panelOverlay">
      <div className="dash-panel-head">
        <div>
          <h3>Live overlay</h3>
          <span className="dp-sub">Push something that shows full-screen on your site, right now.</span>
        </div>
      </div>
      <div className="dash-panel-body">
        {isLive && (
          <div className="overlay-live-banner">
            <span>
              Live now ({activeSite?.overlay?.type} · {activeSite?.overlay?.display || 'fullscreen'}):{' '}
              {activeSite?.overlay?.text}
            </span>
          </div>
        )}

        <div className="overlay-form">
          <div>
            <div className="overlay-field-label">Type</div>
            <div className="overlay-type-row">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`overlay-type-btn${type === opt.value ? ' active' : ''}`}
                  onClick={() => setType(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="overlay-field-label">Display</div>
            <div className="overlay-display-row">
              <button
                type="button"
                className={`overlay-display-btn${display === 'fullscreen' ? ' active' : ''}`}
                onClick={() => setDisplay('fullscreen' as OverlayDisplay)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                Full screen
              </button>
              <button
                type="button"
                className={`overlay-display-btn${display === 'popup' ? ' active' : ''}`}
                onClick={() => setDisplay('popup' as OverlayDisplay)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <rect x="12" y="12" width="7" height="7" rx="1" />
                </svg>
                Popup
              </button>
            </div>
          </div>

          <textarea
            rows={2}
            placeholder="What should visitors see?"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="overlay-color-row">
            <div className="overlay-color-group">
              <div className="overlay-field-label">Background</div>
              <ColorSwatches colors={OVERLAY_BG_SWATCHES} value={bgColor} onChange={setBgColor} />
            </div>
            <div className="overlay-color-group">
              <div className="overlay-field-label">Text</div>
              <ColorSwatches colors={OVERLAY_TEXT_SWATCHES} value={textColor} onChange={setTextColor} />
            </div>
          </div>

          <div>
            <div className="overlay-field-label">Preview</div>
            <div className="overlay-preview-wrap">
              <div className="overlay-preview-stage">
                {!trimmed ? (
                  <span className="overlay-preview-empty">Nothing to preview yet — write a message above.</span>
                ) : display === 'fullscreen' ? (
                  <div className="overlay-preview-full" style={{ background: bgColor, color: textColor }}>
                    {trimmed}
                  </div>
                ) : (
                  <div className="overlay-preview-popup" style={{ background: bgColor, color: textColor }}>
                    {trimmed}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="ghost-btn live" style={{ flex: 1, justifyContent: 'center', padding: 11 }} onClick={push}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                <path d="M4 12h16M4 6h16M4 18h10" />
              </svg>
              Push live
            </button>
            {isLive && (
              <button className="ghost-btn danger" onClick={stop}>
                Take down
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
