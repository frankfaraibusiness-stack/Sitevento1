// hooks/useConnectSiteWizard.ts
//
// Replaces the connect-site wizard's module-level state and functions
// (handleDomainSubmit, watchConnectSiteStatus, verifySiteTag, etc.) with
// a stateful hook the ConnectSiteWizard component drives. Same flow:
// domain -> create pending site doc + siteIndex doc -> show tag -> poll
// /api/verify-site (and live-listen on the doc in case verification
// lands from elsewhere) -> success.
'use client';

import { useCallback, useRef, useState } from 'react';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { useDomainLookup } from '@/hooks/useDomainLookup';
import { defaultPermissionIds } from '@/lib/connectPermissions';
import type { PlanId } from '@/lib/plans';

// Three steps now (was two): 1) domain + permissions grant, 2) tag +
// verify, 3) success. 'domain' still covers both the URL field and the
// permissions grid below it — they're one step/one submit, not a
// fourth step, since the permissions grid has no server effect yet
// (see lib/connectPermissions.ts's header) and splitting it out would
// just be an extra click for nothing saved differently.
export type ConnectStep = 'domain' | 'tag' | 'success';
export type VerifyStatusKind = 'pending' | 'checking' | 'ok' | 'fail';

// Mirrors app/api/connect-site/route.ts's SITE_LIMIT_REACHED response.
// `idle` = nothing to report; `reached` = the server just refused to
// create a site because the account is at its plan's cap — the UI
// (ConnectSiteWizard -> DashboardClient) reacts to this by swapping to
// the UpsellOverlay instead of showing a plain form error, since this
// is a "upgrade to continue" moment, not a transient failure.
export interface LimitStatus {
  state: 'idle' | 'reached';
  planId?: string;
  limit?: number;
  used?: number;
}

// Accepts a bare domain ("yourbusiness.com") as happily as a full URL
// ("https://yourbusiness.com/landing") — the step-1 field no longer
// requires the user to type a scheme themselves (see
// ConnectSiteWizard.tsx's plain-text input), so this has to meet them
// halfway rather than relying on the browser's native type="url"
// validation to reject anything without "https://" up front.
function normalizeUrl(raw: string): string | null {
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
    // A bare domain must still look like one (has a dot, has a TLD) —
    // this rejects stray single words ("test") that new URL() would
    // otherwise happily accept once we've prepended https://.
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(u.hostname)) return null;
    return u.origin + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return null;
  }
}

export function useConnectSiteWizard(uid: string | null, plan: PlanId = 'free') {
  const [step, setStep] = useState<ConnectStep>('domain');
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [domainSubmitting, setDomainSubmitting] = useState(false);

  // Step 1's permission grants (components/connect/ConnectPermissionsGrid.tsx).
  // Seeded with the plan's sensible defaults each time the wizard
  // resets; purely local state for this pass (see
  // lib/connectPermissions.ts's header) — nothing here blocks or
  // alters submitDomain below.
  const [permissionIds, setPermissionIds] = useState<string[]>(() => defaultPermissionIds(plan));
  const togglePermission = useCallback((permissionId: string, next: boolean) => {
    setPermissionIds((prev) => {
      if (next) return prev.includes(permissionId) ? prev : [...prev, permissionId];
      return prev.filter((id) => id !== permissionId);
    });
  }, []);

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [hostname, setHostname] = useState('');

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatusKind>('pending');
  const [verifyMessage, setVerifyMessage] = useState('Waiting for you to add the tag');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const [copyLabel, setCopyLabel] = useState('Copy tag');

  // Drives the full-screen pass/fail banner (ConnectSiteWizard's
  // ConnectStatusBanner) that flashes over step 2 right after a verify
  // attempt resolves. Separate from verifyStatus/verifyMessage (which
  // persist as the inline status row) — this is just the one-shot
  // celebratory/apologetic overlay, auto-dismissed a couple seconds
  // after it appears.
  const [statusBanner, setStatusBanner] = useState<'ok' | 'fail' | null>(null);
  const bannerTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const flashBanner = useCallback((kind: 'ok' | 'fail') => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    setStatusBanner(kind);
    bannerTimeoutRef.current = setTimeout(() => setStatusBanner(null), kind === 'ok' ? 1700 : 2200);
  }, []);
  const dismissBanner = useCallback(() => {
    if (bannerTimeoutRef.current) clearTimeout(bannerTimeoutRef.current);
    setStatusBanner(null);
  }, []);

  const [limitStatus, setLimitStatus] = useState<LimitStatus>({ state: 'idle' });

  const unsubRef = useRef<Unsubscribe | null>(null);

  // Cosmetic "domain intel" lookup shown under the step-1 field — see
  // components/connect/DomainIntelCard.tsx. Entirely decoupled from the
  // actual connect flow below; it never blocks submitDomain or affects
  // domainError.
  const domainLookup = useDomainLookup();

  const setDomainInputAndLookup = useCallback(
    (value: string) => {
      setDomainInput(value);
      domainLookup.onDomainInputChange(value);
    },
    [domainLookup]
  );

  const teardownWatch = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    teardownWatch();
    dismissBanner();
    setStep('domain');
    setDomainInput('');
    setDomainError('');
    setSiteId(null);
    setSiteUrl(null);
    setHostname('');
    setVerifyStatus('pending');
    setVerifyMessage('Waiting for you to add the tag');
    setVerifySubmitting(false);
    setLimitStatus({ state: 'idle' });
    setPermissionIds(defaultPermissionIds(plan));
    domainLookup.reset();
  }, [teardownWatch, dismissBanner, domainLookup, plan]);

  const watchSiteStatus = useCallback(
    (watchUid: string, watchSiteId: string) => {
      teardownWatch();
      const db = getFirebaseDb();
      unsubRef.current = onSnapshot(doc(db, 'users', watchUid, 'sites', watchSiteId), (snap) => {
        const data = snap.data();
        if (data && data.status === 'verified') {
          setVerifyStatus('ok');
          setVerifyMessage('Tag found — site verified');
          flashBanner('ok');
          setTimeout(() => setStep('success'), 1400);
        }
      });
    },
    [teardownWatch, flashBanner]
  );

  // Reopen the wizard straight at the tag/verify step for an already
  // pending site — same as the original's resumeVerification().
  const resumeVerification = useCallback(
    (site: { id: string; url: string }) => {
      setSiteId(site.id);
      setSiteUrl(site.url);
      let h = site.url;
      try {
        h = new URL(site.url).hostname;
      } catch {
        /* leave h as-is */
      }
      setHostname(h);
      setVerifyStatus('pending');
      setVerifyMessage('Waiting for you to add the tag');
      setStep('tag');
      if (uid) watchSiteStatus(uid, site.id);
    },
    [uid, watchSiteStatus]
  );

  const submitDomain = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setDomainError('');
      setLimitStatus({ state: 'idle' });
      const normalized = normalizeUrl(domainInput);
      if (!normalized) {
        setDomainError("That doesn't look like a valid URL.");
        return;
      }
      if (!uid) return;

      setDomainSubmitting(true);
      try {
        const auth = getFirebaseAuth();
        const currentUser = auth.currentUser;
        if (!currentUser) {
          setDomainError('Your session expired. Please sign in again.');
          return;
        }
        const idToken = await currentUser.getIdToken();

        // Site creation goes through the server now instead of a direct
        // client-side addDoc()/setDoc() — this is what actually enforces
        // the plan's connected-site limit (atomically, so it can't be
        // bypassed by calling Firestore directly either). See
        // app/api/connect-site/route.ts.
        const res = await fetch('/api/connect-site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken, url: normalized }),
        });
        const result = await res.json().catch(() => ({}));

        if (!res.ok || !result.ok) {
          if (result.code === 'SITE_LIMIT_REACHED') {
            setLimitStatus({ state: 'reached', planId: result.planId, limit: result.limit, used: result.used });
            return;
          }
          setDomainError(result.error || 'Could not save that site. Please try again.');
          return;
        }

        setSiteId(result.siteId);
        setSiteUrl(result.url);
        setHostname(result.hostname || '');
        setVerifyStatus('pending');
        setVerifyMessage('Waiting for you to add the tag');
        setStep('tag');
        watchSiteStatus(uid, result.siteId);
      } catch (err) {
        console.error('create site error', err);
        setDomainError('Could not save that site. Please try again.');
      } finally {
        setDomainSubmitting(false);
      }
    },
    [domainInput, uid, watchSiteStatus]
  );

  const verifySiteTag = useCallback(async () => {
    if (!siteId || !siteUrl || !uid) return;
    setVerifySubmitting(true);
    setVerifyStatus('checking');
    setVerifyMessage('Checking your site…');

    try {
      const res = await fetch('/api/verify-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, siteId, url: siteUrl }),
      });
      const result = await res.json().catch(() => ({}));

      if (res.ok && result.verified) {
        setVerifyStatus('ok');
        setVerifyMessage('Tag found — site verified');
        flashBanner('ok');
        setTimeout(() => setStep('success'), 1400);
      } else {
        setVerifyStatus('fail');
        setVerifyMessage(result.message || "Couldn't find the tag yet. Add it and try again.");
        flashBanner('fail');
      }
    } catch (err) {
      console.error('verifySiteTag error', err);
      setVerifyStatus('fail');
      setVerifyMessage('Network error — check your connection and try again.');
      flashBanner('fail');
    } finally {
      setVerifySubmitting(false);
    }
  }, [siteId, siteUrl, uid, flashBanner]);

  // Shared by the step-2 copy button and step-3's "AI prompt" box
  // (ConnectSiteWizard.tsx) — one source for the exact tag text so the
  // two never drift apart.
  const getConnectTag = useCallback(() => {
    if (!siteId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      `<meta name="sitevento" content="${siteId}">\n` +
      `<script src="${origin}/sitevento.js" data-site="${siteId}" defer></script>`
    );
  }, [siteId]);

  const copyConnectTag = useCallback(() => {
    const tag = getConnectTag();
    if (!tag) return;
    const done = () => {
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy tag'), 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tag).then(done).catch(done);
    } else {
      done();
    }
  }, [getConnectTag]);

  const backToDomainStep = useCallback(() => {
    teardownWatch();
    dismissBanner();
    setStep('domain');
  }, [teardownWatch, dismissBanner]);

  return {
    step,
    setStep,
    domainInput,
    setDomainInput: setDomainInputAndLookup,
    domainError,
    domainSubmitting,
    permissionIds,
    togglePermission,
    siteId,
    siteUrl,
    hostname,
    verifyStatus,
    verifyMessage,
    verifySubmitting,
    statusBanner,
    dismissBanner,
    copyLabel,
    submitDomain,
    verifySiteTag,
    copyConnectTag,
    getConnectTag,
    backToDomainStep,
    resumeVerification,
    reset,
    teardownWatch,
    domainLookupStatus: domainLookup.status,
    domainLookupResult: domainLookup.result,
    limitStatus,
  };
}
