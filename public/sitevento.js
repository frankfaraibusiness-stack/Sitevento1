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
//      visitor loads already exposes to it.
//
//   3. LIVE BANNER — opens a real-time Firestore listener on the site's
//      public siteOverlay data (read via the site's own doc) and
//      renders/removes a banner the instant the dashboard owner pushes
//      or takes one down, plus impression/click/close beacons so the
//      dashboard's live engagement stats move with real visitors.
//
// ── Visitor identity ──────────────────────────────────────────────
// A random id is generated once and persisted in localStorage, so the
// SAME browser is recognized as the same visitor across visits/days —
// not just within one tab session. If localStorage is unavailable
// (private browsing, storage blocked, embedded contexts that lock it
// down), or it gets CLEARED later, the id is still generated/used for
// this page load's beacons — but it no longer just becomes a stray
// "new visitor" or an IP+UA-hash stranger-merge after that. The server
// (/api/track) runs coarse, low-entropy device recognition in that
// case and, when it recognizes the device from a prior visit, hands
// back that visitor's ORIGINAL id in the response; see
// adoptResolvedVisitorId below, which re-seeds localStorage with it so
// this visitor's history stays attached to them across a storage clear.
// This id is random and unlinked to any other identity — sitevento
// cannot connect it to a real name/email unless the visitor voluntarily
// submits one (e.g. the "Notify me" control on a locked banner).
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
    var OVERLAY_TRACK_ENDPOINT = API_ORIGIN + '/api/overlay-track';
    var NOTIFY_ENDPOINT = API_ORIGIN + '/api/overlay-notify';
    var WIDGET_ENDPOINT = API_ORIGIN + '/api/widget';
    var SITE_WIDGETS_ENDPOINT = API_ORIGIN + '/api/site-widgets';

    // ---- Persistent visitor id ----
    var VISITOR_KEY = 'sv_vid';
    var visitorId = '';
    try {
      visitorId = localStorage.getItem(VISITOR_KEY) || '';
      if (!visitorId) {
        visitorId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem(VISITOR_KEY, visitorId);
      }
    } catch (e) {
      // Storage blocked — still generate one for this page load's
      // beacons; server-side IP+UA fallback covers the "no persistence"
      // gap so the visit still gets grouped sensibly.
      visitorId = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    }

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

    // ============================================================
    // 1. VISIT TRACKING
    // ============================================================
    // ---- Durable identity: re-seed storage if the server recovered us ----
    // Fires when THIS beacon was sent with no usable visitorId (storage
    // was empty/blocked) and the server matched us to a device it's
    // seen before, handing back that original id. Writing it back into
    // localStorage now means every beacon from here on — this page and
    // every future visit, as long as storage survives — carries the
    // real persisted id again instead of silently falling back to a
    // server-side hash every single time.
    function adoptResolvedVisitorId(resolvedId) {
      if (!resolvedId || resolvedId === visitorId) return;
      visitorId = resolvedId;
      try {
        localStorage.setItem(VISITOR_KEY, resolvedId);
      } catch (e) {
        // Storage still unavailable — fine, this page load's remaining
        // beacons at least use the recovered id in-memory; next page
        // load will just go through device recovery again.
      }
    }

    function sendVisit(path) {
      var landingNow = isFirstViewThisSession;
      isFirstViewThisSession = false; // only the first call in this page session counts as landing
      beaconWithResponse(
        TRACK_ENDPOINT,
        {
          siteId: siteId,
          visitorId: visitorId,
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
        },
        function (data) {
          if (data && data.resolvedVisitorId) {
            adoptResolvedVisitorId(data.resolvedVisitorId);
          }
          if (data && data.blocked) {
            renderBlockBanner(data.blockReason);
          }
          if (data && data.pendingMessage) {
            renderMessagePopup(data.pendingMessage);
          }
        }
      );
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
          beacon(NOTIFY_ENDPOINT, { siteId: siteId, email: val });
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
      beacon(TRACK_ENDPOINT, {
        siteId: siteId,
        visitorId: visitorId,
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
        var cfgParam = '';
        try {
          cfgParam = '#cfg=' + encodeURIComponent(JSON.stringify({
            siteId: siteId,
            widgetId: widget.id,
            visitorId: visitorId,
            config: widget.config || {},
          }));
        } catch (e) {
          cfgParam = '';
        }
        iframe.src = widget.bundleUrl + cfgParam;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'no-referrer';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups');
        // Expandable widgets (support-chat, faq-page, etc.) are fully
        // sized by the stylesheet in mountAutoStyles() — collapsed
        // launcher size, then full-viewport/floating-card size once
        // open, driven by the sv-expanded class the postMessage bridge
        // toggles. An inline height here would beat every one of those
        // rules (inline style always outranks a stylesheet selector,
        // regardless of specificity) and freeze the frame at a fixed
        // size no matter what class JS adds — exactly the "tiny iframe
        // that never resizes" bug. So only non-expandable widgets get
        // the inline fallback height.
        if (!EXPANDABLE_WIDGET_IDS[widget.id]) {
          iframe.style.height = (widget.config && widget.config.height) || '480px';
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
        // support-chat's desktop "open" size is a floating card, not a
        // true fullscreen takeover — only its mobile open state (and
        // spin-reward/appointment-booking's modal, which always wants
        // a backdrop over the whole screen) use the inset:0 rule above.
        // Collapsed support-chat: the mount DIV is sized 56x56 above,
        // but that never constrained the <iframe> INSIDE it — the
        // corner-container rule above sets the frame to width:336px
        // and no rule here ever gave it a height, so it fell back to
        // the browser's default iframe height (150px). That left a
        // 336x150 transparent box sitting over the page instead of a
        // tidy 56px circle, and since the launcher button inside the
        // iframe is itself `position:fixed` to ITS OWN viewport, the
        // button rendered somewhere inside that oversized, invisible
        // frame rather than as a clickable bubble in the corner. This
        // pins the frame to the same 56x56 box as its parent div so
        // the two stay in lockstep while collapsed.
        '[data-sitevento-widget="support-chat"]{width:56px;height:56px;}' +
        '[data-sitevento-widget="support-chat"] .sv-widget-frame{width:56px;height:56px;}' +
        '[data-sitevento-widget="support-chat"].sv-expanded.sv-chat-desktop{' +
        'position:fixed;inset:auto;bottom:16px;right:16px;top:auto;left:auto;' +
        'width:384px;height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);}';
      document.head.appendChild(style);
    }

    // Widgets whose open state needs more room than the generic
    // 336x480 corner box — see the CSS comment above. Each one posts
    // { source: 'sitevento-widget', widgetId, open, isMobile } to this
    // window from inside its iframe when it opens/closes; isMobile
    // decides whether the shared full-viewport .sv-expanded rule above
    // (edge-to-edge, sticky header) or the widget's own desktop-sized
    // centered layout applies.
    var EXPANDABLE_WIDGET_IDS = {
      'support-chat': 1,
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
        // support-chat only: desktop-open uses a floating card, not
        // the shared fullscreen rule, so it needs its own class too.
        if (data.widgetId === 'support-chat') {
          el.classList.toggle('sv-chat-desktop', !!data.open && !data.isMobile);
        }
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
              if (effectivePosition === 'corner-bottom-right' || effectivePosition === 'corner-bottom-left') {
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
    // 'popup' and 'overlay' are both a dismissible card, just
    // placed/sized differently by their own container (corner box vs.
    // full-viewport dimmed stage) — they share the sv-ad-card
    // renderer. 'interstitial' ALSO uses sv-ad-card, but gets its own
    // full-viewport container (sv-ad-interstitial, below) rather than
    // reusing sv-ad-overlay — per lib/monetization.ts's catalog
    // description ("shown between page transitions or on a timer"),
    // interstitial is conceptually distinct from overlay even though
    // both render full-screen, so each keeps its own DOM node/CSS
    // instead of collapsing into one id. Previously interstitial
    // shared sv-ad-corner with popup and rendered as the same small
    // bottom-left corner card — not actually full-screen despite the
    // catalog calling it that; this is the fix.
    var AD_CONTAINER_IDS = {
      banner: 'sv-ad-fixed-top',
      'sticky-footer': 'sv-ad-fixed-bottom',
      interstitial: 'sv-ad-interstitial',
      popup: 'sv-ad-corner',
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
        '#sv-ad-overlay .sv-ad-stage,#sv-ad-interstitial .sv-ad-stage{position:relative;width:100%;' +
        'height:100%;display:flex;align-items:center;justify-content:center;padding:22px;' +
        'box-sizing:border-box;background:rgba(6,6,9,.88);}' +
        '#sv-ad-overlay .sv-ad-card-wrap,#sv-ad-interstitial .sv-ad-card-wrap{width:100%;max-width:420px;}' +
        '#sv-ad-overlay .sv-ad-card-img,#sv-ad-interstitial .sv-ad-card-img{height:220px;}';
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
      beacon(AD_TRACK_ENDPOINT, {
        siteId: siteId,
        adId: adId,
        event: eventType,
        visitorId: visitorId,
        format: format,
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
        wrap.remove();
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

      // 'overlay' and 'interstitial' both need the full-viewport
      // dimmed stage (the card floats centered over a dark scrim) —
      // 'popup' just drops straight into its fixed corner container.
      if (format === 'overlay' || format === 'interstitial') {
        var stage = document.createElement('div');
        stage.className = 'sv-ad-stage';
        stage.appendChild(wrap);
        container.appendChild(stage);
      } else {
        container.appendChild(wrap);
      }

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
      fetch(AD_SERVE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: siteId, pageUrl: location.href, format: format }),
      })
        .then(function (res) {
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
          // Network failure — this one format's slot just never
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
