'use client';

// components/connect/VerifyFlow.tsx
//
// Step 2 of the connect wizard: verify the owner actually controls the
// site, and separately confirm there's a real, live site to find at
// all. Rebuilt from the supplied design against two real backends
// instead of one:
//
//   - POST /api/site-reachability — NEW (this feature). A registered
//     domain (step 1's RDAP lookup) is not the same thing as a live
//     site: DNS can point nowhere, hosting can be down, the domain can
//     be parked. This fetches the site's own url server-side and
//     reports reachable/unreachable; if reachable, it also extracts
//     ordinary <head> metadata (title, description, Open Graph tags,
//     favicon) so the owner gets a real preview of what's actually
//     live there. Read-only — never writes to the site doc, so it can
//     be re-run freely while the owner is fixing DNS/hosting.
//
//   - POST /api/verify-site — the EXISTING, already-working ownership
//     check (see that route's own header comment). Confirms BOTH
//     halves of the real install tag are present — not the design's
//     placeholder <meta name="walnut-site-verification">, but
//     sitevento's actual tag pair:
//       <meta name="sitevento" content="{siteId}">
//       <script src="{origin}/sitevento.js" data-site="{siteId}" defer></script>
//     — and on success flips the site's Firestore status to
//     'verified' itself (Admin SDK, bypassing security rules). This
//     component does not duplicate that write.
//
// This component expects to be handed the site step 1 just created
// (id + url + hostname) as props — no separate Firestore read needed,
// since ConnectFlowClient already has that data from step 1's own
// response.
import { useCallback, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import type { SiteMetadataResult } from '@/lib/siteMetadata';

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Website', 'Verify', 'Connect', 'Settings', 'Finish'];
const CURRENT_STEP = 2;

export interface VerifiedSite {
  id: string;
  url: string;
  hostname: string;
}

interface VerifyFlowProps {
  site: VerifiedSite;
  onVerified: () => void;
}

type ReachState = 'idle' | 'checking' | 'reachable' | 'unreachable';
type VerifyState = 'idle' | 'checking' | 'verified' | 'failed';

function escapeHtmlAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const CheckIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M5 12l5 5L20 7" />
  </svg>
);
const ArrowsIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M8 7l-5 5 5 5M16 7l5 5-5 5" />
  </svg>
);
const GlobeIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18" />
  </svg>
);
const WarnIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L11 7" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66L13 17" />
  </svg>
);
const TextIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
);
const TagIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M20 12l-8 8-9-9V4h7l10 8z" />
    <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);
const UserIcon = () => (
  <svg viewBox="0 0 24 24">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 5-6 8-6s6.5 2 8 6" />
  </svg>
);
const TagListIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M4 6h16M4 12h10M4 18h7" />
  </svg>
);
const PaletteIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-.95-.5-1.3-.3-.35-.5-.8-.5-1.2 0-1 .8-1.5 1.5-1.5H16a4 4 0 0 0 4-4c0-4.4-3.6-8-8-8z" />
    <circle cx="7.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="14.5" cy="8" r="1.2" fill="currentColor" stroke="none" />
  </svg>
);
const LayersIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M12 3l9 5-9 5-9-5 9-5z" />
    <path d="M3 13l9 5 9-5" />
  </svg>
);
const TypeIcon = () => (
  <svg viewBox="0 0 24 24">
    <path d="M5 6h14M12 6v14M9 20h6" />
  </svg>
);

function MetaRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="cwz-vfy-row">
      <div className="cwz-vfy-row-icon">{icon}</div>
      <div className="cwz-vfy-row-content">
        <span className="cwz-vfy-row-label">{label}</span>
        <span className={`cwz-vfy-row-value${value ? '' : ' cwz-vfy-muted'}`}>{value || 'No data'}</span>
      </div>
    </div>
  );
}

const PLATFORM_LABELS: Record<string, string> = {
  shopify: 'Shopify',
  wordpress: 'WordPress',
  wix: 'Wix',
  squarespace: 'Squarespace',
  webflow: 'Webflow',
  nextjs: 'Next.js',
  other: 'Other',
  unknown: 'Not detected',
};

// Detected-theme preview — colors/fonts/platform from
// lib/siteTheme.ts's detectSiteTheme(), run server-side against the
// same HTML the reachability check already fetched. Shown only once
// something was actually found (a site with no swatches, fonts, or
// recognized platform just doesn't render this block, same
// no-fabricated-data convention as MetaRow's "No data" state, but at
// the block level since there's nothing useful to show a near-empty
// color/font list for).
function DetectedThemeSection({ theme }: { theme: SiteMetadataResult['siteTheme'] }) {
  const hasColors = theme.colors.length > 0;
  const hasFonts = theme.fonts.length > 0;
  const hasPlatform = theme.platform !== 'unknown';
  if (!hasColors && !hasFonts && !hasPlatform) return null;

  return (
    <>
      <div className="cwz-vfy-card-divider" />
      <div className="cwz-vfy-rows">
        {hasPlatform && (
          <div className="cwz-vfy-row">
            <div className="cwz-vfy-row-icon">
              <LayersIcon />
            </div>
            <div className="cwz-vfy-row-content">
              <span className="cwz-vfy-row-label">Built with</span>
              <span className="cwz-vfy-row-value">
                {theme.platform === 'other' && theme.platformDetail ? theme.platformDetail : PLATFORM_LABELS[theme.platform]}
              </span>
            </div>
          </div>
        )}

        {hasColors && (
          <div className="cwz-vfy-row">
            <div className="cwz-vfy-row-icon">
              <PaletteIcon />
            </div>
            <div className="cwz-vfy-row-content">
              <span className="cwz-vfy-row-label">Site colours</span>
              <div className="cwz-vfy-swatch-row">
                {theme.colors.map((c) => (
                  <span key={c.value} className="cwz-vfy-swatch" title={`${c.value} (${c.source})`}>
                    <span className="cwz-vfy-swatch-color" style={{ background: c.value }} />
                    <span className="cwz-vfy-swatch-code">{c.value}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {hasFonts && (
          <div className="cwz-vfy-row">
            <div className="cwz-vfy-row-icon">
              <TypeIcon />
            </div>
            <div className="cwz-vfy-row-content">
              <span className="cwz-vfy-row-label">Fonts</span>
              <div className="cwz-vfy-chip-row">
                {theme.fonts.map((f) => (
                  <span key={f} className="cwz-vfy-chip cwz-vfy-neutral">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function VerifyFlow({ site, onVerified }: VerifyFlowProps) {
  const [reachState, setReachState] = useState<ReachState>('idle');
  const [metaResult, setMetaResult] = useState<SiteMetadataResult | null>(null);
  const [reachError, setReachError] = useState('');

  const [verifyState, setVerifyState] = useState<VerifyState>('idle');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const scriptOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const metaTagText = `<meta name="sitevento" content="${site.id}">`;
  const scriptTagText = `<script src="${scriptOrigin}/sitevento.js" data-site="${site.id}" defer></script>`;

  const checkReachability = useCallback(async () => {
    setReachState('checking');
    setReachError('');
    setMetaResult(null);

    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setReachState('unreachable');
        setReachError('Your session expired. Please sign in again.');
        return;
      }
      const idToken = await currentUser.getIdToken();

      const res = await fetch('/api/site-reachability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, siteId: site.id }),
      });
      const data = await res.json();

      // A non-200 response (bad/expired idToken, rate limited, site
      // not found, etc.) comes back as lib/serverAuth.ts's jsonError
      // shape ({ ok: false, error }), not a SiteMetadataResult — those
      // two shapes share no fields, so check res.ok first rather than
      // reading data.reachable/data.errorMessage off whichever one
      // actually came back.
      if (!res.ok) {
        setReachState('unreachable');
        setReachError(data.error || "Couldn't reach that site.");
        return;
      }

      const result = data as SiteMetadataResult;
      setMetaResult(result);
      if (result.reachable) {
        setReachState('reachable');
      } else {
        setReachState('unreachable');
        setReachError(result.errorMessage || "Couldn't reach that site.");
      }
    } catch (err) {
      console.error('site-reachability error', err);
      setReachState('unreachable');
      setReachError("Couldn't reach that site. Please try again.");
    }
  }, [site.id]);

  const handleCheckVerification = useCallback(async () => {
    if (verifyState === 'checking') return;
    setVerifyState('checking');
    setVerifyMessage('');

    try {
      const auth = getFirebaseAuth();
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setVerifyState('failed');
        setVerifyMessage('Your session expired. Please sign in again.');
        return;
      }

      const res = await fetch('/api/verify-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, siteId: site.id, url: site.url }),
      });
      const data = await res.json().catch(() => ({ verified: false, message: 'Unexpected response.' }));

      if (data.verified) {
        setVerifyState('verified');
        setVerifyMessage(data.message || 'Site verified.');
        // Also run (or re-run) the reachability + metadata preview now
        // that ownership is confirmed, so the owner sees both results
        // without an extra click.
        checkReachability();
      } else {
        setVerifyState('failed');
        setVerifyMessage(data.message || "Couldn't verify this site yet.");
      }
    } catch (err) {
      console.error('verify-site error', err);
      setVerifyState('failed');
      setVerifyMessage('Something went wrong checking verification. Please try again.');
    }
  }, [site.id, site.url, checkReachability]);

  async function handleCopy() {
    const text = `${metaTagText}\n${scriptTagText}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setVerifyState('failed');
      setVerifyMessage('Could not copy to clipboard. Please select and copy the tags manually.');
    }
  }

  const nextDisabled = verifyState !== 'verified';

  return (
    <div className="cwz-root">
      <header className="cwz-header">
        <a href="/" className="cwz-logo" aria-label="sitevento home">
          <img src="https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png" alt="" />
          <span>sitevento</span>
        </a>
        <div className="cwz-header-right">
          <button
            type="button"
            className="cwz-next-btn"
            disabled={nextDisabled}
            onClick={onVerified}
            aria-label="Go to next step"
          >
            <svg className="cwz-next-arrow" viewBox="0 0 24 24">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
            <span className="cwz-next-word">{verifyState === 'verified' ? 'Next' : 'Verify first'}</span>
          </button>
        </div>
      </header>

      <div className="cwz-content">
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

        <div className="cwz-stage">
          <div className="cwz-vfy-hero">
            <div className="cwz-vfy-hero-icon">
              <svg viewBox="0 0 24 24">
                <path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" fill="#b8e62e" stroke="#1a1a1a" strokeWidth={2.4} strokeLinejoin="round" />
                <path d="M9 12l2 2 4-4" fill="none" stroke="#1a1a1a" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1>Verify your website</h1>
            <p>Add a small install tag to your site&apos;s homepage so we can confirm you own it — then we&apos;ll check it&apos;s actually live.</p>
            <div className="cwz-vfy-domain-pill">
              <GlobeIcon />
              <span>{site.hostname}</span>
            </div>
          </div>

          {/* install tag card */}
          <div className="cwz-vfy-card">
            <div className="cwz-vfy-card-header">
              <div className="cwz-vfy-card-icon">
                <ArrowsIcon />
              </div>
              <div className="cwz-vfy-card-title-wrap">
                <div className="cwz-vfy-card-title">Your install tag</div>
                <div className="cwz-vfy-card-subtitle">
                  Paste both lines into the <strong>&lt;head&gt;</strong> of your homepage.
                </div>
              </div>
              <span
                className={`cwz-vfy-card-badge cwz-vfy-status-${
                  verifyState === 'verified' ? 'verified' : verifyState === 'checking' ? 'checking' : verifyState === 'failed' ? 'failed' : 'pending'
                }`}
              >
                {verifyState === 'verified' && 'Verified'}
                {verifyState === 'checking' && 'Checking…'}
                {verifyState === 'failed' && 'Not yet'}
                {verifyState === 'idle' && 'Pending'}
              </span>
            </div>

            <div className="cwz-vfy-card-divider" />

            <code className="cwz-vfy-code">
              <span className="cwz-tag-bracket">&lt;</span>
              <span className="cwz-tag-name">meta</span> <span className="cwz-tag-attr">name</span>=
              <span className="cwz-tag-string">&quot;sitevento&quot;</span> <span className="cwz-tag-attr">content</span>=
              <span className="cwz-tag-string">&quot;{escapeHtmlAttr(site.id)}&quot;</span>
              <span className="cwz-tag-bracket">&gt;</span>
              {'\n'}
              <span className="cwz-tag-bracket">&lt;</span>
              <span className="cwz-tag-name">script</span> <span className="cwz-tag-attr">src</span>=
              <span className="cwz-tag-string">&quot;{escapeHtmlAttr(scriptOrigin)}/sitevento.js&quot;</span>{' '}
              <span className="cwz-tag-attr">data-site</span>=<span className="cwz-tag-string">&quot;{escapeHtmlAttr(site.id)}&quot;</span>{' '}
              <span className="cwz-tag-attr">defer</span>
              <span className="cwz-tag-bracket">&gt;&lt;/script&gt;</span>
            </code>

            <div className="cwz-vfy-code-actions">
              <button type="button" className="cwz-vfy-code-btn" onClick={handleCopy}>
                {copied ? (
                  <>
                    <CheckIcon /> Copied!
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24">
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
                    Copy tags
                  </>
                )}
              </button>
            </div>

            <div className="cwz-vfy-card-divider" />

            <div className="cwz-vfy-steps-list">
              <div className="cwz-vfy-step-item">
                <span className="cwz-vfy-step-num">1</span>
                <span className="cwz-vfy-step-text">
                  Open your website&apos;s <strong>homepage HTML</strong> (via your CMS, host, or page editor).
                </span>
              </div>
              <div className="cwz-vfy-step-item">
                <span className="cwz-vfy-step-num">2</span>
                <span className="cwz-vfy-step-text">
                  Paste both lines anywhere between <strong>&lt;head&gt;</strong> and <strong>&lt;/head&gt;</strong>.
                </span>
              </div>
              <div className="cwz-vfy-step-item">
                <span className="cwz-vfy-step-num">3</span>
                <span className="cwz-vfy-step-text">
                  Save &amp; publish the page. Then click <strong>Check verification</strong> below.
                </span>
              </div>
            </div>

            <button type="button" className="cwz-vfy-check-btn" disabled={verifyState === 'checking'} onClick={handleCheckVerification}>
              {verifyState === 'checking' ? (
                <svg className="cwz-vfy-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                </svg>
              ) : (
                <CheckIcon />
              )}
              <span>{verifyState === 'checking' ? 'Checking your site…' : 'Check verification'}</span>
            </button>

            {verifyState !== 'idle' && verifyState !== 'checking' && (
              <div className={`cwz-vfy-status ${verifyState === 'verified' ? 'cwz-vfy-success' : 'cwz-vfy-error'}`}>
                {verifyState === 'verified' ? <CheckIcon /> : <WarnIcon />}
                <span className="cwz-vfy-status-text" dangerouslySetInnerHTML={{ __html: verifyMessage }} />
              </div>
            )}
          </div>

          {/* reachability + metadata preview card */}
          {(reachState !== 'idle' || verifyState === 'verified') && (
            <div className="cwz-vfy-card">
              <div className="cwz-vfy-card-header">
                <div className="cwz-vfy-card-icon">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="4" width="18" height="16" rx="2" fill="#b8e62e" stroke="#1a1a1a" strokeWidth={2.4} />
                    <path d="M3 9h18M8 4v5M16 4v5" stroke="#1a1a1a" strokeWidth={2.2} strokeLinecap="round" />
                  </svg>
                </div>
                <div className="cwz-vfy-card-title-wrap">
                  <div className="cwz-vfy-card-title">Is your site live?</div>
                  <div className="cwz-vfy-card-subtitle">A registered domain doesn&apos;t always mean a live site — this checks for one.</div>
                </div>
                {!['idle'].includes(reachState) && (
                  <span
                    className={`cwz-vfy-card-badge cwz-vfy-status-${
                      reachState === 'reachable' ? 'verified' : reachState === 'checking' ? 'checking' : 'failed'
                    }`}
                  >
                    {reachState === 'reachable' && 'Live'}
                    {reachState === 'checking' && 'Checking…'}
                    {reachState === 'unreachable' && 'Unreachable'}
                  </span>
                )}
              </div>

              <div className="cwz-vfy-card-divider" />

              {reachState === 'idle' && (
                <button type="button" className="cwz-vfy-check-btn" onClick={checkReachability}>
                  <GlobeIcon />
                  <span>Check if my site is live</span>
                </button>
              )}

              {reachState === 'checking' && (
                <div className="cwz-vfy-reach-row cwz-vfy-reach-checking">
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeDasharray="40 20" />
                  </svg>
                  <span>Fetching your homepage…</span>
                </div>
              )}

              {reachState === 'unreachable' && (
                <>
                  <div className="cwz-vfy-reach-row cwz-vfy-reach-bad">
                    <WarnIcon />
                    <span>{reachError}</span>
                  </div>
                  <button type="button" className="cwz-vfy-code-btn" onClick={checkReachability}>
                    <ArrowsIcon />
                    Check again
                  </button>
                </>
              )}

              {reachState === 'reachable' && metaResult && (
                <>
                  <div className="cwz-vfy-reach-row cwz-vfy-reach-ok">
                    <CheckIcon />
                    <span>Your site responded — here&apos;s what we found on the homepage.</span>
                  </div>

                  <div className="cwz-vfy-preview">
                    <div className="cwz-vfy-preview-image">
                      {metaResult.ogImage || metaResult.favicon ? (
                        <img src={metaResult.ogImage || metaResult.favicon || ''} alt="" onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
                      ) : (
                        <GlobeIcon />
                      )}
                    </div>
                    <div className="cwz-vfy-preview-info">
                      <div className="cwz-vfy-preview-title">{metaResult.ogTitle || metaResult.title || 'Untitled site'}</div>
                      <div className="cwz-vfy-preview-desc">{metaResult.ogDescription || metaResult.description || 'No description found.'}</div>
                      {(metaResult.canonical || metaResult.finalUrl) && (
                        <a className="cwz-vfy-preview-url" href={metaResult.canonical || metaResult.finalUrl || '#'} target="_blank" rel="noopener noreferrer">
                          <LinkIcon />
                          <span>{metaResult.canonical || metaResult.finalUrl}</span>
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="cwz-vfy-card-divider" />

                  <div className="cwz-vfy-rows">
                    <MetaRow icon={<TextIcon />} label="Page title" value={metaResult.title} />
                    <MetaRow icon={<TextIcon />} label="Description" value={metaResult.description} />
                    <MetaRow icon={<TagIcon />} label="OG title" value={metaResult.ogTitle} />
                    <MetaRow icon={<UserIcon />} label="Author" value={metaResult.author} />
                    <MetaRow icon={<GlobeIcon />} label="OG site name" value={metaResult.ogSiteName} />

                    {metaResult.keywords.length > 0 ? (
                      <div className="cwz-vfy-row">
                        <div className="cwz-vfy-row-icon">
                          <TagListIcon />
                        </div>
                        <div className="cwz-vfy-row-content">
                          <span className="cwz-vfy-row-label">Keywords</span>
                          <div className="cwz-vfy-chip-row">
                            {metaResult.keywords.map((kw) => (
                              <span key={kw} className="cwz-vfy-chip">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <MetaRow icon={<TagListIcon />} label="Keywords" value={null} />
                    )}
                  </div>

                  <DetectedThemeSection theme={metaResult.siteTheme} />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
