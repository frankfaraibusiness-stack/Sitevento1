'use client';

// components/auth/AuthOverlay.tsx
//
// Full-page auth surface: sits on the same --app-bg page background
// as the rest of the app (not a hardcoded flat lime fill), with its
// own sticky glassy header (brand mark + close), and raw form fields
// placed directly on that canvas — no floating card, no mascot, no
// decorative background scene. Pane switching (sign in / sign up /
// forgot password) is React state (currentPane) instead of toggling
// a `.active` class across DOM nodes; form fields are controlled
// inputs instead of getElementById lookups.
import { useEffect, useRef, useState } from 'react';
import { useAuthForms, type AuthPane, type SuccessKind } from '@/hooks/useAuthForms';
import { useScrollLock } from '@/hooks/useScrollLock';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { GoogleIcon } from './GoogleIcon';
import { Header } from '@/components/layout/Header';
import { AuthBlob } from './AuthBlob';

// Drives the sign-in ⇄ sign-up ⇄ forgot crossfade (see
// .panes/.pane/.is-switching/.is-leaving in auth-overlay.css). Plain
// state swap is instant (old pane unmounts the same frame the new one
// mounts), which is the "glitch" flash the fade-in animation alone
// can't hide — there's nothing to fade *out* of. This keeps the
// outgoing pane mounted and visible for one short beat so the two
// panes genuinely cross over, and measures .panes' height across the
// swap so the form column animates to its new size instead of jumping.
function useAuthPaneTransition(pane: AuthPane) {
  const [displayPane, setDisplayPane] = useState(pane);
  const [leavingPane, setLeavingPane] = useState<AuthPane | null>(null);
  const [switching, setSwitching] = useState(false);
  const panesRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (pane === displayPane) return;

    const el = panesRef.current;
    // Lock the current height before swapping content so the height
    // transition in CSS has a real "from" value to animate out of.
    if (el) el.style.height = `${el.offsetHeight}px`;

    setLeavingPane(displayPane);
    setDisplayPane(pane);
    setSwitching(true);

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setLeavingPane(null), 220);

    return () => clearTimeout(timeoutRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pane]);

  useEffect(() => {
    const el = panesRef.current;
    if (!el) return;
    // After the new pane has rendered, measure its natural height and
    // animate .panes to it; release back to "auto" once settled so
    // later content changes (error text, etc.) aren't height-locked.
    const raf = requestAnimationFrame(() => {
      const next = el.scrollHeight;
      el.style.height = `${next}px`;
    });
    const release = setTimeout(() => {
      el.style.height = 'auto';
      setSwitching(false);
    }, 360);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(release);
    };
  }, [displayPane]);

  return { displayPane, leavingPane, switching, panesRef };
}

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
  const { displayPane, leavingPane, switching, panesRef } = useAuthPaneTransition(pane);

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
  // password pane itself once the reset email is sent — replaces a
  // separate full-screen success pane for this one case (see
  // handleSuccess below).
  const [resetSent, setResetSent] = useState(false);

  // Sign-in/sign-up close the overlay and hand off to the dashboard
  // (new accounts land in the onboarding flow first; see AppRoot.tsx)
  // the instant the credential resolves, same as any other app's auth
  // flow. "Forgot password" has nowhere to redirect to (there's no
  // dashboard to land on yet), so it keeps a small inline confirmation
  // inside the forgot-password pane itself instead.
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

  useScrollLock(open);

  useEffect(() => {
    if (open) {
      setPane(initialPane);
      setResetSent(false);
      clearErrors();
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
      {/* Same header as the rest of the app — logo stays flush-left,
          same size/position/glass treatment — just swapped into its
          auth mode (onCloseClick) so signup/profile/hamburger are
          replaced by a single bare close button. No second header to
          keep in sync by hand. */}
      <Header
        user={null}
        onLogoClick={onClose}
        onSignupClick={() => {}}
        onProfileClick={() => {}}
        onHamburgerClick={() => {}}
        onCloseClick={onClose}
      />

      <div className="stage">
        <div className="auth-split">
          {/* Desktop-only left panel (styles/auth/auth-overlay.css
              .auth-aside, ≥960px) — on narrow screens this never
              renders any visible layout since .auth-split collapses to
              a single centered column, same as before. Gives the wide
              viewport a real left/right split instead of one narrow
              form card floating in empty space. */}
          <div className="auth-aside" aria-hidden="true">
            <AuthBlob className="auth-aside-blob" />
            <h2 className="auth-aside-title">
              {displayPane === 'signup' ? 'Join sitevento' : 'Welcome to sitevento'}
            </h2>
            <p className="auth-aside-copy">
              Connect your site, see visits in real time, and let your AI agent handle the rest — all from one
              dashboard.
            </p>
            <ul className="auth-aside-points">
              <li>Live visits &amp; lead capture</li>
              <li>One tag, no redeploys</li>
              <li>An AI agent that works your site 24/7</li>
            </ul>
          </div>

          <div className="form-wrap">
          <div className={`panes${switching ? ' is-switching' : ''}`} ref={panesRef}>
            {/* SIGN IN */}
            <div
              className={`pane${
                displayPane === 'signin' ? ' active' : leavingPane === 'signin' ? ' is-leaving' : ''
              }`}
            >
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
                      style={{ color: showSiPass ? 'var(--ink)' : undefined }}
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
            <div
              className={`pane${
                displayPane === 'signup' ? ' active' : leavingPane === 'signup' ? ' is-leaving' : ''
              }`}
            >
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
                      style={{ color: showSuPass ? 'var(--ink)' : undefined }}
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
            <div
              className={`pane${
                displayPane === 'forgot' ? ' active' : leavingPane === 'forgot' ? ' is-leaving' : ''
              }`}
            >
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
