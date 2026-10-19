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

export function useConnectSiteWizard(uid: string | null) {
  const [step, setStep] = useState<ConnectStep>('domain');
  const [domainInput, setDomainInput] = useState('');
  const [domainError, setDomainError] = useState('');
  const [domainSubmitting, setDomainSubmitting] = useState(false);

  const [siteId, setSiteId] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [hostname, setHostname] = useState('');

  const [verifyStatus, setVerifyStatus] = useState<VerifyStatusKind>('pending');
  const [verifyMessage, setVerifyMessage] = useState('Waiting for you to add the tag');
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const [copyLabel, setCopyLabel] = useState('Copy tag');

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
    domainLookup.reset();
  }, [teardownWatch, domainLookup]);

  const watchSiteStatus = useCallback(
    (watchUid: string, watchSiteId: string) => {
      teardownWatch();
      const db = getFirebaseDb();
      unsubRef.current = onSnapshot(doc(db, 'users', watchUid, 'sites', watchSiteId), (snap) => {
        const data = snap.data();
        if (data && data.status === 'verified') {
          setVerifyStatus('ok');
          setVerifyMessage('Tag found — site verified');
          setTimeout(() => setStep('success'), 500);
        }
      });
    },
    [teardownWatch]
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
        setTimeout(() => setStep('success'), 500);
      } else {
        setVerifyStatus('fail');
        setVerifyMessage(result.message || "Couldn't find the tag yet. Add it and try again.");
      }
    } catch (err) {
      console.error('verifySiteTag error', err);
      setVerifyStatus('fail');
      setVerifyMessage('Network error — check your connection and try again.');
    } finally {
      setVerifySubmitting(false);
    }
  }, [siteId, siteUrl, uid]);

  const copyConnectTag = useCallback(() => {
    if (!siteId) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const tag =
      `<meta name="sitevento" content="${siteId}">\n` +
      `<script src="${origin}/sitevento.js" data-site="${siteId}" defer></script>`;
    const done = () => {
      setCopyLabel('Copied');
      setTimeout(() => setCopyLabel('Copy tag'), 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(tag).then(done).catch(done);
    } else {
      done();
    }
  }, [siteId]);

  const backToDomainStep = useCallback(() => {
    teardownWatch();
    setStep('domain');
  }, [teardownWatch]);

  return {
    step,
    setStep,
    domainInput,
    setDomainInput: setDomainInputAndLookup,
    domainError,
    domainSubmitting,
    siteId,
    siteUrl,
    hostname,
    verifyStatus,
    verifyMessage,
    verifySubmitting,
    copyLabel,
    submitDomain,
    verifySiteTag,
    copyConnectTag,
    backToDomainStep,
    resumeVerification,
    reset,
    teardownWatch,
    domainLookupStatus: domainLookup.status,
    domainLookupResult: domainLookup.result,
    limitStatus,
  };
}
