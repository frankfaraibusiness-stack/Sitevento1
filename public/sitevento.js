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
// down), the id is still generated and used for this page load's
// beacons, it just won't persist to the next visit; the server has its
// own IP+UA based fallback for that case too. This id is random and
// unlinked to any other identity — sitevento cannot connect it to a
// real name/email unless the visitor voluntarily submits one (e.g. the
// "Notify me" control on a locked banner).
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
          landing: landingNow,
        },
        function (data) {
          if (data && data.blocked) {
            renderBlockBanner(data.blockReason);
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
      if (widget && (widget.id === 'support-chat' || widget.id === 'spin-reward' || widget.id === 'appointment-booking')) {
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
        iframe.style.height = (widget.config && widget.config.height) || '480px';
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
        '#sv-auto-corner-br .sv-widget-frame,#sv-auto-corner-bl .sv-widget-frame{' +
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
        // Some corner widgets (support-chat, spin-reward, appointment-
        // booking) open into something bigger than the generic 336x480
        // box above: support-chat needs a true full-viewport panel on
        // mobile, and spin-reward/appointment-booking each open a
        // `position:fixed;inset:0` modal INSIDE their iframe meant to
        // cover the whole screen with a backdrop.
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
        '[data-sitevento-widget="support-chat"]{width:56px;height:56px;}' +
        '[data-sitevento-widget="support-chat"].sv-expanded.sv-chat-desktop{' +
        'position:fixed;inset:auto;bottom:16px;left:16px;top:auto;right:auto;' +
        'width:384px;height:600px;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);}';
      document.head.appendChild(style);
    }

    // Widgets whose open state needs more room than the generic
    // 336x480 corner box — see the CSS comment above. Each one posts
    // { source: 'sitevento-widget', widgetId, open, isMobile? } to this
    // window from inside its iframe when it opens/closes.
    var EXPANDABLE_WIDGET_IDS = { 'support-chat': 1, 'spin-reward': 1, 'appointment-booking': 1, 'faq-page': 1 };

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
  } catch (e) {
    // Never throw into the host page.
  }
})();
