// lib/formFloodGuard.ts
//
// Widget 2: Form Flood Guard. Thin, route-agnostic wrapper around
// lib/botShieldEnforce.ts's applyBotShield, specifically for the
// visitor-facing LEAD-CAPTURE routes — email-capture, contact-us,
// appointment-booking, feedback-survey. These all share the same
// shape of risk the product ask called out directly: a script
// hammering a form submit endpoint is both (a) the clearest possible
// non-human behavior pattern, and (b) the most expensive one to leave
// unguarded, since each one is a real Firestore WRITE (a lead doc) —
// exactly the cost this app's write-limit system already exists to
// protect (see app/api/widget/route.ts's header for that history).
//
// Keyed on IP (see botShieldEnforce.ts's header for why these routes
// specifically use `ip:<address>` rather than a real visitorId) — a
// burst of submissions from the same address in a short window is
// judged the same way a burst of pageviews/clicks from the same
// visitor is, via the exact same lib/botShield.ts engine and
// 'form-submit' threshold (3 in 15s moderate, 6 in 15s severe — see
// BOT_SHIELD_THRESHOLDS).
//
// Call this AFTER assertWidgetWriteAllowed (so an already-paused site
// never pays for this extra check) and BEFORE the actual lead write —
// if it says blocked, the route should respond exactly the way it
// already responds to any other soft-reject (CORS-open, always 200,
// `{ ok: false, reason: ... }`), never a hard error.
import type { Firestore } from 'firebase-admin/firestore';
import { applyBotShield } from './botShieldEnforce';
import { getBotShieldConfig } from './botShieldConfig';

export interface FormFloodCheckResult {
  blocked: boolean;
  reason: string | null;
}

// Mirrors app/api/track's own VISITOR_ID_RE — a client-supplied
// visitorId is only trusted as a real one (and therefore allowed to
// participate in blockedVisitors) when it looks like what the loader
// actually generates. A handful of these routes accept an optional
// visitorId field already (contact-us, appointment-booking); an
// unrecognized/malformed value is silently treated the same as "no
// visitorId", falling back to the IP-keyed path below.
const VISITOR_ID_RE = /^v[a-z0-9]{6,40}$/i;

export async function checkFormFlood(opts: {
  db: Firestore;
  siteRef: FirebaseFirestore.DocumentReference;
  ip: string;
  /** Optional — when the caller already resolved a trustworthy visitorId (e.g. contact-us, appointment-booking), pass it so a block lands in blockedVisitors like any other visitor block, instead of only the IP-keyed bucket. */
  visitorId?: unknown;
}): Promise<FormFloodCheckResult> {
  const hasRealVisitorId = typeof opts.visitorId === 'string' && VISITOR_ID_RE.test(opts.visitorId);
  const subjectId = hasRealVisitorId ? (opts.visitorId as string) : `ip:${opts.ip}`;

  // No usable IP AND no usable visitorId (e.g. local dev, a proxy that
  // stripped the header, on a route with no visitorId field at all) —
  // fail open rather than keying every such request under one shared
  // bucket, which would false-positive-block unrelated visitors from
  // behind the same proxy/NAT the instant a FEW of them submit close
  // together.
  if (!hasRealVisitorId && (!opts.ip || opts.ip === 'unknown')) {
    return { blocked: false, reason: null };
  }

  try {
    const config = await getBotShieldConfig(opts.db, opts.siteRef);
    if (!config.formFloodGuardEnabled) {
      return { blocked: false, reason: null };
    }

    const result = await applyBotShield({
      db: opts.db,
      siteRef: opts.siteRef,
      subjectId,
      isRealVisitorId: hasRealVisitorId,
      kind: 'form-submit',
      enabled: true,
    });

    return { blocked: result.blocked, reason: result.reason };
  } catch (err) {
    // Same fail-open principle as every other best-effort check in
    // these routes (see app/api/track's header) — a Bot Shield hiccup
    // must never be the reason a legitimate lead submission fails.
    console.error('[formFloodGuard] check failed, allowing submission', err);
    return { blocked: false, reason: null };
  }
}
