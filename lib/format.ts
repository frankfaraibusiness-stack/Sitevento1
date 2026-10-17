// lib/format.ts
//
// Note: the original's escapeHtml() helper has no equivalent here — JSX
// escapes all interpolated text by default, so manual escaping would be
// redundant (and wrong, since it'd double-escape the entities).
export function formatTs(ts: unknown): string {
  if (!ts) return 'Just now';
  const date =
    typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as any).toDate === 'function'
      ? (ts as any).toDate()
      : new Date(ts as string | number);
  if (isNaN(date.getTime())) return 'Just now';
  return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
