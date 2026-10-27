'use client';

// components/widgets/designer/FaqListField.tsx
//
// Editor for the 'faqList' field type (lib/widgets.ts) — currently
// only used by faq-page's `faqs` config field. Two parts:
//
//   1. An "Generate with AI" panel: the owner describes their
//      business in a couple sentences, this component silently fetches
//      the connected site's own <title>/meta-description/theme-color
//      via POST /api/site-metadata (best-effort — a failed lookup just
//      means less context, never blocks generation), then posts both
//      to POST /api/generate-faq, which returns a ready { q, a }[]
//      list this component replaces/appends into the field.
//   2. The same per-item card list PrizeListField.tsx established for
//      spin-reward's prize list — reuses its wdg-prize-* CSS classes
//      (renamed wdg-faq-* below, same shapes) so this reads as the
//      same design language rather than a one-off.
//
// Generation never writes anything by itself — it only fills the
// in-memory `value` the parent form already tracks via onChange, same
// as typing into any other field. The owner still has to hit the
// designer's own Save button, same as always, and can edit/delete/
// reorder any generated question first.
import { useId, useState } from 'react';
import { getFirebaseAuth } from '@/lib/firebase';
import type { FaqItem } from '@/lib/widgets';

const MAX_FAQS = 16;
const MIN_FAQS = 1;

function emptyFaq(): FaqItem {
  return { q: '', a: '' };
}

export function FaqListField({
  value,
  onChange,
  siteId,
  siteUrl,
}: {
  value: FaqItem[];
  onChange: (v: FaqItem[]) => void;
  // Needed to call /api/generate-faq (ownership check) and, optionally,
  // /api/site-metadata (context) — both are no-ops in the UI below if
  // either is missing (e.g. previewing with no active site selected).
  siteId?: string;
  siteUrl?: string;
}) {
  const idBase = useId();
  const faqs = value.length > 0 ? value : [emptyFaq()];

  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastProvider, setLastProvider] = useState<string | null>(null);

  function updateFaq(i: number, patch: Partial<FaqItem>) {
    onChange(faqs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }
  function removeFaq(i: number) {
    onChange(faqs.filter((_, idx) => idx !== i));
  }
  function addFaq() {
    onChange([...faqs, emptyFaq()]);
  }

  async function generate() {
    const trimmed = description.trim();
    if (!trimmed) {
      setGenError('Describe your business first — a sentence or two is enough.');
      return;
    }
    if (!siteId) {
      setGenError('Select a site first.');
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        setGenError('Your session has expired. Please sign in again.');
        return;
      }
      const idToken = await user.getIdToken();

      // Best-effort: read the site's own head for extra context. A
      // failed/timed-out lookup should never block generation — just
      // fall through with no extra context, same as if the owner's
      // description alone had been sent.
      let siteTitle: string | undefined;
      let siteDescription: string | undefined;
      if (siteUrl) {
        try {
          const metaRes = await fetch('/api/site-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: siteUrl }),
          });
          const meta = await metaRes.json().catch(() => null);
          if (meta?.ok) {
            siteTitle = meta.title || undefined;
            siteDescription = meta.description || undefined;
          }
        } catch {
          // ignored — see comment above
        }
      }

      const res = await fetch('/api/generate-faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          siteId,
          businessDescription: trimmed,
          siteTitle,
          siteDescription,
          count: 6,
        }),
      });
      const data = await res.json().catch(() => ({ ok: false, error: 'Malformed server response.' }));
      if (!res.ok || !data.ok) {
        setGenError(data.error || 'Could not generate questions right now.');
        return;
      }
      const generated: FaqItem[] = Array.isArray(data.faqs) ? data.faqs : [];
      if (generated.length === 0) {
        setGenError('Could not generate questions right now.');
        return;
      }
      // Replaces the current list rather than appending — generation
      // is meant to give the owner a complete starting point to edit,
      // not pile onto whatever placeholder/default rows were already
      // there. If they'd already hand-written real questions they
      // want to keep, Add question still lets them bring those back
      // in below; this keeps the common "first time, empty defaults"
      // case a single clean action instead of leaving defaults mixed in.
      onChange(generated.slice(0, MAX_FAQS));
      setLastProvider(typeof data.provider === 'string' ? data.provider : null);
    } catch {
      setGenError('Could not generate questions right now — check your connection and try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="wdg-faq-field">
      <div className="wdg-faq-generate">
        <div className="wdg-faq-generate-head">
          <span className="wdg-faq-generate-title">\u2728 Generate with AI</span>
          <span className="wdg-faq-generate-sub">Describe your business and we\u2019ll draft real questions and answers for it.</span>
        </div>
        <textarea
          className="wdg-textarea"
          rows={3}
          value={description}
          maxLength={600}
          placeholder="e.g. We\u2019re a family-run bakery in Austin, TX \u2014 custom cakes, wedding orders, and daily pastries. Open Tue\u2013Sun."
          onChange={(e) => setDescription(e.target.value)}
          disabled={generating}
        />
        <div className="wdg-faq-generate-row">
          <button type="button" className="wdg-faq-generate-btn" onClick={generate} disabled={generating}>
            {generating ? 'Generating\u2026' : 'Generate questions'}
          </button>
          {lastProvider && !generating && !genError && <span className="wdg-faq-generate-ok">Done \u2014 review and edit below</span>}
        </div>
        {genError && <span className="wdg-faq-generate-error">{genError}</span>}
      </div>

      <div className="wdg-faqs">
        {faqs.map((f, i) => (
          <div key={i} className="wdg-faq-row">
            <div className="wdg-faq-row-top">
              <span className="wdg-faq-index">{i + 1}</span>
              <input
                className="wdg-input wdg-faq-q"
                value={f.q}
                maxLength={140}
                placeholder="Question"
                aria-label={`Question ${i + 1}`}
                onChange={(e) => updateFaq(i, { q: e.target.value })}
              />
              <button
                type="button"
                className="wdg-prize-remove"
                aria-label={`Remove question ${i + 1}`}
                disabled={faqs.length <= MIN_FAQS}
                onClick={() => removeFaq(i)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <label className="wdg-faq-a-wrap" htmlFor={`${idBase}-a-${i}`}>
              <textarea
                id={`${idBase}-a-${i}`}
                className="wdg-textarea wdg-faq-a"
                rows={2}
                value={f.a}
                maxLength={400}
                placeholder="Answer"
                aria-label={`Answer ${i + 1}`}
                onChange={(e) => updateFaq(i, { a: e.target.value })}
              />
            </label>
          </div>
        ))}
      </div>

      {faqs.length < MAX_FAQS && (
        <button type="button" className="wdg-prize-add" onClick={addFaq}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add question
        </button>
      )}
    </div>
  );
}
