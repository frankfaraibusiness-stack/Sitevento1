'use client';

// components/console/ConsolePasscodeGate.tsx
//
// Full-screen passcode prompt shown when useConsoleAuth() finds no
// valid console_session cookie. Deliberately its own small screen,
// not a reuse of components/auth/AuthOverlay — Console is not part of
// the customer-facing auth system (see app/api/console-auth's header).
import { useState, type FormEvent } from 'react';

interface ConsolePasscodeGateProps {
  submitting: boolean;
  error: string | null;
  onSubmit: (passcode: string) => void;
}

export function ConsolePasscodeGate({ submitting, error, onSubmit }: ConsolePasscodeGateProps) {
  const [passcode, setPasscode] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passcode.trim() || submitting) return;
    onSubmit(passcode.trim());
  }

  return (
    <div className="console-gate">
      <div className="console-gate-card">
        <div className="console-gate-mark">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1>Console Panel</h1>
        <p className="console-gate-sub">Internal platform overview. Enter the access passcode to continue.</p>

        <form onSubmit={handleSubmit}>
          <div className="console-gate-field">
            <input
              type="password"
              inputMode="numeric"
              placeholder="Passcode"
              autoFocus
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <div className="console-gate-error">{error}</div>}
          <button type="submit" className="console-gate-submit" disabled={submitting || !passcode.trim()}>
            {submitting ? 'Checking…' : 'Enter Console'}
          </button>
        </form>

        <p className="console-gate-note">Testing phase — open access by passcode. Will be restricted before launch.</p>
      </div>
    </div>
  );
}
