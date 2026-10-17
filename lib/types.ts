// lib/types.ts
//
// Shared shapes for Firestore documents, mirroring the fields the
// original index.html read/wrote with no schema enforcement. Keeping
// these as the single source of truth is one of the real upgrades over
// the old plain-JS version, where a typo in a field name would fail
// silently at runtime.

export type OverlayType = 'announcement' | 'maintenance' | 'message';
export type OverlayDisplay = 'fullscreen' | 'popup';

export interface SiteOverlay {
  active: boolean;
  type: OverlayType;
  display: OverlayDisplay;
  text: string;
  bgColor: string;
  textColor: string;
  updatedAt: number | { toDate: () => Date } | null;
}

export type SiteStatus = 'pending' | 'verified';

export interface Site {
  id: string;
  name: string;
  url: string;
  status: SiteStatus;
  overlay?: SiteOverlay;
  createdAt?: { toDate: () => Date } | null;
  verifiedAt?: { toDate: () => Date } | null;
}

export interface Visit {
  id: string;
  path: string;
  referrer: string;
  device: string;
  country?: string;
  city?: string | null;
  ts: { toDate: () => Date } | number | null;
  visitorId: string;
  blocked: boolean;
}

export interface Lead {
  id: string;
  email: string;
  ts: { toDate: () => Date } | number | null;
}
