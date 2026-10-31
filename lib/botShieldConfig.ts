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

export interface BotShieldConfig {
  /** Widget 1 — auto-blocks visitors replaying pageviews/clicks far faster than a human can. */
  refreshShieldEnabled: boolean;
  /** Widget 2 — auto-blocks visitors flooding lead-capture forms (email-capture, contact-us, appointment-booking, feedback-survey). */
  formFloodGuardEnabled: boolean;
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

export async function getBotShieldConfig(
  db: Firestore,
  siteRef: FirebaseFirestore.DocumentReference
): Promise<BotShieldConfig> {
  try {
    const snap = await siteRef.collection('botShield').doc('_config').get();
    if (!snap.exists) return DEFAULT_BOT_SHIELD_CONFIG;
    const data = snap.data() || {};
    return {
      refreshShieldEnabled: typeof data.refreshShieldEnabled === 'boolean' ? data.refreshShieldEnabled : DEFAULT_BOT_SHIELD_CONFIG.refreshShieldEnabled,
      formFloodGuardEnabled: typeof data.formFloodGuardEnabled === 'boolean' ? data.formFloodGuardEnabled : DEFAULT_BOT_SHIELD_CONFIG.formFloodGuardEnabled,
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
