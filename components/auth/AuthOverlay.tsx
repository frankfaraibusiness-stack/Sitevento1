'use client';

// components/auth/AuthOverlay.tsx
//
// Replaces the #authOverlay markup + showPane/togglePw/checkStrength/
// handleSubmit/fakeOAuth wiring. Pane switching is React state
// (currentPane) instead of toggling a `.active` class across DOM nodes;
// form fields are controlled inputs instead of getElementById lookups.
import { useEffect, useState } from 'react';
import { useAuthForms, type AuthPane, type SuccessKind } from '@/hooks/useAuthForms';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { GoogleIcon } from './GoogleIcon';
import { AuthBlob } from './AuthBlob';

interface AuthOverlayProps {
  open: boolean;
  initialPane: AuthPane;
  onClose: () => void;
  // isNewUser is true only for a genuinely brand-new account (email
  // signup, or a first-time Google sign-in) — see useAuthForms.ts's
  // header comment. AppRoot uses it to decide whether to launch the
  // onboarding flow after closing this overlay.
  onAuthSucceeded: (isNewUser: boolean) => void;
}

export function AuthOverlay({ open, initialPane, onClose, onAuthSucceeded }: AuthOverlayProps) {
  const [pane, setPane] = useState<AuthPane>(initialPane);

  const [siName, setSiName] = useState('');
  const [siEmail, setSiEmail] = useState('');
  const [siPass, setSiPass] = useState('');
  const [suName, setSuName] = useState('');
  const [suEmail, setSuEmail] = useState('');
  const [suPass, setSuPass] = useState('');
  const [fpEmail, setFpEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [showSiPass, setShowSiPass] = useState(false);
  const [showSuPass, setShowSuPass] = useState(false);
  // Inline "check your inbox" confirmation shown inside the forgot-
  // password pane itself once the reset email is sent — replaces the
  // old separate full-screen success pane for this one case (see
  // handleSuccess above).
  const [resetSent, setResetSent] = useState(false);

  // No more full-screen "success" pane with a "back to sign in" CTA
  // for sign-in/sign-up — those now close the overlay and hand off to
  // the dashboard (new accounts land in the onboarding flow first; see
  // AppRoot.tsx) the instant the credential resolves, same as any
  // other app's auth modal. "Forgot password" has nowhere to redirect
  // to (there's no dashboard to land on yet), so it keeps a small
  // inline confirmation inside the forgot-password pane itself instead
  // of a separate full-screen pane.
  function handleSuccess(kind: SuccessKind, isNewUser: boolean) {
    if (kind === 'forgot') {
      setResetSent(true);
      return;
    }
    onClose();
    onAuthSucceeded(isNewUser);
  }

  const { submitting, fieldErrors, formError, clearErrors, signUp, signIn, forgotPassword, googleSignIn } =
    useAuthForms(handleSuccess);

  useEffect(() => {
    if (open) {
      setPane(initialPane);
      setResetSent(false);
      clearErrors();
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialPane]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="auth-overlay open" aria-hidden={!open}>
      <button className="auth-exit" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      {/* Sticky header shown only on mobile/narrow layouts (≤920px),
          where the desktop showcase column — and its floating
          .auth-exit close circle sitting over it — is hidden. Keeps
          the logo and a close affordance pinned to the top of the
          scrollable form column instead of a lone circle floating
          over the content. */}
      <div className="auth-mobile-header">
        <img
          className="brand-logo"
          src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
          alt="sitevento"
        />
        <button className="auth-mobile-header-close" aria-label="Close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="stage">
        <div className="showcase">
          <div className="showcase-brand">
            <img
              className="brand-logo"
              src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
              alt="sitevento"
            />
          </div>

          <AuthBlob className="showcase-blob" />

          <div className="showcase-copy">
            <h1>One script tag. A control panel for your whole site.</h1>
            <p>Join the teams tracking visits, pushing live overlays, and capturing leads without a single redeploy.</p>
          </div>

          <div className="showcase-card">
            <span className="live-dot" />
            <span className="ctext">2,418 active sessions right now</span>
          </div>

          <div className="showcase-stats">
            <div>
              <span className="s-num">2,400+</span>
              <span className="s-label">Sites connected</span>
            </div>
            <div>
              <span className="s-num">48M</span>
              <span className="s-label">Visits / month</span>
            </div>
            <div>
              <span className="s-num">&lt;2 min</span>
              <span className="s-label">Avg. setup</span>
            </div>
          </div>
        </div>

        <div className="form-wrap">
          <div className="form-panel">
            <div className="panes">
              {/* SIGN IN */}
              <div className={`pane${pane === 'signin' ? ' active' : ''}`}>
                <div className="form-header">
                  <AuthBlob className="form-blob" />
                  <h2>Welcome back</h2>
                  <p>
                    New here? <a onClick={() => { clearErrors(); setPane('signup'); }}>Create an account</a>
                  </p>
                </div>

                <button className="oauth-btn" disabled={submitting} onClick={() => googleSignIn('signin')}>
                  <GoogleIcon />
                  Continue with Google
                </button>
                {formError && pane === 'signin' && <div className="err-msg">{formError}</div>}

                <div className="divider">or sign in with email</div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    signIn(siEmail, siPass);
                  }}
                >
                  <div className="field">
                    <label htmlFor="si-email">Email</label>
                    <input
                      id="si-email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={siEmail}
                      onChange={(e) => setSiEmail(e.target.value)}
                    />
                  </div>
                  <div className={`field${fieldErrors.password ? ' has-error' : ''}`}>
                    <label htmlFor="si-pass">Password</label>
                    <div className="input-shell">
                      <input
                        id="si-pass"
                        type={showSiPass ? 'text' : 'password'}
                        placeholder="••••••••"
                        required
                        value={siPass}
                        onChange={(e) => setSiPass(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        style={{ color: showSiPass ? 'var(--walnut-dark)' : '#8a8477' }}
                        onClick={() => setShowSiPass((v) => !v)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                    {fieldErrors.password && <span className="err-msg">{fieldErrors.password}</span>}
                  </div>

                  <div className="row-between">
                    <label className="check-row">
                      <input type="checkbox" defaultChecked />
                      Remember me
                    </label>
                    <button type="button" className="forgot-link" onClick={() => { clearErrors(); setPane('forgot'); }}>
                      Forgot password?
                    </button>
                  </div>

                  <button type="submit" className={`submit-btn${submitting ? ' loading' : ''}`} disabled={submitting}>
                    <span className="btn-text">Sign in</span>
                    <span className="spinner" />
                  </button>
                </form>
              </div>

              {/* SIGN UP */}
              <div className={`pane${pane === 'signup' ? ' active' : ''}`}>
                <div className="form-header">
                  <AuthBlob className="form-blob" />
                  <h2>Create your account</h2>
                  <p>
                    Already have one? <a onClick={() => { clearErrors(); setPane('signin'); }}>Sign in</a>
                  </p>
                </div>

                <button className="oauth-btn" disabled={submitting} onClick={() => googleSignIn('signup')}>
                  <GoogleIcon />
                  Continue with Google
                </button>
                {formError && pane === 'signup' && <div className="err-msg">{formError}</div>}

                <div className="divider">or sign up with email</div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!agreed) return;
                    signUp(suName, suEmail, suPass);
                  }}
                >
                  <div className="field">
                    <label htmlFor="su-name">Full name</label>
                    <input
                      id="su-name"
                      type="text"
                      placeholder="Maya Reyes"
                      required
                      value={suName}
                      onChange={(e) => setSuName(e.target.value)}
                    />
                  </div>
                  <div className={`field${fieldErrors.email ? ' has-error' : ''}`}>
                    <label htmlFor="su-email">Work email</label>
                    <input
                      id="su-email"
                      type="email"
                      placeholder="you@company.com"
                      required
                      value={suEmail}
                      onChange={(e) => setSuEmail(e.target.value)}
                    />
                    {fieldErrors.email && <span className="err-msg">{fieldErrors.email}</span>}
                  </div>
                  <div className="field">
                    <label htmlFor="su-pass">Password</label>
                    <div className="input-shell">
                      <input
                        id="su-pass"
                        type={showSuPass ? 'text' : 'password'}
                        placeholder="Create a password"
                        required
                        value={suPass}
                        onChange={(e) => setSuPass(e.target.value)}
                      />
                      <button
                        type="button"
                        className="pw-toggle"
                        style={{ color: showSuPass ? 'var(--walnut-dark)' : '#8a8477' }}
                        onClick={() => setShowSuPass((v) => !v)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
                          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </button>
                    </div>
                    <PasswordStrengthMeter value={suPass} />
                  </div>

                  <div className="row-between" style={{ marginBottom: 20 }}>
                    <label className="check-row">
                      <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
                      I agree to the{' '}
                      <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ marginLeft: 4 }}>
                        Terms
                      </a>
                      &nbsp;&amp;&nbsp;
                      <a href="/privacy" target="_blank" rel="noopener noreferrer">
                        Privacy Policy
                      </a>
                    </label>
                  </div>

                  <button type="submit" className={`submit-btn${submitting ? ' loading' : ''}`} disabled={submitting}>
                    <span className="btn-text">Create account</span>
                    <span className="spinner" />
                  </button>
                </form>
              </div>

              {/* FORGOT PASSWORD */}
              <div className={`pane${pane === 'forgot' ? ' active' : ''}`}>
                <button
                  className="back-link"
                  onClick={() => { clearErrors(); setResetSent(false); setPane('signin'); }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to sign in
                </button>

                {resetSent ? (
                  <div className="reset-sent">
                    <div className="reset-sent-check">
                      <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    </div>
                    <h2>Check your inbox</h2>
                    <p>We&apos;ve sent a reset link to {fpEmail || 'your email address'}.</p>
                  </div>
                ) : (
                  <>
                    <div className="form-header">
                      <h2>Reset your password</h2>
                      <p>Enter your email and we&apos;ll send you a link to get back in.</p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        forgotPassword(fpEmail);
                      }}
                    >
                      <div className={`field${fieldErrors.email ? ' has-error' : ''}`}>
                        <label htmlFor="fp-email">Email</label>
                        <input
                          id="fp-email"
                          type="email"
                          placeholder="you@company.com"
                          required
                          value={fpEmail}
                          onChange={(e) => setFpEmail(e.target.value)}
                        />
                        {fieldErrors.email && <span className="err-msg">{fieldErrors.email}</span>}
                      </div>
                      <button type="submit" className={`submit-btn${submitting ? ' loading' : ''}`} disabled={submitting}>
                        <span className="btn-text">Send reset link</span>
                        <span className="spinner" />
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>

            <p className="terms-note">
              By continuing you agree to sitevento&apos;s{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </a>{' '}
              and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
