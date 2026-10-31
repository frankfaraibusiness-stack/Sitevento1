// components/legal/formatLastUpdated.ts
//
// Each legal page (privacy, terms) keeps a single ISO date constant
// next to its own content — see the LAST_UPDATED export at the top of
// app/privacy/content.tsx and app/terms/content.tsx — and this turns
// it into the display string LegalPage's "Last updated" line shows.
//
// This exists so that the ONLY place anyone ever hand-edits a date is
// that one ISO constant per page, next to the content it describes.
// Before this, page.tsx hardcoded a pre-formatted string like
// "October 17, 2026" directly in the JSX, so updating the content
// without also updating that string (or updating it with a typo/wrong
// format) was an easy, easy-to-miss mistake. Centralizing the
// formatting here means the displayed date is always derived — never
// re-typed — from the one source-of-truth constant.
export function formatLastUpdated(isoDate: string): string {
  // Parsed as UTC midnight (not local time) so the displayed date
  // doesn't shift by a day depending on the server/browser's time
  // zone relative to UTC.
  const date = new Date(`${isoDate}T00:00:00Z`);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
