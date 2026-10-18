'use client';

// components/dashboard/WidgetConfigPanel.tsx
//
// Opens when a WidgetsPanel card is clicked. One generic form driven by
// lib/widgets.ts's WIDGET_CATALOG[].configFields, rather than 10
// hand-written forms — a field's `type` picks the input, `saved`/`draft`
// + enable/disable/saveConfig come from useSiteWidget (same draft/saved/
// persist shape as BannerComposer/useOverlayComposer). Reuses the
// .bcp-* classes dashboard.css already defines for BannerComposer's
// rows/inputs/switch/bar so this doesn't need its own stylesheet.
import { useEffect, useState } from 'react';
import { useSiteWidget } from '@/hooks/useSiteWidget';
import { getWidgetCatalogEntry, type WidgetFieldDef } from '@/lib/widgets';
import type { Site } from '@/lib/types';

const AUTO_MOUNT_NOTE =
  'This widget shows up on your site automatically — no code to paste. Want it in a specific spot on the page instead? Add ';
const MANUAL_ONLY_NOTE =
  'This widget only shows where you place it. Add this to your page where you want it to appear: ';

interface WidgetConfigPanelProps {
  uid: string | null;
  activeSite: Site | null;
  widgetId: string;
  onClose: () => void;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`bcp-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="bcp-switch-knob" />
    </button>
  );
}

function FieldInput({ field, value, onChange }: { field: WidgetFieldDef; value: unknown; onChange: (v: string | number) => void }) {
  const strValue = value === undefined || value === null ? '' : String(value);
  switch (field.type) {
    case 'textarea':
      return (
        <span className="bcp-textarea-wrap">
          <textarea
            className="bcp-textarea"
            rows={3}
            value={strValue}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.maxLength && <span className="bcp-count">{strValue.length}/{field.maxLength}</span>}
        </span>
      );
    case 'color':
      return (
        <span className="bcp-color-ctrl">
          <span className="bcp-swatch-wrap" style={{ background: /^#[0-9a-f]{6}$/i.test(strValue) ? strValue : '#8a5a3c' }}>
            <input
              type="color"
              className="bcp-swatch-input"
              value={/^#[0-9a-f]{6}$/i.test(strValue) ? strValue : '#8a5a3c'}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${field.label} colour picker`}
            />
          </span>
          <input
            className="bcp-hex"
            value={strValue}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => onChange(e.target.value)}
          />
        </span>
      );
    case 'number':
      return (
        <input
          className="bcp-input"
          type="number"
          value={strValue}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'datetime':
      return (
        <input
          className="bcp-input"
          type="datetime-local"
          value={strValue}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'url':
      return (
        <input
          className="bcp-input"
          value={strValue}
          placeholder={field.placeholder || 'https://\u2026'}
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default:
      return (
        <input
          className="bcp-input"
          value={strValue}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

export function WidgetConfigPanel({ uid, activeSite, widgetId, onClose }: WidgetConfigPanelProps) {
  const entry = getWidgetCatalogEntry(widgetId);
  const { draft, loading, busy, dirty, isLive, patchConfig, saveConfig, enable, disable } = useSiteWidget(
    uid,
    activeSite,
    widgetId
  );
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  function flash(kind: 'ok' | 'error', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3200);
  }

  if (!entry) return null;

  async function handleSave() {
    const ok = await saveConfig();
    flash(ok ? 'ok' : 'error', ok ? 'Settings saved.' : 'Could not save.');
  }

  async function handleToggle(next: boolean) {
    const ok = next ? await enable() : await disable();
    flash(
      ok ? 'ok' : 'error',
      ok
        ? next
          ? entry.position === 'manual-only'
            ? 'Turned on — add it to your page to show it (see below).'
            : 'Widget is live on your site.'
          : 'Widget turned off.'
        : 'Could not update.'
    );
  }

  return (
    <div className="feat-panel-screen" role="dialog" aria-modal="true" aria-label={entry.name}>
      <div className="feat-panel-head">
        <div className="feat-panel-head-text">
          <h2>{entry.name}</h2>
          <span>{entry.description}</span>
        </div>
        <button type="button" className="feat-panel-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M5 5l14 14M19 5L5 19" />
          </svg>
        </button>
      </div>
      <div className="feat-panel-body">
        {!activeSite ? (
          <p className="bcp-row-note">Connect a site first to turn on widgets.</p>
        ) : loading ? (
          <p className="bcp-row-note">{'Loading\u2026'}</p>
        ) : (
          <div className="bcp-root">
            <div className="bcp-body">
              <div className="bcp-main">
                <section className="bcp-section">
                  <h4 className="bcp-section-title">Status</h4>
                  <div className="bcp-group">
                    <div className="bcp-row">
                      <span className="bcp-row-stack">
                        <span className="bcp-row-label">Live on {activeSite.name}</span>
                        <span className="bcp-row-note">
                          {isLive
                            ? entry.position === 'manual-only'
                              ? 'Live — visible wherever you\u2019ve placed it on your page.'
                              : 'Visitors see this widget now.'
                            : 'Not shown to visitors yet.'}
                        </span>
                      </span>
                      <Toggle on={isLive} onChange={handleToggle} label={`Enable ${entry.name}`} />
                    </div>
                  </div>
                </section>

                {entry.configFields.length > 0 && (
                  <section className="bcp-section">
                    <h4 className="bcp-section-title">Settings</h4>
                    <div className="bcp-group">
                      {entry.configFields.map((field) => (
                        <label key={field.key} className="bcp-row bcp-row-top">
                          <span className="bcp-row-label">{field.label}</span>
                          <FieldInput
                            field={field}
                            value={draft.config[field.key]}
                            onChange={(v) => patchConfig({ [field.key]: v })}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                <section className="bcp-section">
                  <h4 className="bcp-section-title">Placement</h4>
                  <p className="bcp-row-note">
                    {entry.position === 'manual-only' ? MANUAL_ONLY_NOTE : AUTO_MOUNT_NOTE}
                    <code>&lt;div data-sitevento-widget=&quot;{widgetId}&quot;&gt;&lt;/div&gt;</code>
                    {' '}wherever you want it on the page.
                  </p>
                </section>

                <div className="bcp-bar">
                  <button type="button" className="ghost-btn live" onClick={handleSave} disabled={busy || !dirty}>
                    Save settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {toast && <div className={`bcp-toast is-${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
