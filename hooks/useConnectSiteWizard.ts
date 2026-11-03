// hooks/useConnectSiteWizard.ts
//
// Drives the /dashboard/connect page (see app/dashboard/connect/page.tsx
// and components/connect/ConnectFlow.tsx). Two steps now, not three:
// 1) domain + permissions grant, 2) tag + verify, merged with the old
// step 3's "you're connected" moment — verifying successfully flips
// `connected` to true in place rather than switching to a distinct
// step, so the tag/verify card and the success state share one screen
// without a jarring step change. The page itself still renders a
// separate "what's next" screen once `connected` is true (see
// ConnectFlow.tsx) — that's presentation, not wizard state.
'use client';

import { useCallback, useRef, useState } from 'react';
import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { getFirebaseDb, getFirebaseAuth } from '@/lib/firebase';
import { useDomainLookup } from '@/hooks/useDomainLookup';
import { defaultPermissionIds } from '@/lib/connectPermissions';
import type { PlanId } from '@/lib/plans';

export type ConnectStep = 'domain' | 'tag';
export type VerifyStatusKind = 'pending' | 'checking' | 'ok' | 'fail';

// Mirrors app/api/connect-site/route.ts's SITE_LIMIT_REACHED response.
// `idle` = nothing to report; `reached` = the server just refused to
// create a site because the account is at its plan's cap.
export interface LimitStatus {
  state: 'idle' | 'reached';
  planId?: string;
  limit?: number;
  used?: number;
}

// Accepts a bare domain ("yourbusiness.com") as happily as a full URL
// ("https://yourbusiness.com/landing").
function normalizeUrl(raw: string): string | null {
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
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

  // Flips true the moment verification succeeds — merged in from the
  // old separate "step 3". The tag/verify card (step 'tag') and the
  // success state now coexist on one screen instead of swapping steps.
  const [connected, setConnected] = useState(false);

  const [copyLabel, setCopyLabel] = useState('Copy tag');

  // Drives the full-screen pass/fail banner that flashes right after a
  // verify attempt resolves. Separate from verifyStatus/verifyMessage
  // (which persist as the inline status row) — this is the one-shot
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
  // actual connect flow below.
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
    setConnected(false);
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
          setConnected(true);
        }
      });
    },
    [teardownWatch, flashBanner]
  );

  // Reopen the flow straight at the tag/verify step for an already
  // pending site — e.g. landing on /dashboard/connect?site=...&url=...
  // from DashboardShell's "verify now" action.
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
      setConnected(false);
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

        const res = await fetch('/api/connect-site', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // permissionIds: step 1's grant selection
          // (ConnectPermissionsGrid), persisted onto the new site doc
          // server-side (re-validated against the caller's real plan —
          // see app/api/connect-site/route.ts).
          body: JSON.stringify({ idToken, url: normalized, permissionIds }),
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
        setConnected(false);
        setStep('tag');
        watchSiteStatus(uid, result.siteId);
      } catch (err) {
        console.error('create site error', err);
        setDomainError('Could not save that site. Please try again.');
      } finally {
        setDomainSubmitting(false);
      }
    },
    [domainInput, uid, watchSiteStatus, permissionIds]
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
        // Auto-advance into the connected state the moment verification
        // succeeds — no extra click needed.
        setConnected(true);
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

  // Shared by the step-2 copy button, step-2's own "AI prompt" tab, and
  // the connected panel's AI prompt box — one source for the exact tag
  // text so none of the three ever drift apart.
  const getConnectTag = useCallback(() => {
    if (!siteId) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return (
      `<meta name="sitevento" content="${siteId}">\n` +
      `<script src="${origin}/sitevento.js" data-site="${siteId}" defer></script>`
    );
  }, [siteId]);

  // Same prompt text the connected panel offers, available already at
  // step 2 — building the tag isn't the only way to add it, so the
  // choice between "paste it yourself" and "hand it to your AI" should
  // exist the moment the tag exists, not only after verifying.
  const getConnectAiPrompt = useCallback(() => {
    const tag = getConnectTag();
    if (!tag) return '';
    return (
      `Add the following tag to the <head> of every page on my site` +
      `${hostname ? ` (${hostname})` : ''}, right before the closing </head> tag. ` +
      `Don't modify the tag, just paste it in as-is:\n\n${tag}`
    );
  }, [getConnectTag, hostname]);

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
    setConnected(false);
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
    connected,
    statusBanner,
    dismissBanner,
    copyLabel,
    submitDomain,
    verifySiteTag,
    copyConnectTag,
    getConnectTag,
    getConnectAiPrompt,
    backToDomainStep,
    resumeVerification,
    reset,
    teardownWatch,
    domainLookupStatus: domainLookup.status,
    domainLookupResult: domainLookup.result,
    limitStatus,
  };
}
