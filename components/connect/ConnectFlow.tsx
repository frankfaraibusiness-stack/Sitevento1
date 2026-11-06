'use client';

// components/connect/ConnectFlow.tsx
//
// "Connect your site" — step 1 of 5 (Website / Verify / Connect /
// Settings / Finish — see TOTAL_STEPS/STEP_LABELS below, confirmed by
// step 2's own design). Rebuilt from scratch against the new
// cartoonic/3D design (see styles/connect/connect-flow.css for the
// full token set), replacing the old multi-step wizard that lived
// here before. Step 2 (components/connect/VerifyFlow.tsx) is built;
// steps 3-5 (Connect/permissions, Settings, Finish) aren't yet —
// adding them is just growing the step machine in
// ConnectFlowClient.tsx, not rebuilding this page.
//
// Wired to the real backend, not a mockup:
//   - POST /api/domain-lookup — live best-effort RDAP lookup as the
//     owner types (debounced), same rdap.org-backed data the old
//     wizard's "domain intel" card showed.
//   - POST /api/connect-site — on "Next", actually creates the
//     users/{uid}/sites/{siteId} doc server-side (Admin SDK, ID-token
//     verified, plan limit enforced atomically) and persists the same
//     RDAP snapshot onto it. See that route's header comment for why
//     this has to happen server-side rather than a client-side
//     Firestore write.
//
// This component owns its own full-page header (logo + step-aware
// Next button) per the design. components/layout/GlobalNav.tsx (the
// app-wide nav rendered from the root layout on every other route) is
// deliberately hidden on this one route instead — see GlobalNav's own
// pathname === '/dashboard/connect' exception and that file's comment
// for why.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import type { PlanId } from '@/lib/plans';
import type { DomainLookupResult } from '@/lib/domainLookup';
import type { VerifiedSite } from '@/components/connect/VerifyFlow';

const LOGO_URL = 'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

// Real roadmap, confirmed by step 2's design (components/connect/
// VerifyFlow.tsx) — keep these two in sync between every step's
// component, since each one renders its own copy of the same tracker.
const TOTAL_STEPS = 5;
const STEP_LABELS = ['Website', 'Verify', 'Connect', 'Settings', 'Finish'];
const CURRENT_STEP = 1;
const DEBOUNCE_MS = 650;
const MIN_DOMAIN_LENGTH = 4; // e.g. "a.co" is 4

export interface LimitStatus {
  state: 'idle' | 'reached';
  planId?: string;
  limit?: number;
  used?: number;
}

interface ConnectFlowProps {
  uid: string;
  plan: PlanId;
  onSiteCreated?: (site: VerifiedSite) => void;
  onLimitReached?: (status: LimitStatus) => void;
  onUpgradeClick?: () => void;
}

// Accepts a bare domain ("yourbusiness.com") as happily as a full URL
// ("https://yourbusiness.com/landing"). Mirrors the server's own
// normalizeUrl in app/api/connect-site/route.ts exactly.
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

function extractDomain(input: string): string | null {
  if (!input) return null;
  let str = input.trim();
  if (!/^https?:\/\//i.test(str)) str = 'https://' + str;
  try {
    const url = new URL(str);
    let hostname = url.hostname.toLowerCase();
    hostname = hostname.replace(/^www\./, '');
    if (!hostname || hostname.indexOf('.') === -1) return null;
    return hostname;
  } catch {
    return null;
  }
}

function formatDate(dateStr: string | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

type CardState = 'idle' | 'checking' | 'available' | 'registered' | 'error';

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
  </svg>
);
const BuildingIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2" />
  </svg>
);
const CalendarIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 3v4M16 3v4" />
  </svg>
);
const ClockIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const ServerIcon = () => (
  <svg viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="7" rx="2" />
    <rect x="3" y="13" width="18" height="7" rx="2" />
    <path d="M7 7.5h.01M7 16.5h.01" />
  </svg>
);
const ShieldIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" />
  </svg>
);

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="cwz-domain-info-row">
      <div className="cwz-domain-info-row-icon">{icon}</div>
      <div className="cwz-domain-info-content">
        <span className="cwz-domain-info-label">{label}</span>
        <span className={`cwz-domain-info-value${value ? '' : ' cwz-muted'}`}>{value || 'No data'}</span>
      </div>
    </div>
  );
}

// uid/plan aren't read directly below — /api/connect-site derives the
// real uid from the verified idToken server-side, and the plan's
// default permission grant is also resolved server-side
// (defaultPermissionIds(planId) in that route). Both props stay on
// this component's public API because a later permissions step (not
// built yet — see the header comment) will need them client-side the
// same way the old wizard's ConnectPermissionsGrid did.
export function ConnectFlow({ uid: _uid, plan: _plan, onSiteCreated, onLimitReached, onUpgradeClick }: ConnectFlowProps) {
  const [urlInput, setUrlInput] = useState('');
  const [cardState, setCardState] = useState<CardState>('idle');
  const [lookupResult, setLookupResult] = useState<DomainLookupResult | null>(null);
  const [lookupErrorText, setLookupErrorText] = useState('');
  const [currentDisplayDomain, setCurrentDisplayDomain] = useState('');
  const [confirmedRegistered, setConfirmedRegistered] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [limitStatus, setLimitStatus] = useState<LimitStatus>({ state: 'idle' });

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastLookedUpRef = useRef<string | null>(null);

  const runLookup = useCallback(async (domain: string) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCurrentDisplayDomain(domain);
    setCardState('checking');
    setLookupResult(null);
    setLookupErrorText('');

    try {
      const res = await fetch('/api/domain-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
        signal: controller.signal,
      });
      const data: DomainLookupResult = await res.json();
      if (controller.signal.aborted) return;

      setLookupResult(data);
      if (data.found) {
        setCardState('registered');
        setConfirmedRegistered(true);
      } else {
        setCardState('available');
        setConfirmedRegistered(false);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setCardState('error');
      setLookupErrorText('Could not retrieve domain data. The domain may not exist or the lookup service is unavailable.');
      setConfirmedRegistered(false);
    }
  }, []);

  const scheduleAutoScan = useCallback(
    (raw: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const domain = extractDomain(raw.trim());

      if (!raw.trim() || !domain || domain.length < MIN_DOMAIN_LENGTH) {
        lastLookedUpRef.current = null;
        setConfirmedRegistered(false);
        setCardState('idle');
        setLookupResult(null);
        setCurrentDisplayDomain('');
        return;
      }

      if (domain === lastLookedUpRef.current) return;

      debounceRef.current = setTimeout(() => {
        const latestDomain = extractDomain(raw.trim());
        if (!latestDomain || latestDomain === lastLookedUpRef.current) return;
        lastLookedUpRef.current = latestDomain;
        runLookup(latestDomain);
      }, DEBOUNCE_MS);
    },
    [runLookup]
  );

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setUrlInput(value);
    setSubmitError('');
    setLimitStatus({ state: 'idle' });
    scheduleAutoScan(value);
  }

  function triggerLookupNow() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const raw = urlInput.trim();
    const domain = extractDomain(raw);
    if (!raw || !domain) {
      setConfirmedRegistered(false);
      setCardState('idle');
      setLookupResult(null);
      setCurrentDisplayDomain('');
      return;
    }
    lastLookedUpRef.current = domain;
    runLookup(domain);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerLookupNow();
    }
  }

  const handleNext = useCallback(async () => {
    if (!confirmedRegistered || submitting) return;
    const normalized = normalizeUrl(urlInput);
    if (!normalized) {
      setSubmitError("That doesn't look like a valid URL.");
      return;
    }

    setSubmitting(true);
    setSubmitError('');
    setLimitStatus({ state: 'idle' });

    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setSubmitError('Your session expired. Please sign in again.');
        return;
      }
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/connect-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, url: normalized }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok || !result.ok) {
        if (result.code === 'SITE_LIMIT_REACHED') {
          const status: LimitStatus = { state: 'reached', planId: result.planId, limit: result.limit, used: result.used };
          setLimitStatus(status);
          onLimitReached?.(status);
          return;
        }
        setSubmitError(result.error || 'Could not save that site. Please try again.');
        return;
      }

      onSiteCreated?.({ id: result.siteId, url: result.url, hostname: result.hostname });
    } catch (err) {
      console.error('connect-site error', err);
      setSubmitError('Could not save that site. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [confirmedRegistered, submitting, urlInput, onSiteCreated, onLimitReached]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const nextDisabled = !confirmedRegistered || submitting;

  return (
    <div className="cwz-root">
      {/* ── header — logo + step-aware Next button ──────────── */}
      <header className="cwz-header">
        <a href="/" className="cwz-logo" aria-label="sitevento home">
          <img src={LOGO_URL} alt="" />
          <span>sitevento</span>
        </a>
        <div className="cwz-header-right">
          <button
            type="button"
            className="cwz-next-btn"
            disabled={nextDisabled}
            onClick={handleNext}
            aria-label="Go to next step"
          >
            <svg className="cwz-next-arrow" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="cwz-next-word">{submitting ? 'Connecting…' : 'Next'}</span>
          </button>
        </div>
      </header>

      {/* ── page content ──────────────────────────────────────── */}
      <div className="cwz-content">
        {/* live step tracker */}
        <div className="cwz-tracker" role="group" aria-label="Connect progress">
          <div className="cwz-tracker-header">
            <span className="cwz-tracker-label">Connect website</span>
            <span className="cwz-tracker-count" aria-live="polite">
              <span className="cwz-current">{CURRENT_STEP}</span>
              <span className="cwz-divider">/</span>
              <span className="cwz-total">{TOTAL_STEPS}</span>
            </span>
          </div>

          <div className="cwz-progress-track" aria-hidden="true">
            <div className="cwz-progress-fill" style={{ width: `${((CURRENT_STEP - 1) / (TOTAL_STEPS - 1)) * 100}%` }} />
            <div className="cwz-progress-dots">
              {STEP_LABELS.map((_, idx) => {
                const stepNum = idx + 1;
                const cls = stepNum < CURRENT_STEP ? ' cwz-done' : stepNum === CURRENT_STEP ? ' cwz-current' : '';
                return <span key={idx} className={`cwz-progress-dot${cls}`} />;
              })}
            </div>
          </div>

          <div className="cwz-step-labels" aria-hidden="true">
            {STEP_LABELS.map((label, idx) => {
              const stepNum = idx + 1;
              const cls = stepNum < CURRENT_STEP ? ' cwz-done' : stepNum === CURRENT_STEP ? ' cwz-active' : '';
              return (
                <span key={label} className={`cwz-step-label${cls}`}>
                  {label}
                </span>
              );
            })}
          </div>
        </div>

        {/* wizard stage */}
        <div className="cwz-stage">
          <div className="cwz-input-group">
            <label className="cwz-input-label" htmlFor="cwzWebsiteUrl">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" fill="none" stroke="#1a1a1a" strokeWidth={2.5} />
                <path
                  d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
                  fill="none"
                  stroke="#1a1a1a"
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
              </svg>
              Enter your website URL
            </label>

            <div className="cwz-input-wrapper">
              <span className="cwz-url-prefix-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <rect x="3" y="5" width="18" height="14" rx="3" fill="#b8e62e" stroke="#1a1a1a" strokeWidth={2.4} />
                  <circle cx="12" cy="12" r="3.2" fill="#ffffff" stroke="#1a1a1a" strokeWidth={2.2} />
                  <path d="M7 9h.01M17 15h.01" stroke="#1a1a1a" strokeWidth={2.4} strokeLinecap="round" />
                </svg>
              </span>

              <input
                type="url"
                id="cwzWebsiteUrl"
                className="cwz-url-input"
                placeholder="https://your-website.com"
                autoComplete="url"
                spellCheck={false}
                aria-label="Website URL"
                value={urlInput}
                onChange={handleInputChange}
                onKeyDown={handleInputKeyDown}
              />

              <button
                type="button"
                className="cwz-url-submit-arrow"
                aria-label="Look up domain"
                onClick={triggerLookupNow}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </div>

          {/* domain info card — always visible */}
          <div className="cwz-domain-card">
            <div className="cwz-domain-card-header">
              <div className="cwz-domain-card-icon">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" fill="#b8e62e" stroke="#1a1a1a" strokeWidth={2.4} />
                  <path
                    d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="cwz-domain-card-title-wrap">
                <div className={`cwz-domain-card-title${cardState === 'idle' ? ' cwz-no-data' : ''}`}>
                  {cardState === 'idle' ? 'No data' : currentDisplayDomain}
                </div>
                <span
                  className={`cwz-domain-card-badge cwz-status-${
                    cardState === 'registered'
                      ? 'registered'
                      : cardState === 'available'
                      ? 'available'
                      : cardState === 'error'
                      ? 'error'
                      : cardState === 'checking'
                      ? 'checking'
                      : 'idle'
                  }`}
                >
                  {cardState === 'idle' && 'Awaiting lookup'}
                  {cardState === 'checking' && 'Checking…'}
                  {cardState === 'registered' && 'Registered'}
                  {cardState === 'available' && 'Not registered'}
                  {cardState === 'error' && 'Error'}
                </span>
              </div>
            </div>

            <div className="cwz-domain-card-divider" />

            {cardState === 'checking' && (
              <div className="cwz-domain-card-loading">
                <span className="cwz-loading-spinner" />
                <span>Fetching domain registration data…</span>
              </div>
            )}

            {cardState === 'error' && (
              <div className="cwz-domain-card-error">
                <svg viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v5M12 16h.01" />
                </svg>
                <span>{lookupErrorText}</span>
              </div>
            )}

            {(cardState === 'idle' || cardState === 'registered' || cardState === 'available') && (
              <div className="cwz-domain-info-rows">
                {cardState === 'idle' && (
                  <>
                    <InfoRow icon={<GlobeIcon />} label="Domain" value={null} />
                    <InfoRow icon={<BuildingIcon />} label="Registrar" value={null} />
                    <InfoRow icon={<CalendarIcon />} label="Registered" value={null} />
                    <InfoRow icon={<ClockIcon />} label="Expires" value={null} />
                    <InfoRow icon={<CalendarIcon />} label="Last changed" value={null} />
                    <InfoRow icon={<ServerIcon />} label="Nameservers" value={null} />
                    <InfoRow icon={<ShieldIcon />} label="Status" value={null} />
                  </>
                )}
                {cardState === 'available' && (
                  <>
                    <InfoRow icon={<GlobeIcon />} label="Domain" value={currentDisplayDomain} />
                    <InfoRow icon={<ShieldIcon />} label="Status" value="Available — no registration record found" />
                  </>
                )}
                {cardState === 'registered' && lookupResult && (
                  <>
                    <InfoRow icon={<GlobeIcon />} label="Domain" value={lookupResult.domain || currentDisplayDomain} />
                    <InfoRow icon={<BuildingIcon />} label="Registrar" value={lookupResult.registrar} />
                    <InfoRow icon={<CalendarIcon />} label="Registered" value={formatDate(lookupResult.createdAt)} />
                    <InfoRow icon={<ClockIcon />} label="Expires" value={formatDate(lookupResult.expiresAt)} />
                    <InfoRow icon={<CalendarIcon />} label="Last changed" value={formatDate(lookupResult.updatedAt)} />
                    {lookupResult.nameserverCount !== null && (
                      <InfoRow
                        icon={<ServerIcon />}
                        label="Nameservers"
                        value={String(lookupResult.nameserverCount)}
                      />
                    )}
                    {lookupResult.status.length > 0 && (
                      <InfoRow icon={<ShieldIcon />} label="Status" value={lookupResult.status.join(', ')} />
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {submitError && (
            <div className="cwz-domain-card-error" style={{ width: '100%', maxWidth: 560, margin: '14px auto 0' }}>
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>{submitError}</span>
            </div>
          )}

          {limitStatus.state === 'reached' && (
            <div className="cwz-limit-banner">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>
                You&apos;ve reached your plan&apos;s limit of {limitStatus.limit} connected site
                {limitStatus.limit === 1 ? '' : 's'}.
              </span>
              {onUpgradeClick && (
                <button type="button" className="cwz-limit-banner-upgrade" onClick={onUpgradeClick}>
                  Upgrade
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
