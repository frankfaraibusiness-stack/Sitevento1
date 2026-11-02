'use client';

// components/site-alert/SiteAlertPageClient.tsx
//
// Client half of /dashboard/features/site-alert (see that route's
// page.tsx). Replaces the old DashboardShell popup/full-screen panel
// (.feat-panel-screen wrapping <BannerComposer>) with a real standalone
// page — same Header + Sidebar + useAuth/useSidebar/useSites wiring as
// AgentPageClient.tsx, so Site Alert now behaves like every other Quick
// Tool instead of being the one tile that still opened an in-place
// overlay (see FeatureOptionsGrid.tsx's old header comment).
//
// All actual state/persistence still comes from
// hooks/useOverlayComposer.ts — that hook, lib/siteAlert.ts, and
// BannerCard.tsx are unchanged. This file (plus
// SiteAlertTemplatePicker.tsx) is a from-scratch UI layer on top of the
// same data.
import { useEffect, useState } from 'react';
import { useNavRouter } from '@/hooks/useNavPending';
import { Header } from '@/components/layout/Header';
import { Sidebar } from '@/components/layout/Sidebar';
import { AuthOverlay } from '@/components/auth/AuthOverlay';
import { AppSkeleton } from '@/components/AppSkeleton';
import { useAuth } from '@/hooks/useAuth';
import { useSidebar } from '@/hooks/useSidebar';
import { useSites } from '@/hooks/useSites';
import { useOverlayComposer } from '@/hooks/useOverlayComposer';
import type { AuthPane } from '@/hooks/useAuthForms';
import {
  OVERLAY_ART_OPTIONS,
  OVERLAY_LIMITS,
  hasOverlayContent,
  isSafeColor,
  safeUrl,
  type OverlayArt,
  type OverlayTemplateId,
  type OverlayTheme,
} from '@/lib/siteAlert';
import { BannerCard } from '@/components/dashboard/BannerCard';
import { SiteAlertTemplatePicker } from './SiteAlertTemplatePicker';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  // Re-sync the free-typed hex field whenever the draft's own value
  // changes from outside this input — e.g. picking a different
  // pre-built model swaps every theme color at once via applyTemplate,
  // and without this the text box would keep showing the old template's
  // hex instead of the new one's.
  useEffect(() => setText(value), [value]);
  const isHex6 = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <label className="sap-row sap-color-row">
      <span className="sap-row-label">{label}</span>
      <span className="sap-color-ctrl">
        <span className="sap-swatch-wrap" style={{ background: value }}>
          {isHex6 && (
            <input
              type="color"
              className="sap-swatch-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${label} colour picker`}
            />
          )}
        </span>
        <input
          className="sap-hex"
          value={text}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(e) => {
            setText(e.target.value);
            if (isSafeColor(e.target.value)) onChange(e.target.value.trim());
          }}
          onBlur={() => setText(value)}
          aria-label={`${label} value`}
        />
      </span>
    </label>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`sap-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="sap-switch-knob" />
    </button>
  );
}

export default function SiteAlertPageClient() {
  const router = useNavRouter();
  const { user, authReady } = useAuth();
  const sidebar = useSidebar();
  const { activeSite } = useSites(user?.uid ?? null);

  const [authOpen, setAuthOpen] = useState(false);
  const [authPane, setAuthPane] = useState<AuthPane>('signin');

  const { draft, saved, patch, patchTheme, applyTemplate, dirty, isLive, busy, saveDraft, push, stop } =
    useOverlayComposer(user?.uid ?? null, activeSite, user);

  const [previewDevice, setPreviewDevice] = useState<'phone' | 'desktop'>('phone');
  const [confirm, setConfirm] = useState<null | 'push' | 'push-live' | 'turn-off'>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function flash(kind: 'ok' | 'error', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3800);
  }

  async function handleSaveDraft() {
    const ok = await saveDraft();
    flash(ok ? 'ok' : 'error', ok ? 'Draft saved. Visitors can\u2019t see it.' : 'Could not save.');
  }

  // Every push now goes through a confirmation step first, whether this
  // is the first time going live or an update to an already-live
  // banner — so a stray tap near "Push live" never actually puts
  // something in front of every visitor by accident.
  function handlePushClick() {
    setConfirm(isLive ? 'push-live' : 'push');
  }

  async function confirmPush() {
    const wasLive = isLive;
    const ok = await push();
    setConfirm(null);
    flash(ok ? 'ok' : 'error', ok ? (wasLive ? 'Updated \u2014 visitors see the new version now.' : 'Live! Every visitor sees it now.') : 'Could not push.');
  }

  async function confirmStop() {
    const ok = await stop();
    setConfirm(null);
    flash(ok ? 'ok' : 'error', ok ? 'Banner turned off.' : 'Could not turn that off.');
  }

  const warnings: string[] = [];
  if (draft.active && !hasOverlayContent(draft)) warnings.push('Add a title or description before going live.');
  const rawUrl = draft.ctaUrl.trim();
  const urlInvalid = rawUrl !== '' && safeUrl(rawUrl) === '';
  if (urlInvalid) warnings.push('Link must start with / (same site) or http(s)://.');
  if (draft.ctaLabel && !draft.ctaUrl && !draft.closable) {
    warnings.push('This button has no link and visitors can\u2019t close the banner, so it would do nothing.');
  }
  const blocking = (draft.active && !hasOverlayContent(draft)) || urlInvalid;

  return (
    <>
      <Header
        user={user}
        onLogoClick={() => router.push('/')}
        onSignupClick={() => {
          setAuthPane('signup');
          setAuthOpen(true);
        }}
        onProfileClick={() => router.push('/dashboard')}
        onHamburgerClick={() => sidebar.setOpen(true)}
      />

      <Sidebar
        open={sidebar.open}
        user={user}
        leadsCount={0}
        onClose={() => sidebar.setOpen(false)}
        onSignIn={() => {
          setAuthPane('signin');
          setAuthOpen(true);
        }}
        onNavigate={(section) => {
          sidebar.setOpen(false);
          router.push(section === 'overview' ? '/dashboard' : `/dashboard#${section}`);
        }}
        onOpenProfile={() => {
          sidebar.setOpen(false);
          router.push('/dashboard/profile');
        }}
      />

      <main className="sap-main">
        <div className="sap-wrap">
          <button type="button" className="sap-back" onClick={() => router.push('/dashboard')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            <span>Dashboard</span>
          </button>

          <div className="sap-head">
            <span className="sap-head-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                <path d="M4 12h16M4 6h16M4 18h10" />
              </svg>
            </span>
            <div className="sap-head-top">
              <h1>Site Alert</h1>
              {isLive && <span className="sap-live-pill">Live</span>}
            </div>
            <p>Push a banner to every visitor on your site, right now &mdash; announcements, outages, sales. No redeploy needed.</p>
          </div>

          {!authReady ? (
            <AppSkeleton label="Loading" />
          ) : !user ? (
            <p className="sap-row-note">Sign in to set up a Site Alert.</p>
          ) : !activeSite ? (
            <p className="sap-row-note">Connect a site from your dashboard to push a banner to it.</p>
          ) : (
            <>
              {/* ── Pre-built models ──────────────────────────────── */}
              <SiteAlertTemplatePicker selected={draft.template} onSelect={(id: OverlayTemplateId) => applyTemplate(id)} />

              {/* ── Preview, with phone/desktop switch ────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Preview</h2>
                  <span className="sap-card-sub">What visitors will actually see</span>
                </div>

                <div className="sap-preview-switch" role="radiogroup" aria-label="Preview device">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={previewDevice === 'phone'}
                    className={`sap-device-btn${previewDevice === 'phone' ? ' is-on' : ''}`}
                    onClick={() => setPreviewDevice('phone')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
                      <path d="M10.5 18.5h3" strokeLinecap="round" />
                    </svg>
                    Phone
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={previewDevice === 'desktop'}
                    className={`sap-device-btn${previewDevice === 'desktop' ? ' is-on' : ''}`}
                    onClick={() => setPreviewDevice('desktop')}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <rect x="2.5" y="4" width="19" height="13" rx="2" />
                      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
                    </svg>
                    Desktop
                  </button>
                </div>

                {previewDevice === 'phone' ? (
                  <div className="sap-phone-wrap">
                    <div className="sap-phone" style={{ background: `linear-gradient(160deg, ${draft.theme.bgFrom}, ${draft.theme.bgTo})` }}>
                      <div className="sap-phone-notch" />
                      <div className="sap-phone-screen">
                        {hasOverlayContent(draft) || draft.art !== 'none' ? (
                          <BannerCard overlay={draft} />
                        ) : (
                          <div className="sap-preview-empty">Add a title or description to see it here.</div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="sap-desktop-wrap">
                    <div className="sap-desktop" style={{ background: `linear-gradient(160deg, ${draft.theme.bgFrom}, ${draft.theme.bgTo})` }}>
                      <div className="sap-desktop-bar">
                        <span className="sap-desktop-dot" />
                        <span className="sap-desktop-dot" />
                        <span className="sap-desktop-dot" />
                      </div>
                      <div className="sap-desktop-screen">
                        {hasOverlayContent(draft) || draft.art !== 'none' ? (
                          <BannerCard overlay={draft} />
                        ) : (
                          <div className="sap-preview-empty">Add a title or description to see it here.</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isLive && (
                  <div className="sap-stats" role="status" aria-label="Live banner stats">
                    <div className="sap-stats-row">
                      <div className="sap-stat">
                        <span className="sap-stat-num">{(activeSite.overlayStats?.impressions ?? 0).toLocaleString()}</span>
                        <span className="sap-stat-label">Impressions</span>
                      </div>
                      <div className="sap-stat">
                        <span className="sap-stat-num">{(activeSite.overlayStats?.ctaClicks ?? 0).toLocaleString()}</span>
                        <span className="sap-stat-label">{saved?.ctaLabel ? `Clicked "${saved.ctaLabel}"` : 'CTA clicks'}</span>
                      </div>
                      <div className="sap-stat">
                        <span className="sap-stat-num">{(activeSite.overlayStats?.closes ?? 0).toLocaleString()}</span>
                        <span className="sap-stat-label">Closed</span>
                      </div>
                    </div>
                    <p className="sap-stats-note">This push only &mdash; resets the next time you update or re-push.</p>
                  </div>
                )}
              </section>

              {/* ── Content ────────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Content</h2>
                  <span className="sap-card-sub">What the banner says</span>
                </div>
                <div className="sap-group">
                  <label className="sap-row">
                    <span className="sap-row-label">Badge</span>
                    <input className="sap-input" value={draft.badge} maxLength={OVERLAY_LIMITS.badge} placeholder="e.g. What's new" onChange={(e) => patch({ badge: e.target.value })} />
                  </label>
                  <label className="sap-row">
                    <span className="sap-row-label">Title</span>
                    <input className="sap-input" value={draft.title} maxLength={OVERLAY_LIMITS.title} placeholder="Headline" onChange={(e) => patch({ title: e.target.value })} />
                  </label>
                  <label className="sap-row sap-row-top">
                    <span className="sap-row-label">Message</span>
                    <span className="sap-textarea-wrap">
                      <textarea
                        className="sap-textarea"
                        rows={3}
                        value={draft.description}
                        maxLength={OVERLAY_LIMITS.description}
                        placeholder="What should visitors see?"
                        onChange={(e) => patch({ description: e.target.value })}
                      />
                      <span className="sap-count">{draft.description.length}/{OVERLAY_LIMITS.description}</span>
                    </span>
                  </label>
                </div>
              </section>

              {/* ── Button ─────────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Button</h2>
                  <span className="sap-card-sub">Optional &mdash; leave blank for no button</span>
                </div>
                <div className="sap-group">
                  <label className="sap-row">
                    <span className="sap-row-label">Label</span>
                    <input className="sap-input" value={draft.ctaLabel} maxLength={OVERLAY_LIMITS.ctaLabel} placeholder="Optional, e.g. Learn more" onChange={(e) => patch({ ctaLabel: e.target.value })} />
                  </label>
                  <label className="sap-row">
                    <span className="sap-row-label">Link</span>
                    <input
                      className={`sap-input${urlInvalid ? ' is-invalid' : ''}`}
                      value={draft.ctaUrl}
                      maxLength={OVERLAY_LIMITS.ctaUrl}
                      placeholder="/pricing or https://…  (blank = just closes)"
                      inputMode="url"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => patch({ ctaUrl: e.target.value })}
                    />
                  </label>
                </div>
              </section>

              {/* ── Artwork ────────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Artwork</h2>
                  <span className="sap-card-sub">A small icon shown above the title</span>
                </div>
                <div className="sap-art-strip" role="listbox" aria-label="Artwork">
                  {OVERLAY_ART_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={draft.art === a.id}
                      className={`sap-art-pill${draft.art === a.id ? ' is-selected' : ''}`}
                      onClick={() => patch({ art: a.id as OverlayArt })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </section>

              {/* ── Display ────────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Display</h2>
                  <span className="sap-card-sub">How it appears on the page</span>
                </div>
                <div className="sap-group">
                  <div className="sap-row">
                    <span className="sap-row-stack">
                      <span className="sap-row-label">Shown as</span>
                      <span className="sap-row-note">{draft.display === 'fullscreen' ? 'Covers the whole screen when it appears.' : 'A smaller card in the corner of the screen.'}</span>
                    </span>
                    <span className="sap-seg" role="radiogroup" aria-label="Display">
                      <button type="button" role="radio" aria-checked={draft.display === 'fullscreen'} className={`sap-seg-btn${draft.display === 'fullscreen' ? ' is-on' : ''}`} onClick={() => patch({ display: 'fullscreen' })}>
                        Full screen
                      </button>
                      <button type="button" role="radio" aria-checked={draft.display === 'popup'} className={`sap-seg-btn${draft.display === 'popup' ? ' is-on' : ''}`} onClick={() => patch({ display: 'popup' })}>
                        Popup
                      </button>
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Style ──────────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Style</h2>
                  <span className="sap-card-sub">Colors and card look</span>
                </div>
                <div className="sap-group">
                  <ColorField label="Background top" value={draft.theme.bgFrom} onChange={(v) => patchTheme({ bgFrom: v })} />
                  <ColorField label="Background bottom" value={draft.theme.bgTo} onChange={(v) => patchTheme({ bgTo: v })} />
                  <ColorField label="Accent" value={draft.theme.accent} onChange={(v) => patchTheme({ accent: v })} />
                  <ColorField label="Button text" value={draft.theme.accentText} onChange={(v) => patchTheme({ accentText: v })} />
                  <ColorField label="Title" value={draft.theme.titleColor} onChange={(v) => patchTheme({ titleColor: v })} />
                  <ColorField label="Message text" value={draft.theme.textColor} onChange={(v) => patchTheme({ textColor: v })} />
                  <div className="sap-row">
                    <span className="sap-row-label">Card</span>
                    <span className="sap-seg" role="radiogroup" aria-label="Card style">
                      {(['glass', 'solid'] as const).map((c) => (
                        <button key={c} type="button" role="radio" aria-checked={draft.theme.card === c} className={`sap-seg-btn${draft.theme.card === c ? ' is-on' : ''}`} onClick={() => patchTheme({ card: c as OverlayTheme['card'] })}>
                          {c === 'glass' ? 'Glass' : 'Solid'}
                        </button>
                      ))}
                    </span>
                  </div>
                </div>
              </section>

              {/* ── Behaviour ──────────────────────────────────────── */}
              <section className="sap-card">
                <div className="sap-card-head">
                  <h2 className="sap-card-title">Behaviour</h2>
                  <span className="sap-card-sub">How visitors can interact with it</span>
                </div>
                <div className="sap-group">
                  <div className="sap-row">
                    <span className="sap-row-stack">
                      <span className="sap-row-label">Visitors can close it</span>
                      <span className="sap-row-note">{draft.closable ? 'A close button is shown. Closable by default.' : 'No close button. It stays until you turn it off.'}</span>
                    </span>
                    <Toggle on={draft.closable} onChange={(v) => patch(v ? { closable: true, notifyOnClose: false } : { closable: false })} label="Visitors can close it" />
                  </div>

                  {draft.closable && (
                    <div className="sap-row sap-row-top sap-row-wrap">
                      <span className="sap-row-stack">
                        <span className="sap-row-label">After they close it</span>
                        <span className="sap-row-note">{draft.reshow === 'once' ? 'Stays closed until you push a new version.' : 'Comes back on every page refresh.'}</span>
                      </span>
                      <span className="sap-seg" role="radiogroup" aria-label="After close">
                        <button type="button" role="radio" aria-checked={draft.reshow === 'once'} className={`sap-seg-btn${draft.reshow === 'once' ? ' is-on' : ''}`} onClick={() => patch({ reshow: 'once' })}>
                          Stay closed
                        </button>
                        <button type="button" role="radio" aria-checked={draft.reshow === 'every'} className={`sap-seg-btn${draft.reshow === 'every' ? ' is-on' : ''}`} onClick={() => patch({ reshow: 'every' })}>
                          Every refresh
                        </button>
                      </span>
                    </div>
                  )}

                  {!draft.closable && (
                    <div className="sap-row sap-row-top">
                      <span className="sap-row-stack">
                        <span className="sap-row-label">Let visitors ask to be notified</span>
                        <span className="sap-row-note">{draft.notifyOnClose ? 'A "Notify me" email field is shown.' : 'No notify option. Locked visitors have no way to ask to hear back.'}</span>
                      </span>
                      <Toggle on={draft.notifyOnClose} onChange={(v) => patch({ notifyOnClose: v })} label="Let visitors ask to be notified" />
                    </div>
                  )}
                </div>
              </section>

              {warnings.length > 0 && (
                <div className="sap-warn" role="status">
                  {warnings.map((w) => <p key={w}>{w}</p>)}
                </div>
              )}

              {/* ── CTAs — not sticky, sit at the natural bottom of the
                  page with room to breathe once the person has scrolled
                  all the way through everything above. ──────────────── */}
              <div className="sap-cta-row">
                {isLive && (
                  <button type="button" className="ghost-btn danger" onClick={() => setConfirm('turn-off')} disabled={busy}>
                    Take down
                  </button>
                )}
                <button type="button" className="ghost-btn" onClick={handleSaveDraft} disabled={busy || !dirty}>
                  Save draft
                </button>
                <button type="button" className="ghost-btn live" onClick={handlePushClick} disabled={busy || blocking || (isLive && !dirty)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                    <path d="M4 12h16M4 6h16M4 18h10" />
                  </svg>
                  {busy ? 'Working\u2026' : isLive ? (dirty ? 'Update live banner' : 'Live') : 'Push live'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>

      {confirm && (
        <div className="sap-sheet-backdrop" role="presentation" onClick={() => !busy && setConfirm(null)}>
          <div className="sap-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="sap-sheet-title">
              {confirm === 'turn-off' ? 'Turn the banner off?' : confirm === 'push-live' ? 'Update the live banner?' : 'Push this live?'}
            </div>
            <p className="sap-sheet-msg">
              {confirm === 'turn-off'
                ? 'Visitors will stop seeing it right away. Your content is kept so you can turn it back on later.'
                : confirm === 'push-live'
                ? 'Every visitor will see the new version immediately, including people who closed the old one.'
                : 'Every visitor to your site will see this banner immediately. Double check it looks right in the preview above.'}
            </p>
            <div className="sap-sheet-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="button" className={`ghost-btn ${confirm === 'turn-off' ? 'danger' : 'live'}`} onClick={confirm === 'turn-off' ? confirmStop : confirmPush} disabled={busy}>
                {busy ? 'Working\u2026' : confirm === 'turn-off' ? 'Turn off' : confirm === 'push-live' ? 'Update now' : 'Push live'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`sap-toast is-${toast.kind}`} role="status">{toast.text}</div>}

      <AuthOverlay
        open={authOpen}
        initialPane={authPane}
        onClose={() => setAuthOpen(false)}
        onAuthSucceeded={() => setAuthOpen(false)}
      />
    </>
  );
}
