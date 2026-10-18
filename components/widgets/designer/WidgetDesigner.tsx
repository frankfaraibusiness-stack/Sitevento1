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
// WidgetsPageClient.tsx uses, so the designer carries the same top bar
// as the picker and the rest of the app.
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { useSiteWidget } from '@/hooks/useSiteWidget';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import type { AuthPane } from '@/hooks/useAuthForms';
import { getWidgetCatalogEntry, type WidgetFieldDef } from '@/lib/widgets';
import { CustomSelect } from './CustomSelect';
import { CustomColorPicker } from './CustomColorPicker';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { PhonePreview } from './PhonePreview';

const AUTO_MOUNT_NOTE =
  'This widget shows up on your site automatically — no code to paste. Want it in a specific spot on the page instead? Add ';
const MANUAL_ONLY_NOTE =
  'This widget only shows where you place it. Add this to your page where you want it to appear: ';

function FieldControl({ field, value, onChange }: { field: WidgetFieldDef; value: unknown; onChange: (v: string | number) => void }) {
  const strValue = value === undefined || value === null ? '' : String(value);

  switch (field.type) {
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
  const router = useRouter();
  const { user } = useAuth();
  const sidebar = useSidebar();
  const { activeSiteId, activeSite } = useSites(user?.uid ?? null);
  const entry = getWidgetCatalogEntry(widgetId);

  const { draft, loading, busy, dirty, isLive, patchConfig, saveConfig, enable, disable } = useSiteWidget(
    user?.uid ?? null,
    activeSite,
    widgetId
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [previewVisible, setPreviewVisible] = useState(true);

  useEffect(() => {
    if (!user) {
      setAuthPane('signin');
      setAuthOpen(true);
    }
  }, [user]);

  function flash(kind: 'ok' | 'error', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3200);
  }

  const siteUrl = useMemo(() => {
    if (!activeSite?.url) return null;
    try {
      const u = new URL(activeSite.url);
      return u.protocol === 'http:' || u.protocol === 'https:' ? activeSite.url : null;
    } catch {
      return null;
    }
  }, [activeSite?.url]);

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
    flash(ok ? 'ok' : 'error', ok ? 'Settings saved.' : 'Could not save.');
  }

  async function handleToggle(next: boolean) {
    const { ok } = next ? await enable() : await disable();
    const isManualOnly = entry?.position === 'manual-only';
    flash(
      ok ? 'ok' : 'error',
      ok
        ? next
          ? isManualOnly
            ? 'Turned on — add it to your page to show it (see below).'
            : 'Widget is live on your site.'
          : 'Widget turned off.'
        : 'Could not update.'
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

          {!user ? (
            <p className="wdg-row-note">Sign in to design and turn on this widget.</p>
          ) : !activeSiteId ? (
            <p className="wdg-row-note">Connect a site from your dashboard to turn widgets on.</p>
          ) : loading ? (
            <p className="wdg-row-note">{'Loading\u2026'}</p>
          ) : (
            <div className="wdg-layout">
              <div className="wdg-preview-col">
                <PhonePreview
                  widgetId={widgetId}
                  siteId={activeSite?.id || ''}
                  config={draft.config}
                  siteUrl={siteUrl}
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

                {entry.configFields.length > 0 && (
                  <section className="wdg-section">
                    <h4 className="wdg-section-title">Design it</h4>
                    <div className="wdg-group">
                      {entry.configFields.map((field) => (
                        <div key={field.key} className="wdg-row wdg-row-top">
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

      {toast && <div className={`wdg-toast is-${toast.kind}`} role="status">{toast.text}</div>}

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}
