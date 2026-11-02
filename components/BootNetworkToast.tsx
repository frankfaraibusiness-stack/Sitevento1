'use client';

// components/BootNetworkToast.tsx
//
// Shown after BootSplash's boot window (5s) elapses without Firebase
// auth settling — the splash still closes either way (see
// BootSplash.tsx's onTimeout), and this toast surfaces the "we
// couldn't confirm your connection" state with a retry action,
// instead of silently dropping the person into a half-ready app.
//
// "No network" is the heading (bold, top), "Try again" is the
// description line underneath with the retry action — per the brief.
// Auto-dismisses after a while on its own, but is also dismissible,
// and always offers Retry (reloads the page, which re-runs the whole
// boot flow / auth check from scratch).
import { useEffect, useState } from 'react';
import '@/styles/base/boot-network-toast.css';

interface BootNetworkToastProps {
  open: boolean;
  onRetry: () => void;
  onDismiss: () => void;
}

const AUTO_DISMISS_MS = 8000;

export function BootNetworkToast({ open, onRetry, onDismiss }: BootNetworkToastProps) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) {
      setClosing(false);
      return;
    }
    const t = setTimeout(() => setClosing(true), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [open]);

  // Give the leave transition a moment to play before actually
  // unmounting (onDismiss), same pattern BootSplash uses for its own
  // fade-out.
  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => onDismiss(), 320);
    return () => clearTimeout(t);
  }, [closing, onDismiss]);

  if (!open) return null;

  return (
    <div
      className={`boot-net-toast${closing ? ' is-closing' : ''}`}
      role="alert"
      aria-live="assertive"
    >
      <span className="boot-net-toast-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8.5c5-4 13-4 18 0" />
          <path d="M6.3 12.2c3.3-2.6 8.1-2.6 11.4 0" />
          <path d="M9.6 15.9c1.6-1.3 3.2-1.3 4.8 0" />
          <circle cx="12" cy="19.2" r="1.1" fill="currentColor" stroke="none" />
          <path d="M3 3l18 18" strokeWidth={2.4} />
        </svg>
      </span>

      <div className="boot-net-toast-body">
        <p className="boot-net-toast-title">No network</p>
        <p className="boot-net-toast-desc">
          We couldn&apos;t confirm your connection.{' '}
          <button type="button" className="boot-net-toast-retry" onClick={onRetry}>
            Try again
          </button>
        </p>
      </div>

      <button
        type="button"
        className="boot-net-toast-close"
        aria-label="Dismiss"
        onClick={() => setClosing(true)}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}
