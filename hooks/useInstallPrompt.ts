'use client';

// hooks/useInstallPrompt.ts
//
// Wraps the browser's native PWA install flow (the `beforeinstallprompt`
// event on Chromium/Android, and the lack of any such event on iOS
// Safari, which only supports Add to Home Screen manually) behind one
// small hook so InstallPromptOverlay doesn't need to know any of this.
//
// Chromium fires `beforeinstallprompt` once, early, and expects the
// page to call `.preventDefault()` and hang onto the event so it can
// be triggered later from a real UI action (`.prompt()`) — you cannot
// re-request it later, so it's captured in a ref the moment it fires,
// however early that is relative to when the overlay actually opens.
//
// `canInstall` only ever reflects what the platform told us: Chromium
// confirmed installability via the event, or we're on iOS Safari
// (detected via UA) which never fires the event but does support
// install through its own native Share > Add to Home Screen sheet, so
// the overlay still has something useful to show there (just no
// one-tap `.prompt()`). Everywhere else (already-installed, desktop
// Safari/Firefox without PWA support) canInstall stays false and the
// caller should not show an install upsell at all.
import { useCallback, useEffect, useRef, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's own non-standard flag for "launched from home screen"
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIOS && isSafari;
}

export type InstallPlatform = 'chromium' | 'ios-safari' | 'unsupported';

export function useInstallPrompt() {
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>('unsupported');

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }

    if (isIOSSafari()) {
      setPlatform('ios-safari');
      setCanInstall(true);
      // No beforeinstallprompt on iOS — nothing further to wire up.
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setPlatform('chromium');
      setCanInstall(true);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setCanInstall(false);
      deferredRef.current = null;
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Resolves 'accepted' | 'dismissed' | 'unavailable' (no native prompt
  // to trigger, e.g. iOS — caller should fall back to showing manual
  // Share > Add to Home Screen instructions in that case).
  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const deferred = deferredRef.current;
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferredRef.current = null;
    setCanInstall(false);
    return outcome;
  }, []);

  return { canInstall, installed, platform, promptInstall };
}
