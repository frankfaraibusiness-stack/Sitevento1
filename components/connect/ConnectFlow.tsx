'use client';

// components/connect/ConnectFlow.tsx — the full-page "connect your
// site" flow, replacing the old modal (components/connect/
// ConnectSiteWizard.tsx, now removed). Three visual stages:
//
//   1. Domain — pick a domain, choose what you're granting sitevento.
//   2. Tag — paste the tag, verify. Success flashes inline here (the
//      old separate "step 3" success card is gone; verifying
//      successfully just flips the hook's `connected` flag) and then
//      auto-advances to stage 3 a beat later.
//   3. Connected — a dedicated "what's next" screen: a small live
//      animation confirming the link is active, a short explanation of
//      what sitevento now does for this site, and two calm CTAs (go to
//      the dashboard, or keep reading below about what's available
//      now) rather than a single "Done" button closing a dialog.
//
// Driven by useConnectSiteWizard, same hook the old modal used (now
// trimmed to two steps + a connected flag — see that file's header).
// No hardcoded colors anywhere in this tree — every surface reads
// theme variables from styles/base.css, same convention as the rest
// of the app.
import { useEffect, useMemo, useState } from 'react';
import { useConnectSiteWizard, type LimitStatus } from '@/hooks/useConnectSiteWizard';
import { DomainIntelCard } from '@/components/connect/DomainIntelCard';
import { ConnectPermissionsGrid } from '@/components/connect/ConnectPermissionsGrid';
import { ConnectBlob } from '@/components/connect/ConnectBlob';
import { useNavRouter } from '@/hooks/useNavPending';
import type { PlanId } from '@/lib/plans';

export interface ConnectFlowResumeTarget {
  id: string;
  url: string;
}

interface ConnectFlowProps {
  uid: string;
  plan?: PlanId;
  resumeTarget: ConnectFlowResumeTarget | null;
  onLimitReached?: (status: LimitStatus) => void;
  onUpgradeClick?: () => void;
}

const STAGE_INDEX: Record<'domain' | 'tag' | 'connected', number> = { domain: 1, tag: 2, connected: 3 };

export function ConnectFlow({ uid, plan = 'free', resumeTarget, onLimitReached, onUpgradeClick }: ConnectFlowProps) {
  const router = useNavRouter();
  const wizard = useConnectSiteWizard(uid, plan);

  useEffect(() => {
    if (wizard.limitStatus.state === 'reached' && onLimitReached) {
      onLimitReached(wizard.limitStatus);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizard.limitStatus]);

  // Resume an already-pending site's verify step if the route was
  // landed on with ?site=&url=, otherwise start fresh.
  useEffect(() => {
    if (resumeTarget) {
      wizard.resumeVerification(resumeTarget);
    } else {
      wizard.reset();
    }
    return () => {
      wizard.teardownWatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeTarget]);

  // The visual "stage" is step 'tag' + connected=false/true collapsed
  // into one more stage than the hook itself tracks — connected=true
  // is presented as its own screen even though the hook still just
  // calls it step 'tag' underneath.
  const stage: 'domain' | 'tag' | 'connected' = wizard.connected ? 'connected' : wizard.step;

  function handleUpgrade() {
    if (onUpgradeClick) onUpgradeClick();
  }

  return (
    <div className="cflow">
      <ConnectFlowStatusBanner kind={wizard.statusBanner} onDismiss={wizard.dismissBanner} />

      <div className="cflow-rail" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`cflow-rail-seg${n < STAGE_INDEX[stage] ? ' is-done' : n === STAGE_INDEX[stage] ? ' is-current' : ''}`} />
        ))}
      </div>

      <div className="cflow-stage">
        <div className="cflow-card">
          {stage === 'domain' && (
            <div className="cflow-step">
              <span className="cflow-step-label">
                <span className="dot" />
                Step 1 of 3
              </span>
              <h1>Connect your site</h1>
              <p className="cflow-sub">
                Enter your domain — with or without <code>https://</code> — and choose what you&apos;re giving
                sitevento access to do. We&apos;ll generate a unique tag next.
              </p>

              <form onSubmit={wizard.submitDomain}>
                <div className={`cflow-field${wizard.domainError ? ' has-error' : ''}`}>
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
                  className={`cflow-submit${wizard.domainSubmitting || wizard.domainLookupStatus === 'loading' ? ' loading' : ''}`}
                  disabled={wizard.domainSubmitting || wizard.domainLookupStatus === 'loading'}
                >
                  <span className="btn-text">Continue</span>
                  <span className="spinner" />
                </button>
              </form>
            </div>
          )}

          {stage === 'tag' && (
            <div className="cflow-step">
              <button className="cflow-back" onClick={wizard.backToDomainStep}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <span className="cflow-step-label">
                <span className="dot" />
                Step 2 of 3
              </span>
              <h1>Add this tag &amp; verify</h1>
              <p className="cflow-sub">
                Paste this into the <code>&lt;head&gt;</code> of <span>{wizard.hostname || 'your site'}</span>, then
                verify below — this step covers both adding the tag and confirming the connection.
              </p>

              <div className="cflow-tag-box">
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
              <button type="button" className="cflow-copy-btn" onClick={wizard.copyConnectTag}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
                <span>{wizard.copyLabel}</span>
              </button>

              <div className="cflow-note">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                <span>
                  <strong>This tag is unique to your account</strong> — it&apos;s how sitevento knows which dashboard
                  a visit, lead, or overlay belongs to. Don&apos;t share it or post it publicly.
                </span>
              </div>

              <div
                className={
                  'cflow-verify-status' +
                  (wizard.verifyStatus === 'ok' ? ' ok' : wizard.verifyStatus === 'fail' ? ' fail' : wizard.verifyStatus === 'checking' ? ' pending' : '')
                }
              >
                <span className="vdot2" />
                <span>{wizard.verifyMessage}</span>
              </div>

              <button
                type="button"
                className={`cflow-submit${wizard.verifySubmitting ? ' loading' : ''}`}
                disabled={wizard.verifySubmitting}
                onClick={wizard.verifySiteTag}
              >
                <span className="btn-text">Verify site</span>
                <span className="spinner" />
              </button>
            </div>
          )}

          {stage === 'connected' && (
            <ConnectedStage
              hostname={wizard.hostname}
              tag={wizard.getConnectTag()}
              onGoToDashboard={() => router.push('/dashboard')}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full-screen status banner — flashes green on a successful verify,
// or red on a failed one, with the blob character reacting
// (happy/worried). Auto-dismisses itself. ──────────────────────────
function ConnectFlowStatusBanner({ kind, onDismiss }: { kind: 'ok' | 'fail' | null; onDismiss: () => void }) {
  if (!kind) return null;
  const isOk = kind === 'ok';
  return (
    <button type="button" className={`cflow-flash${isOk ? ' is-success' : ' is-fail'}`} onClick={onDismiss} aria-live="assertive">
      <ConnectBlob tone={isOk ? 'success' : 'fail'} variant={isOk ? 'happy' : 'worried'} className="cflow-flash-blob" />
      <span className="cflow-flash-title">{isOk ? 'Tag found' : "Couldn't verify yet"}</span>
      <span className="cflow-flash-sub">
        {isOk ? 'Your site is verified and connecting…' : 'Double-check the tag is live, then try again.'}
      </span>
    </button>
  );
}

// ── Stage 3: Connected — animation, what-sitevento-does-now explainer,
// and two CTAs (go to dashboard, or keep reading below). This is a
// full page, not a dialog, so "keep reading" means scrolling further
// down this same screen rather than opening anything new. ───────────
function ConnectedStage({ hostname, tag, onGoToDashboard }: { hostname: string; tag: string; onGoToDashboard: () => void }) {
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
    <div className="cflow-step cflow-connected">
      <span className="cflow-step-label">
        <span className="dot" />
        Step 3 of 3
      </span>

      <div className="cflow-connected-hero">
        <div className="cflow-pulse-ring" aria-hidden="true" />
        <div className="cflow-pulse-ring cflow-pulse-ring-delay" aria-hidden="true" />
        <ConnectBlob tone="success" variant="happy" className="cflow-connected-blob" />
        <div className="cflow-connected-check">
          <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
      </div>

      <h1>{hostname || 'Your site'} is connected</h1>
      <p className="cflow-sub cflow-connected-sub">
        The tag is live and sitevento is now watching this site in real time. Here&apos;s what&apos;s on, and what to
        do next.
      </p>

      <div className="cflow-cta-row">
        <button type="button" className="cflow-submit cflow-submit-wide" onClick={onGoToDashboard}>
          <span className="btn-text">Go to dashboard</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
        <a href="#cflow-whats-next" className="cflow-secondary-btn">
          Keep reading
        </a>
      </div>

      <div id="cflow-whats-next" className="cflow-whats-next">
        <h2>What&apos;s active now</h2>
        <div className="cflow-feature-grid">
          <div className="cflow-feature-card">
            <span className="cflow-feature-icon cflow-feature-icon-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M3 12c2.5-5 6-7.5 9-7.5s6.5 2.5 9 7.5c-2.5 5-6 7.5-9 7.5S5.5 17 3 12Z" />
              </svg>
            </span>
            <h3>Live visits</h3>
            <p>Every visitor landing on {hostname || 'your site'} now shows up in your dashboard in real time.</p>
          </div>
          <div className="cflow-feature-card">
            <span className="cflow-feature-icon cflow-feature-icon-purple">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7Z" />
              </svg>
            </span>
            <h3>Lead capture</h3>
            <p>Forms and signups on the site start feeding leads straight into your dashboard automatically.</p>
          </div>
          <div className="cflow-feature-card">
            <span className="cflow-feature-icon cflow-feature-icon-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
              </svg>
            </span>
            <h3>Site banners</h3>
            <p>Push an announcement, promo, or alert live on the site any time, no redeploy required.</p>
          </div>
        </div>

        <h2 className="cflow-whats-next-second">Your tag &amp; AI prompt</h2>
        <p className="cflow-sub">Keep these handy if you ever need to re-add the tag elsewhere.</p>

        <div className="cflow-success-grid">
          <div className="cflow-success-panel">
            <div className="cflow-success-panel-head">
              <span className="cflow-success-panel-label">Your tag</span>
              <button type="button" className="cflow-copy-btn cflow-copy-btn-sm" onClick={copyTag}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
                <span>{copyLabel}</span>
              </button>
            </div>
            <div className="cflow-tag-box cflow-tag-box-sm">
              {tag.split('\n').map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          <div className="cflow-success-panel cflow-success-panel-ai">
            <div className="cflow-success-panel-head">
              <span className="cflow-success-panel-label">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M12 2 9 9l-7 3 7 3 3 7 3-7 7-3-7-3-3-7Z" />
                </svg>
                Prefer your AI to do it?
              </span>
              <button type="button" className="cflow-copy-btn cflow-copy-btn-sm" onClick={copyPrompt}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="9" y="9" width="12" height="12" rx="2" />
                  <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
                <span>{promptCopyLabel}</span>
              </button>
            </div>
            <p className="cflow-success-panel-note">
              Paste this into Claude, ChatGPT, Cursor, or any AI coding assistant pointed at your site&apos;s
              codebase — it&apos;ll add the tag for you.
            </p>
            <div className="cflow-prompt-box">{aiPrompt}</div>
          </div>
        </div>

        <button type="button" className="cflow-submit cflow-submit-wide cflow-submit-final" onClick={onGoToDashboard}>
          <span className="btn-text">Go to dashboard</span>
        </button>
      </div>
    </div>
  );
}
