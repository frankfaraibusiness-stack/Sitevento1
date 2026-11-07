'use client';

// components/advertise/AdvertiseCreateForm.tsx
//
// "Create ad" tab panel — rebuilt to match the advertise-preview
// mockup exactly (dropdown ad-type picker, upload/URL image tabs,
// budget estimate card), with the mockup's vanilla-JS DOM
// manipulation reimplemented as React state/handlers.
//
// Real backend wiring (unchanged contract from the old component):
// onSubmit(creative, budget) -> useAdvertiser().createAd, which POSTs
// to app/api/advertise ('create-ad') and is validated server-side by
// lib/adPool.ts's validateAdCreativeInput / validateAdBudgetInput.
//
// Known real-vs-mockup gaps:
//  - No upload/URL-preview-fetch backend exists anywhere in this repo.
//    The dropzone and "Image or website URL" tabs are kept pixel-for-
//    pixel as the mockup shows them, but underneath both resolve to
//    the SAME plain `imageUrl` string the old real form used: a file
//    upload reads the picked file as a data: URL (client-side only,
//    via FileReader — never touches a server) and the URL tab takes
//    whatever the advertiser pastes, verbatim, as imageUrl — no actual
//    og:image scrape happens. The mockup's fake 900ms "fetching
//    preview…" shimmer for non-image URLs is dropped: it simulated a
//    backend call that was never real.
//  - The mockup's budget card has no format-placement picker at all
//    (the old real form had a separate formats checkbox group). Since
//    validateAdBudgetInput requires a non-empty `budget.formats` array
//    server-side, this submits a fixed default of ['banner'] —
//    matching the old form's own default — without adding UI the
//    mockup doesn't have.
//  - adv-cpc's displayed min/placeholder stay exactly as the mockup
//    wrote them EXCEPT the value actually enforced at submit time,
//    which is clamped to the real server floor
//    (MIN_CPC_PER_1K_BID_USD = 5) so a borderline submission doesn't
//    round-trip to a server rejection the UI never warned about.
import { useRef, useState } from 'react';
import type { AdCreativeType, AdFormatId } from '@/lib/adPool';

type ActionResult = { ok: boolean; error?: string };

interface Props {
  busy: boolean;
  onSubmit: (creative: Record<string, unknown>, budget: Record<string, unknown>) => Promise<ActionResult>;
}

const TYPE_META: Record<AdCreativeType, { name: string; shortDesc: string }> = {
  banner: { name: 'Banner', shortDesc: 'Pure image creative — no title or button' },
  link: { name: 'Link card', shortDesc: 'Image + headline, description, and a button' },
  text: { name: 'Text', shortDesc: 'Headline + copy only — no image required' },
};

const TYPE_OPTION_DESC: Record<AdCreativeType, string> = {
  banner: 'Pure image creative. No title or button — the image is the whole ad.',
  link: 'Image + headline, description, and a call-to-action button.',
  text: 'Headline + copy only. No image required — lightest, fastest to approve.',
};

const TYPE_CONFIG: Record<
  AdCreativeType,
  {
    title: string;
    sub: string;
    showNote: boolean;
    image: boolean;
    destinationLabel: string;
    destinationRequired: boolean;
    headlineRequired: boolean;
    ctaLabel: string;
    ctaRequired: boolean;
  }
> = {
  banner: {
    title: 'Creative',
    sub: 'A banner renders as a single clickable image — keep any headline, logo, or offer inside the artwork itself.',
    showNote: true,
    image: true,
    destinationLabel: 'Destination URL',
    destinationRequired: true,
    headlineRequired: false,
    ctaLabel: 'Button label',
    ctaRequired: false,
  },
  link: {
    title: 'Creative',
    sub: 'An image, headline, short description, and a button — the most common ad format.',
    showNote: false,
    image: true,
    destinationLabel: 'Destination URL',
    destinationRequired: true,
    headlineRequired: true,
    ctaLabel: 'Button label',
    ctaRequired: true,
  },
  text: {
    title: 'Creative',
    sub: 'Headline and copy only — no image. Lightest format, fastest to approve.',
    showNote: false,
    image: false,
    destinationLabel: 'Destination URL (optional)',
    destinationRequired: false,
    headlineRequired: true,
    ctaLabel: 'Button label (optional)',
    ctaRequired: false,
  },
};

const DEFAULT_FORMATS: AdFormatId[] = ['banner'];
const ADV_MIN_CPM = 1.0;
const ADV_MIN_CPC1K = 3.5;
const REAL_MIN_CPC1K = 5; // server floor — see file header
const ADV_BASE_DAILY_IMPRESSIONS = 1000;
const ADV_BASE_DAILY_CLICKS = 50;

function formatEstimate(cpm: number, cpc1k: number, total: number) {
  const impressions = cpm > 0 ? Math.round((total / cpm) * 1000) : 0;
  const clicks = cpc1k > 0 ? Math.round((total / cpc1k) * 1000) : 0;

  const cpmRatio = cpm / ADV_MIN_CPM;
  const dailyImpressions = ADV_BASE_DAILY_IMPRESSIONS * cpmRatio * cpmRatio;
  const cpcRatio = cpc1k / ADV_MIN_CPC1K;
  const dailyClicks = ADV_BASE_DAILY_CLICKS * cpcRatio * cpcRatio;

  const daysForImpressions = dailyImpressions > 0 ? impressions / dailyImpressions : Infinity;
  const daysForClicks = dailyClicks > 0 ? clicks / dailyClicks : Infinity;
  const days = Math.max(daysForImpressions, daysForClicks);

  let timeLabel = 'Set a budget to see delivery time';
  let timeSub = 'Higher bids get prioritized in rotation and deliver faster.';

  if (isFinite(days) && total > 0) {
    if (days < 1) {
      const hours = Math.max(1, Math.round(days * 24));
      timeLabel = `~${hours} ${hours === 1 ? 'hour' : 'hours'} to fully deliver`;
    } else if (days < 2) {
      timeLabel = '~1 day to fully deliver';
    } else if (days <= 60) {
      timeLabel = `~${Math.round(days)} days to fully deliver`;
    } else {
      const months = days / 30;
      const roundedMonths = months < 2 ? Math.round(months * 10) / 10 : Math.round(months);
      timeLabel = `~${roundedMonths} ${months < 1.5 ? 'month' : 'months'} to fully deliver`;
    }
    timeSub = `At $${cpm.toFixed(2)}/1k impressions + $${cpc1k.toFixed(2)}/1k clicks, roughly ${Math.round(dailyImpressions).toLocaleString()} impressions/day.`;
  }

  return { impressions, clicks, timeLabel, timeSub };
}

export function AdvertiseCreateForm({ busy, onSubmit }: Props) {
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [creativeType, setCreativeType] = useState<AdCreativeType>('banner');

  const [imageSource, setImageSource] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [destination, setDestination] = useState('');
  const [headline, setHeadline] = useState('');
  const [description, setDescription] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');

  const [cpm, setCpm] = useState('2.50');
  const [cpc1k, setCpc1k] = useState('45');
  const [totalBudget, setTotalBudget] = useState('100');

  const [error, setError] = useState<string | null>(null);

  const cfg = TYPE_CONFIG[creativeType];
  const estimate = formatEstimate(
    Math.max(parseFloat(cpm) || 0, ADV_MIN_CPM),
    Math.max(parseFloat(cpc1k) || 0, ADV_MIN_CPC1K),
    parseFloat(totalBudget) || 0
  );

  function selectType(type: AdCreativeType) {
    setCreativeType(type);
    setTypeMenuOpen(false);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = (ev.target?.result as string) || '';
      setImagePreview(result);
      setImageUrl(result);
    };
    reader.readAsDataURL(file);
  }

  function handleUrlInput(value: string) {
    setImageUrl(value);
    setImagePreview(value.trim() ? value : '');
  }

  function clearImage() {
    setImagePreview('');
    setImageUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function resetForm() {
    setCreativeType('banner');
    setImageSource('upload');
    clearImage();
    setDestination('');
    setHeadline('');
    setDescription('');
    setCtaLabel('');
    setCpm('2.50');
    setCpc1k('45');
    setTotalBudget('100');
    setError(null);
  }

  function clampMin(raw: string, floor: number) {
    const val = parseFloat(raw);
    if (!isFinite(val) || val < floor) return floor;
    return val;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (cfg.image && !imageUrl.trim()) {
      setError('This ad type needs an image.');
      return;
    }
    if (cfg.destinationRequired && !destination.trim()) {
      setError('A destination URL is required.');
      return;
    }
    if (cfg.headlineRequired && !headline.trim()) {
      setError('A headline is required.');
      return;
    }
    if (cfg.ctaRequired && !ctaLabel.trim()) {
      setError('A button label is required.');
      return;
    }

    const creative: Record<string, unknown> = { type: creativeType };
    if (cfg.image) creative.imageUrl = imageUrl.trim();
    if (destination.trim()) creative.destinationUrl = destination.trim();
    if (headline.trim()) creative.headline = headline.trim();
    if (description.trim()) creative.body = description.trim();
    if (ctaLabel.trim()) creative.ctaLabel = ctaLabel.trim();

    const resolvedCpm = clampMin(cpm, ADV_MIN_CPM);
    const resolvedCpc1k = Math.max(clampMin(cpc1k, ADV_MIN_CPC1K), REAL_MIN_CPC1K);
    const total = parseFloat(totalBudget) || 0;

    const budget: Record<string, unknown> = {
      formats: DEFAULT_FORMATS,
      bidCpmUsd: resolvedCpm,
      bidCpcPer1kUsd: resolvedCpc1k,
    };
    if (total > 0) budget.totalCapUsd = total;

    const result = await onSubmit(creative, budget);
    if (result.ok) {
      resetForm();
    } else {
      setError(result.error || 'Could not create the ad. Please try again.');
    }
  }

  return (
    <form className="adv-form" id="adv-create-form" onSubmit={handleSubmit}>
      <div className="adv-card">
        <h2 className="adv-card-title">Ad type</h2>
        <p className="adv-card-sub">Pick the format first — it decides which fields you need to fill in below.</p>

        <div className="adv-type-dropdown" id="adv-type-dropdown">
          <button
            type="button"
            className="adv-type-trigger"
            id="adv-type-trigger"
            onClick={() => setTypeMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={typeMenuOpen}
          >
            <span className="adv-type-trigger-text">
              <span className="adv-type-trigger-name">{TYPE_META[creativeType].name}</span>
              <span className="adv-type-trigger-desc">{TYPE_META[creativeType].shortDesc}</span>
            </span>
            <svg className="adv-type-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {typeMenuOpen && (
            <div className="adv-type-menu" role="listbox" aria-label="Ad type options">
              {(['banner', 'link', 'text'] as AdCreativeType[]).map((t) => (
                <button
                  type="button"
                  key={t}
                  className={`adv-type-option${creativeType === t ? ' is-selected' : ''}`}
                  onClick={() => selectType(t)}
                  role="option"
                  aria-selected={creativeType === t}
                >
                  <span className="adv-type-option-text">
                    <span className="adv-type-option-name">{TYPE_META[t].name}</span>
                    <span className="adv-type-option-desc">{TYPE_OPTION_DESC[t]}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="adv-card">
        <h2 className="adv-card-title">{cfg.title}</h2>
        <p className="adv-card-sub">{cfg.sub}</p>

        {cfg.showNote && (
          <div className="adv-banner-note" id="adv-banner-note">
            Keep text inside the image itself — headline and body fields are hidden for this type.
          </div>
        )}

        {cfg.image && (
          <div className="adv-field" id="field-image">
            <label className="adv-label">Ad image</label>
            <div className="adv-image-tabs">
              <button
                type="button"
                className={`adv-image-tab${imageSource === 'upload' ? ' is-active' : ''}`}
                onClick={() => setImageSource('upload')}
              >
                Upload file
              </button>
              <button
                type="button"
                className={`adv-image-tab${imageSource === 'url' ? ' is-active' : ''}`}
                onClick={() => setImageSource('url')}
              >
                Image or website URL
              </button>
            </div>

            {imageSource === 'upload' ? (
              <label className="adv-dropzone" htmlFor="adv-file-input" id="adv-dropzone">
                <span>Click to choose an image, or drag one here</span>
                <input ref={fileInputRef} type="file" id="adv-file-input" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
              </label>
            ) : (
              <>
                <input
                  type="text"
                  className="adv-input"
                  id="adv-image-url-input"
                  value={imageUrl}
                  onChange={(e) => handleUrlInput(e.target.value)}
                  placeholder="https://yoursite.com/image.jpg"
                />
                <p className="adv-hint">Paste a direct image link, or your site&apos;s homepage URL.</p>
              </>
            )}

            {imagePreview && (
              <div className="adv-image-preview is-visible" id="adv-image-preview">
                <img id="adv-image-preview-img" src={imagePreview} alt="Ad creative preview" />
                <button type="button" className="adv-image-preview-remove" onClick={clearImage} aria-label="Remove image">
                  ×
                </button>
              </div>
            )}
          </div>
        )}

        <div className="adv-field" id="field-destination">
          <label className="adv-label" id="label-destination">
            {cfg.destinationLabel}
          </label>
          <input
            type="url"
            className="adv-input"
            id="adv-destination"
            placeholder="https://yoursite.com/landing-page"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />
          <p className="adv-hint">Where people land after clicking the ad.</p>
        </div>

        {creativeType !== 'banner' && (
          <div className="adv-field" id="field-headline">
            <label className="adv-label">Headline</label>
            <input
              type="text"
              className="adv-input"
              id="adv-headline"
              maxLength={80}
              placeholder="e.g. Build your site in minutes, not weeks"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <span className="adv-char-count">
              <span>{headline.length}</span>/80
            </span>
          </div>
        )}

        {creativeType !== 'banner' && (
          <div className="adv-field" id="field-description">
            <label className="adv-label">
              Description <span className="adv-label-optional">optional</span>
            </label>
            <textarea
              className="adv-textarea"
              id="adv-description"
              maxLength={200}
              placeholder="One or two sentences on what makes it worth the click."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <span className="adv-char-count">
              <span>{description.length}</span>/200
            </span>
          </div>
        )}

        <div className="adv-field" id="field-cta">
          <label className="adv-label" id="label-cta">
            {cfg.ctaLabel}
          </label>
          <input
            type="text"
            className="adv-input"
            id="adv-cta"
            maxLength={24}
            placeholder="e.g. Get started free"
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
          />
        </div>
      </div>

      <div className="adv-card">
        <h2 className="adv-card-title">Budget</h2>
        <p className="adv-card-sub">Set what you&apos;re willing to pay per 1,000 impressions and per 1,000 clicks, plus a total cap — we&apos;ll estimate reach from these.</p>

        <div className="adv-budget-grid">
          <div className="adv-budget-field">
            <label className="adv-label">Cost per 1,000 impressions (CPM)</label>
            <div className="adv-money-input">
              <span>$</span>
              <input type="number" className="adv-input" min={1} step={0.25} value={cpm} onChange={(e) => setCpm(e.target.value)} placeholder="2.50" />
              <span className="adv-money-suffix">/ 1k</span>
            </div>
            <p className="adv-hint">$1.00 minimum. Higher bids get shown more — and faster.</p>
          </div>
          <div className="adv-budget-field">
            <label className="adv-label">Cost per 1,000 clicks (CPC×1k)</label>
            <div className="adv-money-input">
              <span>$</span>
              <input type="number" className="adv-input" min={5} step={0.5} value={cpc1k} onChange={(e) => setCpc1k(e.target.value)} placeholder="45.00" />
              <span className="adv-money-suffix">/ 1k</span>
            </div>
            <p className="adv-hint">$5.00 minimum.</p>
          </div>
          <div className="adv-budget-field">
            <label className="adv-label">Total campaign budget</label>
            <div className="adv-money-input">
              <span>$</span>
              <input type="number" className="adv-input" min={5} step={5} value={totalBudget} onChange={(e) => setTotalBudget(e.target.value)} placeholder="100.00" />
            </div>
          </div>
        </div>

        <div className="adv-estimate-card">
          <div className="adv-estimate-cell">
            <span className="adv-estimate-label">Est. impressions</span>
            <span className="adv-estimate-value">{estimate.impressions.toLocaleString()}</span>
            <span className="adv-estimate-sub">if spent entirely on CPM</span>
          </div>
          <div className="adv-estimate-cell">
            <span className="adv-estimate-label">Est. clicks</span>
            <span className="adv-estimate-value">{estimate.clicks.toLocaleString()}</span>
            <span className="adv-estimate-sub">if spent entirely on CPC</span>
          </div>
        </div>

        <div className="adv-delivery-note">
          <span className="adv-delivery-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={9} />
              <path d="M12 7v5l3.5 2" />
            </svg>
          </span>
          <span className="adv-delivery-text">
            <strong>{estimate.timeLabel}</strong>
            <span>{estimate.timeSub}</span>
          </span>
        </div>
      </div>

      {error && <p className="adv-row-note">{error}</p>}

      <div className="adv-submit-row">
        <button type="submit" className="adv-btn adv-btn-primary" disabled={busy}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
          </svg>
          {busy ? 'Launching…' : 'Launch ad'}
        </button>
        <button type="button" className="adv-btn" onClick={resetForm} disabled={busy}>
          Reset
        </button>
      </div>
    </form>
  );
}
