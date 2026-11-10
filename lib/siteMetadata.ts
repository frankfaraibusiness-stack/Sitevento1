// lib/siteMetadata.ts
//
// Shared type for app/api/site-reachability/route.ts's result and
// components/connect/VerifyFlow.tsx's client-side rendering of it —
// kept in its own plain lib file (same reason DomainLookupResult
// lives in lib/domainLookup.ts rather than inside the
// /api/domain-lookup route file) so a Client Component can import
// just the type without any risk of a server-only route file's
// runtime code (firebase-admin, NextRequest, etc.) being pulled into
// the client bundle alongside it.
import type { SiteTheme } from './siteTheme';
import { emptySiteTheme } from './siteTheme';

export interface SiteMetadataResult {
  reachable: boolean;
  httpStatus: number | null;
  finalUrl: string | null;
  errorMessage: string | null;
  title: string | null;
  description: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImage: string | null;
  ogSiteName: string | null;
  ogType: string | null;
  twitterCard: string | null;
  themeColor: string | null;
  author: string | null;
  keywords: string[];
  canonical: string | null;
  favicon: string | null;
  // Populated whenever reachable is true — see lib/siteTheme.ts. This
  // route is read-only (never writes to the site doc, per its own
  // header comment), so this is a live preview only; app/api/
  // verify-site/route.ts is what actually persists siteTheme onto the
  // Site doc once verification succeeds.
  siteTheme: SiteTheme;
}

export function emptySiteMetadataResult(overrides: Partial<SiteMetadataResult> = {}): SiteMetadataResult {
  return {
    reachable: false,
    httpStatus: null,
    finalUrl: null,
    errorMessage: null,
    title: null,
    description: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    ogSiteName: null,
    ogType: null,
    twitterCard: null,
    themeColor: null,
    author: null,
    keywords: [],
    canonical: null,
    favicon: null,
    siteTheme: emptySiteTheme(),
    ...overrides,
  };
}
