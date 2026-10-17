'use client';

// components/connect/ConnectSiteWizard.tsx — replaces #connectOverlay's
// three connect-step divs + the show/hide wiring. Driven by
// useConnectSiteWizard; step switching is React state instead of
// toggling display:none across sibling divs.
import { useEffect } from 'react';
import { useConnectSiteWizard } from '@/hooks/useConnectSiteWizard';

export interface ConnectSiteResumeTarget {
  id: string;
  url: string;
}

interface ConnectSiteWizardProps {
  open: boolean;
  uid: string | null;
  resumeTarget: ConnectSiteResumeTarget | null;
  onClose: () => void;
  onFinished: (siteId: string | null) => void;
}

export function ConnectSiteWizard({ open, uid, resumeTarget, onClose, onFinished }: ConnectSiteWizardProps) {
  const wizard = useConnectSiteWizard(uid);

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

  return (
    <div className="connect-overlay open" aria-hidden={!open}>
      <button className="connect-exit" aria-label="Close" onClick={handleClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="connect-stage">
        <div className="connect-card">
          {/* STEP 1: enter domain */}
          {wizard.step === 'domain' && (
            <div className="connect-step">
              <span className="connect-step-label">
                <span className="dot" />
                Step 1 of 2
              </span>
              <h2>Connect your site</h2>
              <p className="connect-sub">
                Enter the domain you want to run from sitevento. We&apos;ll generate a unique tag for it next.
              </p>

              <form onSubmit={wizard.submitDomain}>
                <div className={`connect-field${wizard.domainError ? ' has-error' : ''}`}>
                  <label htmlFor="connect-domain">Site URL</label>
                  <input
                    id="connect-domain"
                    type="url"
                    placeholder="https://yourbusiness.com"
                    required
                    value={wizard.domainInput}
                    onChange={(e) => wizard.setDomainInput(e.target.value)}
                  />
                  <span className="err-msg">{wizard.domainError}</span>
                </div>
                <button
                  type="submit"
                  className={`connect-submit${wizard.domainSubmitting ? ' loading' : ''}`}
                  disabled={wizard.domainSubmitting}
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
                Step 2 of 2
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
                  &quot;{typeof window !== 'undefined' ? window.location.origin : ''}/t.js&quot;
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
            <div className="connect-step" style={{ textAlign: 'center' }}>
              <div className="connect-success-check">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <h2>Site connected</h2>
              <p className="connect-sub" style={{ marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
                Your dashboard is now live for this site. Visits will start appearing as soon as they happen.
              </p>
              <button
                type="button"
                className="connect-submit"
                onClick={() => {
                  const verifiedId = wizard.siteId;
                  handleClose();
                  onFinished(verifiedId);
                }}
              >
                <span className="btn-text">Go to dashboard</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
