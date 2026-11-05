// lib/botShieldConfig.ts
//
// Per-site on/off switches for the two Bot Shield widgets (Refresh &
// Click Shield, Form Flood Guard — see lib/botShield.ts's header for
// the shared detection engine both are built on). Stored at:
//
//   users/{uid}/sites/{siteId}/botShield/_config
//
// Deliberately sharing the `botShield` collection with the per-visitor
// rolling-state docs (lib/botShieldEnforce.ts writes those at
// {visitorId}) rather than a new top-level collection — `_config` is a
// reserved doc id here precisely because a real visitorId can never
// start with an underscore (see VISITOR_ID_RE in app/api/track/
// route.ts: visitor ids always start with "v"), so there's no
// collision risk between a visitor's state doc and this one config
// doc living side by side.
//
// Both widgets are available on every plan, unmetered: this protects
// the SITE OWNER's own write quota (a bot burst otherwise burns real,
// billed Firestore writes — see the very first fix in this app's
// change history, app/api/widget's write-limit gate) and the
// visitor-facing experience, so gating it behind a paid tier would be
// gating a cost-saving feature behind the exact cost it saves on.
import type { Firestore } from 'firebase-admin/firestore';
import type { BotShieldThresholdOverrides } from './botShield';

export interface BotShieldConfig {
  /** Widget 1 — auto-blocks visitors replaying pageviews/clicks far faster than a human can. */
  refreshShieldEnabled: boolean;
  /** Widget 2 — auto-blocks visitors flooding lead-capture forms (email-capture, contact-us, appointment-booking, feedback-survey). */
  formFloodGuardEnabled: boolean;
  // ── Owner-configurable thresholds ──────────────────────────────────
  // Per-site overrides for the burst caps lib/botShield.ts's
  // BOT_SHIELD_THRESHOLDS otherwise applies to every site identically.
  // A missing key, or a missing field within one, falls back to the
  // built-in default — see resolveThreshold in lib/botShield.ts, which
  // also clamps every value to a sane floor so a bad input here can
  // never disable protection outright. Kept OPTIONAL (not required,
  // not pre-filled with the defaults on write) so the dashboard only
  // ever writes the fields an owner actually touched, and a later
  // change to the built-in defaults automatically applies to every
  // site that never customized a given kind.
  thresholds?: BotShieldThresholdOverrides;
  updatedAt?: unknown;
}

// On by default: this is a protective default (guards the owner's own
// write quota and their visitors' experience), not a growth feature
// that needs an opt-in moment — the inverse default of most config in
// this app (widgets, agent features) which start OFF until the owner
// chooses to turn them on.
export const DEFAULT_BOT_SHIELD_CONFIG: BotShieldConfig = {
  refreshShieldEnabled: true,
  formFloodGuardEnabled: true,
};

// Only plain-number fields are trusted out of a stored/posted
// threshold override — anything else (wrong type, NaN, Infinity,
// missing) is dropped rather than coerced, so a corrupt doc degrades
// to "use the built-in default for this field" instead of propagating
// garbage into resolveThreshold's math.
function sanitizeOverride(raw: unknown): BotShieldThresholdOverrides[keyof BotShieldThresholdOverrides] {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: { windowMs?: number; moderateCount?: number; severeCount?: number } = {};
  if (typeof o.windowMs === 'number' && Number.isFinite(o.windowMs)) out.windowMs = o.windowMs;
  if (typeof o.moderateCount === 'number' && Number.isFinite(o.moderateCount)) out.moderateCount = o.moderateCount;
  if (typeof o.severeCount === 'number' && Number.isFinite(o.severeCount)) out.severeCount = o.severeCount;
  return Object.keys(out).length ? out : undefined;
}

function sanitizeThresholds(raw: unknown): BotShieldThresholdOverrides | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const o = raw as Record<string, unknown>;
  const out: BotShieldThresholdOverrides = {};
  const pageview = sanitizeOverride(o.pageview);
  const click = sanitizeOverride(o.click);
  const formSubmit = sanitizeOverride(o['form-submit']);
  if (pageview) out.pageview = pageview;
  if (click) out.click = click;
  if (formSubmit) out['form-submit'] = formSubmit;
  return Object.keys(out).length ? out : undefined;
}

export async function getBotShieldConfig(
  db: Firestore,
  siteRef: FirebaseFirestore.DocumentReference
): Promise<BotShieldConfig> {
  try {
    const snap = await siteRef.collection('botShield').doc('_config').get();
    if (!snap.exists) return DEFAULT_BOT_SHIELD_CONFIG;
    const data = snap.data() || {};
    const thresholds = sanitizeThresholds(data.thresholds);
    return {
      refreshShieldEnabled: typeof data.refreshShieldEnabled === 'boolean' ? data.refreshShieldEnabled : DEFAULT_BOT_SHIELD_CONFIG.refreshShieldEnabled,
      formFloodGuardEnabled: typeof data.formFloodGuardEnabled === 'boolean' ? data.formFloodGuardEnabled : DEFAULT_BOT_SHIELD_CONFIG.formFloodGuardEnabled,
      ...(thresholds ? { thresholds } : {}),
    };
  } catch (err) {
    // Fail OPEN to the protective default rather than failing the
    // request — a config-read hiccup should never be the reason a
    // pageview/form-submit beacon itself fails, same "never surface
    // infra trouble to the visitor" principle every route here
    // already follows (see app/api/track's header comment).
    console.error('[botShieldConfig] read failed, using defaults', err);
    return DEFAULT_BOT_SHIELD_CONFIG;
  }
}
