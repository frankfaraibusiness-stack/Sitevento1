'use client';

// components/InstallPromptOverlay.tsx
//
// Full-screen "install sitevento" upsell — a PWA install prompt, not
// the site-limit paywall (see UpsellOverlay.tsx). Reuses AgentBlob's
// greet variant as the hero visual and follows the brand correction
// from the hero/capabilities redesign: lime + ink + cream only, no
// walnut anywhere in this component.
//
// Layout is close/bottom-CTA, not the two-pane auth/upsell showcase
// layout — this is a single full-bleed ink panel, logo + close top,
// blob + headline + benefits centered, CTA pinned to the bottom safe
// area, matching what was asked for directly.
import { useEffect } from 'react';
import { AgentBlob } from '@/components/agent/AgentBlob';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { useScrollLock } from '@/hooks/useScrollLock';

interface InstallPromptOverlayProps {
  open: boolean;
  onClose: () => void;
}

const BENEFITS = [
  {
    title: 'One tap from your home screen',
    body: 'Jump straight into your dashboard, no browser tab or typing the URL.',
  },
  {
    title: 'Live visit alerts',
    body: 'Get notified the moment someone lands on a connected site.',
  },
  {
    title: 'Faster, app-like feel',
    body: 'Loads instantly and feels native, not like a website.',
  },
];

export function InstallPromptOverlay({ open, onClose }: InstallPromptOverlayProps) {
  const { canInstall, installed, platform, promptInstall } = useInstallPrompt();

  useScrollLock(open);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Nothing to show once actually installed — caller is expected not
  // to open this in that case too, but this is a hard stop either way.
  if (!open || installed) return null;

  async function handleInstallClick() {
    if (platform === 'chromium') {
      const outcome = await promptInstall();
      if (outcome === 'accepted' || outcome === 'dismissed') onClose();
      return;
    }
    // iOS Safari (and anything else without a native prompt) — the
    // button becomes "show me how", not a one-tap install, so just
    // keep the overlay open; .ios-steps below is already visible.
  }

  return (
    <div className="install-overlay open" role="dialog" aria-modal="true" aria-label="Install sitevento">
      <div className="install-glow install-glow-a" aria-hidden="true" />
      <div className="install-glow install-glow-b" aria-hidden="true" />

      <button className="install-exit" aria-label="Close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="install-top">
        <img
          className="install-logo"
          src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png"
          alt="sitevento"
        />
      </div>

      <div className="install-body">
        <div className="install-blob-wrap">
          <AgentBlob variant="greet" className="install-blob" />
        </div>

        <h1 className="install-heading">Put sitevento on your home screen</h1>
        <p className="install-sub">
          Install the app for a faster way to check in on your sites &mdash; no tab-hunting, no retyping the URL.
        </p>

        <ul className="install-benefits">
          {BENEFITS.map((b) => (
            <li key={b.title} className="install-benefit">
              <span className="install-benefit-dot" aria-hidden="true" />
              <div>
                <span className="install-benefit-title">{b.title}</span>
                <span className="install-benefit-body">{b.body}</span>
              </div>
            </li>
          ))}
        </ul>

        {platform === 'ios-safari' && (
          <div className="install-ios-steps">
            <p>
              Tap <span className="install-ios-chip">Share</span> in Safari&apos;s toolbar, then{' '}
              <span className="install-ios-chip">Add to Home Screen</span>.
            </p>
          </div>
        )}
      </div>

      <div className="install-cta-bar">
        <button
          className="install-cta-btn"
          onClick={handleInstallClick}
          disabled={!canInstall && platform !== 'ios-safari'}
        >
          {platform === 'ios-safari' ? 'Show me how' : 'Install now'}
        </button>
        <button className="install-cta-secondary" onClick={onClose}>
          Not now
        </button>
      </div>
    </div>
  );
}
