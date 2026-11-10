'use client';

// components/settings/panels/AppearancePanel.tsx
//
// Real functions, not placeholders: every choice here persists to
// Firestore at users/{uid}.settings via useUserSettings, reloads on
// every page load, AND actually changes the app — SettingsPageClient
// applies settings.fontSize/compactMode to <html data-font-size>/
// [data-compact] the moment they load or change (see its own effect),
// and styles/settings/settings-page.css + base.css read those attributes to
// resize text and tighten spacing across the dashboard, not just this
// page. Dashboard Landing View is persisted and read by
// DashboardClient on load to pick the opening panel. Theme Colour
// works the same way: hooks/useAppliedAppearance.ts applies
// settings.themeColor as an inline --app-bg override on <html> the
// moment it loads or changes, and base.css's `html, body { background:
// var(--app-bg) }` (the single source of truth for the page background
// everywhere) picks it up automatically.
import { useEffect, useState } from 'react';
import type { UserSettings } from '@/hooks/useUserSettings';
import { THEME_COLOR_PRESETS, isValidThemeColor, normalizeThemeColorInput } from '@/lib/theme';
import { useNavRouter } from '@/hooks/useNavPending';
import type { PlanId } from '@/lib/plans';

const FONT_SIZES: { key: UserSettings['fontSize']; label: string; glyphSize: string }[] = [
  { key: 'small', label: 'Small', glyphSize: '0.72rem' },
  { key: 'medium', label: 'Medium', glyphSize: '0.9rem' },
  { key: 'large', label: 'Large', glyphSize: '1.1rem' },
];

// 'visits' and 'leads' used to be selectable here too, but
// DashboardClient's landing-section scroll target for each
// (#panelVisits / #panelLeads) was removed when DashboardShell was
// rebuilt around the dx-wrap/#dashMain layout — picking either one
// silently did nothing (see DashboardClient.tsx's LANDING_VIEW_SECTION
// and hooks/useAppView.ts's matching SECTION_ANCHORS). Trimmed down to
// the two options that actually land somewhere: 'overview' scrolls
// nowhere (it's the top of the page already), 'sites' intentionally
// maps to 'overview' too since Connected Sites has no separate anchor
// of its own — both are honest no-ops rather than broken ones.
const LANDING_VIEWS: { value: UserSettings['landingView']; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'sites', label: 'Connected Sites' },
];

interface AppearancePanelProps {
  settings: UserSettings;
  settingsLoaded: boolean;
  settingsSaving: boolean;
  updateSettings: (patch: Partial<UserSettings>) => Promise<boolean>;
  // Theme Colour (the page-background override below) is a paid-plan
  // perk — a Ventol Free account sees the section locked with an upgrade
  // nudge instead of the live swatch picker. Every other appearance
  // control (font size, compact mode, landing view) stays free-tier.
  planId: PlanId;
}

export default function AppearancePanel({ settings, settingsLoaded, settingsSaving, updateSettings, planId }: AppearancePanelProps) {
  const router = useNavRouter();
  const themeLocked = planId === 'free';
  // Local draft for the free-text hex field — kept separate from
  // settings.themeColor so the input can hold invalid/in-progress text
  // (e.g. "#d3f") without that ever reaching updateSettings, which only
  // fires once normalizeThemeColorInput confirms a complete, valid hex.
  const [hexDraft, setHexDraft] = useState(settings.themeColor);
  const [hexError, setHexError] = useState(false);

  // settings.themeColor can change out from under this draft — most
  // commonly the initial Firestore load resolving just after mount
  // (settings starts as DEFAULT_SETTINGS, then the real value arrives),
  // or a sync from another tab/device. Only resync while the field
  // isn't showing a validation error, so this doesn't stomp someone
  // actively correcting a typo.
  useEffect(() => {
    if (!hexError) setHexDraft(settings.themeColor);
  }, [settings.themeColor, hexError]);

  function applyHex(raw: string) {
    setHexDraft(raw);
    const normalized = normalizeThemeColorInput(raw);
    if (normalized === null) {
      setHexError(true);
      return;
    }
    setHexError(false);
    if (normalized !== settings.themeColor) {
      updateSettings({ themeColor: normalized });
    }
  }

  function applyPreset(hex: string) {
    setHexDraft(hex);
    setHexError(false);
    updateSettings({ themeColor: hex });
  }

  return (
    <>
      <div className="settings-panel-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a10 10 0 0 1 0 20" />
        </svg>
        <h3>Appearance</h3>
      </div>
      <p className="settings-panel-desc">Adjust how the dashboard displays for you.</p>
      <hr className="settings-divider" />

      <div className="settings-input-group">
        <label>Font Size</label>
        <p className="settings-field-desc">Applies across the dashboard. Saved automatically.</p>
        <div className="settings-picker-row">
          {FONT_SIZES.map((f) => {
            const active = settings.fontSize === f.key;
            return (
              <button
                key={f.key}
                type="button"
                className={`settings-picker-btn${active ? ' active' : ''}`}
                disabled={!settingsLoaded}
                onClick={() => updateSettings({ fontSize: f.key })}
              >
                <span style={{ fontSize: f.glyphSize }}>Aa</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="settings-toggle-item">
        <div className="settings-toggle-label-wrap">
          <span className="settings-toggle-label">Compact Mode</span>
          <span className="settings-toggle-sublabel">Reduce spacing to fit more content on screen.</span>
        </div>
        <label className="settings-toggle-switch">
          <input
            type="checkbox"
            checked={settings.compactMode}
            disabled={!settingsLoaded}
            onChange={(e) => updateSettings({ compactMode: e.target.checked })}
          />
          <span className="slider" />
        </label>
      </div>

      <div className="settings-input-group">
        <label>Dashboard Landing View</label>
        <p className="settings-field-desc">Which panel opens first when you sign in. Saved automatically.</p>
        <select
          className="settings-select"
          value={settings.landingView}
          disabled={!settingsLoaded}
          onChange={(e) => updateSettings({ landingView: e.target.value as UserSettings['landingView'] })}
        >
          {LANDING_VIEWS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      </div>

      <div className={`settings-input-group${themeLocked ? ' settings-group-locked' : ''}`}>
        <div className="settings-label-row">
          <label>Theme Colour</label>
          {themeLocked && (
            <span className="settings-plan-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V7a4 4 0 0 1 8 0v4" />
              </svg>
              Paid plans
            </span>
          )}
        </div>
        <p className="settings-field-desc">
          Sets the app&rsquo;s background colour. Pick a preset or enter your own hex code. Saved automatically.
        </p>

        {themeLocked ? (
          <div className="settings-locked-panel">
            <div className="settings-locked-swatches" aria-hidden="true">
              {THEME_COLOR_PRESETS.slice(0, 5).map((hex) => (
                <span key={hex} className="settings-swatch-dot" style={{ background: hex }} />
              ))}
            </div>
            <p className="settings-locked-copy">
              Custom theme colours are available on Ventol Starter and above. Upgrade to pick your own background colour.
            </p>
            <button type="button" className="settings-locked-upgrade-btn" onClick={() => router.push('/dashboard/plans')}>
              Upgrade plan
            </button>
          </div>
        ) : (
          <>
            <div className="settings-picker-row">
              {THEME_COLOR_PRESETS.map((hex) => {
                const active = settings.themeColor === hex;
                return (
                  <button
                    key={hex}
                    type="button"
                    className={`settings-picker-btn settings-swatch-btn${active ? ' active' : ''}`}
                    disabled={!settingsLoaded}
                    onClick={() => applyPreset(hex)}
                    aria-label={`Use ${hex} as the theme colour`}
                  >
                    <span className="settings-swatch-dot" style={{ background: hex }} />
                    <span>{hex}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`settings-picker-btn settings-swatch-btn${!settings.themeColor ? ' active' : ''}`}
                disabled={!settingsLoaded}
                onClick={() => applyPreset('')}
              >
                <span className="settings-swatch-dot settings-swatch-dot--default" />
                <span>Default</span>
              </button>
            </div>
            <div className="settings-field-row" style={{ marginTop: '0.5rem' }}>
              <input
                type="text"
                inputMode="text"
                className="settings-text-input"
                placeholder="#d3fcaa"
                maxLength={7}
                value={hexDraft}
                disabled={!settingsLoaded}
                onChange={(e) => applyHex(e.target.value)}
                aria-invalid={hexError}
              />
              <input
                type="color"
                className="settings-swatch-picker"
                value={settings.themeColor && isValidThemeColor(settings.themeColor) ? settings.themeColor : '#cbff70'}
                disabled={!settingsLoaded}
                onChange={(e) => applyHex(e.target.value)}
                aria-label="Pick a custom theme colour"
              />
            </div>
            {hexError && <span className="settings-hint settings-hint-error">Enter a valid hex code, like #d3fcaa.</span>}
          </>
        )}
      </div>

      {settingsSaving && <span className="settings-hint">Saving…</span>}
    </>
  );
}
