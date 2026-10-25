'use client';

// components/widgets/designer/WidgetDesigner.tsx
//
// Shared designer shell for every /widgets/[widgetId] route (see
// app/widgets/[widgetId]/page.tsx). One component drives all current
// and future widgets off WIDGET_CATALOG[].configFields (lib/widgets.ts)
// — a new widget added to that catalog gets this exact page, with the
// live phone preview and custom controls, for free; nothing here is
// per-widget.
//
// Replaces the old overlay (components/dashboard/WidgetConfigPanel.tsx,
// still the generic-form approach it introduced, now expanded into a
// full page with a preview) which opened in place over /widgets; this
// is a real route instead so each widget gets its own indexable URL.
//
// Uses the same Header + Sidebar + useAuth/useSites wiring
// WidgetsPageClient.tsx uses — the app's one shared global auth state,
// not a page-local auth subscription — so the designer carries the
// same top bar and the same signed-in session as the picker and the
// rest of the app.
import { useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useSiteWidget } from '@/hooks/useSiteWidget';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useAuth } from '@/hooks/useAuth';
import { useUserProfile } from '@/hooks/useUserProfile';
import { PLANS } from '@/lib/plans';
import type { AuthPane } from '@/hooks/useAuthForms';
import { getWidgetCatalogEntry, UNIVERSAL_CONFIG_FIELDS, isPrizeList, type WidgetFieldDef, type Prize } from '@/lib/widgets';
import { AppSkeleton } from '@/components/AppSkeleton';
import { WidgetStatusPopup, type WidgetStatusPopupProps } from '@/components/widgets/WidgetStatusPopup';
import { CustomSelect } from './CustomSelect';
import { CustomColorPicker } from './CustomColorPicker';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { PrizeListField } from './PrizeListField';
import { WidgetPreview } from './WidgetPreview';

const AUTO_MOUNT_NOTE =
  'This widget shows up on your site automatically — no code to paste. Want it in a specific spot on the page instead? Add ';
const MANUAL_ONLY_NOTE =
  'This widget only shows where you place it. Add this to your page where you want it to appear: ';

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: WidgetFieldDef;
  value: unknown;
  onChange: (v: string | number | Prize[]) => void;
}) {
  const strValue = value === undefined || value === null ? '' : String(value);

  switch (field.type) {
    case 'prizeList':
      return <PrizeListField value={isPrizeList(value) ? value : (field.default as Prize[])} onChange={onChange} />;
    case 'select':
      return (
        <CustomSelect
          value={strValue || String(field.default)}
          options={field.options || []}
          onChange={onChange}
          label={field.label}
        />
      );
    case 'color':
      return <CustomColorPicker value={strValue} onChange={onChange} label={field.label} />;
    case 'datetime':
      return <CustomDateTimePicker value={strValue} onChange={onChange} label={field.label} />;
    case 'textarea':
      return (
        <span className="wdg-textarea-wrap">
          <textarea
            className="wdg-textarea"
            rows={3}
            value={strValue}
            maxLength={field.maxLength}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          {field.maxLength && <span className="wdg-count">{strValue.length}/{field.maxLength}</span>}
        </span>
      );
    case 'number':
      return (
        <input
          className="wdg-input"
          type="number"
          inputMode="decimal"
          value={strValue}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'url':
      return (
        <input
          className="wdg-input"
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
          className="wdg-input"
          value={strValue}
          maxLength={field.maxLength}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`wdg-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="wdg-switch-knob" />
    </button>
  );
}

export function WidgetDesigner({ widgetId }: { widgetId: string }) {
  const router = useNavRouter();
  // Same hooks/useAuth.ts every other authenticated route uses (see
  // WidgetsPageClient.tsx, DashboardClient.tsx) — not a page-local
  // auth subscription. useAuth() waits for setPersistence() to settle
  // before attaching onAuthStateChanged, so an already-signed-in
  // visitor doesn't read as signed-out for a beat on this route the
  // way a fresh, unsynced listener would; that's what previously made
  // this page re-prompt sign-in on every visit.
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId, activeSite } = useSites(user?.uid ?? null, user);
  const { planId } = useUserProfile(user);
  const canUseLogoBranding = PLANS.find((p) => p.id === planId)?.limits.customLogoBranding ?? false;
  const entry = getWidgetCatalogEntry(widgetId);

  const { draft, loading, busy, dirty, isLive, patchConfig, saveConfig, enable, disable } = useSiteWidget(
    user?.uid ?? null,
    activeSite,
    widgetId
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  // Replaces the old 3.2s auto-dismiss toast — a centered, branded
  // popup via WidgetStatusPopup.tsx (shared across the whole catalog)
  // that stays up until the person dismisses it, instead of
  // disappearing before some people get a chance to read it.
  const [popup, setPopup] = useState<Omit<WidgetStatusPopupProps, 'onClose' | 'open'> | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);

  // authReady only flips true once useAuth() has actually settled
  // (persistence restored + onAuthStateChanged's first callback), so
  // this only ever prompts sign-in for a visitor who is genuinely
  // signed out — never mid-restore.
  useEffect(() => {
    if (authReady && !user) {
      setAuthPane('signin');
      setAuthOpen(true);
    }
  }, [authReady, user]);

  function showPopup(kind: WidgetStatusPopupProps['kind'], title: string, message: string) {
    setPopup({ kind, title, message });
  }

  if (!entry) {
    return (
      <>
        <Header
          user={user}
          onLogoClick={() => router.push('/')}
          onSignupClick={() => { setAuthPane('signup'); setAuthOpen(true); }}
          onProfileClick={() => router.push('/dashboard')}
          onHamburgerClick={() => sidebar.setOpen(true)}
        />
        <main className="wdg-main">
          <div className="wdg-wrap">
            <p className="wdg-row-note">That widget doesn&rsquo;t exist. <a href="/widgets">Back to all widgets</a>.</p>
          </div>
        </main>
      </>
    );
  }

  async function handleSave() {
    const { ok } = await saveConfig();
    showPopup(
      ok ? 'on' : 'error',
      ok ? 'Settings saved' : 'Could not save',
      ok ? 'Your changes to this widget have been saved.' : 'Something went wrong saving your changes. Please try again.'
    );
  }

  async function handleToggle(next: boolean) {
    const { ok } = next ? await enable() : await disable();
    const isManualOnly = entry?.position === 'manual-only';
    if (!ok) {
      showPopup('error', 'Could not update', 'Something went wrong turning this widget on or off. Please try again.');
      return;
    }
    if (!next) {
      showPopup('off', 'Widget turned off', 'Visitors will no longer see this widget on your site.');
      return;
    }
    showPopup(
      'on',
      'Widget is live',
      isManualOnly
        ? 'Turned on — add it to your page using the snippet below to show it.'
        : `Visitors to ${activeSite?.name || 'your site'} can see this widget now.`
    );
  }

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => { setAuthPane('signup'); setAuthOpen(true); }}
        onProfileClick={() => router.push('/dashboard')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => { setAuthPane('signin'); setAuthOpen(true); }}
        onNavigate={(section) => {
          sidebar.setOpen(false);
          router.push(section === 'overview' ? '/dashboard' : `/dashboard#${section}`);
        }}
        onOpenProfile={() => {
          sidebar.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      <main className="wdg-main">
        <div className="wdg-wrap">
          <button type="button" className="wdg-back" onClick={() => router.push('/widgets')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>All widgets</span>
          </button>

          <div className="wdg-head">
            <h1>{entry.name}</h1>
            <p>{entry.description}</p>
          </div>

          {!authReady ? (
            <AppSkeleton label="Loading widget" />
          ) : !user ? (
            <p className="wdg-row-note">Sign in to design and turn on this widget.</p>
          ) : !activeSiteId ? (
            <p className="wdg-row-note">Connect a site from your dashboard to turn widgets on.</p>
          ) : loading ? (
            <AppSkeleton label="Loading widget" />
          ) : (
            <div className="wdg-layout">
              <div className="wdg-preview-col">
                <WidgetPreview
                  widgetId={widgetId}
                  siteId={activeSite?.id || ''}
                  position={entry.position}
                  config={draft.config}
                  visible={previewVisible}
                  onToggle={() => setPreviewVisible((v) => !v)}
                />
              </div>

              <div className="wdg-form-col">
                <section className="wdg-section">
                  <h4 className="wdg-section-title">Status</h4>
                  <div className="wdg-group">
                    <div className="wdg-row">
                      <span className="wdg-row-stack">
                        <span className="wdg-row-label">Live on {activeSite?.name}</span>
                        <span className="wdg-row-note">
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

                <section className="wdg-section">
                  <h4 className="wdg-section-title">Branding</h4>
                  <p className="wdg-section-sub">Label this widget and choose what shows on it — shared across every widget.</p>
                  <div className="wdg-group">
                    {UNIVERSAL_CONFIG_FIELDS.map((field) => {
                      const isLogoField = field.key === 'brandLogoUrl';
                      const isLogoMode = draft.config.brandMode === 'logo';
                      if (isLogoField && (!isLogoMode || !canUseLogoBranding)) return null;
                      if (field.key === 'brandText' && isLogoMode) return null;

                      // The "Custom logo" option is only offered to
                      // plans with customLogoBranding — rather than a
                      // silently-blocked click, it's left out of the
                      // dropdown entirely and a separate upgrade pill
                      // underneath explains why, so the option is
                      // discoverable without being selectable.
                      const resolvedField =
                        field.key === 'brandMode' && !canUseLogoBranding
                          ? { ...field, options: field.options?.filter((o) => o.value !== 'logo') }
                          : field;

                      return (
                        <div key={field.key} className="wdg-row wdg-row-top">
                          <span className="wdg-row-label">{field.label}</span>
                          <FieldControl
                            field={resolvedField}
                            value={draft.config[field.key]}
                            onChange={(v) => patchConfig({ [field.key]: v })}
                          />
                          {field.key === 'brandMode' && !canUseLogoBranding && (
                            <span className="wdg-upgrade-pill">
                              Want a custom logo instead of text? <a href="/dashboard/plans">Upgrade your plan</a>.
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {entry.configFields.length > 0 && (
                  <section className="wdg-section">
                    <h4 className="wdg-section-title">Design it</h4>
                    <div className="wdg-group">
                      {entry.configFields.map((field) => (
                        <div
                          key={field.key}
                          className={`wdg-row wdg-row-top${field.type === 'prizeList' ? ' wdg-row-stacked' : ''}`}
                        >
                          <span className="wdg-row-label">{field.label}</span>
                          <FieldControl
                            field={field}
                            value={draft.config[field.key]}
                            onChange={(v) => patchConfig({ [field.key]: v })}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="wdg-section">
                  <h4 className="wdg-section-title">Placement</h4>
                  <p className="wdg-row-note">
                    {entry.position === 'manual-only' ? MANUAL_ONLY_NOTE : AUTO_MOUNT_NOTE}
                    <code>&lt;div data-sitevento-widget=&quot;{widgetId}&quot;&gt;&lt;/div&gt;</code>
                    {' '}wherever you want it on the page.
                  </p>
                </section>

                <div className="wdg-bar">
                  <button type="button" className="ghost-btn live" onClick={handleSave} disabled={busy || !dirty}>
                    Save settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <WidgetStatusPopup
        open={!!popup}
        kind={popup?.kind ?? 'on'}
        title={popup?.title ?? ''}
        message={popup?.message ?? ''}
        onClose={() => setPopup(null)}
      />

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}
