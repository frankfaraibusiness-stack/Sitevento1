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
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type ConnectStep = 'domain' | 'tag' | 'success';
export type VerifyStatusKind = 'pending' | 'checking' | 'ok' | 'fail';

function normalizeUrl(raw: string): string | null {
  let v = raw.trim();
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try {
    const u = new URL(v);
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

  const unsubRef = useRef<Unsubscribe | null>(null);

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
  }, [teardownWatch]);

  const watchSiteStatus = useCallback(
    (watchUid: string, watchSiteId: string) => {
      teardownWatch();
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
      const normalized = normalizeUrl(domainInput);
      if (!normalized) {
        setDomainError("That doesn't look like a valid URL.");
        return;
      }
      if (!uid) return;

      setDomainSubmitting(true);
      try {
        let h = normalized;
        try {
          h = new URL(normalized).hostname;
        } catch {
          /* leave h as-is */
        }

        const docRef = await addDoc(collection(db, 'users', uid, 'sites'), {
          name: h,
          url: normalized,
          status: 'pending',
          overlay: { active: false },
          createdAt: serverTimestamp(),
        });

        // Flat lookup doc so the stateless tracking endpoint (api/track)
        // can resolve "which user owns this siteId" with one cheap read.
        // siteId is already non-secret (it's pasted into the public page
        // as the meta tag / script attribute), so this index is safe.
        await setDoc(doc(db, 'siteIndex', docRef.id), {
          uid,
          createdAt: serverTimestamp(),
        });

        setSiteId(docRef.id);
        setSiteUrl(normalized);
        setHostname(h);
        setVerifyStatus('pending');
        setVerifyMessage('Waiting for you to add the tag');
        setStep('tag');
        watchSiteStatus(uid, docRef.id);
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
      `<script src="${origin}/t.js" data-site="${siteId}" defer></script>`;
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
    setDomainInput,
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
  };
}
