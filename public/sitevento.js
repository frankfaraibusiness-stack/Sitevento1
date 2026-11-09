// sitevento.js — Sitevento install snippet. Built from zero.
//
// Installed on a customer's site exactly as shown in the dashboard's
// connect wizard (hooks/useConnectSiteWizard.ts / ConnectSiteWizard.tsx):
//
//   <meta name="sitevento" content="SITE_ID">
//   <script src="https://YOUR-DEPLOYMENT/sitevento.js" data-site="SITE_ID" defer></script>
//
// Served as a static file from /public, so it works at /sitevento.js on
// whatever origin this deployment is on — no hardcoded domain anywhere.
//
// Three independent jobs. Each is wrapped so a failure in one can never
// break the others or the host page — nothing in here is allowed to
// throw into the customer's site.
//
//   1. IDENTITY — verify the <meta name="sitevento"> tag's content
//      matches this script's own data-site attribute (protects against
//      a copy/paste mismatch — tag from one site, script from another),
//      and establish a stable per-visitor id.
//
//   2. VISIT TRACKING — one beacon per page view (and per SPA route
//      change) to /api/track with path, referrer, viewport, language,
//      and the visitor id. Country/city/device/browser/OS are all
//      derived SERVER-SIDE from the request's own IP and User-Agent —
//      this script never reads or transmits precise geolocation,
//      fingerprinting signals, or anything beyond what any page the
//      visitor loads already exposes to it. Also beacons one lightweight
//      event per CLICK anywhere on the page to /api/click-track — the
//      "Click Shield" half of SECURITY BOT (lib/botShield.ts), judged
//      server-side on both click frequency and the time between clicks.
//
//   3. LIVE BANNER — opens a real-time Firestore listener on the site's
//      public siteOverlay data (read via the site's own doc) and
//      renders/removes a banner the instant the dashboard owner pushes
//      or takes one down, plus impression/click/close beacons so the
//      dashboard's live engagement stats move with real visitors.
//
// ── Visitor identity — SERVER-SIDE, not client-side ─────────────────
// This loader no longer invents its own visitorId. Identity is issued
// and owned entirely by /api/track (see lib/visitorIdentity.ts's
// header for the full contract): this script only ever stores and
// replays back a signed TOKEN the server gave it — never a bare id it
// made up itself. Concretely:
//
//   - On load, this reads whatever token it has saved from a PRIOR
//     visit (localStorage key sv_vtok) and sends that along on the
//     very first beacon. A brand-new visitor (or one with storage
//     cleared/blocked) simply has no token yet and sends none — that
//     is a completely normal, expected state, not an error.
//   - Every single /api/track response — not just a special
//     "recovery" case — carries back `visitorToken`, the token the
//     server wants this browser to use from now on. This script
//     ALWAYS overwrites its stored token with whatever comes back,
//     unconditionally; the server's answer is authoritative, full
//     stop, this script never second-guesses or keeps its own.
//   - visitorId (the plain id, unsigned) is only ever read out of a
//     verified response, never generated or guessed client-side. It
//     starts as '' and stays '' until the first beacon's response
//     lands — see identityReady/onIdentityReady below for how
//     anything that needs a real visitorId (click tracking, widgets,
//     ads) waits for that moment instead of racing it.
//
// This is deliberately a bigger change than "same id, better storage
// key": previously a malicious or just-reset page could assert ANY
// well-formed-looking id and the server would trust it outright. Now
// the bare id is worthless without the server's signature alongside
// it — only a token /api/track itself minted is ever honored as an
// existing identity. This id is still random and unlinked to any
// other identity — sitevento cannot connect it to a real name/email
// unless the visitor voluntarily submits one (e.g. the "Notify me"
// control on a locked banner).
(function () {
  'use strict';

  // Avoid double-initialization if the tag is pasted more than once.
  if (window.__siteventoLoaded) return;
  window.__siteventoLoaded = true;

  try {
    var currentScript =
      document.currentScript ||
      (function () {
        var scripts = document.getElementsByTagName('script');
        for (var i = scripts.length - 1; i >= 0; i--) {
          if (scripts[i].src && /sitevento\.js/.test(scripts[i].src)) return scripts[i];
        }
        return scripts[scripts.length - 1];
      })();

    var siteId = currentScript && currentScript.getAttribute('data-site');
    if (!siteId) return; // no site id, nothing to do

    // ---- Identity check: meta tag content must match data-site ----
    // Both are pasted together by the dashboard and should always
    // agree; if they don't (stale tag left from a different site,
    // tag/script copied from two different places), skip tracking
    // rather than silently attribute traffic to the wrong account.
    var metaTag = document.querySelector('meta[name="sitevento"]');
    var metaSiteId = metaTag ? metaTag.getAttribute('content') : null;
    if (metaTag && metaSiteId && metaSiteId !== siteId) {
      return;
    }

    // Resolve the API origin from this script's own src, so a redeploy
    // to a new *.vercel.app URL or a future custom domain just works
    // without touching this file.
    var API_ORIGIN = (function () {
      try {
        return new URL(currentScript.src).origin;
      } catch (e) {
        return window.location.origin;
      }
    })();
    var TRACK_ENDPOINT = API_ORIGIN + '/api/track';
    var CLICK_TRACK_ENDPOINT = API_ORIGIN + '/api/click-track';
    var OVERLAY_TRACK_ENDPOINT = API_ORIGIN + '/api/overlay-track';
    var NOTIFY_ENDPOINT = API_ORIGIN + '/api/overlay-notify';
    var WIDGET_ENDPOINT = API_ORIGIN + '/api/widget';
    var SITE_WIDGETS_ENDPOINT = API_ORIGIN + '/api/site-widgets';
    var CUSTOM_EVENT_ENDPOINT = API_ORIGIN + '/api/custom-event';
    var HEATMAP_SAMPLE_ENDPOINT = API_ORIGIN + '/api/heatmap-sample';

    // ---- Persistent visitor identity: token-first, server-issued ----
    // sv_vtok is the signed token from the server (see the big comment
    // above); sv_vid is kept ONLY as a one-release read-compat shim for
    // a browser that already has an id saved under the OLD key from
    // before this change shipped — it is read once, sent as a legacy
    // fallback on the very first beacon (the server still accepts a
    // bare id for exactly one more beacon — see /api/track's
    // clientHadValidLegacyId path), and then never written to again.
    // Nothing in this script mints an id itself anymore; if neither key
    // has anything usable, visitorId/visitorToken both simply start
    // empty and get filled in once the server's first response lands.
    var VISITOR_TOKEN_KEY = 'sv_vtok';
    var LEGACY_VISITOR_KEY = 'sv_vid';
    var visitorToken = '';
    var legacyVisitorId = '';
    var visitorId = '';
    // siteToken: signs (siteId, uid) for THIS page view only — see
    // lib/visitorIdentity.ts's "Site token" section. Deliberately kept
    // in-memory only, never localStorage: it's short-lived (30 min
    // server-side TTL) routing info for end-of-visit beacons on this
    // same page view, not a durable identity credential like
    // visitorToken above, so there's nothing worth persisting across
    // reloads. Set once /api/track's first response lands; stays empty
    // (and visit-end/heatmap-sample just fall back to their own normal
    // lookup) if that response is slow/never arrives.
    var siteToken = '';
    try {
      visitorToken = localStorage.getItem(VISITOR_TOKEN_KEY) || '';
      if (!visitorToken) {
        legacyVisitorId = localStorage.getItem(LEGACY_VISITOR_KEY) || '';
      }
    } catch (e) {
      // Storage blocked (private mode, locked-down embed, etc) — this
      // page load simply has no saved identity to offer; the very
      // first beacon goes out with neither a token nor a legacy id,
      // which /api/track treats as a brand-new-or-unrecoverable
      // visitor and mints one, same as any other first-ever visit.
    }

    // Fired (with the confirmed visitorId) the first time ANY beacon's
    // response hands back an identity — whether that's a freshly
    // signed token for a brand-new visitor or a recognized returning
    // one. Anything that needs a trustworthy, server-confirmed
    // visitorId before it does its own thing (click tracking, widget
    // mounting, ad serving) queues up here via onIdentityReady instead
    // of reading the visitorId closure variable directly, which could
    // otherwise still be '' if it ran before this page's very first
    // /api/track round trip completed.
    var identityReady = false;
    var identityWaiters = [];
    function resolveIdentity(id) {
      if (!id || identityReady) return;
      visitorId = id;
      identityReady = true;
      var waiters = identityWaiters;
      identityWaiters = [];
      for (var i = 0; i < waiters.length; i++) {
        try {
          waiters[i](id);
        } catch (e) {
          // A waiter throwing must never break the others or this
          // script's own tracking.
        }
      }
    }
    // Calls back immediately (synchronously, if identity is already
    // resolved) or queues the callback for when resolveIdentity runs.
    function onIdentityReady(cb) {
      if (identityReady) {
        cb(visitorId);
      } else {
        identityWaiters.push(cb);
      }
    }

    // Server-tracked email-capture state (see app/api/track's own
    // `emailCapture` response field and lib/types.ts's VisitorProfile.
    // emailCaptureSubmittedAt) — updated from every sendVisit()
    // response, same "latest wins" treatment as visitorToken above.
    // null until the first beacon lands; EmailCaptureWidget (via the
    // #cfg payload built in renderWidget below) treats a null/missing
    // value as "no server data yet, fall back to the old purely
    // client-side behavior" rather than as "definitely not submitted"
    // — see that widget's own comment on why it still keeps its
    // localStorage dismissed-flag as a fallback.
    var latestEmailCapture = null;

    // ---- Session id (per-tab, for "landing page" detection only) ----
    var SESSION_KEY = 'sv_sid';
    var LANDING_KEY = 'sv_landed';
    var sessionId = '';
    var isFirstViewThisSession = true;
    try {
      sessionId = sessionStorage.getItem(SESSION_KEY) || '';
      if (!sessionId) {
        sessionId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        sessionStorage.setItem(SESSION_KEY, sessionId);
      }
      isFirstViewThisSession = !sessionStorage.getItem(LANDING_KEY);
      if (isFirstViewThisSession) sessionStorage.setItem(LANDING_KEY, '1');
    } catch (e) {
      sessionId = '';
    }

    // Opt-in diagnostics: add ?sv_debug=1 to the page URL (or set
    // window.SITEVENTO_DEBUG = true before this script loads) to log
    // what each endpoint actually returns. /api/track and /api/widget
    // always answer 200 even on failure (by design — a tracking call
    // must never surface an error to a real visitor), so without this
    // a misconfigured backend (e.g. missing Firebase Admin env vars,
    // or a site not yet indexed) fails completely silently. Never
    // enabled unless explicitly requested.
    var DEBUG = (function () {
      try {
        return window.SITEVENTO_DEBUG === true || /[?&]sv_debug=1\b/.test(location.search);
      } catch (e) {
        return false;
      }
    })();
    function dlog() {
      if (!DEBUG) return;
      try {
        console.log.apply(console, ['[sitevento]'].concat(Array.prototype.slice.call(arguments)));
      } catch (e) {}
    }

    // DEBUG BUILD: sendBeacon forced off — it fails silently on a
    // blocked/CORS-rejected request, which is exactly what made "is it
    // even firing?" unanswerable from the embedding page's own console.
    // fetch() surfaces a real .then/.catch outcome instead, and in debug
    // mode logs it. Revert to the sendBeacon-first version only once
    // delivery is confirmed working end-to-end on real embedding sites.
    function beacon(url, payloadObj) {
      var payload = JSON.stringify(payloadObj);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      })
        .then(function (res) {
          if (DEBUG) {
            return res.text().then(function (text) {
              dlog(url, 'status', res.status, 'body', text);
            });
          }
        })
        .catch(function (err) {
          dlog(url, 'blocked:', err);
        });
    }

    // Same contract as beacon() but resolves with the parsed JSON body
    // (or null on any failure) instead of being fire-and-forget. Only
    // /api/track needs this — it's the one call whose response tells
    // the client whether this visitor/country is blocked, so the
    // full-screen block banner can be shown.
    function beaconWithResponse(url, payloadObj, cb) {
      var payload = JSON.stringify(payloadObj);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      })
        .then(function (res) {
          return res.json().catch(function () {
            return null;
          });
        })
        .then(function (data) {
          if (DEBUG) dlog(url, 'response', data);
          cb(data);
        })
        .catch(function (err) {
          dlog(url, 'blocked:', err);
          cb(null);
        });
    }

    // ---- Public custom-event API: window.sitevento('track', name, properties) ----
    // The one thing this embed script genuinely cannot know on its
    // own: WHICH button a click was on, or what it meant. Auto-
    // detected signals (rage clicks, the generic "valid click" count,
    // scroll depth) only ever see anonymous DOM activity. This lets
    // the site owner say "this specific thing happened" from their
    // own page — an onclick handler, a form-submit listener, a
    // checkout-complete callback, whatever — same shape as every
    // other embeddable analytics snippet's custom-event call
    // (ga('send', 'event', ...), analytics.track(...), etc).
    //
    //   sitevento('track', 'signup_button_click');
    //   sitevento('track', 'upgrade_click', { plan: 'pro', price: 29 });
    //
    // Waits on onIdentityReady rather than sending immediately: a call
    // fired from a page's very first tick (before this script's own
    // first /api/track round trip has completed) would otherwise have
    // no verified visitorToken yet, and /api/custom-event requires one
    // (see that route's header — same "no bare id accepted" rule
    // click tracking already follows). Queuing here means a developer
    // never has to manually wait for the script to be "ready" — call
    // it as early as they like and it fires the moment identity
    // actually resolves.
    function trackCustomEvent(name, properties) {
      if (typeof name !== 'string' || !name.trim()) {
        dlog('sitevento(\'track\', ...) needs a non-empty event name');
        return;
      }
      var cleanName = name.trim();
      var props = properties && typeof properties === 'object' && !Array.isArray(properties) ? properties : {};
      onIdentityReady(function () {
        if (!visitorToken) return; // identity resolved via legacy path with no signed token — nothing verifiable to send
        beacon(CUSTOM_EVENT_ENDPOINT, {
          siteId: siteId,
          visitorToken: visitorToken,
          sessionId: sessionId,
          name: cleanName,
          properties: props,
          path: location.pathname + location.search || '/',
        });
      });
    }

    // Drains any sitevento('track', ...) calls a page made BEFORE this
    // script finished loading. The dashboard's install snippet (see
    // ConnectSideRail/VerifyFlow in components/connect) is expected to
    // ship a tiny inline stub ahead of this file's own <script> tag:
    //
    //   window.sitevento = window.sitevento || function () {
    //     (window.sitevento.q = window.sitevento.q || []).push(arguments);
    //   };
    //
    // ...the same queue-then-replay pattern every major JS snippet
    // (gtag.js, Segment, Intercom...) uses so a developer can call
    // sitevento(...) anywhere on their page, including above this
    // script tag, without a race. If that stub was never installed
    // (an older install snippet, or this script loaded via some other
    // means), window.sitevento simply doesn't exist yet until the
    // line below creates it — either way, calls made AFTER this point
    // work immediately, and this once-only flush catches anything
    // queued before it.
    var existingQueue = (window.sitevento && window.sitevento.q) || [];
    window.sitevento = function (command) {
      var args = Array.prototype.slice.call(arguments, 1);
      if (command === 'track') {
        trackCustomEvent(args[0], args[1]);
      } else {
        dlog('sitevento(): unknown command', command);
      }
    };
    for (var qi = 0; qi < existingQueue.length; qi++) {
      try {
        window.sitevento.apply(null, existingQueue[qi]);
      } catch (e) {
        // One bad queued call must never block the rest or this
        // script's own tracking.
      }
    }

    // ============================================================
    // 1. VISIT TRACKING
    // ============================================================
    // ---- Durable identity: always adopt whatever the server issues ----
    // Called after EVERY /api/track response, not just a special
    // "recovery" case — the server signs and returns a fresh
    // visitorToken on every single beacon (see lib/visitorIdentity.ts),
    // and this script's job is simply to store whatever it's handed
    // and resolve identityReady the first time. No local judgment
    // about whether to trust it: the server is the one place that
    // decides what this visitor's id is, this is purely "save it and
    // tell anyone waiting."
    function adoptVisitorToken(token, id) {
      if (!token || !id) return;
      visitorToken = token;
      try {
        localStorage.setItem(VISITOR_TOKEN_KEY, token);
        // The legacy key is never written to again once a real token
        // exists — sv_vid is read-only compat now, not a second
        // source of truth to keep in sync.
      } catch (e) {
        // Storage still unavailable — fine, this page load's remaining
        // beacons at least use the token in-memory; next page load
        // just goes through device recovery again.
      }
      resolveIdentity(id);
    }

    // UTM / campaign attribution — read straight off location.search on
    // every call, same as every other per-call URL-derived field this
    // beacon already sends (path, for instance). In the common case a
    // tagged link only has these params on the very first page a
    // visitor lands on, so in practice they show up mostly on the
    // `landing: true` visit — but this does NOT special-case landingNow:
    // an SPA route change that itself appends UTM params (a client-side
    // router rewriting the query string) is sent exactly as faithfully
    // as the landing page was, with no attempt to "remember" the
    // landing page's params and reapply them to later, untagged URLs.
    // Attribution analysis (lib/analytics.ts's campaignBreakdown/
    // utmSourceBreakdown) is expected to read this as "which visits
    // carried a UTM tag," not "which session was attributed to a
    // campaign" — a looser, honest signal rather than a guessed one.
    function readUtmParams() {
      try {
        var params = new URLSearchParams(location.search || '');
        var out = {};
        var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
        for (var i = 0; i < keys.length; i++) {
          var v = params.get(keys[i]);
          if (v) out[keys[i]] = v.slice(0, 200);
        }
        return out;
      } catch (e) {
        return {};
      }
    }

    function sendVisit(path) {
      var landingNow = isFirstViewThisSession;
      isFirstViewThisSession = false; // only the first call in this page session counts as landing
      var utm = readUtmParams();
      // Resolve any pending broken-link check against THIS page view's
      // own path — covers both a hard navigation (fresh script load,
      // checked against location.pathname) and an SPA route change
      // (same script instance, sendVisit(path) called with the new
      // route) the exact same way, since this runs at the top of every
      // call regardless of which triggered it.
      checkPendingBrokenLink(path || location.pathname + location.search || '/');
      beaconWithResponse(
        TRACK_ENDPOINT,
        {
          siteId: siteId,
          // visitorToken is the primary identity signal (see the big
          // comment near VISITOR_TOKEN_KEY above); visitorId here is
          // ONLY the one-release legacy fallback read from the OLD
          // sv_vid key, sent solely so a browser that already has that
          // old key saved doesn't get treated as a stranger on its
          // very first beacon after this update ships. Once a real
          // token exists, legacyVisitorId is simply never read again.
          visitorToken: visitorToken || undefined,
          visitorId: visitorToken ? undefined : (legacyVisitorId || undefined),
          sessionId: sessionId,
          path: path || location.pathname + location.search || '/',
          referrer: document.referrer || '',
          screen: window.screen && window.screen.width && window.screen.height
            ? window.screen.width + 'x' + window.screen.height
            : null,
          lang: (navigator.language || navigator.userLanguage || '').slice(0, 20) || null,
          // Coarse timezone offset only (e.g. "-300"), not a timezone
          // name/locale — one more low-entropy signal for server-side
          // device recovery when storage comes back empty. Never used
          // for anything else.
          tz: (function () {
            try {
              return String(new Date().getTimezoneOffset());
            } catch (e) {
              return null;
            }
          })(),
          landing: landingNow,
          utmSource: utm.utm_source || null,
          utmMedium: utm.utm_medium || null,
          utmCampaign: utm.utm_campaign || null,
          utmTerm: utm.utm_term || null,
          utmContent: utm.utm_content || null,
          // Network Information API — Chromium-family only
          // (navigator.connection is undefined on Safari/Firefox, so
          // this reads null there, same "missing = unknown" contract
          // as every other optional signal this script sends). Free:
          // already-available browser data, no extra request.
          connectionType: (function () {
            try {
              var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
              return (c && c.type) || null;
            } catch (e) {
              return null;
            }
          })(),
        },
        function (data) {
          // Adopt whatever identity the server confirms, every single
          // time — not only on some special "recovery" response. This
          // is the moment identityReady resolves for this page load.
          if (data && data.visitorToken && data.visitorId) {
            adoptVisitorToken(data.visitorToken, data.visitorId);
          }
          if (data && data.siteToken) {
            siteToken = data.siteToken;
          }
          if (data && data.blocked) {
            renderBlockBanner(data.blockReason);
          }
          if (data && data.pendingMessage) {
            renderMessagePopup(data.pendingMessage);
          }
          if (data && data.emailCapture) {
            latestEmailCapture = data.emailCapture;
          }
          if (data && data.visitId) {
            startEngagementTracking(data.visitId);
          }
        }
      );
    }

    // ============================================================
    // 1a. BROKEN-LINK DETECTION
    // ============================================================
    // Honest scope: sitevento.js runs in the BROWSER, after the page
    // already loaded — it has no way to see an HTTP status code for
    // the current page (the server decided that before any script
    // ran), so this does NOT detect server-side 404s. What it CAN
    // detect honestly: a visitor clicked a same-site link that LOOKED
    // like real navigation, and no new page view beacon for that
    // destination ever showed up — which covers a broken client-side
    // router path, a link pointing at a route that 404s client-side,
    // JS on the target page crashing before sendVisit() can run, or a
    // click that got swallowed by a bug and never navigated at all.
    // That's a real, useful "something's wrong with this link" signal,
    // just a different (narrower, more honest) one than "the server
    // returned 404" — the dashboard copy must say it this way, not
    // claim HTTP-level 404 detection.
    //
    // Mechanics: on click, record { href, path, ts } into localStorage
    // (sessionStorage would NOT survive a full navigation in every
    // browser the same way localStorage does, and a real navigation is
    // exactly the case this needs to survive). On the NEXT page's
    // sendVisit() — which may be a fresh script load entirely — check
    // whether the pending click resolved (its target path shows up as
    // the new page) within a few seconds; if not, beacon it as a
    // broken link exactly once and discard it either way. Set up here,
    // BEFORE the initial sendVisit() call just below, specifically so
    // that very first call's own checkPendingBrokenLink (left over
    // from the PREVIOUS page, if any) has a live storage key and
    // listener to work with — this block must not move below that
    // call.
    var BROKEN_LINK_ENDPOINT = API_ORIGIN + '/api/broken-link';
    var BROKEN_LINK_STORAGE_KEY = 'sitevento_pending_link_' + siteId;
    var BROKEN_LINK_TIMEOUT_MS = 4000;

    function isSameOriginHref(href) {
      try {
        var a = document.createElement('a');
        a.href = href;
        return a.origin === location.origin;
      } catch (e) {
        return false;
      }
    }

    function onLinkClick(evt) {
      try {
        var el = evt.target;
        var depth = 0;
        while (el && depth < 6) {
          if (el.nodeType === 1 && (el.tagName || '').toLowerCase() === 'a') break;
          el = el.parentNode;
          depth++;
        }
        if (!el || !el.href) return;
        // Only same-origin links: an outbound link intentionally
        // leaving the site is not "broken" by not producing another
        // sitevento beacon — there isn't going to be one.
        if (!isSameOriginHref(el.href)) return;
        // Links that don't actually navigate the top-level page
        // (target="_blank", a download attribute) are out of scope —
        // checkable in advance, so filtered here. A bare #anchor jump
        // on the same path is left in scope deliberately: it still
        // sets a pending entry, but self-resolves immediately on the
        // very next sendVisit() for an unrelated reason (the path
        // prefix still matches), so it never produces a false report.
        if (el.target && el.target !== '_self') return;
        if (el.hasAttribute('download')) return;
        var destPath = el.pathname + (el.search || '');
        localStorage.setItem(
          BROKEN_LINK_STORAGE_KEY,
          JSON.stringify({ href: el.href, fromPath: location.pathname + location.search, destPath: destPath, ts: Date.now() })
        );
      } catch (e) {
        // Never let link-tracking bookkeeping interfere with the
        // actual click/navigation.
      }
    }

    function checkPendingBrokenLink(arrivedPath) {
      try {
        var raw = localStorage.getItem(BROKEN_LINK_STORAGE_KEY);
        if (!raw) return;
        localStorage.removeItem(BROKEN_LINK_STORAGE_KEY); // always consume it — checked at most once
        var pending = JSON.parse(raw);
        if (!pending || !pending.href || !pending.ts) return;
        if (Date.now() - pending.ts > BROKEN_LINK_TIMEOUT_MS) return; // too stale either way — not worth reporting as "just happened"
        // Resolved: the new page view's path matches (or starts with,
        // to tolerate a trailing slash / hash difference) what the
        // link pointed at — this was a working link.
        if (arrivedPath && pending.destPath && arrivedPath.indexOf(pending.destPath.split('#')[0].split('?')[0]) === 0) return;
        beacon(BROKEN_LINK_ENDPOINT, {
          siteId: siteId,
          visitorId: visitorId,
          href: pending.href,
          fromPath: pending.fromPath,
        });
      } catch (e) {
        // Malformed stored value or storage access error — nothing to
        // report, nothing to throw.
      }
    }

    try {
      document.addEventListener('click', onLinkClick, { capture: true, passive: true });
    } catch (e) {
      // localStorage/click listener unavailable — broken-link
      // detection just doesn't run; everything else is unaffected.
    }

    // Initial page view.
    sendVisit();

    // Best-effort SPA support: log a new visit on pushState/replaceState
    // navigation (common in React/Vue/etc router setups) without
    // requiring the host site to call anything explicitly.
    try {
      var wrapHistory = function (fn) {
        return function () {
          var result = fn.apply(this, arguments);
          sendVisit();
          return result;
        };
      };
      history.pushState = wrapHistory(history.pushState);
      history.replaceState = wrapHistory(history.replaceState);
      window.addEventListener('popstate', function () {
        sendVisit();
      });
    } catch (e) {
      // Environment locks down history mutation — initial-load tracking
      // above still ran, just skip SPA route tracking.
    }

    // ============================================================
    // 1b. ENGAGEMENT SUMMARY — scroll depth, active time, valid clicks
    // ============================================================
    // Everything in this block runs ENTIRELY IN MEMORY while the
    // visitor is on the page — zero network calls. Exactly one beacon
    // (VISIT_END_ENDPOINT) is sent per page view, when the visitor
    // leaves, carrying the final accumulated numbers. This is the only
    // way to add "how far did they scroll / how long were they
    // actually looking / how many real clicks" without multiplying
    // writes per visit — see app/api/visit-end/route.ts's header for
    // the full write-budget reasoning. Re-armed on every sendVisit()
    // call (new visitId each time — see startEngagementTracking below)
    // so an SPA route change gets its own fresh scroll/time/click
    // summary instead of accumulating across unrelated "page views."
    var VISIT_END_ENDPOINT = API_ORIGIN + '/api/visit-end';
    // Mirrors lib/botShield.ts's own MIN_HUMAN_CLICK_GAP_MS floor — a
    // click landing closer together than this is judged the same
    // "not human-paced" way SECURITY BOT already judges it server-side
    // for blocking purposes. This is a SEPARATE, client-side-only
    // tally for the owner's own "how engaged was this visit" read —
    // it does not feed, and is not fed by, the click-track beacon's
    // own burst/block judgment a few lines below.
    var MIN_HUMAN_CLICK_GAP_MS = 120;

    var engagementActive = false;
    var currentVisitId = null;
    var maxScrollPct = 0;
    var validClickCount = 0;
    var lastValidClickAt = 0;
    var activeMs = 0;
    var activeSince = document.visibilityState === 'visible' ? Date.now() : null;
    var scrollRaf = null;
    // Page load time — read once window.load fires (the Navigation
    // Timing entry isn't final before then), cached here rather than
    // sent as its own beacon: it rides the SAME visit-end beacon as
    // scroll/active-time/clicks below, so measuring load time costs
    // zero extra writes. Only ever applies to the FIRST tracked visit
    // of this page load (an SPA route change after the real page load
    // has nothing new to measure — there's no second "page load").
    var pageLoadMs = null;
    try {
      if (window.performance && typeof window.performance.getEntriesByType === 'function') {
        if (document.readyState === 'complete') {
          capturePageLoadMs();
        } else {
          window.addEventListener('load', function () {
            // Fired at the very end of the load event — defer one
            // tick so the Navigation Timing entry's own loadEventEnd
            // has actually been stamped by the time this reads it.
            setTimeout(capturePageLoadMs, 0);
          });
        }
      }
    } catch (e) {
      // Navigation Timing unsupported/blocked — pageLoadMs stays null,
      // same "missing = unknown" contract as every other optional
      // signal in this script.
    }
    function capturePageLoadMs() {
      try {
        var nav = window.performance.getEntriesByType('navigation')[0];
        if (nav && typeof nav.loadEventEnd === 'number' && nav.loadEventEnd > 0) {
          pageLoadMs = Math.round(nav.loadEventEnd);
        }
      } catch (e) {
        // leave pageLoadMs null
      }
    }

    function computeScrollPct() {
      try {
        var doc = document.documentElement;
        var scrollable = Math.max((doc.scrollHeight || 0) - (window.innerHeight || doc.clientHeight || 0), 0);
        if (scrollable <= 0) return 100; // page doesn't scroll at all — fully "seen" by definition
        var scrolled = window.scrollY || doc.scrollTop || 0;
        return Math.max(0, Math.min(100, Math.round((scrolled / scrollable) * 100)));
      } catch (e) {
        return 0;
      }
    }

    function onScroll() {
      if (!engagementActive || scrollRaf) return;
      // rAF-throttled, not a direct per-event read — scroll fires far
      // faster than once per animation frame on most devices, and
      // nothing here is written over the network either way (see this
      // block's own header), but there's no reason to run the
      // scrollHeight/getBoundingClientRect math more than once per
      // paintable frame.
      scrollRaf = window.requestAnimationFrame(function () {
        scrollRaf = null;
        var pct = computeScrollPct();
        if (pct > maxScrollPct) maxScrollPct = pct;
      });
    }

    function onVisibilityChange() {
      if (!engagementActive) return;
      if (document.visibilityState === 'visible') {
        if (activeSince === null) activeSince = Date.now();
      } else {
        if (activeSince !== null) {
          activeMs += Date.now() - activeSince;
          activeSince = null;
        }
      }
    }

    // ── Rage-click / "broken interaction" detection ──────────────────
    // A well-established UX-research proxy (used by every major session-
    // replay/heatmap tool): 3+ clicks on the SAME element within a short
    // window, with no sign the page reacted (no navigation, no DOM
    // change near the click), is what a frustrated visitor repeatedly
    // clicking something that doesn't work looks like. This is a signal
    // worth surfacing, NOT a certainty — a legitimately fast double/
    // triple-click on a working button can occasionally qualify too, so
    // the dashboard must present this as "clicks that look like a
    // frustrated/broken interaction," never as a confirmed bug report.
    // Tracked per element (via a WeakMap keyed on the actual DOM node,
    // not a selector string, so two different buttons that happen to
    // share a class never get confused) and reset whenever a new visit
    // starts tracking (startEngagementTracking clears this map) —
    // accumulated entirely in memory, same "no network call per click"
    // rule as every other engagement signal in this block. Only the
    // FINAL tally (how many distinct elements hit the rage-click
    // threshold this page view) rides the one visit-end beacon.
    var RAGE_CLICK_WINDOW_MS = 1200;
    var RAGE_CLICK_THRESHOLD = 3;
    var rageClickState = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var rageClickElements = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    var rageClickCount = 0;

    // ---- Heatmap sampling: bucket EVERY click's (x%, y%) position on
    // a coarse grid, not just the ones that trip rage-click detection
    // above. Same "accumulate in memory, one beacon at the end" shape
    // as everything else in this engagement block — a page with
    // thousands of clicks still costs exactly one flush, because what
    // gets sent is per-cell COUNTS (a plain object keyed "gx_gy"), not
    // one entry per click. GRID_SIZE must match app/api/heatmap-
    // sample/route.ts's own GRID_SIZE constant exactly — see that
    // file's header. Percent-of-page (not raw pixels) is what gets
    // bucketed, so this grid is meaningful across any viewport width;
    // viewportW is sent alongside purely as an informational caption
    // for the dashboard, never used to reinterpret the bucket math.
    var HEATMAP_GRID_SIZE = 20;
    var heatmapBuckets = Object.create(null);
    var heatmapSampleCount = 0;

    function onHeatmapClick(evt) {
      if (!engagementActive) return;
      var docEl = document.documentElement;
      var w = docEl ? docEl.clientWidth : window.innerWidth;
      var h = docEl ? docEl.clientHeight : window.innerHeight;
      if (!w || !h) return;
      // clientX/Y are viewport-relative, which is exactly what we want
      // for an (x%, y%) heatmap of what's currently on screen — NOT
      // pageX/Y (which would fold in scroll position and make the same
      // visual click position land in a different bucket depending on
      // how far the visitor had scrolled).
      var xPct = evt.clientX / w;
      var yPct = evt.clientY / h;
      if (xPct < 0 || xPct > 1 || yPct < 0 || yPct > 1) return; // defensive — shouldn't happen for a real click inside the viewport
      var gx = Math.min(HEATMAP_GRID_SIZE - 1, Math.floor(xPct * HEATMAP_GRID_SIZE));
      var gy = Math.min(HEATMAP_GRID_SIZE - 1, Math.floor(yPct * HEATMAP_GRID_SIZE));
      var key = gx + '_' + gy;
      heatmapBuckets[key] = (heatmapBuckets[key] || 0) + 1;
      heatmapSampleCount += 1;
    }

    // Called from the same place flushEngagement is (pagehide, SPA
    // route change) — its own beacon, not folded into visit-end's
    // payload, because this is PER-PAGE aggregate data (see
    // app/api/heatmap-sample's header), not a patch to one visit doc.
    function flushHeatmapSamples(useBeacon) {
      if (heatmapSampleCount === 0) return; // nothing sampled this page view — no beacon worth sending
      var samples = [];
      for (var key in heatmapBuckets) {
        if (!Object.prototype.hasOwnProperty.call(heatmapBuckets, key)) continue;
        var parts = key.split('_');
        var count = heatmapBuckets[key];
        // Expand each bucket back into `count` individual {gx,gy}
        // entries — the server re-derives its own counts from this
        // array rather than trusting a client-sent count directly
        // (see app/api/heatmap-sample's validation), so this keeps the
        // wire format identical to "a list of samples" even though
        // it's cheap here because count is small per bucket.
        for (var i = 0; i < count; i++) {
          samples.push({ gx: Number(parts[0]), gy: Number(parts[1]) });
        }
      }
      var docEl = document.documentElement;
      var payload = {
        siteId: siteId,
        visitorToken: visitorToken || undefined,
        // siteToken: lets /api/heatmap-sample resolve uid with zero
        // Firestore reads instead of its own siteIndex lookup — same
        // short-circuit visit-end's payload already uses, see
        // lib/visitorIdentity.ts's "Site token" section.
        siteToken: siteToken || undefined,
        path: location.pathname + location.search,
        samples: samples,
        viewportW: docEl ? docEl.clientWidth : window.innerWidth,
      };
      heatmapBuckets = Object.create(null);
      heatmapSampleCount = 0;
      try {
        if (useBeacon && navigator.sendBeacon) {
          var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(HEATMAP_SAMPLE_ENDPOINT, blob);
        } else {
          beacon(HEATMAP_SAMPLE_ENDPOINT, payload);
        }
      } catch (e) {
        // Never let a flush failure throw into the host page's own
        // unload/visibility handling — same guarantee flushEngagement
        // makes for its own beacon.
      }
    }

    function targetKey(evt) {
      // Walk up to the nearest clickable-ish ancestor (button/link/
      // role=button) rather than keying on the exact leaf node (e.g. an
      // <svg> icon inside a <button>) — two clicks that both land
      // "on the button" should count as the same element even if the
      // precise pixel hit a different child.
      var el = evt.target;
      var depth = 0;
      while (el && depth < 6) {
        if (el.nodeType === 1) {
          var tag = (el.tagName || '').toLowerCase();
          if (tag === 'button' || tag === 'a' || el.getAttribute('role') === 'button' || el.onclick) return el;
        }
        el = el.parentNode;
        depth++;
      }
      return evt.target && evt.target.nodeType === 1 ? evt.target : null;
    }

    function onRageClickCheck(evt) {
      if (!engagementActive || !rageClickState) return;
      var el = targetKey(evt);
      if (!el) return;
      var now = Date.now();
      var state = rageClickState.get(el);
      if (!state || now - state.first > RAGE_CLICK_WINDOW_MS) {
        state = { first: now, count: 0, flagged: false };
        rageClickState.set(el, state);
      }
      state.count += 1;
      if (state.count >= RAGE_CLICK_THRESHOLD && !state.flagged && rageClickElements && !rageClickElements.has(el)) {
        state.flagged = true;
        rageClickElements.add(el);
        rageClickCount += 1;
      }
    }

    function onEngagementClick(evt) {
      if (!engagementActive) return;
      onRageClickCheck(evt);
      onHeatmapClick(evt);
      var now = Date.now();
      if (lastValidClickAt && now - lastValidClickAt < MIN_HUMAN_CLICK_GAP_MS) return; // same human-timing gate as SECURITY BOT's own click shield
      lastValidClickAt = now;
      validClickCount += 1;
    }

    // Called only from flushEngagement, AFTER it has already closed out
    // any open "visible" interval (activeSince is guaranteed null by
    // then) — so this just reads the final accumulated total.
    function currentActiveSeconds() {
      return Math.round(activeMs / 1000);
    }

    // Sends the accumulated summary for whichever visit is currently
    // being tracked, then resets all three counters — called both when
    // a page view genuinely ends (pagehide) and when sendVisit() starts
    // tracking a NEW visitId (SPA route change), so each page view's
    // numbers are reported once and don't bleed into the next one.
    function flushEngagement(useBeacon) {
      if (!engagementActive || !currentVisitId) return;
      // Close out any still-open "visible" interval right here, rather
      // than relying on a visibilitychange listener having already run
      // first — two listeners for the same event fire in registration
      // order, which is fragile to depend on. Idempotent: if
      // onVisibilityChange already closed the interval (activeSince is
      // already null), this is a no-op.
      if (activeSince !== null) {
        activeMs += Date.now() - activeSince;
        activeSince = null;
      }
      var payload = {
        siteId: siteId,
        // visitorToken, not the bare id — app/api/visit-end now
        // verifies this the same way click-track does (see
        // lib/visitorIdentity.ts). currentVisitId is only ever set
        // from inside startEngagementTracking, called from
        // sendVisit()'s response handler — the exact place identity
        // resolves — so by the time flushEngagement can ever run,
        // visitorToken is already guaranteed to be set; no
        // onIdentityReady wait needed here.
        visitorToken: visitorToken || undefined,
        // siteToken: lets /api/visit-end resolve uid with zero
        // Firestore reads instead of its own siteIndex lookup — see
        // lib/visitorIdentity.ts's "Site token" section and this
        // route's own header. Harmless to omit (falls back exactly
        // like before) if /api/track's response hasn't landed yet by
        // the time this fires.
        siteToken: siteToken || undefined,
        visitId: currentVisitId,
        scrollDepthPct: maxScrollPct,
        activeSeconds: currentActiveSeconds(),
        validClicks: validClickCount,
        rageClicks: rageClickCount,
      };
      // Only ever attached once — to whichever visit-end beacon fires
      // FIRST after pageLoadMs becomes available. Cleared immediately
      // after use so a later SPA route change's own visit-end (a
      // different visitId, no real "page load" of its own) doesn't
      // resend the same number against the wrong page view.
      if (pageLoadMs !== null) {
        payload.pageLoadMs = pageLoadMs;
        pageLoadMs = null;
      }
      engagementActive = false; // stop accumulating immediately; this is a final snapshot
      try {
        if (useBeacon && navigator.sendBeacon) {
          // sendBeacon is the right tool specifically here (unlike the
          // beacon()/fetch() helper this file uses everywhere else) —
          // on pagehide/unload the page may be torn down before a
          // fetch() promise ever resolves, where sendBeacon is
          // guaranteed to queue the request with the browser itself.
          // Still genuinely best-effort end-to-end (see
          // app/api/visit-end's own header) — not every visit produces
          // this beacon, and that's an accepted, documented gap.
          var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(VISIT_END_ENDPOINT, blob);
        } else {
          beacon(VISIT_END_ENDPOINT, payload);
        }
      } catch (e) {
        // Never let a flush failure throw into the host page's own
        // unload/visibility handling.
      }
    }

    // Called from sendVisit()'s response handler once a visitId comes
    // back. Flushes whatever the PREVIOUS visitId had accumulated
    // (relevant on an SPA route change — the prior "page view" just
    // ended) before resetting counters for the new one.
    function startEngagementTracking(visitId) {
      if (engagementActive && currentVisitId && currentVisitId !== visitId) {
        flushEngagement(true);
        flushHeatmapSamples(true);
      }
      currentVisitId = visitId;
      maxScrollPct = computeScrollPct(); // may already be non-zero if landing mid-page (e.g. an anchor link)
      validClickCount = 0;
      lastValidClickAt = 0;
      activeMs = 0;
      activeSince = document.visibilityState === 'visible' ? Date.now() : null;
      rageClickState = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
      rageClickElements = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
      rageClickCount = 0;
      heatmapBuckets = Object.create(null);
      heatmapSampleCount = 0;
      engagementActive = true;
    }

    try {
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);
      document.addEventListener('click', onEngagementClick, { capture: true, passive: true });
      // pagehide is the modern, bfcache-safe successor to 'unload' and
      // fires reliably on both tab close and navigation away; 'visibility
      // change to hidden' is kept as a second trigger because on mobile
      // Safari/iOS, backgrounding a tab (home button, app switch) often
      // never fires pagehide at all before the page is suspended —
      // flushEngagement's own engagementActive guard makes calling it
      // from both listeners harmless (the second call is just a no-op).
      window.addEventListener('pagehide', function () {
        flushEngagement(true);
        flushHeatmapSamples(true);
      });
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
          flushEngagement(true);
          flushHeatmapSamples(true);
        }
      });
    } catch (e) {
      // Environment blocks one of these listeners — engagement tracking
      // just doesn't run; visit/click tracking above is unaffected.
    }

    // ============================================================
    // 1c. CLICK TRACKING — SECURITY BOT's "Click Shield" half
    // ============================================================
    // Rebuilt to stop costing a Firestore read+write on EVERY SINGLE
    // CLICK. The old version beaconed /api/click-track once per click,
    // unconditionally — on a page with 50 real clicks (a configurator,
    // a multi-step form, a game) that was 50 round trips, each one a
    // full siteIndex read + token-cap transaction + site-doc read +
    // blockedVisitors read + a botShield read-decide-write transaction,
    // for clicks that were, in the overwhelming majority of cases,
    // obviously human and clean. Pure waste, the exact "duplicate or
    // useless" cost this rewrite exists to remove.
    //
    // The fix mirrors how heatmap sampling (see onHeatmapClick /
    // flushHeatmapSamples above) and engagement tracking already work
    // here: accumulate in memory, zero network calls per click, only
    // ever talk to the server when there's actually something worth a
    // server-side judgment. Concretely:
    //
    //   - Every click's timestamp is pushed onto an in-memory array
    //     (clickTimestamps) — no network call, same as heatmap's
    //     in-memory buckets.
    //   - After each push, this runs the same SHAPE of judgment the
    //     server would (mirroring lib/botShield.ts's evaluateBurst: a
    //     rolling-window count against CLICK_SHIELD_WINDOW_MS /
    //     _MODERATE_COUNT / _SEVERE_COUNT below, plus the per-click
    //     MIN_HUMAN_CLICK_GAP_MS human-timing floor) entirely
    //     client-side, entirely in memory.
    //   - A beacon to /api/click-track is sent ONLY when that local
    //     judgment first crosses 'moderate' or 'severe' for this click
    //     run — i.e. only on the rare click that actually looks like a
    //     burst, not on every one of the (vastly more common) clean
    //     clicks leading up to it. Once a beacon has been sent for a
    //     given escalation level, it isn't resent again until the
    //     level changes (suspectedLevel below), so a sustained flood
    //     still doesn't re-beacon on every subsequent click past the
    //     threshold either.
    //   - The SERVER remains the sole source of truth for the actual
    //     restrict/block: the client's local judgment only decides
    //     WHEN to ask, never acts on its own — a bot controls this
    //     client-side code just as easily as everything else on the
    //     page, so /api/click-track still runs lib/botShield.ts's real
    //     decide() against its own server-held rolling state (see that
    //     route's own header) and that server verdict is what's
    //     actually enforced. The client's local count is only ever a
    //     trigger for "go check with the server now," never a
    //     replacement for the server's own check.
    //
    // Net effect: a normal visitor clicking throughout a page now costs
    // ZERO additional Firestore reads/writes beyond the one pageview
    // beacon already sent for that page. Only a visitor whose clicking
    // pattern actually looks automated ever reaches Firestore via this
    // path at all — which is exactly the traffic this feature exists
    // to catch in the first place.
    //
    // Aggregate click counts for the owner's OWN dashboard stats are
    // unaffected by any of this — validClicks/rageClicks already ride
    // the existing visit-end beacon (see flushEngagement above), which
    // was always a single end-of-visit flush, never per-click.
    try {
      // Mirrors lib/botShield.ts's BOT_SHIELD_THRESHOLDS.click default
      // (50 clicks/60s → restrict, 100 clicks/60s → block). This is
      // ONLY used to decide when to ask the server — if a site owner
      // has customized their thresholds in the dashboard, the actual
      // enforcement still happens correctly server-side against their
      // real configured numbers; a stale/default client-side guess
      // here can at most cause one extra (harmless) early beacon or
      // one slightly late one, never a missed block, since the server
      // re-checks its own real state on every beacon it does receive.
      var CLICK_SHIELD_WINDOW_MS = 60_000;
      var CLICK_SHIELD_MODERATE_COUNT = 50;
      var CLICK_SHIELD_SEVERE_COUNT = 100;

      var clickTimestamps = [];
      var lastSuspectedLevel = 'clean'; // 'clean' | 'moderate' | 'severe' — only beacon on a NEW escalation

      function judgeClickBurst(nowTs) {
        var windowStart = nowTs - CLICK_SHIELD_WINDOW_MS;
        var kept = [];
        for (var i = 0; i < clickTimestamps.length; i++) {
          if (clickTimestamps[i] > windowStart) kept.push(clickTimestamps[i]);
        }
        clickTimestamps = kept;
        clickTimestamps.push(nowTs);

        var level = 'clean';
        if (clickTimestamps.length >= CLICK_SHIELD_SEVERE_COUNT) level = 'severe';
        else if (clickTimestamps.length >= CLICK_SHIELD_MODERATE_COUNT) level = 'moderate';

        // Same human-timing floor the old per-click beacon relied on
        // the SERVER to judge — checked locally now purely to decide
        // whether this click is worth an immediate beacon, same as
        // the count check above.
        if (level === 'clean' && clickTimestamps.length > 1) {
          var gap = nowTs - clickTimestamps[clickTimestamps.length - 2];
          if (gap < MIN_HUMAN_CLICK_GAP_MS) level = 'moderate';
        }
        return level;
      }

      document.addEventListener(
        'click',
        function () {
          // visitorToken, not visitorId: /api/click-track still
          // requires a verified token (see lib/visitorIdentity.ts) —
          // a spoofed visitorId on this endpoint could get an
          // innocent visitor wrongly restricted/blocked. Gating on
          // visitorToken rather than visitorId is equivalent here:
          // resolveIdentity always sets both together (see
          // adoptVisitorToken), so one is truthy iff the other is. No
          // token yet means identity hasn't resolved — there's nothing
          // server-verifiable to key a click burst on, so this click
          // is simply not counted toward the burst window at all
          // (matches the old behavior's same early return).
          if (!visitorToken) return;

          var now = Date.now();
          var level = judgeClickBurst(now);

          // Only beacon on a NEW escalation (clean -> moderate,
          // moderate -> severe) — never on every click once already
          // at/above a level, and never at all while staying 'clean'.
          // This is the entire fix: the overwhelmingly common case
          // (every click on a normal page view) now touches the
          // network zero times.
          if (level === 'clean' || level === lastSuspectedLevel) return;
          lastSuspectedLevel = level;

          beaconWithResponse(
            CLICK_TRACK_ENDPOINT,
            { siteId: siteId, visitorToken: visitorToken },
            function (data) {
              // A click that got this visitor restricted/blocked shows
              // the exact same full-screen banner a blocked pageview
              // beacon would — the visitor is blocked account-wide the
              // instant SECURITY BOT acts, not just "this click didn't
              // count," so the banner should appear right away rather
              // than waiting for their next page load/refresh.
              if (data && data.blocked) {
                renderBlockBanner('visitor');
              }
            }
          );
        },
        { capture: true, passive: true }
      );
    } catch (e) {
      // Environment blocks adding a document-level listener (very
      // unusual) — click tracking just doesn't run; visit tracking
      // above is unaffected.
    }

    // ============================================================
    // 2. LIVE BANNER (optional — only activates if the site has ever
    //    pushed one; otherwise this listener just sits idle)
    // ============================================================
    var FIREBASE_CONFIG = {
      apiKey: 'AIzaSyCd0d__8akeieiLp4soUaYLU_fT9YmZ_ko',
      authDomain: 'autoagent-e750a.firebaseapp.com',
      projectId: 'autoagent-e750a',
      storageBucket: 'autoagent-e750a.firebasestorage.app',
      messagingSenderId: '420577964097',
      appId: '1:420577964097:web:b4a7cf15d7472f030796c0',
    };

    var DISMISS_KEY = 'sv_overlay_dismissed_' + siteId;

    function mountStyles() {
      if (document.getElementById('sv-overlay-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-overlay-styles';
      style.textContent =
        // ── Full-screen wrapper: covers the ENTIRE viewport, independent
        // of the host page's own layout/scroll position, same contract
        // as siterifty's .sa-overlay.
        '#sv-overlay-backdrop{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;' +
        'z-index:2147483000;overflow:hidden;box-sizing:border-box;}' +
        '#sv-overlay-backdrop *,#sv-overlay-backdrop *::before,#sv-overlay-backdrop *::after{box-sizing:border-box;}' +
        // ── Stage: fills the wrapper, paints the gradient background,
        // centers the card. This is what makes "fullscreen" actually
        // sitewide — a popup only differs by anchoring to a corner.
        '.sv-stage{position:relative;width:100%;height:100%;display:flex;flex-direction:column;' +
        'align-items:center;justify-content:center;padding:22px;box-sizing:border-box;overflow:hidden;' +
        'isolation:isolate;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;' +
        '-webkit-font-smoothing:antialiased;}' +
        '.sv-popup .sv-stage{align-items:flex-end;justify-content:flex-end;padding:18px;background:none !important;}' +
        // Soft accent bloom behind the card (fullscreen only).
        '.sv-glow{position:absolute;width:720px;height:720px;max-width:160%;left:50%;top:46%;' +
        'transform:translate(-50%,-50%);background:radial-gradient(closest-side,var(--sv-accent,#c6ff3d),transparent 70%);' +
        'opacity:.2;filter:blur(30px);pointer-events:none;z-index:-1;}' +
        '.sv-popup .sv-glow{display:none;}' +
        '.sv-card{position:relative;width:100%;max-width:430px;max-height:100%;overflow-y:auto;' +
        'overflow-x:hidden;-webkit-overflow-scrolling:touch;border-radius:30px;padding:34px 26px 28px;' +
        'box-sizing:border-box;text-align:center;color:var(--sv-text,#fff);scrollbar-width:none;}' +
        '.sv-card::-webkit-scrollbar{display:none;}' +
        '.sv-card-glass{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.14);' +
        'backdrop-filter:blur(26px) saturate(150%);-webkit-backdrop-filter:blur(26px) saturate(150%);' +
        'box-shadow:0 30px 70px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.12);}' +
        '.sv-card-solid{background:rgba(8,8,12,.92);border:1px solid rgba(255,255,255,.1);' +
        'box-shadow:0 30px 70px rgba(0,0,0,.55);}' +
        '.sv-popup .sv-card{max-width:340px;text-align:left;padding:18px;border-radius:16px;}' +
        '.sv-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;' +
        'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:inherit;' +
        'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}' +
        '.sv-close svg{width:15px;height:15px;}' +
        '.sv-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;' +
        'letter-spacing:.04em;text-transform:uppercase;padding:6px 13px;border-radius:999px;' +
        'color:var(--sv-accent,#c6ff3d);' +
        'background:color-mix(in srgb,var(--sv-accent,#c6ff3d) 13%,transparent);' +
        'border:1px solid color-mix(in srgb,var(--sv-accent,#c6ff3d) 32%,transparent);margin-bottom:14px;}' +
        '.sv-title{font-size:clamp(22px,6vw,28px);font-weight:800;margin:0 0 10px;' +
        'color:var(--sv-title,#fff);line-height:1.2;letter-spacing:-.02em;}' +
        '.sv-popup .sv-title{font-size:15px;margin-bottom:4px;}' +
        '.sv-desc{font-size:15px;line-height:1.55;margin:0;color:var(--sv-text,rgba(255,255,255,.8));' +
        'white-space:pre-line;}' +
        '.sv-popup .sv-desc{font-size:12px;}' +
        '.sv-cta{display:inline-flex;align-items:center;justify-content:center;gap:9px;width:100%;' +
        'min-height:50px;margin-top:22px;background:var(--sv-accent,#c6ff3d);' +
        'color:var(--sv-accent-text,#101400);font-weight:700;font-size:15.5px;padding:0 20px;border-radius:14px;' +
        'border:none;cursor:pointer;text-decoration:none;}' +
        '.sv-popup .sv-cta{width:auto;min-height:0;margin-top:12px;padding:9px 14px;font-size:12px;}' +
        '.sv-cta svg{width:16px;height:16px;}' +
        '.sv-notify-row{display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;justify-content:center;}' +
        '.sv-popup .sv-notify-row{justify-content:flex-start;}' +
        '.sv-notify-input{flex:1 1 150px;min-width:0;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.25);' +
        'background:rgba(255,255,255,.08);color:inherit;font-size:13.5px;}' +
        '.sv-notify-btn{padding:9px 14px;border-radius:9px;border:none;background:var(--sv-accent,#c6ff3d);' +
        'color:var(--sv-accent-text,#101400);font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap;}' +
        '.sv-notify-msg{font-size:12px;margin-top:6px;opacity:.85;}';
      document.head.appendChild(style);
    }

    function removeOverlay() {
      var el = document.getElementById('sv-overlay-backdrop');
      if (el) el.remove();
      try {
        document.documentElement.style.overflow = '';
      } catch (e) {}
    }

    function trackOverlay(version, event) {
      beacon(OVERLAY_TRACK_ENDPOINT, { siteId: siteId, version: version, event: event });
    }

    function readDismissed() {
      try {
        var v = localStorage.getItem(DISMISS_KEY);
        return v ? parseInt(v, 10) : null;
      } catch (e) {
        return null;
      }
    }
    function writeDismissed(version) {
      try {
        localStorage.setItem(DISMISS_KEY, String(version));
      } catch (e) {}
    }

    function renderOverlay(data) {
      // A block banner always wins — never let the owner's own promo
      // overlay render on top of (or replace) the "you're blocked"
      // takeover a Firestore listener update might fire after.
      if (document.getElementById('sv-block-backdrop')) return;
      removeOverlay();
      if (!data || !data.active) return;
      if (!data.title && !data.description) return;

      var version = typeof data.version === 'number' ? data.version : 0;
      var remembers = data.closable !== false && data.reshow !== 'every';
      if (remembers) {
        var dismissed = readDismissed();
        if (dismissed !== null && dismissed >= version) return;
      }

      mountStyles();
      var theme = data.theme || {};
      var isPopup = data.display === 'popup';

      // ── Full-page wrapper: pinned to the viewport regardless of the
      // host page's own scroll position/layout, so this always covers
      // the whole screen edge-to-edge (not just the visible fold).
      var backdrop = document.createElement('div');
      backdrop.id = 'sv-overlay-backdrop';
      if (isPopup) backdrop.className = 'sv-popup';

      // ── Stage: paints the sitewide gradient and centers the card,
      // mirroring siterifty's SiteAlertOverlay (.sa-overlay > .sa-stage
      // > .sa-glow + .sa-card). In popup mode the stage is transparent
      // (no sitewide tint) and just anchors the small card to a corner.
      var stage = document.createElement('div');
      stage.className = 'sv-stage';
      stage.style.setProperty('--sv-accent', theme.accent || '#c6ff3d');
      if (!isPopup) {
        stage.style.background = 'linear-gradient(160deg,' + (theme.bgFrom || '#111') + ',' + (theme.bgTo || '#000') + ')';
        var glow = document.createElement('div');
        glow.className = 'sv-glow';
        stage.appendChild(glow);
      }

      var card = document.createElement('div');
      card.className = 'sv-card sv-card-' + (theme.card === 'solid' ? 'solid' : 'glass');
      if (isPopup) {
        // Popup card still needs its own background since the stage
        // behind it has none.
        card.style.background = 'linear-gradient(160deg,' + (theme.bgFrom || '#111') + ',' + (theme.bgTo || '#000') + ')';
      }
      card.style.setProperty('--sv-accent', theme.accent || '#c6ff3d');
      card.style.setProperty('--sv-accent-text', theme.accentText || '#101400');
      card.style.setProperty('--sv-title', theme.titleColor || '#fff');
      card.style.setProperty('--sv-text', theme.textColor || 'rgba(255,255,255,0.78)');

      if (data.closable !== false) {
        var closeBtn = document.createElement('button');
        closeBtn.className = 'sv-close';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">' +
          '<path d="M5 5l14 14M19 5L5 19"/></svg>';
        closeBtn.onclick = function () {
          trackOverlay(version, 'close');
          removeOverlay();
          if (remembers) writeDismissed(version);
        };
        card.appendChild(closeBtn);
      }

      if (data.badge) {
        var badge = document.createElement('span');
        badge.className = 'sv-badge';
        badge.textContent = data.badge;
        card.appendChild(badge);
      }
      if (data.title) {
        var title = document.createElement('h2');
        title.className = 'sv-title';
        title.textContent = data.title;
        card.appendChild(title);
      }
      if (data.description) {
        var desc = document.createElement('p');
        desc.className = 'sv-desc';
        desc.textContent = data.description;
        card.appendChild(desc);
      }
      if (data.ctaLabel) {
        var cta = document.createElement(data.ctaUrl ? 'a' : 'button');
        cta.className = 'sv-cta';
        if (data.ctaUrl) cta.setAttribute('href', data.ctaUrl);
        else cta.setAttribute('type', 'button');
        var ctaText = document.createElement('span');
        ctaText.textContent = data.ctaLabel;
        cta.appendChild(ctaText);
        cta.onclick = function () {
          trackOverlay(version, 'cta');
          if (!data.ctaUrl && data.closable !== false) {
            removeOverlay();
            if (remembers) writeDismissed(version);
          }
        };
        card.appendChild(cta);
      }

      if (data.closable === false && data.notifyOnClose) {
        var row = document.createElement('div');
        row.className = 'sv-notify-row';
        var input = document.createElement('input');
        input.type = 'email';
        input.required = true;
        input.placeholder = 'you@email.com';
        input.className = 'sv-notify-input';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sv-notify-btn';
        btn.textContent = 'Notify me';
        var msg = document.createElement('div');
        msg.className = 'sv-notify-msg';
        btn.onclick = function () {
          var val = (input.value || '').trim();
          if (!val || val.indexOf('@') === -1) {
            msg.textContent = 'Enter a valid email.';
            return;
          }
          btn.disabled = true;
          btn.textContent = 'Submitting…';
          // visitorId + current page URL: feeds app/api/overlay-notify's
          // lead-attribution write (lib/leadAttribution.ts) — same
          // fields the Email Capture widget already sends, see
          // EmailCaptureWidget.tsx's own submit call.
          beacon(NOTIFY_ENDPOINT, { siteId: siteId, email: val, visitorId: visitorId, pageUrl: location.href });
          msg.textContent = "We'll let you know.";
          btn.textContent = 'Submitted';
        };
        row.appendChild(input);
        row.appendChild(btn);
        card.appendChild(row);
        card.appendChild(msg);
      }

      stage.appendChild(card);
      backdrop.appendChild(stage);
      document.body.appendChild(backdrop);
      if (!isPopup) {
        try {
          document.documentElement.style.overflow = 'hidden';
        } catch (e) {}
      }
      trackOverlay(version, 'impression');
    }

    function startOverlayListener() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', startOverlayListener, { once: true });
        return;
      }
      Promise.all([
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js'),
      ])
        .then(function (mods) {
          var appMod = mods[0];
          var fsMod = mods[1];
          var app = appMod.initializeApp(FIREBASE_CONFIG);
          var db = fsMod.getFirestore(app);
          var ref = fsMod.doc(db, 'siteOverlay', siteId);
          fsMod.onSnapshot(
            ref,
            function (snap) {
              renderOverlay(snap.exists() ? snap.data() : null);
            },
            function () {
              // Read denied/offline — fail silently, no banner shown.
            }
          );
        })
        .catch(function () {
          // SDK failed to load (network/ad-blocker/CSP) — skip banners,
          // visit tracking above is unaffected.
        });
    }
    startOverlayListener();

    // ============================================================
    // 2b. BLOCK BANNER — shown when /api/track reports this visitor
    //    (or their country) is blocked by the site owner. Unlike the
    //    promo overlay above, this is:
    //      - NOT dismissible (no close button, no "remembers" logic)
    //      - NOT opt-in — it fires purely off the /api/track response,
    //        with no siteOverlay doc needed
    //      - sitevento-branded, not owner-themed, since its purpose is
    //        telling the visitor the SITE blocked them using sitevento
    //        (plus a soft upsell), not delivering the owner's own copy
    //    Two distinct full-screen takeovers, each with its own theme and
    //    copy (not a shared "blocked" card reused for both reasons):
    //      - RESTRICTED (reason === 'country'): yellow/amber theme —
    //        visitor is outside an allowed region.
    //      - BLOCKED (any other reason): red theme — visitor/site owner
    //        explicitly blocked this visitor.
    //    True full-bleed takeovers — content fills the viewport edge to
    //    edge (no centered floating card), with its own dedicated
    //    .sv-block-* style block below rather than reusing .sv-card/
    //    .sv-stage/.sv-glow from the promo overlay.
    // ============================================================
    var SITEVENTO_LOGO_URL =
      'https://cdn.phototourl.com/member/2026-10-16-c4f6fc3d-2a68-40c8-9241-fa770df8a99f.png';

    var BLOCK_THEMES = {
      restricted: {
        badge: 'Access restricted',
        title: 'This site isn\u2019t available in your region',
        desc: 'The site owner has restricted access from your region. This page has been blocked using sitevento.',
        accent: '#f2c200',
        accentText: '#1a1300',
        bgFrom: '#1f1700',
        bgTo: '#000',
      },
      blocked: {
        badge: 'Access blocked',
        title: 'This site isn\u2019t available to you',
        desc: 'The site owner has blocked your access to this page. This page has been blocked using sitevento.',
        accent: '#ff4d4f',
        accentText: '#1a0000',
        bgFrom: '#1f0000',
        bgTo: '#000',
      },
    };

    function mountBlockStyles() {
      if (document.getElementById('sv-block-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-block-styles';
      style.textContent =
        // Full-bleed backdrop AND content — no inset card, no max-width
        // box. The theme-colored gradient and all content paint directly
        // across the entire viewport.
        '#sv-block-backdrop{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;' +
        'z-index:2147483647;overflow-y:auto;overflow-x:hidden;box-sizing:border-box;' +
        'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'padding:40px 24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;' +
        '-webkit-font-smoothing:antialiased;text-align:center;}' +
        '#sv-block-backdrop *,#sv-block-backdrop *::before,#sv-block-backdrop *::after{box-sizing:border-box;}' +
        '.sv-block-inner{position:relative;width:100%;max-width:520px;display:flex;' +
        'flex-direction:column;align-items:center;}' +
        // Logo rendered raw — it's a wordmark image (text baked into the
        // graphic itself), not an icon, so no square tile/border/shadow
        // chrome around it; just the image at a readable width.
        '.sv-block-logo{height:22px;width:auto;display:block;margin:0 auto 28px;}' +
        '.sv-block-badge{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:700;' +
        'letter-spacing:.04em;text-transform:uppercase;padding:7px 15px;border-radius:999px;' +
        'margin-bottom:22px;}' +
        '.sv-block-title{font-size:clamp(26px,6vw,38px);font-weight:800;margin:0 0 14px;' +
        'color:#fff;line-height:1.18;letter-spacing:-.02em;}' +
        '.sv-block-desc{font-size:16px;line-height:1.6;margin:0;color:rgba(255,255,255,.76);' +
        'max-width:420px;}' +
        '.sv-block-upsell{margin-top:36px;padding-top:26px;border-top:1px solid rgba(255,255,255,.14);' +
        'width:100%;max-width:360px;}' +
        '.sv-block-upsell-label{font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;' +
        'color:rgba(255,255,255,.48);margin-bottom:10px;}' +
        '.sv-block-upsell-text{font-size:13.5px;line-height:1.55;color:rgba(255,255,255,.7);margin:0 0 18px;}' +
        '.sv-block-cta{display:inline-flex;align-items:center;justify-content:center;gap:9px;' +
        'min-height:50px;padding:0 26px;font-weight:700;font-size:15px;border-radius:14px;' +
        'border:none;cursor:pointer;text-decoration:none;}';
      document.head.appendChild(style);
    }

    function renderBlockBanner(reason) {
      // Already showing — don't rebuild on a later sendVisit() call
      // (e.g. an SPA route change firing a second blocked response).
      if (document.getElementById('sv-block-backdrop')) return;
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', function () {
          renderBlockBanner(reason);
        }, { once: true });
        return;
      }

      // A block banner always wins over the promo overlay — if one is
      // already up (pushed before this beacon resolved), take it down.
      removeOverlay();

      mountBlockStyles();

      var themeKey = reason === 'country' ? 'restricted' : 'blocked';
      var theme = BLOCK_THEMES[themeKey];

      var backdrop = document.createElement('div');
      backdrop.id = 'sv-block-backdrop';
      backdrop.style.background = 'linear-gradient(160deg,' + theme.bgFrom + ',' + theme.bgTo + ')';

      var inner = document.createElement('div');
      inner.className = 'sv-block-inner';

      // Logo as a raw image — the asset itself is a wordmark (the
      // sitevento name baked into the image as text), not an icon, so
      // it's dropped in at its own natural aspect ratio with no tile/
      // border/shadow container around it.
      var logo = document.createElement('img');
      logo.className = 'sv-block-logo';
      logo.src = SITEVENTO_LOGO_URL;
      logo.alt = 'sitevento';
      inner.appendChild(logo);

      var badge = document.createElement('span');
      badge.className = 'sv-block-badge';
      badge.style.color = theme.accent;
      badge.style.background = 'color-mix(in srgb,' + theme.accent + ' 15%,transparent)';
      badge.style.border = '1px solid color-mix(in srgb,' + theme.accent + ' 35%,transparent)';
      badge.textContent = theme.badge;
      inner.appendChild(badge);

      var title = document.createElement('h2');
      title.className = 'sv-block-title';
      title.textContent = theme.title;
      inner.appendChild(title);

      var desc = document.createElement('p');
      desc.className = 'sv-block-desc';
      desc.textContent = theme.desc;
      inner.appendChild(desc);

      // Upsell: promote sitevento itself to the blocked visitor.
      var upsell = document.createElement('div');
      upsell.className = 'sv-block-upsell';
      var upsellLabel = document.createElement('div');
      upsellLabel.className = 'sv-block-upsell-label';
      upsellLabel.textContent = 'Run your own site?';
      var upsellText = document.createElement('p');
      upsellText.className = 'sv-block-upsell-text';
      upsellText.textContent =
        'sitevento gives any site live analytics, visitor blocking, and an AI agent that moderates traffic automatically — in minutes, free to start.';
      upsell.appendChild(upsellLabel);
      upsell.appendChild(upsellText);

      var cta = document.createElement('a');
      cta.className = 'sv-block-cta';
      cta.style.background = theme.accent;
      cta.style.color = theme.accentText;
      cta.href = API_ORIGIN + '/?utm_source=block_banner&utm_medium=blocked_visitor&utm_campaign=' + encodeURIComponent(reason || 'blocked');
      cta.target = '_blank';
      cta.rel = 'noopener noreferrer';
      var ctaText = document.createElement('span');
      ctaText.textContent = 'Get sitevento free';
      cta.appendChild(ctaText);
      cta.onclick = function () {
        // Reuses the existing overlay-engagement beacon so block-banner
        // upsell clicks show up alongside other CTA engagement rather
        // than needing a new endpoint; version 0 since this banner has
        // no versioned content of its own to dedupe against.
        beacon(OVERLAY_TRACK_ENDPOINT, { siteId: siteId, version: 0, event: 'cta' });
      };
      upsell.appendChild(cta);
      inner.appendChild(upsell);

      backdrop.appendChild(inner);
      document.body.appendChild(backdrop);
      try {
        document.documentElement.style.overflow = 'hidden';
      } catch (e) {}
    }

    // ============================================================
    // 2c. DIRECT MESSAGE POPUP — a short, one-off note the site owner
    //    sent to THIS specific visitor from the Users page's "Message"
    //    quick action (components/dashboard/UsersPage.tsx). Unlike the
    //    promo overlay above:
    //      - addressed to one visitorId, not broadcast sitewide — no
    //        Firestore listener needed, it rides piggyback on the
    //        normal /api/track beacon response (data.pendingMessage)
    //      - always closable, always a corner popup (never fullscreen)
    //      - a single fixed cartoonic look (bright card, thick ink
    //        outline, chunky offset shadow — same family as the
    //        dashboard's Email capture page), not owner-themeable —
    //        see lib/visitorMessage.ts's VISITOR_MESSAGE_THEME, which
    //        this is a hand-written mirror of
    //      - CTA is blank/absent by default; the owner can give it any
    //        label + link (a page, a mailto:, a tel:) when composing
    //    Shown at most once: closing it (via the × or the CTA) acks it
    //    back to the server (ackMessage: <sentAt>) so a later beacon on
    //    this or any other page never re-shows the same message.
    // ============================================================
    var MSG_THEME = { bg: '#fff7e0', ink: '#1a1812', accent: '#c6ff3d', accentText: '#1a1400' };

    function mountMessageStyles() {
      if (document.getElementById('sv-msg-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-msg-styles';
      style.textContent =
        '#sv-msg-backdrop{position:fixed;inset:0;width:100%;height:100vh;height:100dvh;' +
        'z-index:2147483100;overflow:hidden;box-sizing:border-box;pointer-events:none;' +
        'display:flex;align-items:flex-end;justify-content:flex-end;padding:18px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;' +
        '-webkit-font-smoothing:antialiased;}' +
        '#sv-msg-backdrop *,#sv-msg-backdrop *::before,#sv-msg-backdrop *::after{box-sizing:border-box;}' +
        '@keyframes svMsgPop{0%{opacity:0;transform:translateY(16px) scale(.96);}100%{opacity:1;transform:translateY(0) scale(1);}}' +
        '.sv-msg-card{position:relative;pointer-events:auto;width:100%;max-width:330px;' +
        'background:' + MSG_THEME.bg + ';color:' + MSG_THEME.ink + ';border:2.5px solid ' + MSG_THEME.ink + ';' +
        'border-radius:22px;padding:20px 20px 18px;box-shadow:0 5px 0 ' + MSG_THEME.ink + ';' +
        'animation:svMsgPop .32s cubic-bezier(.22,1,.36,1) both;}' +
        '.sv-msg-top{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;}' +
        '.sv-msg-icon{flex-shrink:0;width:34px;height:34px;border-radius:11px;background:' + MSG_THEME.accent + ';' +
        'border:2px solid ' + MSG_THEME.ink + ';display:flex;align-items:center;justify-content:center;}' +
        '.sv-msg-icon svg{width:18px;height:18px;color:' + MSG_THEME.accentText + ';}' +
        '.sv-msg-badge{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;' +
        'color:' + MSG_THEME.ink + ';opacity:.55;display:block;margin-bottom:2px;}' +
        '.sv-msg-title{font-size:15.5px;font-weight:800;margin:0;line-height:1.3;color:' + MSG_THEME.ink + ';' +
        'word-wrap:break-word;overflow-wrap:break-word;}' +
        '.sv-msg-close{position:absolute;top:12px;right:12px;width:26px;height:26px;border-radius:50%;' +
        'border:2px solid ' + MSG_THEME.ink + ';background:#fff;color:' + MSG_THEME.ink + ';cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;}' +
        '.sv-msg-close svg{width:11px;height:11px;}' +
        '.sv-msg-body{font-size:13.5px;line-height:1.55;margin:0 0 4px;color:' + MSG_THEME.ink + ';' +
        'opacity:.88;white-space:pre-line;word-wrap:break-word;overflow-wrap:break-word;}' +
        '.sv-msg-cta{display:inline-flex;align-items:center;justify-content:center;gap:7px;' +
        'margin-top:12px;padding:10px 16px;border-radius:12px;border:2px solid ' + MSG_THEME.ink + ';' +
        'background:' + MSG_THEME.accent + ';color:' + MSG_THEME.accentText + ';font-weight:800;font-size:13px;' +
        'cursor:pointer;text-decoration:none;box-shadow:0 3px 0 ' + MSG_THEME.ink + ';' +
        'transition:transform .12s ease,box-shadow .12s ease;}' +
        '.sv-msg-cta:hover{transform:translateY(-1px);box-shadow:0 4px 0 ' + MSG_THEME.ink + ';}' +
        '.sv-msg-cta:active{transform:translateY(1px);box-shadow:0 1px 0 ' + MSG_THEME.ink + ';}' +
        '@media (max-width:480px){#sv-msg-backdrop{padding:12px;}.sv-msg-card{max-width:none;}}';
      document.head.appendChild(style);
    }

    function removeMessagePopup() {
      var el = document.getElementById('sv-msg-backdrop');
      if (el) el.remove();
    }

    // Tells the server this exact message (by its sentAt stamp) has
    // been shown/dismissed, so it's never sent again. Piggybacks on
    // the normal track beacon rather than a dedicated endpoint — the
    // next sendVisit() naturally includes it, and firing one
    // immediately here (rather than waiting for the next page view)
    // means a single-page-visit reader still acks before leaving.
    function ackMessage(sentAt) {
      // Only ever called from inside a pendingMessage the server just
      // handed back in a sendVisit() response — identity is always
      // already resolved by then, so visitorToken is guaranteed to be
      // set here (no onIdentityReady wait needed).
      beacon(TRACK_ENDPOINT, {
        siteId: siteId,
        visitorToken: visitorToken || undefined,
        sessionId: sessionId,
        path: location.pathname + location.search || '/',
        ackMessage: sentAt,
      });
    }

    function renderMessagePopup(msg) {
      // Already showing (e.g. a second sendVisit resolved while this
      // is still up) — don't rebuild/duplicate.
      if (document.getElementById('sv-msg-backdrop')) return;
      if (!msg || (!msg.title && !msg.body)) return;
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', function () {
          renderMessagePopup(msg);
        }, { once: true });
        return;
      }

      mountMessageStyles();

      var backdrop = document.createElement('div');
      backdrop.id = 'sv-msg-backdrop';

      var card = document.createElement('div');
      card.className = 'sv-msg-card';

      var closeBtn = document.createElement('button');
      closeBtn.className = 'sv-msg-close';
      closeBtn.setAttribute('aria-label', 'Close');
      closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">' +
        '<path d="M5 5l14 14M19 5L5 19"/></svg>';
      closeBtn.onclick = function () {
        removeMessagePopup();
        ackMessage(msg.sentAt);
      };
      card.appendChild(closeBtn);

      var top = document.createElement('div');
      top.className = 'sv-msg-top';
      var icon = document.createElement('div');
      icon.className = 'sv-msg-icon';
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H7l-3 3V5Z"/></svg>';
      top.appendChild(icon);

      var textCol = document.createElement('div');
      textCol.style.minWidth = '0';
      textCol.style.flex = '1';
      var badge = document.createElement('span');
      badge.className = 'sv-msg-badge';
      badge.textContent = 'Message from the site';
      textCol.appendChild(badge);
      if (msg.title) {
        var title = document.createElement('h3');
        title.className = 'sv-msg-title';
        title.textContent = msg.title;
        textCol.appendChild(title);
      }
      top.appendChild(textCol);
      card.appendChild(top);

      if (msg.body) {
        var body = document.createElement('p');
        body.className = 'sv-msg-body';
        body.textContent = msg.body;
        card.appendChild(body);
      }

      if (msg.ctaLabel) {
        var cta = document.createElement(msg.ctaUrl ? 'a' : 'button');
        cta.className = 'sv-msg-cta';
        if (msg.ctaUrl) {
          cta.setAttribute('href', msg.ctaUrl);
          // mailto:/tel: open in the same tab by nature; an external
          // http(s) link opens in a new tab so the popup's host page
          // isn't navigated away from underneath the visitor.
          if (/^https?:\/\//i.test(msg.ctaUrl)) {
            cta.target = '_blank';
            cta.rel = 'noopener noreferrer';
          }
        } else {
          cta.setAttribute('type', 'button');
        }
        var ctaText = document.createElement('span');
        ctaText.textContent = msg.ctaLabel;
        cta.appendChild(ctaText);
        cta.onclick = function () {
          removeMessagePopup();
          ackMessage(msg.sentAt);
        };
        card.appendChild(cta);
      }

      backdrop.appendChild(card);
      document.body.appendChild(backdrop);
    }

    // ============================================================
    // 3. WIDGETS — any element with data-sitevento-widget="WIDGET_ID"
    //    gets that widget fetched and rendered immediately. New widgets
    //    just need the attribute added to the page; nothing here needs
    //    to change and nothing needs a redeploy for a new widget to
    //    start showing up, since the backend resolves widget content at
    //    request time.
    // ============================================================
    function mountWidgetStyles() {
      if (document.getElementById('sv-widget-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-widget-styles';
      style.textContent =
        '.sv-widget-frame{border:0;display:block;width:100%;max-width:100%;}' +
        '.sv-widget-error{font:12px -apple-system,sans-serif;color:#9a4b4b;padding:8px;}';
      document.head.appendChild(style);
    }

    function renderWidget(container, widget) {
      mountWidgetStyles();
      // Expandable widgets' sizing rules (collapsed launcher -> full
      // panel/modal on open) live in mountAutoStyles() below; ensure
      // they're present even if this widget was placed manually rather
      // than through the auto-mount path, so the open/close
      // postMessage bridge always has somewhere to apply its class
      // toggle.
      // EXPANDABLE_WIDGET_IDS is defined further down in this file (as
      // `var`, hoisted) but not assigned until the script finishes
      // evaluating top to bottom; that's fine here because renderWidget
      // is only ever CALLED later, after the whole script (including
      // that assignment) has already run — never at module-definition
      // time. Reusing the one shared list here instead of a second
      // hardcoded copy is what used to cause faq-page/contact-us/
      // feedback-survey to silently get no expandable CSS at all when
      // manually placed (rather than auto-mounted from the dashboard):
      // this used to be its own separate, shorter list that drifted out
      // of sync with EXPANDABLE_WIDGET_IDS below.
      if (widget && EXPANDABLE_WIDGET_IDS[widget.id]) {
        mountAutoStyles();
      }
      container.innerHTML = '';

      if (widget.type === 'iframe' && widget.bundleUrl) {
        // Executable widget content is NEVER run in the host page's own
        // context — always a sandboxed iframe pointed at a URL the
        // backend returned, so a compromised/misconfigured widget can
        // at most affect its own frame, never read the host page's
        // cookies/DOM/storage or make requests as the host origin.
        //
        // bundleUrl is the same for every site (it's the generic widget
        // page, e.g. https://app/w/support-chat) — per-site config is
        // layered on as a #hash fragment (never sent to the server in
        // the request line, unlike a query string) so the generic page
        // can read its own site's settings via location.hash on load.
        var iframe = document.createElement('iframe');
        iframe.className = 'sv-widget-frame';
        // The #cfg fragment carries visitorId to the widget (notably
        // EmailCaptureWidget, which needs a real, server-confirmed id
        // to key its "never show again once submitted" rule on — see
        // lib/visitorIdentity.ts's header for why a client-guessed id
        // can't support that). autoMountWidgets()/armScrollEndWidget()
        // (further down this file) can call requestWidget() — and thus
        // this function — before /api/track's first response has ever
        // landed, independent of identity. So iframe.src is NOT set
        // here: it's set only once onIdentityReady fires, which is
        // immediate if identity already resolved (the common case —
        // most widgets mount well after the first beacon) and
        // otherwise waits for it. The iframe element itself is still
        // created, styled, and appended right away so layout/sizing
        // isn't delayed — only the navigation (and therefore the
        // visitorId this iframe will ever see) waits.
        function mountWidgetFrame(id) {
          var cfgParam = '';
          try {
            cfgParam = '#cfg=' + encodeURIComponent(JSON.stringify({
              siteId: siteId,
              widgetId: widget.id,
              visitorId: id,
              // The signed token itself — needed so EmailCaptureWidget
              // can send a verifiable identity on its own POST to
              // /api/email-capture (that route's emailCaptureSubmittedAt
              // stamp requires a verified token; see its header).
              // Handing this to the widget iframe isn't a wider
              // exposure than visitorId above already is: the iframe
              // is sandboxed but same-origin with this app (it's
              // served from this app's own /w/{widgetId} route, not
              // the embedding site), i.e. the same origin that signed
              // the token in the first place, via the exact #hash-
              // fragment channel (never sent in a request line) this
              // file already uses for every other per-site widget
              // config.
              visitorToken: visitorToken || undefined,
              // Server-tracked visit count + submitted flag for THIS
              // visitor (see app/api/track's `emailCapture` response
              // field) — only consumed by EmailCaptureWidget today,
              // but included for every widget rather than special-
              // cased by id here: harmless extra JSON for widgets that
              // ignore it, and it's a useful signal for widgets added
              // later too. null until identityReady's first resolution
              // also means a server round trip landed (see
              // resolveIdentity/sendVisit), so by the time this
              // function ever runs, latestEmailCapture is already
              // whatever that same first response carried.
              emailCapture: latestEmailCapture,
              config: widget.config || {},
            }));
          } catch (e) {
            cfgParam = '';
          }
          iframe.src = widget.bundleUrl + cfgParam;
        }
        onIdentityReady(mountWidgetFrame);
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
        // Expandable widgets (faq-page, contact-us, etc.) are fully
        // sized by the stylesheet in mountAutoStyles() — collapsed
        // launcher size, then full-viewport/floating-card size once
        // open, driven by the sv-expanded class the postMessage bridge
        // toggles. Always-full-viewport widgets (support-chat,
        // email-capture) are fully self-positioned via their own CSS
        // and just need a full-size transparent frame at all times —
        // see ALWAYS_FULLSCREEN_WIDGET_IDS below. announcement-bar is
        // its own third case: not expandable, not full-viewport —
        // just a slim in-flow bar — so it gets its own small fixed
        // frame height via the '.sv-bar-frame' rule in
        // mountAutoStyles() instead of either the 480px fallback
        // (way too tall for a one-line bar) or a full-viewport frame
        // (unnecessary — it never covers more than a thin top strip).
        // An inline height here would beat every one of those rules
        // (inline style always outranks a stylesheet selector,
        // regardless of specificity) and freeze the frame at a fixed
        // size no matter what the widget's own CSS says — exactly the
        // "tiny iframe that never resizes" bug. So only
        // none-of-the-above widgets get the inline fallback height.
        if (
          !EXPANDABLE_WIDGET_IDS[widget.id] &&
          !ALWAYS_FULLSCREEN_WIDGET_IDS[widget.id] &&
          !BAR_FRAME_WIDGET_IDS[widget.id]
        ) {
          iframe.style.height = (widget.config && widget.config.height) || '480px';
        }
        if (BAR_FRAME_WIDGET_IDS[widget.id]) {
          iframe.className += ' sv-bar-frame';
        }
        iframe.setAttribute('title', widget.name || widget.id || 'Sitevento widget');
        container.appendChild(iframe);
      } else {
        // Unknown/unsupported widget type — fail quietly in production,
        // this text is only useful to the site owner inspecting devtools.
        var err = document.createElement('div');
        err.className = 'sv-widget-error';
        err.textContent = 'Sitevento: widget unavailable.';
        container.appendChild(err);
      }
    }

    function requestWidget(el) {
      var widgetId = el.getAttribute('data-sitevento-widget');
      if (!widgetId) return;

      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = controller
        ? setTimeout(function () {
            controller.abort();
          }, 8000)
        : null;

      fetch(WIDGET_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteId: siteId,
          widgetId: widgetId,
          pageUrl: location.href,
        }),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          if (timeoutId) clearTimeout(timeoutId);
          return res.json().catch(function () {
            return { success: false };
          });
        })
        .then(function (data) {
          if (data && data.success && data.widget) {
            renderWidget(el, data.widget);
          }
          // On failure, leave the container exactly as the host page
          // authored it rather than injecting any error UI into their
          // layout — the only diagnostic goes to devtools, never the
          // visible page, consistent with "never break the host page".
          else if (data && data.error) {
            console.warn('[sitevento] widget unavailable:', data.error.code, data.error.message);
          }
        })
        .catch(function () {
          if (timeoutId) clearTimeout(timeoutId);
          // Network failure/timeout — leave the element alone.
        });
    }

    function mountWidgets() {
      var elements = document.querySelectorAll('[data-sitevento-widget]');
      for (var i = 0; i < elements.length; i++) {
        requestWidget(elements[i]);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mountWidgets, { once: true });
    } else {
      mountWidgets();
    }

    // ============================================================
    // 4. AUTO-MOUNT — widgets turned on in the dashboard appear on the
    //    site automatically, with no HTML to paste, the same way the
    //    live banner above already does. This is what actually makes
    //    "enable" in the dashboard mean something: previously a widget
    //    only rendered if the owner separately pasted
    //    `<div data-sitevento-widget="id"></div>` into their page by
    //    hand, which most owners never did (or didn't know to do),
    //    so turning a widget on produced nothing anyone could see.
    //
    //    A widget the owner HAS manually placed (its data- div already
    //    exists on the page, handled by mountWidgets() above) is left
    //    alone — manual placement always wins, this only fills in
    //    widgets with no existing mount point. Widgets whose catalog
    //    `position` is 'manual-only' (ones meant to live inline in the
    //    page's own content, e.g. Reviews) are never auto-mounted.
    // ============================================================
    var AUTO_MOUNT_CONTAINER_IDS = {
      'fixed-top': 'sv-auto-fixed-top',
      'fixed-bottom': 'sv-auto-fixed-bottom',
      'corner-bottom-right': 'sv-auto-corner-br',
      'corner-bottom-left': 'sv-auto-corner-bl',
      'scroll-end': 'sv-auto-scroll-end',
    };

    // How close to the bottom of the page (px) counts as "scrolled to
    // the end" — generous enough to fire on short pages and pages whose
    // exact scrollable height shifts slightly as late content/images
    // load, without requiring the visitor hit the literal last pixel.
    var SCROLL_END_THRESHOLD = 180;

    function nearPageEnd() {
      var doc = document.documentElement;
      var scrollTop = window.pageYOffset || doc.scrollTop || 0;
      var viewport = window.innerHeight || doc.clientHeight || 0;
      var fullHeight = Math.max(
        doc.scrollHeight || 0,
        document.body ? document.body.scrollHeight : 0
      );
      // Pages shorter than the viewport (nothing to scroll) never fire
      // — there's no "end" to reach, so don't show on first paint.
      if (fullHeight <= viewport) return false;
      return scrollTop + viewport >= fullHeight - SCROLL_END_THRESHOLD;
    }

    function mountAutoStyles() {
      if (document.getElementById('sv-auto-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-auto-styles';
      style.textContent =
        '#sv-auto-fixed-top{position:fixed;top:0;left:0;right:0;z-index:2147482900;}' +
        '#sv-auto-fixed-bottom{position:fixed;bottom:0;left:0;right:0;z-index:2147482900;}' +
        '#sv-auto-corner-br{position:fixed;bottom:16px;right:16px;z-index:2147482900;' +
        'display:flex;flex-direction:column;align-items:flex-end;gap:10px;}' +
        '#sv-auto-corner-bl{position:fixed;bottom:16px;left:16px;z-index:2147482900;' +
        'display:flex;flex-direction:column;align-items:flex-start;gap:10px;}' +
        // A corner frame's box is fixed at its OPEN size (the chat
        // panel's own footprint) from the moment it mounts, whether the
        // launcher is collapsed or the panel is open — the inner widget
        // (see SupportChatWidget.tsx) positions its collapsed circle
        // inside that fixed box via absolute positioning instead of the
        // box itself growing/shrinking as it opens and closes. This is
        // what stops the "starts small, snaps bigger" jump: the iframe
        // the browser lays out never changes size, only its contents do.
        //
        // IMPORTANT — this used to be written as the ID selectors
        // `#sv-auto-corner-br .sv-widget-frame,#sv-auto-corner-bl
        // .sv-widget-frame`. An ID selector outranks ANY number of
        // classes/attribute selectors in CSS specificity, full stop —
        // source order never gets a say once an ID is in the mix. That
        // meant this 336px rule silently beat EVERY expanded/full-
        // screen override below it (.sv-expandable .sv-widget-frame,
        // the support-chat collapsed-circle rule, all of it), no matter
        // what classes JS toggled on the element: the iframe stayed
        // clamped to 336px wide while the outer mount div correctly
        // grew to the full viewport. That's exactly what "full-screen"
        // widgets rendering as a small centered floating popup looks
        // like — the div behind it really was full-screen, but the
        // iframe's own content was stuck in a 336px box inside it. The
        // chat bubble's "frame too small to be clickable" bug (see the
        // z-index/width note near the support-chat frame rule below)
        // was this same root cause. Using the .sv-corner-frame class
        // here instead keeps every rule touching .sv-widget-frame at
        // the same specificity tier, so the later, more specific
        // selectors below can actually win the way their position in
        // this stylesheet implies they should.
        '.sv-corner-frame .sv-widget-frame{' +
        'width:336px;max-width:calc(100vw - 32px);background:transparent;}' +
        // announcement-bar: a slim top bar, never taller than its own
        // CSS's max-height (160px — see AnnouncementBarWidget.tsx's
        // .ab-bar rule), so the outer iframe is sized to match rather
        // than either the 480px generic fallback or a full-viewport
        // frame. height:auto with this as a cap (not a fixed height)
        // lets the bar's own slide-up-and-collapse close animation
        // actually play inside it rather than getting clipped by a
        // frame that's already shrunk to 0.
        '.sv-bar-frame{display:block;width:100%;height:auto;max-height:160px;' +
        'background:transparent;}' +
        // scroll-end mounts full-viewport by default (the widget itself
        // decides overlay vs. corner-card layout from its config), so
        // its frame covers the screen with a transparent background —
        // same "frame never resizes, only its contents change" approach
        // as the corner containers above.
        '#sv-auto-scroll-end{position:fixed;inset:0;z-index:2147482950;' +
        'pointer-events:none;}' +
        '#sv-auto-scroll-end .sv-widget-frame{width:100%;height:100%;' +
        'background:transparent;pointer-events:auto;}' +
        // ── Expandable corner widgets ──────────────────────────────
        // Every corner-launcher widget (support-chat, faq-page,
        // contact-us, feedback-survey, appointment-booking, spin-
        // reward) opens into something bigger than the generic 336x480
        // box above: a true full-viewport panel with a sticky header on
        // mobile, and either a centered card (contact-us, feedback-
        // survey, appointment-booking, spin-reward) or a large centered
        // modal (faq-page) on desktop. Each opens a
        // `position:fixed;inset:0` layout INSIDE their iframe meant to
        // cover the whole screen.
        //
        // That inset:0 is relative to the iframe's own viewport, which
        // is only ever as big as the browser actually renders the
        // iframe element — so as long as the generic 336x480 corner
        // box above is what sizes these iframes, their "fullscreen"
        // modal is clipped to a 336x480 window: the launcher button
        // still responds to clicks (so it LOOKS broken, not just
        // small), but the modal it opens is invisible or cut off,
        // which reads as "I click and nothing happens."
        //
        // A prior version of this tried keeping support-chat's iframe
        // permanently full-viewport with pointer-events:none, hoping
        // the widget inside could selectively re-enable it on just its
        // own button/panel. That doesn't work: pointer-events:none set
        // on an <iframe> element from the PARENT page's stylesheet
        // blocks the parent from ever dispatching events into that
        // iframe at all — nothing the iframe's own document does
        // internally can hand that back. Hence: visible but completely
        // unclickable.
        //
        // Fix: every expandable widget's iframe stays sized to its
        // collapsed launcher by default (so it never needs pointer-
        // events:none and never blocks clicks on the rest of the
        // page), and posts a message to this window the moment it
        // opens/closes (see EXPANDABLE_WIDGET_IDS below and each
        // widget's own postMessage effect). The listener this arms
        // grows that SAME iframe — not a new overlay — to full-
        // viewport only while it's actually open, then shrinks it back
        // on close, so inset:0 inside the iframe lines up with the
        // real screen exactly when it needs to.
        '[data-sitevento-widget].sv-expandable{transition:width .15s ease,height .15s ease;}' +
        '[data-sitevento-widget].sv-expandable.sv-expanded{position:fixed;inset:0;' +
        'bottom:auto;left:auto;right:auto;top:auto;width:100%;height:100%;' +
        'max-width:none;max-height:none;z-index:2147483100;}' +
        '[data-sitevento-widget].sv-expandable .sv-widget-frame{width:100%;height:100%;background:transparent;}' +
        // support-chat no longer uses the expandable/postMessage-resize
        // path above (that's spin-reward/appointment-booking/faq-page/
        // contact-us/feedback-survey only now — see
        // EXPANDABLE_WIDGET_IDS below). Its own component (see
        // SupportChatWidget.tsx) always renders a self-positioned,
        // bottom-right launcher bubble and, when open, a bottom-right
        // floating card — never a full-screen takeover — exactly the
        // same "always full-viewport, transparent, pointer-events
        // managed entirely by the widget's own CSS" approach as
        // EmailCaptureWidget. So its mount div and iframe just need to
        // be full-viewport and transparent at all times; the widget
        // itself decides what's actually visible/clickable within
        // that, the same way EmailCaptureWidget's .ec-overlay does.
        '[data-sitevento-widget="support-chat"]{position:fixed;inset:0;' +
        'width:100%;height:100%;max-width:none;max-height:none;' +
        'bottom:auto;right:auto;z-index:2147483100;}' +
        '[data-sitevento-widget="support-chat"] .sv-widget-frame{' +
        'width:100%;height:100%;background:transparent;}';
      document.head.appendChild(style);
    }

    // Widgets whose open state needs more room than the generic
    // 336x480 corner box — see the CSS comment above. Each one posts
    // { source: 'sitevento-widget', widgetId, open, isMobile } to this
    // window from inside its iframe when it opens/closes; isMobile
    // decides whether the shared full-viewport .sv-expanded rule above
    // (edge-to-edge, sticky header) or the widget's own desktop-sized
    // centered layout applies.
    // Widgets that are always full-viewport + transparent, fully
    // self-positioned by their own CSS (a corner launcher bubble, a
    // centered or corner-anchored card) rather than relying on
    // sitevento.js to size a collapsed vs. open state. support-chat
    // mounts via the 'corner-bottom-right' catalog position (so it
    // appears immediately, same as any other corner widget) but needs
    // the full-viewport frame treatment in mountAutoStyles() above,
    // not the 336px .sv-corner-frame box other corner widgets get.
    var ALWAYS_FULLSCREEN_WIDGET_IDS = {
      'support-chat': 1,
    };

    // Widgets that are a slim, always-in-flow bar rather than a
    // launcher/overlay — just need a small fixed-height frame instead
    // of the 480px generic fallback or a full-viewport one. See the
    // '.sv-bar-frame' rule in mountAutoStyles() and the height-
    // assignment comment near where this is read in renderWidget().
    var BAR_FRAME_WIDGET_IDS = {
      'announcement-bar': 1,
    };

    var EXPANDABLE_WIDGET_IDS = {
      'spin-reward': 1,
      'appointment-booking': 1,
      'faq-page': 1,
      'contact-us': 1,
      'feedback-survey': 1,
    };

    // Listens for the open/closed state an expandable widget posts
    // from inside its iframe and resizes that iframe's host element
    // accordingly.
    function startExpandableWidgetBridge() {
      window.addEventListener('message', function (event) {
        var data = event && event.data;
        if (!data || data.source !== 'sitevento-widget' || !EXPANDABLE_WIDGET_IDS[data.widgetId]) return;
        var el = document.querySelector('[data-sitevento-widget="' + data.widgetId + '"]');
        if (!el) return;
        el.classList.add('sv-expandable');
        el.classList.toggle('sv-expanded', !!data.open);
      });
    }

    // Lazily creates (once) and returns the shared positioned container
    // for a given auto-mount slot, appending it to <body>.
    function getAutoContainer(position) {
      var id = AUTO_MOUNT_CONTAINER_IDS[position];
      if (!id) return null;
      var el = document.getElementById(id);
      if (!el) {
        mountAutoStyles();
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
      return el;
    }

    function autoMountWidgets() {
      var url = SITE_WIDGETS_ENDPOINT + '?siteId=' + encodeURIComponent(siteId) +
        '&pageUrl=' + encodeURIComponent(location.href);

      fetch(url)
        .then(function (res) {
          return res.json().catch(function () {
            return { success: false };
          });
        })
        .then(function (data) {
          if (!data || !data.success || !data.widgets || !data.widgets.length) return;

          for (var i = 0; i < data.widgets.length; i++) {
            (function (widget) {
              if (!widget || !widget.id) return;

              // Manual placement always wins: if the owner already has
              // a data- div for this exact widget anywhere on the
              // page, don't also auto-mount a second copy of it.
              var manual = document.querySelector('[data-sitevento-widget="' + widget.id + '"]');
              if (manual) return;

              // A corner widget's catalog `position` is its default
              // side; a per-site `config.side` ('left'/'right') lets
              // the owner override it without a second catalog entry.
              // Only meaningful for the two corner positions — a
              // fixed-top/-bottom bar has no left/right to choose.
              var effectivePosition = widget.position;
              if (
                (effectivePosition === 'corner-bottom-right' || effectivePosition === 'corner-bottom-left') &&
                widget.config &&
                (widget.config.side === 'left' || widget.config.side === 'right')
              ) {
                effectivePosition = widget.config.side === 'left' ? 'corner-bottom-left' : 'corner-bottom-right';
              }

              // scroll-end widgets don't mount immediately like every
              // other auto-mounted position — they wait for the visitor
              // to actually scroll near the bottom of the page (and skip
              // entirely if this visitor has already seen/dismissed
              // them before), so they're armed separately below instead
              // of rendered here on the spot.
              if (effectivePosition === 'scroll-end') {
                armScrollEndWidget(widget);
                return;
              }

              var container = getAutoContainer(effectivePosition);
              if (!container) return; // 'manual-only' or unknown position

              var mount = document.createElement('div');
              mount.setAttribute('data-sitevento-widget', widget.id);
              mount.setAttribute('data-sitevento-auto', '1');
              // .sv-corner-frame is what the 336px default-size CSS
              // rule above targets (see the long comment on that rule
              // for why this has to be a class, not an ID selector on
              // the container) — only the two corner positions use
              // that fixed-footprint sizing; fixed-top/-bottom bars
              // size themselves differently and never get this class.
              // ALWAYS_FULLSCREEN_WIDGET_IDS widgets (support-chat)
              // skip it entirely — they're fully self-positioned and
              // get their own dedicated full-viewport rule instead
              // (see the '[data-sitevento-widget="support-chat"]' rule
              // in mountAutoStyles()).
              if (
                (effectivePosition === 'corner-bottom-right' || effectivePosition === 'corner-bottom-left') &&
                !ALWAYS_FULLSCREEN_WIDGET_IDS[widget.id]
              ) {
                mount.className = 'sv-corner-frame';
              }
              container.appendChild(mount);

              // Render directly from what this endpoint already
              // returned (name/config/bundleUrl) instead of making a
              // second round trip through /api/widget for content this
              // response already carries.
              renderWidget(mount, widget);
            })(data.widgets[i]);
          }
        })
        .catch(function () {
          // Network failure — the owner's manually-placed widgets (if
          // any) above are unaffected; just no auto-mounted ones this
          // load.
        });
    }

    // Arms a scroll listener for one scroll-end widget. Mounts it (and
    // tears the listener down) the first time the visitor scrolls near
    // the bottom of the page. The widget's own per-visitor "seen" flag
    // (set in its iframe's localStorage, keyed by this same
    // sv_{widgetId}_seen_{siteId} pattern — see EmailCaptureWidget.tsx)
    // is the actual source of truth for "don't show again"; this check
    // here is a fast-path so a returning visitor who's already
    // dismissed it never even gets a scroll listener attached, rather
    // than mounting the iframe only for it to immediately hide itself.
    // Generic over any future scroll-end widget, not just email-capture
    // — the key is built from the widget's own id.
    function armScrollEndWidget(widget) {
      if (!widget || !widget.id) return;
      try {
        if (localStorage.getItem('sv_' + widget.id.replace(/-/g, '_') + '_seen_' + siteId)) return;
      } catch (e) {
        // Storage unavailable — fall through and arm it anyway; the
        // widget's own in-iframe check is the real guard either way.
      }

      var mounted = false;
      function tryMount() {
        if (mounted) return;
        if (!nearPageEnd()) return;
        mounted = true;
        window.removeEventListener('scroll', tryMount);
        window.removeEventListener('resize', tryMount);

        var container = getAutoContainer('scroll-end');
        if (!container) return;
        var mount = document.createElement('div');
        mount.setAttribute('data-sitevento-widget', widget.id);
        mount.setAttribute('data-sitevento-auto', '1');
        container.appendChild(mount);
        renderWidget(mount, widget);
      }

      window.addEventListener('scroll', tryMount, { passive: true });
      window.addEventListener('resize', tryMount);
      // Covers short/already-scrolled pages where the visitor lands
      // past the threshold without firing a scroll event at all.
      tryMount();
    }

    function startAutoMount() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', startAutoMount, { once: true });
        return;
      }
      autoMountWidgets();
    }
    startAutoMount();

    // Armed unconditionally (not gated on document.body like the
    // mount functions above) — it's just an event listener, safe to
    // attach immediately, and needs to be in place before any
    // expandable widget's iframe can post its first open/closed
    // message.
    startExpandableWidgetBridge();

    // ============================================================
    // 5. ADS — the rendering half of Monetization (dashboard toggle:
    //    components/monetization/MonetizationControlPanel.tsx /
    //    MonetizationAdTypeGrid.tsx; backend: /api/ad-serve picks an
    //    eligible ad, /api/ad-track bills impressions/clicks). Same
    //    "appear automatically, nothing to paste" posture as section 4
    //    above — a site owner turning Monetization on is what makes
    //    ads start showing, not any HTML the owner adds.
    //
    //    One auto-mounted slot per enabled AD_FORMAT_ID, each its own
    //    fixed container (own ids below, never AUTO_MOUNT_CONTAINER_IDS
    //    above — those are keyed by WIDGET position and shared with
    //    manually-placed widgets; reusing them here could put an ad and
    //    a widget in the same node). /api/ad-serve itself is the real
    //    gate (site verified, monetization on, format enabled, a live
    //    ad eligible for this format/country) — this code just asks,
    //    for every format, and renders only what comes back ok:true.
    //    A site with monetization off, or a format with no eligible
    //    ad right now, gets back ok:false and that slot simply never
    //    mounts — exactly the same "fail quiet, never break the host
    //    page" contract every other endpoint here already has.
    // ============================================================
    var AD_SERVE_ENDPOINT = API_ORIGIN + '/api/ad-serve';
    var AD_TRACK_ENDPOINT = API_ORIGIN + '/api/ad-track';

    // Mirrors lib/adPool.ts's AD_FORMAT_IDS. Duplicated rather than
    // imported because this is a static, unbundled script served
    // as-is from /public — same reasoning as FIREBASE_CONFIG above
    // being a literal object here instead of an import from
    // lib/firebase.ts. If a format is ever added/removed there, this
    // list needs updating here too; /api/ad-serve's own validation
    // (isValidAdFormatId) is the real source of truth either way, so
    // a stale entry here just means that one slot's request 400s
    // quietly rather than anything breaking.
    var AD_FORMAT_IDS = ['banner', 'sticky-footer', 'interstitial', 'popup', 'overlay'];

    // 'banner' and 'sticky-footer' both dock to a fixed edge of the
    // viewport (top vs. bottom) and are rendered identically beyond
    // that — same simple strip, just anchored differently — so they
    // share the render function below and differ only in container.
    // 'popup', 'overlay' and 'interstitial' are all a dismissible card
    // over a full-viewport dimmed stage — they share the sv-ad-card
    // renderer, each with its own container so none collide if more
    // than one fires close together (per lib/monetization.ts's
    // catalog, each format is conceptually distinct even though all
    // three render edge-to-edge/centered). 'popup' previously shared
    // sv-ad-corner with a small bottom-left corner card instead — not
    // a centered popup at all; this is the fix, and it also matches
    // the square in-house image creatives (lib/houseAds.ts), sized for
    // a centered square card.
    var AD_CONTAINER_IDS = {
      banner: 'sv-ad-fixed-top',
      'sticky-footer': 'sv-ad-fixed-bottom',
      interstitial: 'sv-ad-interstitial',
      popup: 'sv-ad-popup',
      overlay: 'sv-ad-overlay',
    };

    function mountAdStyles() {
      if (document.getElementById('sv-ad-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-ad-styles';
      style.textContent =
        '#sv-ad-fixed-top{position:fixed;top:0;left:0;right:0;z-index:2147482800;}' +
        '#sv-ad-fixed-bottom{position:fixed;bottom:0;left:0;right:0;z-index:2147482800;}' +
        // Bottom-LEFT, deliberately — a corner widget (support-chat's
        // launcher, etc, see #sv-auto-corner-br above) defaults to
        // bottom-right; placing ad cards on the opposite corner avoids
        // the common case of both landing in the same spot. A widget
        // explicitly configured to the left corner (config.side:
        // 'left') can still end up here too — widgets sit at a higher
        // z-index than ads either way (2147482900 vs. 2147482850), so
        // in that one case the widget renders in front rather than
        // the ad hiding it; the extra bottom offset below gives the ad
        // card its own vertical lane instead of sitting flush under
        // the widget launcher in that case.
        '#sv-ad-corner{position:fixed;bottom:88px;left:16px;z-index:2147482850;' +
        'display:flex;flex-direction:column-reverse;align-items:flex-start;gap:10px;}' +
        '#sv-ad-overlay{position:fixed;inset:0;z-index:2147482990;}' +
        // Full-viewport, same as #sv-ad-overlay, but its own id/z-index
        // lane so interstitial and overlay never collide if a site
        // somehow has both eligible formats fire close together —
        // each is a conceptually distinct format (see comment above
        // AD_CONTAINER_IDS) even though both render edge-to-edge.
        '#sv-ad-interstitial{position:fixed;inset:0;z-index:2147482980;}' +
        // Centered popup — its own full-viewport dimmed-stage lane,
        // distinct z-index from overlay/interstitial so all three can
        // coexist without collision.
        '#sv-ad-popup{position:fixed;inset:0;z-index:2147482970;}' +
        '.sv-ad-strip,.sv-ad-strip *{box-sizing:border-box;}' +
        '.sv-ad-strip{display:flex;align-items:center;gap:12px;width:100%;padding:10px 16px;' +
        'background:rgba(10,10,14,.94);color:#fff;font-family:-apple-system,BlinkMacSystemFont,' +
        '"Segoe UI",Inter,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;' +
        'text-decoration:none;cursor:pointer;}' +
        '.sv-ad-strip-img{height:40px;max-height:40px;width:auto;border-radius:6px;flex-shrink:0;' +
        'object-fit:cover;}' +
        '.sv-ad-strip-body{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:1px;}' +
        '.sv-ad-strip-headline{font-size:13.5px;font-weight:700;color:#fff;overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap;}' +
        '.sv-ad-strip-text{font-size:12px;color:rgba(255,255,255,.7);overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap;}' +
        '.sv-ad-strip-cta{flex-shrink:0;padding:7px 13px;border-radius:999px;background:#c6ff3d;' +
        'color:#101400;font-size:12px;font-weight:700;white-space:nowrap;}' +
        '.sv-ad-strip-close{flex-shrink:0;width:22px;height:22px;border-radius:50%;border:none;' +
        'background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:flex;' +
        'align-items:center;justify-content:center;padding:0;}' +
        '.sv-ad-strip-close svg{width:11px;height:11px;}' +
        '.sv-ad-strip-label{position:absolute;top:-16px;left:16px;font-size:9px;font-weight:700;' +
        'letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);}' +
        '#sv-ad-fixed-top .sv-ad-strip-wrap,#sv-ad-fixed-bottom .sv-ad-strip-wrap{position:relative;}' +
        '.sv-ad-card-wrap{position:relative;width:300px;max-width:calc(100vw - 32px);' +
        'border-radius:16px;overflow:hidden;box-shadow:0 14px 34px rgba(0,0,0,.4);}' +
        '.sv-ad-card{display:flex;flex-direction:column;background:rgba(14,14,18,.97);color:#fff;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;' +
        '-webkit-font-smoothing:antialiased;text-decoration:none;cursor:pointer;}' +
        '.sv-ad-card-img{width:100%;height:140px;object-fit:cover;display:block;}' +
        '.sv-ad-card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;}' +
        '.sv-ad-card-headline{font-size:14.5px;font-weight:800;line-height:1.3;}' +
        '.sv-ad-card-text{font-size:12.5px;line-height:1.5;color:rgba(255,255,255,.72);' +
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;}' +
        '.sv-ad-card-cta{align-self:flex-start;margin-top:4px;padding:9px 16px;border-radius:999px;' +
        'background:#c6ff3d;color:#101400;font-size:12.5px;font-weight:700;}' +
        '.sv-ad-card-close{position:absolute;top:9px;right:9px;width:26px;height:26px;' +
        'border-radius:50%;border:none;background:rgba(0,0,0,.4);color:#fff;cursor:pointer;' +
        'display:flex;align-items:center;justify-content:center;padding:0;}' +
        '.sv-ad-card-close svg{width:12px;height:12px;}' +
        '.sv-ad-card-badge{position:absolute;top:10px;left:10px;font-size:9px;font-weight:700;' +
        'letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.75);' +
        'background:rgba(0,0,0,.4);padding:3px 8px;border-radius:999px;}' +
        '#sv-ad-overlay .sv-ad-stage,#sv-ad-interstitial .sv-ad-stage,#sv-ad-popup .sv-ad-stage{' +
        'position:relative;width:100%;height:100%;display:flex;align-items:center;' +
        'justify-content:center;padding:22px;box-sizing:border-box;background:rgba(6,6,9,.88);}' +
        '#sv-ad-overlay .sv-ad-card-wrap,#sv-ad-interstitial .sv-ad-card-wrap{width:100%;max-width:420px;}' +
        '#sv-ad-overlay .sv-ad-card-img,#sv-ad-interstitial .sv-ad-card-img{height:220px;}' +
        // 'popup' card wrap is sized for a square (1:1) creative —
        // the in-house ads (lib/houseAds.ts) are square images — so
        // its image fills a square box instead of the 420px-wide/
        // 220px-tall rectangle overlay/interstitial use.
        '#sv-ad-popup .sv-ad-card-wrap{width:100%;max-width:340px;}' +
        '#sv-ad-popup .sv-ad-card-img{width:100%;aspect-ratio:1/1;height:auto;object-fit:cover;}';
      document.head.appendChild(style);
    }

    // (AD_CONTAINER_IDS above is the single source of truth for which
    // container each format uses; see its comment for the current
    // interstitial-vs-overlay-vs-popup layout split.)
    function getAdContainer(id) {
      var el = document.getElementById(id);
      if (!el) {
        mountAdStyles();
        el = document.createElement('div');
        el.id = id;
        document.body.appendChild(el);
      }
      return el;
    }

    // Per-visitor-per-ad dismiss memory for the closable formats
    // (interstitial/popup/overlay) — same localStorage-keyed-by-siteId
    // pattern as DISMISS_KEY above, scoped to the ad's own id rather
    // than a static version number since a new ad should always get
    // its own fresh chance to show regardless of what was dismissed
    // before it.
    function adDismissKey(adId) {
      return 'sv_ad_dismissed_' + siteId + '_' + adId;
    }
    function isAdDismissed(adId) {
      try {
        return localStorage.getItem(adDismissKey(adId)) === '1';
      } catch (e) {
        return false;
      }
    }
    function markAdDismissed(adId) {
      try {
        localStorage.setItem(adDismissKey(adId), '1');
      } catch (e) {}
    }

    function trackAd(adId, format, eventType) {
      onIdentityReady(function (id) {
        beacon(AD_TRACK_ENDPOINT, {
          siteId: siteId,
          adId: adId,
          event: eventType,
          visitorId: id,
          format: format,
        });
      });
    }

    function adClickHandler(ad, format) {
      return function () {
        trackAd(ad.id, format, 'click');
      };
    }

    // 'banner' / 'sticky-footer': a slim full-width strip docked to
    // the top or bottom edge. Not individually closable (same posture
    // as a real ad network's leaderboard placement — low-intrusion by
    // design, so no close button competing with the creative for a
    // sliver of vertical space); if the owner wants it gone entirely,
    // that's the Monetization toggle, not a per-ad dismiss here.
    function renderAdStrip(container, ad, format) {
      var c = ad.creative;
      var el = document.createElement(c.destinationUrl ? 'a' : 'div');
      el.className = 'sv-ad-strip';
      if (c.destinationUrl) {
        el.setAttribute('href', c.destinationUrl);
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer sponsored');
      }
      el.onclick = adClickHandler(ad, format);

      if (c.type === 'banner' && c.imageUrl) {
        var img = document.createElement('img');
        img.className = 'sv-ad-strip-img';
        img.src = c.imageUrl;
        img.alt = c.headline || '';
        el.appendChild(img);
      }

      var body = document.createElement('div');
      body.className = 'sv-ad-strip-body';
      if (c.headline) {
        var h = document.createElement('span');
        h.className = 'sv-ad-strip-headline';
        h.textContent = c.headline;
        body.appendChild(h);
      }
      if (c.body) {
        var t = document.createElement('span');
        t.className = 'sv-ad-strip-text';
        t.textContent = c.body;
        body.appendChild(t);
      }
      el.appendChild(body);

      if (c.ctaLabel) {
        var cta = document.createElement('span');
        cta.className = 'sv-ad-strip-cta';
        cta.textContent = c.ctaLabel;
        el.appendChild(cta);
      }

      container.innerHTML = '';
      container.appendChild(el);
      trackAd(ad.id, format, 'impression');
    }

    // 'interstitial' / 'popup' / 'overlay': a closable card, scaled up
    // per format via the container it's placed into (mountAdStyles
    // above does the actual size/position work — this function itself
    // doesn't know or care which of the three it's building).
    function renderAdCard(container, ad, format) {
      var c = ad.creative;
      container.innerHTML = '';

      var wrap = document.createElement('div');
      wrap.className = 'sv-ad-card-wrap';

      var closeBtn = document.createElement('button');
      closeBtn.className = 'sv-ad-card-close';
      closeBtn.setAttribute('aria-label', 'Dismiss ad');
      closeBtn.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round">' +
        '<path d="M5 5l14 14M19 5L5 19"/></svg>';
      closeBtn.onclick = function (evt) {
        evt.preventDefault();
        evt.stopPropagation();
        markAdDismissed(ad.id);
        // Remove the WHOLE container (the full-viewport dimmed stage
        // this card sits in), not just the card itself. Earlier this
        // only did wrap.remove(), which deleted the centered card but
        // left #sv-ad-popup/#sv-ad-overlay/#sv-ad-interstitial's
        // position:fixed;inset:0 stage (and its dark rgba(6,6,9,.88)
        // scrim) sitting in the DOM — invisible content, but still a
        // full-screen layer eating every click on the host site. That
        // "closed" ad was actually still there, forever, as a black
        // shadow blocking the page under it. container.remove() tears
        // the whole lane down so nothing is left behind to intercept
        // clicks once the visitor dismisses the ad.
        container.remove();
      };

      var badge = document.createElement('span');
      badge.className = 'sv-ad-card-badge';
      badge.textContent = 'Ad';

      var card = document.createElement(c.destinationUrl ? 'a' : 'div');
      card.className = 'sv-ad-card';
      if (c.destinationUrl) {
        card.setAttribute('href', c.destinationUrl);
        card.setAttribute('target', '_blank');
        card.setAttribute('rel', 'noopener noreferrer sponsored');
      }
      card.onclick = adClickHandler(ad, format);

      if (c.type === 'banner' && c.imageUrl) {
        var img = document.createElement('img');
        img.className = 'sv-ad-card-img';
        img.src = c.imageUrl;
        img.alt = c.headline || '';
        card.appendChild(img);
      }

      var body = document.createElement('div');
      body.className = 'sv-ad-card-body';
      if (c.headline) {
        var h = document.createElement('div');
        h.className = 'sv-ad-card-headline';
        h.textContent = c.headline;
        body.appendChild(h);
      }
      if (c.body) {
        var t = document.createElement('div');
        t.className = 'sv-ad-card-text';
        t.textContent = c.body;
        body.appendChild(t);
      }
      if (c.ctaLabel) {
        var cta = document.createElement('span');
        cta.className = 'sv-ad-card-cta';
        cta.textContent = c.ctaLabel;
        body.appendChild(cta);
      }
      card.appendChild(body);

      wrap.appendChild(badge);
      wrap.appendChild(closeBtn);
      wrap.appendChild(card);

      // 'overlay', 'interstitial' and 'popup' (the only three formats
      // that reach renderAdCard — see renderAd below) all need the
      // full-viewport dimmed stage (the card floats centered over a
      // dark scrim). 'popup' used to drop straight into a small fixed
      // corner container instead of this stage; now it's centered like
      // the other two, matching the square in-house creatives.
      var stage = document.createElement('div');
      stage.className = 'sv-ad-stage';
      stage.appendChild(wrap);
      container.appendChild(stage);

      trackAd(ad.id, format, 'impression');
    }

    function renderAd(ad, format) {
      if (isAdDismissed(ad.id)) return;
      mountAdStyles();
      var containerId = AD_CONTAINER_IDS[format];
      if (!containerId) return;
      var container = getAdContainer(containerId);
      if (format === 'banner' || format === 'sticky-footer') {
        renderAdStrip(container, ad, format);
      } else {
        renderAdCard(container, ad, format);
      }
    }

    // Asks /api/ad-serve for one format at a time rather than one
    // combined request — the route's own contract is "pick ONE ad for
    // a given siteId + format" (see its header), so covering all five
    // AD_FORMAT_IDS means five independent requests, same shape as
    // autoMountWidgets() issuing one fetch per widget's own content.
    // Each is fully independent: a site owner might have 'banner' and
    // 'overlay' enabled but not the other three, or simply have no
    // eligible 'popup' ad right now — any single format failing/
    // returning ok:false never blocks or delays the others.
    function requestAd(format) {
      var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var timeoutId = controller
        ? setTimeout(function () {
            controller.abort();
          }, 10000)
        : null;

      fetch(AD_SERVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, pageUrl: location.href, format: format }),
        signal: controller ? controller.signal : undefined,
      })
        .then(function (res) {
          if (timeoutId) clearTimeout(timeoutId);
          return res.json().catch(function () {
            return { ok: false };
          });
        })
        .then(function (data) {
          if (DEBUG) dlog(AD_SERVE_ENDPOINT, format, 'response', data);
          if (data && data.ok && data.ad) {
            renderAd(data.ad, data.ad.format || format);
          }
          // ok:false (monetization off, format not enabled, no
          // eligible ad, site not verified, etc.) — nothing to render,
          // same "leave the page exactly as authored" contract as
          // requestWidget() above. Only ever logged in debug mode.
        })
        .catch(function () {
          if (timeoutId) clearTimeout(timeoutId);
          // Network failure/timeout — this one format's slot just never
          // mounts; every other format's own request is unaffected.
        });
    }

    function mountAds() {
      for (var i = 0; i < AD_FORMAT_IDS.length; i++) {
        requestAd(AD_FORMAT_IDS[i]);
      }
    }

    function startAds() {
      if (!document.body) {
        document.addEventListener('DOMContentLoaded', startAds, { once: true });
        return;
      }
      mountAds();
    }
    startAds();
  } catch (e) {
    // Never throw into the host page.
  }
})();
