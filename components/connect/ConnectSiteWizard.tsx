'use client';

// components/connect/ConnectSiteWizard.tsx — three-step "connect your
// site" flow: 1) domain + what you're granting sitevento, 2) paste the
// tag + verify, 3) you're connected — with a copyable tag and a
// pre-written AI-coding-assistant prompt for anyone who'd rather have
// their AI agent paste it in for them. Driven by useConnectSiteWizard;
// step switching is React state instead of toggling display:none
// across sibling divs. No hardcoded background anywhere in this tree —
// every surface reads var(--bg)/var(--cream)/var(--ink) etc. from
// styles/base.css's single fixed palette (this app has no separate
// light/dark mode to track), so it always matches the rest of the app.
import { useEffect, useMemo, useState } from 'react';
import { useConnectSiteWizard, type LimitStatus } from '@/hooks/useConnectSiteWizard';
import { DomainIntelCard } from '@/components/connect/DomainIntelCard';
import { ConnectPermissionsGrid } from '@/components/connect/ConnectPermissionsGrid';
import { ConnectBlob } from '@/components/connect/ConnectBlob';
import type { PlanId } from '@/lib/plans';

export interface ConnectSiteResumeTarget {
  id: string;
  url: string;
}

interface ConnectSiteWizardProps {
  open: boolean;
  uid: string | null;
  plan?: PlanId;
  resumeTarget: ConnectSiteResumeTarget | null;
  onClose: () => void;
  onFinished: (siteId: string | null) => void;
  // Safety net: /api/site-limits is checked BEFORE the wizard even
  // opens (see DashboardClient's openAddSiteModal), so this is only
  // reached if the account went from "under limit" to "at limit"
  // between that check and hitting Continue here — e.g. another tab
  // connected a site in the meantime. app/api/connect-site/route.ts
  // re-checks atomically at creation time regardless, so this is
  // purely about giving the user the same UpsellOverlay experience
  // instead of a plain inline error in that race window.
  onLimitReached?: (status: LimitStatus) => void;
  onUpgradeClick?: () => void;
}

const STEP_INDEX: Record<'domain' | 'tag' | 'success', number> = { domain: 1, tag: 2, success: 3 };

export function ConnectSiteWizard({
  open,
  uid,
  plan = 'free',
  resumeTarget,
  onClose,
  onFinished,
  onLimitReached,
  onUpgradeClick,
}: ConnectSiteWizardProps) {
  const wizard = useConnectSiteWizard(uid, plan);

  useEffect(() => {
    if (wizard.limitStatus.state === 'reached' && onLimitReached) {
      onLimitReached(wizard.limitStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.limitStatus]);

  // Open fresh each time the modal opens: either resume a pending site's
  // verify step, or reset to a blank domain step — mirrors
  // openAddSiteModal()/resumeVerification() from the original.
  useEffect(() => {
    if (!open) return;
    if (resumeTarget) {
      wizard.resumeVerification(resumeTarget);
    } else {
      wizard.reset();
    }
    document.body.style.overflow = 'hidden';
    return () => {
      wizard.teardownWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, resumeTarget]);

  useEffect(() => {
    if (!open) document.body.style.overflow = '';
  }, [open]);

  if (!open) return null;

  function handleClose() {
    document.body.style.overflow = '';
    onClose();
  }

  function handleUpgrade() {
    if (onUpgradeClick) onUpgradeClick();
  }

  return (
    <div className="connect-overlay open" aria-hidden={!open}>
      <button className="connect-exit" aria-label="Close" onClick={handleClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Full-screen pass/fail flash — see useConnectSiteWizard's
          statusBanner. Sits above everything else in the overlay,
          including the exit button, briefly, then clears itself. */}
      <ConnectStatusBanner kind={wizard.statusBanner} onDismiss={wizard.dismissBanner} />

      <ConnectProgressRail step={wizard.step} />

      <div className="connect-stage">
        <div className="connect-card">
          {/* STEP 1: domain + permissions */}
          {wizard.step === 'domain' && (
            <div className="connect-step">
              <span className="connect-step-label">
                <span className="dot" />
                Step 1 of 3
              </span>
              <h2>Connect your site</h2>
              <p className="connect-sub">
                Enter your domain — with or without <code>https://</code> — and choose what you&apos;re giving
                sitevento access to do. We&apos;ll generate a unique tag next.
              </p>

              <form onSubmit={wizard.submitDomain}>
                <div className={`connect-field${wizard.domainError ? ' has-error' : ''}`}>
                  <label htmlFor="connect-domain">Site domain</label>
                  <input
                    id="connect-domain"
                    type="text"
                    inputMode="url"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    placeholder="yourbusiness.com"
                    required
                    value={wizard.domainInput}
                    onChange={(e) => wizard.setDomainInput(e.target.value)}
                  />
                  <span className="err-msg">{wizard.domainError}</span>
                </div>

                <DomainIntelCard status={wizard.domainLookupStatus} result={wizard.domainLookupResult} />

                <ConnectPermissionsGrid
                  plan={plan}
                  selectedIds={wizard.permissionIds}
                  onToggle={wizard.togglePermission}
                  onUpgradeClick={handleUpgrade}
                />

                <button
                  type="submit"
                  className={`connect-submit${
                    wizard.domainSubmitting || wizard.domainLookupStatus === 'loading' ? ' loading' : ''
                  }`}
                  disabled={wizard.domainSubmitting || wizard.domainLookupStatus === 'loading'}
                >
                  <span className="btn-text">Continue</span>
                  <span className="spinner" />
                </button>
              </form>
            </div>
          )}

          {/* STEP 2: show tag + verify */}
          {wizard.step === 'tag' && (
            <div className="connect-step">
              <button className="connect-back" onClick={wizard.backToDomainStep}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="connect-step-label">
                <span className="dot" />
                Step 2 of 3
              </span>
              <h2>Add this tag to your site</h2>
              <p className="connect-sub">
                Paste this into the <code>&lt;head&gt;</code> of <span>{wizard.hostname || 'your site'}</span>, then
                verify below.
              </p>

              <div className="connect-tag-box">
                &lt;<span className="tag-name">meta</span> <span className="attr">name</span>=
                <span className="val">&quot;sitevento&quot;</span> <span className="attr">content</span>=
                <span className="val">&quot;{wizard.siteId}&quot;</span>&gt;
                <br />
                &lt;<span className="tag-name">script</span> <span className="attr">src</span>=
                <span className="val">
                  &quot;{typeof window !== 'undefined' ? window.location.origin : ''}/sitevento.js&quot;
                </span>{' '}
                <span className="attr">data-site</span>=<span className="val">&quot;{wizard.siteId}&quot;</span>{' '}
                <span className="attr">defer</span>&gt;&lt;/<span className="tag-name">script</span>&gt;
              </div>
              <button type="button" className="connect-copy-btn" onClick={wizard.copyConnectTag}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
                <span>{wizard.copyLabel}</span>
              </button>

              <div className="connect-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                <span>
                  <strong>This tag is unique to your account</strong> — it&apos;s how sitevento knows which dashboard
                  a visit, lead, or overlay belongs to. Don&apos;t share it or post it publicly; anyone with it could
                  push overlays or read visit data on your connected site.
                </span>
              </div>

              <div
                className={
                  'connect-verify-status' +
                  (wizard.verifyStatus === 'ok'
                    ? ' ok'
                    : wizard.verifyStatus === 'fail'
                      ? ' fail'
                      : wizard.verifyStatus === 'checking'
                        ? ' pending'
                        : '')
                }
              >
                <span className="vdot2" />
                <span>{wizard.verifyMessage}</span>
              </div>

              <button
                type="button"
                className={`connect-submit${wizard.verifySubmitting ? ' loading' : ''}`}
                disabled={wizard.verifySubmitting}
                onClick={wizard.verifySiteTag}
              >
                <span className="btn-text">Verify site</span>
                <span className="spinner" />
              </button>
            </div>
          )}

          {/* STEP 3: success */}
          {wizard.step === 'success' && (
            <ConnectSuccessStep
              hostname={wizard.hostname}
              tag={wizard.getConnectTag()}
              onDone={() => {
                const verifiedId = wizard.siteId;
                handleClose();
                onFinished(verifiedId);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Progress rail — three segments across the top, replacing the old
// "Step X of 2" label as the only indicator of where you are. The
// label still exists per-step for exact wording, this is the
// at-a-glance visual. ────────────────────────────────────────────────
function ConnectProgressRail({ step }: { step: 'domain' | 'tag' | 'success' }) {
  const current = STEP_INDEX[step];
  return (
    <div className="connect-rail" aria-hidden="true">
      {[1, 2, 3].map((n) => (
        <span key={n} className={`connect-rail-seg${n < current ? ' is-done' : n === current ? ' is-current' : ''}`} />
      ))}
    </div>
  );
}

// ── Full-screen status banner — flashes green on a successful verify,
// or red on a failed one, with the blob character reacting
// (happy/worried). Auto-dismisses itself (see useConnectSiteWizard's
// flashBanner); clicking it dismisses early. ──────────────────────────
function ConnectStatusBanner({ kind, onDismiss }: { kind: 'ok' | 'fail' | null; onDismiss: () => void }) {
  if (!kind) return null;
  const isOk = kind === 'ok';
  return (
    <button
      type="button"
      className={`connect-flash${isOk ? ' is-success' : ' is-fail'}`}
      onClick={onDismiss}
      aria-live="assertive"
    >
      <ConnectBlob tone={isOk ? 'success' : 'fail'} variant={isOk ? 'happy' : 'worried'} className="connect-flash-blob" />
      <span className="connect-flash-title">{isOk ? 'Tag found' : "Couldn't verify yet"}</span>
      <span className="connect-flash-sub">
        {isOk ? 'Your site is verified and connecting…' : 'Double-check the tag is live, then try again.'}
      </span>
    </button>
  );
}

// ── Step 3 ────────────────────────────────────────────────────────────
function ConnectSuccessStep({ hostname, tag, onDone }: { hostname: string; tag: string; onDone: () => void }) {
  const [copyLabel, setCopyLabel] = useState('Copy tag');
  const [promptCopyLabel, setPromptCopyLabel] = useState('Copy prompt');

  const aiPrompt = useMemo(() => {
    if (!tag) return '';
    return (
      `Add the following tag to the <head> of every page on my site` +
      `${hostname ? ` (${hostname})` : ''}, right before the closing </head> tag. ` +
      `Don't modify the tag, just paste it in as-is:\n\n${tag}`
    );
  }, [tag, hostname]);

  function copyTag() {
    if (!tag) return;
    const done = () => {
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy tag'), 1600);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(tag).then(done).catch(done);
    else done();
  }

  function copyPrompt() {
    if (!aiPrompt) return;
    const done = () => {
      setPromptCopyLabel('Copied');
      setTimeout(() => setPromptCopyLabel('Copy prompt'), 1600);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(aiPrompt).then(done).catch(done);
    else done();
  }

  return (
    <div className="connect-step connect-success-step">
      <span className="connect-step-label">
        <span className="dot" />
        Step 3 of 3
      </span>

      <div className="connect-success-hero">
        <ConnectBlob tone="success" variant="happy" className="connect-success-blob" />
        <div className="connect-success-check">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <h2>Site connected</h2>
      <p className="connect-sub">
        {hostname || 'Your site'} is verified. Here&apos;s your tag again if you need it, and a ready-made prompt if
        you&apos;d rather have your AI coding assistant paste it in for you.
      </p>

      <div className="connect-success-grid">
        <div className="connect-success-panel">
          <div className="connect-success-panel-head">
            <span className="connect-success-panel-label">Your tag</span>
            <button type="button" className="connect-copy-btn connect-copy-btn-sm" onClick={copyTag}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
              </svg>
              <span>{copyLabel}</span>
            </button>
          </div>
          <div className="connect-tag-box connect-tag-box-sm">
            {tag.split('\n').map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>

        <div className="connect-success-panel connect-success-panel-ai">
          <div className="connect-success-panel-head">
            <span className="connect-success-panel-label">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7Z" />
              </svg>
              Prefer your AI to do it?
            </span>
            <button type="button" className="connect-copy-btn connect-copy-btn-sm" onClick={copyPrompt}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
              </svg>
              <span>{promptCopyLabel}</span>
            </button>
          </div>
          <p className="connect-success-panel-note">
            Paste this into Claude, ChatGPT, Cursor, or any AI coding assistant pointed at your site&apos;s codebase —
            it&apos;ll add the tag for you.
          </p>
          <div className="connect-prompt-box">{aiPrompt}</div>
        </div>
      </div>

      <button type="button" className="connect-submit" onClick={onDone}>
        <span className="btn-text">Go to dashboard</span>
      </button>
    </div>
  );
}
