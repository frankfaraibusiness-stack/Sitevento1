import type { LegalSection } from '@/components/legal/LegalPage';

export const careersIntro = (
  <p>
    sitevento is built by a small, product-focused team. We&apos;re not currently running a public hiring pipeline,
    but we keep this page updated so you know where things stand and how to reach us if that changes.
  </p>
);

export const careersSections: LegalSection[] = [
  {
    id: 'current-status',
    heading: 'Current status',
    body: (
      <p>
        There are no open roles posted right now. When we do open a position, it&apos;ll be listed here first,
        before anywhere else — we don&apos;t run a separate jobs board or third-party listing.
      </p>
    ),
  },
  {
    id: 'what-we-value',
    heading: 'What we look for when we do hire',
    body: (
      <>
        <p>When roles do open, we tend to prioritize:</p>
        <ul>
          <li><strong>Ownership over a narrow lane.</strong> A small team means everyone touches more of the product than a "pure" title would suggest.</li>
          <li><strong>Judgment about what not to build.</strong> Plan limits, widget caps, and feature scope all come from deliberate product decisions, not defaults — we value people who think about trade-offs, not just shipping speed.</li>
          <li><strong>Comfort with a lean stack.</strong> We&apos;d rather keep the product simple to operate than add complexity to look more "enterprise."</li>
        </ul>
      </>
    ),
  },
  {
    id: 'stay-in-touch',
    heading: 'Want to stay in the loop?',
    body: (
      <p>
        The newsletter signup at the bottom of our homepage covers product updates, not hiring news specifically —
        but it&apos;s currently the best way to hear from us. Check back here periodically, or reach out via{' '}
        <a href="/support">support</a> if you have a specific question about working with us.
      </p>
    ),
  },
];
