'use client';

// components/advertise/AdvertiseCreateForm.tsx
//
// The 'create-ad' form — creative-type picker, format checkboxes,
// optional CPM bid, optional country allow-list, optional daily/
// total caps. Required fields per creative type mirror
// lib/adPool.ts's validateAdCreative exactly (that function is the
// real, authoritative validation this form's payload is checked
// against server-side — this is a client-side mirror of its rules
// for a responsive form, not a replacement for it):
//   banner — imageUrl required, destinationUrl required
//   link   — destinationUrl required, headline required, ctaLabel required
//   text   — headline required (everything else optional)
//
// Image upload is explicitly out of scope (no upload pipeline exists
// anywhere in this codebase yet — see lib/adPool.ts's AdCreative.
// imageUrl comment) — the banner creative just takes a pasted,
// already-hosted image URL.
import { useState } from 'react';
import { AD_FORMAT_IDS, AD_CREATIVE_TYPES, type AdFormatId, type AdCreativeType } from '@/lib/adPool';
import { COUNTRIES } from '@/lib/countries';

interface AdvertiseCreateFormProps {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (creative: Record<string, unknown>, budget: Record<string, unknown>) => Promise<{ ok: boolean; error?: string }>;
}

const CREATIVE_TYPE_LABEL: Record<AdCreativeType, string> = {
  banner: 'Banner (image + link)',
  link: 'Link (headline + link, no image)',
  text: 'Text (no click-through required)',
};

const FORMAT_LABEL: Record<AdFormatId, string> = {
  banner: 'Banner',
  'sticky-footer': 'Sticky footer',
  interstitial: 'Interstitial',
  popup: 'Popup',
  overlay: 'Full-screen overlay',
};

export function AdvertiseCreateForm({ busy, onCancel, onSubmit }: AdvertiseCreateFormProps) {
  const [creativeType, setCreativeType] = useState<AdCreativeType>('link');
  const [imageUrl, setImageUrl] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');

  const [formats, setFormats] = useState<AdFormatId[]>(['banner']);
  const [bidCpmUsd, setBidCpmUsd] = useState('');
  const [dailyCapUsd, setDailyCapUsd] = useState('');
  const [totalCapUsd, setTotalCapUsd] = useState('');
  const [countries, setCountries] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);

  function toggleFormat(id: AdFormatId) {
    setFormats((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }

  function toggleCountry(code: string) {
    setCountries((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  }

  function validateClientSide(): string | null {
    if (creativeType === 'banner') {
      if (!imageUrl.trim()) return 'A banner ad needs an image URL.';
      if (!destinationUrl.trim()) return 'A banner ad needs a destination URL.';
    } else if (creativeType === 'link') {
      if (!destinationUrl.trim()) return 'A link ad needs a destination URL.';
      if (!headline.trim()) return 'A link ad needs a headline.';
      if (!ctaLabel.trim()) return 'A link ad needs a call-to-action label.';
    } else {
      if (!headline.trim()) return 'A text ad needs a headline.';
    }
    if (formats.length === 0) return 'Pick at least one ad format.';
    return null;
  }

  async function handleSubmit() {
    setError(null);
    const clientError = validateClientSide();
    if (clientError) {
      setError(clientError);
      return;
    }

    const creative: Record<string, unknown> = { type: creativeType };
    if (creativeType === 'banner') {
      creative.imageUrl = imageUrl.trim();
      creative.destinationUrl = destinationUrl.trim();
      if (headline.trim()) creative.headline = headline.trim();
      if (ctaLabel.trim()) creative.ctaLabel = ctaLabel.trim();
    } else if (creativeType === 'link') {
      creative.destinationUrl = destinationUrl.trim();
      creative.headline = headline.trim();
      creative.ctaLabel = ctaLabel.trim();
      if (body.trim()) creative.body = body.trim();
    } else {
      creative.headline = headline.trim();
      if (body.trim()) creative.body = body.trim();
      if (destinationUrl.trim()) creative.destinationUrl = destinationUrl.trim();
      if (ctaLabel.trim()) creative.ctaLabel = ctaLabel.trim();
    }

    const budget: Record<string, unknown> = { formats };
    if (bidCpmUsd.trim()) {
      const parsed = Number(bidCpmUsd);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('CPM bid must be a positive number.');
        return;
      }
      budget.bidCpmUsd = parsed;
    }
    if (dailyCapUsd.trim()) {
      const parsed = Number(dailyCapUsd);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Daily cap must be a positive number.');
        return;
      }
      budget.dailyCapUsd = parsed;
    }
    if (totalCapUsd.trim()) {
      const parsed = Number(totalCapUsd);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        setError('Total cap must be a positive number.');
        return;
      }
      budget.totalCapUsd = parsed;
    }
    if (countries.length > 0) budget.countries = countries;

    const result = await onSubmit(creative, budget);
    if (!result.ok) {
      setError(result.error || 'Something went wrong creating that ad.');
    }
  }

  return (
    <div className="adv-form">
      <div className="adv-form-field">
        <label className="adv-form-label">Creative type</label>
        <div className="adv-pill-group">
          {AD_CREATIVE_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`adv-pill${creativeType === t ? ' is-active' : ''}`}
              onClick={() => setCreativeType(t)}
            >
              {CREATIVE_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      {creativeType === 'banner' && (
        <div className="adv-form-field">
          <label className="adv-form-label">Image URL</label>
          <input type="text" className="adv-form-input" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
        </div>
      )}

      {(creativeType === 'banner' || creativeType === 'link' || creativeType === 'text') && (
        <div className="adv-form-field">
          <label className="adv-form-label">
            Destination URL{creativeType === 'link' ? '' : ' (optional for text)'}
          </label>
          <input
            type="text"
            className="adv-form-input"
            value={destinationUrl}
            onChange={(e) => setDestinationUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
      )}

      <div className="adv-form-field">
        <label className="adv-form-label">Headline{creativeType === 'banner' ? ' (optional)' : ''}</label>
        <input type="text" className="adv-form-input" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} />
      </div>

      {creativeType !== 'banner' && (
        <div className="adv-form-field">
          <label className="adv-form-label">Body (optional)</label>
          <textarea className="adv-form-textarea" value={body} onChange={(e) => setBody(e.target.value)} maxLength={300} rows={3} />
        </div>
      )}

      {creativeType !== 'banner' && (
        <div className="adv-form-field">
          <label className="adv-form-label">Call-to-action label{creativeType === 'link' ? '' : ' (optional)'}</label>
          <input type="text" className="adv-form-input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
        </div>
      )}
      {creativeType === 'banner' && (
        <div className="adv-form-field">
          <label className="adv-form-label">Call-to-action label (optional)</label>
          <input type="text" className="adv-form-input" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} maxLength={40} />
        </div>
      )}

      <div className="adv-form-field">
        <label className="adv-form-label">Formats</label>
        <div className="adv-checkbox-group">
          {AD_FORMAT_IDS.map((id) => (
            <label key={id} className="adv-checkbox-row">
              <input type="checkbox" checked={formats.includes(id)} onChange={() => toggleFormat(id)} />
              <span>{FORMAT_LABEL[id]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="adv-form-grid">
        <div className="adv-form-field">
          <label className="adv-form-label">CPM bid, USD (optional)</label>
          <input type="number" min={0.05} step="0.01" className="adv-form-input" value={bidCpmUsd} onChange={(e) => setBidCpmUsd(e.target.value)} placeholder="Auto" />
        </div>
        <div className="adv-form-field">
          <label className="adv-form-label">Daily cap, USD (optional)</label>
          <input type="number" min={1} step="1" className="adv-form-input" value={dailyCapUsd} onChange={(e) => setDailyCapUsd(e.target.value)} placeholder="No cap" />
        </div>
        <div className="adv-form-field">
          <label className="adv-form-label">Total cap, USD (optional)</label>
          <input type="number" min={1} step="1" className="adv-form-input" value={totalCapUsd} onChange={(e) => setTotalCapUsd(e.target.value)} placeholder="No cap" />
        </div>
      </div>

      <div className="adv-form-field">
        <label className="adv-form-label">Country targeting (optional — leave empty for everywhere)</label>
        <div className="adv-country-grid">
          {COUNTRIES.map((c) => (
            <label key={c.code} className="adv-checkbox-row adv-checkbox-row-compact">
              <input type="checkbox" checked={countries.includes(c.code)} onChange={() => toggleCountry(c.code)} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p className="adv-form-error">{error}</p>}

      <div className="adv-form-actions">
        <button type="button" className="ghost-btn" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="ghost-btn live" disabled={busy} onClick={handleSubmit}>
          {busy ? 'Creating…' : 'Create ad'}
        </button>
      </div>
    </div>
  );
}
