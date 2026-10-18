'use client';

// components/dashboard/BannerComposer.tsx — replaces OverlayComposer.
// Full-featured banner editor modeled on siterifty's console-site-alert
// experience: templates, live phone preview (rendering the exact
// BannerCard the visitor overlay mirrors), theme colors, artwork, and
// behaviour toggles (closable / reshow / notify-on-close), with a sticky
// action bar (Save draft / Push live / Take down).
import { useEffect, useState } from 'react';
import {
  OVERLAY_ART_OPTIONS,
  OVERLAY_LIMITS,
  OVERLAY_TEMPLATES,
  hasOverlayContent,
  isSafeColor,
  safeUrl,
  type OverlayArt,
  type OverlayTemplateId,
  type OverlayTheme,
  type SiteOverlayDoc,
} from '@/lib/siteAlert';
import { useOverlayComposer } from '@/hooks/useOverlayComposer';
import { BannerCard } from './BannerCard';
import type { OverlayStats, Site } from '@/lib/types';

interface BannerComposerProps {
  uid: string | null;
  activeSite: Site | null;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const isHex6 = /^#[0-9a-f]{6}$/i.test(value);

  return (
    <label className="bcp-row bcp-color-row">
      <span className="bcp-row-label">{label}</span>
      <span className="bcp-color-ctrl">
        <span className="bcp-swatch-wrap" style={{ background: value }}>
          {isHex6 && (
            <input
              type="color"
              className="bcp-swatch-input"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              aria-label={`${label} colour picker`}
            />
          )}
        </span>
        <input
          className="bcp-hex"
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
      className={`bcp-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="bcp-switch-knob" />
    </button>
  );
}

export function BannerComposer({ uid, activeSite }: BannerComposerProps) {
  const { draft, saved, patch, patchTheme, applyTemplate, dirty, isLive, busy, saveDraft, push, stop } =
    useOverlayComposer(uid, activeSite);

  const [confirm, setConfirm] = useState<null | 'push-live' | 'turn-off'>(null);
  const [toast, setToast] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function flash(kind: 'ok' | 'error', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3800);
  }

  async function handleSaveDraft() {
    const ok = await saveDraft();
    flash(ok ? 'ok' : 'error', ok ? 'Draft saved. Visitors can\u2019t see it.' : 'Could not save.');
  }

  async function handlePush() {
    if (isLive) {
      setConfirm('push-live');
      return;
    }
    const ok = await push();
    flash(ok ? 'ok' : 'error', ok ? 'Live! Every visitor sees it now.' : 'Could not push.');
  }

  async function confirmPush() {
    const ok = await push();
    setConfirm(null);
    flash(ok ? 'ok' : 'error', ok ? 'Updated \u2014 visitors see the new version now.' : 'Could not update.');
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

  const stats: OverlayStats = activeSite?.overlayStats || { impressions: 0, ctaClicks: 0, closes: 0 };

  if (!activeSite) return null;

  return (
    <div className={`bcp-root${isLive ? ' is-live' : ''}`} id="panelOverlay">
      <div className="bcp-body">
        <div className="bcp-layout">
          {/* ── Rail: template, live preview, stats ──────────────── */}
          <div className="bcp-rail">
            <section className="bcp-section">
              <h4 className="bcp-section-title">Start from a template</h4>
              <div className="bcp-templates" role="listbox" aria-label="Banner templates">
                {OVERLAY_TEMPLATES.map((t) => {
                  const selected = draft.template === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`bcp-tpl${selected ? ' is-selected' : ''}`}
                      onClick={() => applyTemplate(t.id as OverlayTemplateId)}
                    >
                      <span className="bcp-tpl-chip" style={{ background: `linear-gradient(135deg, ${t.theme.bgFrom}, ${t.theme.bgTo})` }}>
                        <span className="bcp-tpl-dot" style={{ background: t.theme.accent }} />
                      </span>
                      <span className="bcp-tpl-label">{t.label}</span>
                      <span className="bcp-tpl-blurb">{t.blurb}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="bcp-section">
              <h4 className="bcp-section-title">Preview</h4>
              <div className="bcp-phone-wrap">
                <div
                  className="bcp-phone"
                  aria-label="Banner preview"
                  style={{ background: `linear-gradient(160deg, ${draft.theme.bgFrom}, ${draft.theme.bgTo})` }}
                >
                  <div className="bcp-phone-notch" />
                  <div className="bcp-phone-screen">
                    {hasOverlayContent(draft) || draft.art !== 'none' ? (
                      <BannerCard overlay={draft} />
                    ) : (
                      <div className="bcp-preview-empty">Add a title or description to see it here.</div>
                    )}
                  </div>
                </div>
              </div>

              {isLive && (
                <div className="bcp-stats" role="status" aria-label="Live banner stats">
                  <div className="bcp-stats-row">
                    <div className="bcp-stat">
                      <span className="bcp-stat-num">{stats.impressions.toLocaleString()}</span>
                      <span className="bcp-stat-label">Impressions</span>
                    </div>
                    <div className="bcp-stat">
                      <span className="bcp-stat-num">{stats.ctaClicks.toLocaleString()}</span>
                      <span className="bcp-stat-label">{saved?.ctaLabel ? `Clicked "${saved.ctaLabel}"` : 'CTA clicks'}</span>
                    </div>
                    <div className="bcp-stat">
                      <span className="bcp-stat-num">{stats.closes.toLocaleString()}</span>
                      <span className="bcp-stat-label">Closed</span>
                    </div>
                  </div>
                  <p className="bcp-stats-note">This push only &mdash; resets the next time you update or re-push.</p>
                </div>
              )}
            </section>
          </div>

          {/* ── Main: editable sections ───────────────────────────── */}
          <div className="bcp-main">
            <div className="bcp-form-grid">
              <section className="bcp-section">
                <h4 className="bcp-section-title">Content</h4>
                <div className="bcp-group">
                  <label className="bcp-row">
                    <span className="bcp-row-label">Badge</span>
                    <input className="bcp-input" value={draft.badge} maxLength={OVERLAY_LIMITS.badge} placeholder="e.g. What's new" onChange={(e) => patch({ badge: e.target.value })} />
                  </label>
                  <label className="bcp-row">
                    <span className="bcp-row-label">Title</span>
                    <input className="bcp-input" value={draft.title} maxLength={OVERLAY_LIMITS.title} placeholder="Headline" onChange={(e) => patch({ title: e.target.value })} />
                  </label>
                  <label className="bcp-row bcp-row-top">
                    <span className="bcp-row-label">Message</span>
                    <span className="bcp-textarea-wrap">
                      <textarea
                        className="bcp-textarea"
                        rows={3}
                        value={draft.description}
                        maxLength={OVERLAY_LIMITS.description}
                        placeholder="What should visitors see?"
                        onChange={(e) => patch({ description: e.target.value })}
                      />
                      <span className="bcp-count">{draft.description.length}/{OVERLAY_LIMITS.description}</span>
                    </span>
                  </label>
                </div>
              </section>

              <section className="bcp-section">
                <h4 className="bcp-section-title">Button</h4>
                <div className="bcp-group">
                  <label className="bcp-row">
                    <span className="bcp-row-label">Label</span>
                    <input className="bcp-input" value={draft.ctaLabel} maxLength={OVERLAY_LIMITS.ctaLabel} placeholder="Optional, e.g. Learn more" onChange={(e) => patch({ ctaLabel: e.target.value })} />
                  </label>
                  <label className="bcp-row">
                    <span className="bcp-row-label">Link</span>
                    <input
                      className={`bcp-input${urlInvalid ? ' is-invalid' : ''}`}
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

              <section className="bcp-section">
                <h4 className="bcp-section-title">Artwork</h4>
                <div className="bcp-art-strip" role="listbox" aria-label="Artwork">
                  {OVERLAY_ART_OPTIONS.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="option"
                      aria-selected={draft.art === a.id}
                      className={`bcp-art-pill${draft.art === a.id ? ' is-selected' : ''}`}
                      onClick={() => patch({ art: a.id as OverlayArt })}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bcp-section">
                <h4 className="bcp-section-title">Display</h4>
                <div className="bcp-group">
                  <div className="bcp-row">
                    <span className="bcp-row-label">Shown as</span>
                    <span className="bcp-seg" role="radiogroup" aria-label="Display">
                      <button type="button" role="radio" aria-checked={draft.display === 'fullscreen'} className={`bcp-seg-btn${draft.display === 'fullscreen' ? ' is-on' : ''}`} onClick={() => patch({ display: 'fullscreen' })}>
                        Full screen
                      </button>
                      <button type="button" role="radio" aria-checked={draft.display === 'popup'} className={`bcp-seg-btn${draft.display === 'popup' ? ' is-on' : ''}`} onClick={() => patch({ display: 'popup' })}>
                        Popup
                      </button>
                    </span>
                  </div>
                </div>
              </section>

              <section className="bcp-section bcp-section-wide">
                <h4 className="bcp-section-title">Style</h4>
                <div className="bcp-group">
                  <ColorField label="Background top" value={draft.theme.bgFrom} onChange={(v) => patchTheme({ bgFrom: v })} />
                  <ColorField label="Background bottom" value={draft.theme.bgTo} onChange={(v) => patchTheme({ bgTo: v })} />
                  <ColorField label="Accent" value={draft.theme.accent} onChange={(v) => patchTheme({ accent: v })} />
                  <ColorField label="Button text" value={draft.theme.accentText} onChange={(v) => patchTheme({ accentText: v })} />
                  <ColorField label="Title" value={draft.theme.titleColor} onChange={(v) => patchTheme({ titleColor: v })} />
                  <ColorField label="Message text" value={draft.theme.textColor} onChange={(v) => patchTheme({ textColor: v })} />
                  <div className="bcp-row">
                    <span className="bcp-row-label">Card</span>
                    <span className="bcp-seg" role="radiogroup" aria-label="Card style">
                      {(['glass', 'solid'] as const).map((c) => (
                        <button key={c} type="button" role="radio" aria-checked={draft.theme.card === c} className={`bcp-seg-btn${draft.theme.card === c ? ' is-on' : ''}`} onClick={() => patchTheme({ card: c as OverlayTheme['card'] })}>
                          {c === 'glass' ? 'Glass' : 'Solid'}
                        </button>
                      ))}
                    </span>
                  </div>
                </div>
              </section>

              <section className="bcp-section bcp-section-wide">
                <h4 className="bcp-section-title">Behaviour</h4>
                <div className="bcp-group">
                  <div className="bcp-row">
                    <span className="bcp-row-stack">
                      <span className="bcp-row-label">Visitors can close it</span>
                      <span className="bcp-row-note">{draft.closable ? 'A close button is shown.' : 'No close button. It stays until you turn it off.'}</span>
                    </span>
                    <Toggle on={draft.closable} onChange={(v) => patch(v ? { closable: true, notifyOnClose: false } : { closable: false })} label="Visitors can close it" />
                  </div>

                  {draft.closable && (
                    <div className="bcp-row bcp-row-top bcp-row-wrap">
                      <span className="bcp-row-stack">
                        <span className="bcp-row-label">After they close it</span>
                        <span className="bcp-row-note">{draft.reshow === 'once' ? 'Stays closed until you push a new version.' : 'Comes back on every page refresh.'}</span>
                      </span>
                      <span className="bcp-seg" role="radiogroup" aria-label="After close">
                        <button type="button" role="radio" aria-checked={draft.reshow === 'once'} className={`bcp-seg-btn${draft.reshow === 'once' ? ' is-on' : ''}`} onClick={() => patch({ reshow: 'once' })}>
                          Stay closed
                        </button>
                        <button type="button" role="radio" aria-checked={draft.reshow === 'every'} className={`bcp-seg-btn${draft.reshow === 'every' ? ' is-on' : ''}`} onClick={() => patch({ reshow: 'every' })}>
                          Every refresh
                        </button>
                      </span>
                    </div>
                  )}

                  {!draft.closable && (
                    <div className="bcp-row bcp-row-top">
                      <span className="bcp-row-stack">
                        <span className="bcp-row-label">Let visitors ask to be notified</span>
                        <span className="bcp-row-note">{draft.notifyOnClose ? 'A "Notify me" email field is shown.' : 'No notify option. Locked visitors have no way to ask to hear back.'}</span>
                      </span>
                      <Toggle on={draft.notifyOnClose} onChange={(v) => patch({ notifyOnClose: v })} label="Let visitors ask to be notified" />
                    </div>
                  )}
                </div>
              </section>
            </div>

            {warnings.length > 0 && (
              <div className="bcp-warn" role="status">
                {warnings.map((w) => <p key={w}>{w}</p>)}
              </div>
            )}

            <div className="bcp-bar">
              {isLive && (
                <button type="button" className="ghost-btn danger" onClick={() => setConfirm('turn-off')} disabled={busy}>
                  Take down
                </button>
              )}
              <button type="button" className="ghost-btn" onClick={handleSaveDraft} disabled={busy || !dirty}>
                Save draft
              </button>
              <button type="button" className="ghost-btn live" onClick={handlePush} disabled={busy || blocking || (isLive && !dirty)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3}>
                  <path d="M4 12h16M4 6h16M4 18h10" />
                </svg>
                {busy ? 'Working\u2026' : isLive ? (dirty ? 'Update live banner' : 'Live') : 'Push live'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="bcp-sheet-backdrop" role="presentation" onClick={() => !busy && setConfirm(null)}>
          <div className="bcp-sheet" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="bcp-sheet-title">{confirm === 'push-live' ? 'Update the live banner?' : 'Turn the banner off?'}</div>
            <p className="bcp-sheet-msg">
              {confirm === 'push-live'
                ? 'Every visitor will see the new version immediately, including people who closed the old one.'
                : 'Visitors will stop seeing it right away. Your content is kept so you can turn it back on later.'}
            </p>
            <div className="bcp-sheet-actions">
              <button type="button" className="ghost-btn" onClick={() => setConfirm(null)} disabled={busy}>Cancel</button>
              <button type="button" className={`ghost-btn ${confirm === 'turn-off' ? 'danger' : 'live'}`} onClick={confirm === 'push-live' ? confirmPush : confirmStop} disabled={busy}>
                {busy ? 'Working\u2026' : confirm === 'push-live' ? 'Update now' : 'Turn off'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`bcp-toast is-${toast.kind}`} role="status">{toast.text}</div>}
    </div>
  );
}
