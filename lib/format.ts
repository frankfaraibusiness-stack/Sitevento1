// lib/format.ts
//
// Note: the original's escapeHtml() helper has no equivalent here — JSX
// escapes all interpolated text by default, so manual escaping would be
// redundant (and wrong, since it'd double-escape the entities).
// Used by the rebuilt content pages' "Last updated" badge (About,
// Careers, Docs, Changelog, Status, ...) so it reflects the actual
// render date instead of a string someone has to remember to bump by
// hand in every page.tsx every time copy changes. These are plain
// Server Components with no revalidate window set, so this evaluates
// at build time on a static deploy and at request time on Vercel's
// on-demand rebuilds — either way it's never further than one deploy
// behind "now", which is the point: no more silently-stale dates.
export function formatLiveDate(d: Date = new Date()): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatTs(ts: unknown): string {
  if (!ts) return 'Just now';
  const date =
    typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as any).toDate === 'function'
      ? (ts as any).toDate()
      : new Date(ts as string | number);
  if (isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
