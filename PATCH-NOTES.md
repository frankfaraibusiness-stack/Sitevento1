# Patch: build fix + domain intel on connect

Touched files only.

## Build fix

`components/AppRoot.tsx` was calling `handleConnectCTA(openAddSiteModal)` —
a 1-argument call left over from before the dashboard became its own
route. `useAppView.ts`'s `handleConnectCTA` now takes zero arguments (it
decides signed-in vs signed-out and routes to `/dashboard?connect=1`
itself), so TypeScript correctly failed the build with "Expected 0
arguments, but got 1." Fixed by calling it bare:

    <MarketingPage onConnectClick={handleConnectCTA} />

## New: flexible domain input + WHOIS/RDAP "domain intel" reveal

**components/connect/ConnectSiteWizard.tsx**
- Step 1's input is now `type="text"` (was `type="url"`), with
  `inputMode="url"` for the right mobile keyboard. The old `type="url"`
  triggered the *browser's* native validation before React ever saw the
  value, which silently rejected a bare `domain.com` even though the
  app's own `normalizeUrl()` already handled it fine. Placeholder/label
  updated to reflect that a bare domain is fine.
- Mounts the new `<DomainIntelCard>` under the field.

**hooks/useConnectSiteWizard.ts**
- `normalizeUrl()` now also sanity-checks the hostname looks like a
  real domain (has a dot + TLD) after prepending `https://`, so a stray
  single word doesn't slip through now that the field accepts plain
  text.
- Wires in the new `useDomainLookup` hook; `setDomainInput` now also
  triggers the (fully decoupled, best-effort) lookup. Added
  `domainLookupStatus` / `domainLookupResult` to the hook's return
  value.

**app/api/domain-lookup/route.ts** (new)
- Server-side RDAP lookup (the structured, JSON successor to port-43
  WHOIS) via the free `rdap.org` bootstrap proxy — resolves to the
  right registry for virtually any TLD, no API key, no new npm
  dependency. Same `fetch()` + `AbortController` timeout pattern as the
  existing `api/verify-site` route.
- Returns registrar, creation/update/expiry dates, computed age in
  days, status codes, and nameserver count. Always resolves
  `{found:false}` rather than erroring when RDAP has nothing (common
  for many ccTLDs / privacy-redacted domains) — this is a cosmetic
  enhancement and must never block or show an error on the actual
  connect flow.

**hooks/useDomainLookup.ts** (new)
- Debounces (550ms) and dedupes lookups as the user types, aborts an
  in-flight request if the input changes again, exposes
  `idle | loading | found | not-found` status.

**components/connect/DomainIntelCard.tsx** (new)
- The "credit animation" reveal:
  - `loading`: a small pulsing-dot "Looking up domain records…" row.
  - `not-found`: a quiet "Domain detected" line — a normal outcome,
    not an error.
  - `found`: domain age **counts up** from 0 with a requestAnimationFrame
    eased tween (not a CSS transition — animating a plain number needs
    JS), then registrar / registered date / expiry / nameserver count
    reveal as rows that fade+slide in one at a time (staggered
    `animation-delay`), plus status pills (e.g. "Transfer Prohibited").
  - Respects `prefers-reduced-motion`: count-up becomes instant, rows
    all appear together with no stagger.

**styles/connect-wizard.css**
- Appended `.domain-intel*` rules at the end of the file, reusing the
  existing design tokens (`--lime`, `--ink`, `--walnut`, `--line`,
  `--cream`) and the file's existing animation vocabulary
  (`pulse-ring`, `cubic-bezier(0.22,1,0.36,1)` easing) so it matches
  the rest of the wizard rather than looking bolted on.

## Not changed
No other component, hook, route, or style file was touched. The actual
site-creation/verification flow (Firestore writes, `/api/verify-site`,
`siteIndex` doc) is unchanged — the domain lookup is purely additive
and cannot block or alter it.
