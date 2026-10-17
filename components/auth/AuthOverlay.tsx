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

interface AuthOverlayProps {
  open: boolean;
  initialPane: AuthPane;
  onClose: () => void;
  onAuthSucceeded: () => void;
}

export function AuthOverlay({ open, initialPane, onClose, onAuthSucceeded }: AuthOverlayProps) {
  const [pane, setPane] = useState<AuthPane>(initialPane);
  const [successTitle, setSuccessTitle] = useState('');
  const [successCopy, setSuccessCopy] = useState('');

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

  function handleSuccess(kind: SuccessKind) {
    if (kind === 'forgot') {
      setSuccessTitle('Check your inbox');
      setSuccessCopy("We've sent a reset link to your email address.");
      setPane('success');
      return;
    } else if (kind === 'signup') {
      setSuccessTitle('Account created');
      setSuccessCopy("Welcome to sitevento — let's connect your first site.");
    } else {
      setSuccessTitle('Signed in');
      setSuccessCopy("You're all set. Redirecting you to the dashboard.");
    }
    setPane('success');
    setTimeout(() => {
      onClose();
      onAuthSucceeded();
    }, 1200);
  }

  const { submitting, fieldErrors, formError, clearErrors, signUp, signIn, forgotPassword, googleSignIn } =
    useAuthForms(handleSuccess);

  useEffect(() => {
    if (open) {
      setPane(initialPane);
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

      <div className="stage">
        <div className="showcase">
          <div className="showcase-brand">
            <img
              className="brand-logo"
              src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
              alt="sitevento"
            />
          </div>

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
            <div className="mobile-brand">
              <img
                className="brand-logo"
                src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
                alt="sitevento"
              />
            </div>

            <div className="panes">
              {/* SIGN IN */}
              <div className={`pane${pane === 'signin' ? ' active' : ''}`}>
                <div className="form-header">
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
                      I agree to the <a href="#" style={{ marginLeft: 4 }}>Terms</a>&nbsp;&amp;&nbsp;<a href="#">Privacy Policy</a>
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
                <button className="back-link" onClick={() => { clearErrors(); setPane('signin'); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Back to sign in
                </button>
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
              </div>

              {/* SUCCESS */}
              <div className={`pane success-pane${pane === 'success' ? ' active' : ''}`}>
                <div className="success-check">
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </div>
                <h2>{successTitle}</h2>
                <p>{successCopy}</p>
                <button
                  className="submit-btn"
                  style={{ maxWidth: 220, margin: '0 auto' }}
                  onClick={() => setPane('signin')}
                >
                  <span className="btn-text">Back to sign in</span>
                </button>
              </div>
            </div>

            <p className="terms-note">
              By continuing you agree to sitevento&apos;s <a href="#">Terms of Service</a> and{' '}
              <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
