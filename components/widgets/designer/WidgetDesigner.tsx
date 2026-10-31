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
import {
  getWidgetCatalogEntry,
  UNIVERSAL_CONFIG_FIELDS,
  isPrizeList,
  isFaqList,
  canUseVisitBasedTrigger,
  type WidgetFieldDef,
  type Prize,
  type FaqItem,
} from '@/lib/widgets';
import { AppSkeleton } from '@/components/AppSkeleton';
import { WidgetStatusPopup, UpsellPopup, type WidgetStatusPopupProps } from '@/components/widgets/WidgetStatusPopup';
import { CustomSelect } from './CustomSelect';
import { CustomColorPicker } from './CustomColorPicker';
import { CustomDateTimePicker } from './CustomDateTimePicker';
import { PrizeListField } from './PrizeListField';
import { FaqListField } from './FaqListField';
import { WidgetPreview } from './WidgetPreview';

const AUTO_MOUNT_NOTE =
  'This widget shows up on your site automatically — no code to paste. Want it in a specific spot on the page instead? Add ';
const MANUAL_ONLY_NOTE =
  'This widget only shows where you place it. Add this to your page where you want it to appear: ';

function FieldControl({
  field,
  value,
  onChange,
  siteId,
  siteUrl,
}: {
  field: WidgetFieldDef;
  value: unknown;
  onChange: (v: string | number | Prize[] | FaqItem[]) => void;
  // Only used by 'faqList' (AI generation needs to know which site
  // it's generating for, and optionally that site's own URL to pull
  // context from) — every other field type ignores these.
  siteId?: string;
  siteUrl?: string;
}) {
  const strValue = value === undefined || value === null ? '' : String(value);

  switch (field.type) {
    case 'prizeList':
      return <PrizeListField value={isPrizeList(value) ? value : (field.default as Prize[])} onChange={onChange} />;
    case 'faqList':
      return (
        <FaqListField
          value={isFaqList(value) ? value : (field.default as FaqItem[])}
          onChange={onChange}
          siteId={siteId}
          siteUrl={siteUrl}
        />
      );
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
          min={field.min}
          max={field.max}
          value={strValue}
          placeholder={field.placeholder}
          onChange={(e) => {
            if (e.target.value === '') {
              onChange('');
              return;
            }
            let n = Number(e.target.value);
            if (typeof field.min === 'number') n = Math.max(field.min, n);
            if (typeof field.max === 'number') n = Math.min(field.max, n);
            onChange(n);
          }}
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

function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      aria-disabled={disabled}
      disabled={disabled}
      className={`wdg-switch${on ? ' is-on' : ''}`}
      onClick={() => !disabled && onChange(!on)}
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
  // Email Capture's visit-based trigger (triggerType:'visits') is a
  // paid-plan feature — see lib/widgets.ts's canUseVisitBasedTrigger.
  // useUserProfile defaults planId to 'free' until the real doc loads,
  // which is also the right fallback here (no premature premium flash).
  const canUseVisitTrigger = canUseVisitBasedTrigger(planId);
  const entry = getWidgetCatalogEntry(widgetId);

  const { draft, loading, busy, dirty, isLive, liveStatus, patchConfig, saveConfig, enable, disable } = useSiteWidget(
    user?.uid ?? null,
    activeSite,
    widgetId
  );
  // The toggle itself is gated on this, not just on `isLive`: a site
  // that isn't verified yet should never let the owner flip the
  // switch on at all (matches app/api/site-widget/route.ts's
  // checkLiveStatus, reason SITE_NOT_VERIFIED) rather than letting
  // them toggle it and then telling them it didn't work.
  const siteVerified = activeSite?.status === 'verified';

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');
  // Replaces the old 3.2s auto-dismiss toast — a centered, branded
  // popup via WidgetStatusPopup.tsx (shared across the whole catalog)
  // that stays up until the person dismisses it, instead of
  // disappearing before some people get a chance to read it.
  const [popup, setPopup] = useState<Omit<WidgetStatusPopupProps, 'onClose' | 'open'> | null>(null);
  // Separate from `popup`: shown instead of a plain status popup
  // whenever a toggle/save is blocked specifically by the site not
  // being verified, since that's the one gate the owner can actually
  // go fix right now — see presentLiveStatus/goVerify below.
  const [verifyUpsellOpen, setVerifyUpsellOpen] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(true);

  // Same minimum-hold floor DashboardClient.tsx uses (see that file):
  // useAuth() flips authReady true as soon as the FIRST of its two
  // async checks resolves — usually the server session check
  // (hooks/useAuth.ts), which confirms someone IS signed in but can't
  // fill in `user` itself. The real `User` object only lands a beat
  // later, from the client SDK's onAuthStateChanged listener. Gating
  // only on authReady (as this page used to) meant that gap was
  // visible: on a hard refresh, authReady flipped true with user still
  // null, and this page immediately popped the sign-in modal before
  // the real user arrived and proved it wasn't needed — "forward like
  // stupid" instead of actually waiting to find out. A short, fixed
  // hold keeps the loading skeleton up long enough for that second
  // step to resolve first in the overwhelming majority of cases,
  // exactly like every other authenticated route already does.
  const [minHoldDone, setMinHoldDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMinHoldDone(true), 600);
    return () => clearTimeout(t);
  }, []);

  const authSettled = authReady && minHoldDone;

  // Gated on authSettled, not just authReady, so this never fires
  // during that still-resolving window above. Also closes the modal
  // back up if `user` shows up after it was opened (e.g. the client
  // listener was unusually slow and landed just after the hold) —
  // previously nothing did this, so a late-arriving user left a
  // needless "please sign in" modal sitting open over someone who was
  // in fact already signed in.
  useEffect(() => {
    if (!authSettled) return;
    if (!user) {
      setAuthPane('signin');
      setAuthOpen(true);
    } else {
      setAuthOpen(false);
    }
  }, [authSettled, user]);

  function showPopup(kind: WidgetStatusPopupProps['kind'], title: string, message: string) {
    setPopup({ kind, title, message });
  }

  function goVerify() {
    setVerifyUpsellOpen(false);
    if (activeSite) {
      router.push(`/dashboard/connect?site=${encodeURIComponent(activeSite.id)}&url=${encodeURIComponent(activeSite.url)}`);
    } else {
      router.push('/dashboard/connect');
    }
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

  // Shared by handleSave and handleToggle: turns a returned liveStatus
  // into the right popup instead of ever collapsing it down to a bare
  // "it saved" message. `context` only picks wording ("Settings saved"
  // vs "Widget turned on") — the branching on status.state/reason is
  // identical either way.
  function presentLiveStatus(
    status: { state: 'live'; message: string } | { state: 'saved_but_blocked'; reason: string; message: string } | { state: 'saved_off'; message: string } | null,
    context: 'save' | 'toggle-on' | 'toggle-off'
  ) {
    if (!status) {
      showPopup('error', 'Could not confirm status', 'Your changes were saved, but we could not confirm whether the widget is actually live. Reload this page to check.');
      return;
    }

    if (status.state === 'live') {
      showPopup(
        'on',
        context === 'save' ? 'Settings saved — widget is live' : 'Widget is live',
        status.message
      );
      return;
    }

    if (status.state === 'saved_off') {
      showPopup(
        'off',
        context === 'save' ? 'Settings saved' : 'Widget turned off',
        status.message
      );
      return;
    }

    // saved_but_blocked. The write itself succeeded — this is never an
    // "error" popup — but it must never read as "live" either. For the
    // one gate the owner can fix immediately (an unverified site),
    // route to the upsell with a real "go verify" CTA instead of a
    // dead-end status message.
    if (status.reason === 'SITE_NOT_VERIFIED') {
      setVerifyUpsellOpen(true);
      return;
    }
    showPopup(
      'error',
      context === 'save' ? 'Saved, but not live' : 'Turned on, but not live yet',
      status.message
    );
  }

  async function handleSave() {
    const { ok, liveStatus: status } = await saveConfig();
    if (!ok) {
      showPopup('error', 'Could not save', 'Something went wrong saving your changes. Please try again.');
      return;
    }
    presentLiveStatus(status, 'save');
  }

  async function handleToggle(next: boolean) {
    // The toggle is also disabled in the UI when the site isn't
    // verified (see the Toggle usage below), but this guard covers any
    // path that could still call handleToggle(true) directly.
    if (next && !siteVerified) {
      setVerifyUpsellOpen(true);
      return;
    }
    const { ok, liveStatus: status } = next ? await enable() : await disable();
    if (!ok) {
      showPopup('error', 'Could not update', 'Something went wrong turning this widget on or off. Please try again.');
      return;
    }
    presentLiveStatus(status, next ? 'toggle-on' : 'toggle-off');
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

          {!authSettled ? (
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
                          {!siteVerified
                            ? 'Verify this site before turning widgets on.'
                            : isLive
                            ? entry.position === 'manual-only'
                              ? 'Live — visible wherever you\u2019ve placed it on your page.'
                              : 'Visitors see this widget now.'
                            : 'Not shown to visitors yet.'}
                        </span>
                      </span>
                      <Toggle
                        on={isLive}
                        onChange={handleToggle}
                        label={`Enable ${entry.name}`}
                        disabled={!siteVerified}
                      />
                    </div>
                    {!siteVerified && (
                      <span className="wdg-upgrade-pill">
                        This site isn&rsquo;t verified yet, so widgets won&rsquo;t show for visitors.{' '}
                        <a
                          href="/dashboard/connect"
                          onClick={(e) => {
                            e.preventDefault();
                            goVerify();
                          }}
                        >
                          Verify it now
                        </a>
                        .
                      </span>
                    )}
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
                      {entry.configFields.map((field) => {
                        // Email Capture only: 'delaySeconds' and
                        // 'visitThreshold' are two alternative triggers
                        // for the same popup, not two settings used
                        // together — only show the one matching the
                        // current triggerType (defaulting to 'time' if
                        // unset, matching the catalog default).
                        if (widgetId === 'email-capture') {
                          const triggerType = (draft.config.triggerType as string) || 'time';
                          if (field.key === 'delaySeconds' && triggerType !== 'time') return null;
                          if (field.key === 'visitThreshold' && triggerType !== 'visits') return null;
                        }

                        // The 'visits' option on triggerType is only
                        // offered to plans that pass canUseVisitTrigger
                        // — left out of the dropdown entirely (same
                        // discoverable-but-not-selectable pattern as
                        // brandMode's 'logo' option above) rather than
                        // letting it be picked and then silently never
                        // actually gated anywhere.
                        const resolvedField =
                          field.key === 'triggerType' && !canUseVisitTrigger
                            ? { ...field, options: field.options?.filter((o) => o.value !== 'visits') }
                            : field;

                        return (
                          <div
                            key={field.key}
                            className={`wdg-row wdg-row-top${field.type === 'prizeList' || field.type === 'faqList' ? ' wdg-row-stacked' : ''}`}
                          >
                            <span className="wdg-row-label">{field.label}</span>
                            <FieldControl
                              field={resolvedField}
                              value={draft.config[field.key]}
                              onChange={(v) => {
                                // Falling back off 'visits' to 'time'
                                // when switching away isn't needed here
                                // (the dropdown can't offer 'visits' to
                                // begin with on a Free plan) — this just
                                // writes whatever the control produced.
                                patchConfig({ [field.key]: v });
                              }}
                              siteId={activeSite?.id}
                              siteUrl={activeSite?.url}
                            />
                            {field.key === 'triggerType' && !canUseVisitTrigger && (
                              <span className="wdg-upgrade-pill">
                                Want to trigger this by return visits instead of a timer? <a href="/dashboard/plans">Upgrade your plan</a>.
                              </span>
                            )}
                          </div>
                        );
                      })}
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

      <UpsellPopup
        open={verifyUpsellOpen}
        title="Verify your site to go live"
        message={`${activeSite?.name || 'This site'} hasn\u2019t been verified yet, so visitors won\u2019t see this widget even after you turn it on or save settings. Verify it now and you can set it live right away.`}
        onGoLive={goVerify}
        onClose={() => setVerifyUpsellOpen(false)}
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
