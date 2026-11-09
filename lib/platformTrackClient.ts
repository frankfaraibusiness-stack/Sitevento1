// lib/platformTrackClient.ts
//
// Client-side helper for app/api/platform-track — fires one 'visit'
// beacon per marketing-page session and one 'signup' beacon right
// after a new account is created, so the Console dashboard
// (app/console) has real total-visits / total-signups / conversion
// numbers instead of nothing. Mirrors public/sitevento.js's own
// sv_vid pattern (a random id persisted in localStorage) but in its
// own key/prefix so it never collides with a connected customer
// site's visitor id space — this is sitevento's OWN marketing site
// being tracked, not a customer's site.
'use client';

const VISITOR_KEY = 'sv_platform_vid';
const SESSION_FLAG_KEY = 'sv_platform_visit_sent';

function randomId(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return 'pv' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY) || '';
    if (!id) {
      id = randomId();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // Storage blocked/unavailable — the server still counts the raw
    // visit, just without per-visitor dedupe for this beacon.
    return '';
  }
}

function sendBeacon(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: 'application/json' });
      navigator.sendBeacon('/api/platform-track', blob);
    } else {
      fetch('/api/platform-track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Never let a tracking failure affect the page.
  }
}

/** Fires at most once per browser tab session (sessionStorage-gated), on marketing-page mount. */
export function trackPlatformVisit(path: string) {
  try {
    if (sessionStorage.getItem(SESSION_FLAG_KEY)) return;
    sessionStorage.setItem(SESSION_FLAG_KEY, '1');
  } catch {
    // If sessionStorage itself is unavailable, fall through and send
    // anyway — worse to under-count than to risk never sending.
  }
  const visitorId = getOrCreateVisitorId();
  sendBeacon({ kind: 'visit', path, ...(visitorId ? { visitorId } : {}) });
}

/** Fires once, right after a brand-new account is created (see hooks/useAuthForms.ts). */
export function trackPlatformSignup() {
  const visitorId = getOrCreateVisitorId();
  sendBeacon({ kind: 'signup', ...(visitorId ? { visitorId } : {}) });
}
