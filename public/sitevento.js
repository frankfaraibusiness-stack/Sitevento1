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

    function beacon(url, payloadObj) {
      var payload = JSON.stringify(payloadObj);
      if (navigator.sendBeacon) {
        try {
          var blob = new Blob([payload], { type: 'application/json' });
          var ok = navigator.sendBeacon(url, blob);
          if (ok) return;
        } catch (e) {
          // fall through to fetch
        }
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(function () {});
    }

    // ============================================================
    // 1. VISIT TRACKING
    // ============================================================
    function sendVisit(path) {
      var landingNow = isFirstViewThisSession;
      isFirstViewThisSession = false; // only the first call in this page session counts as landing
      beacon(TRACK_ENDPOINT, {
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
      });
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
        '#sv-overlay-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
        'justify-content:center;padding:24px;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,' +
        '"Segoe UI",sans-serif;}' +
        '#sv-overlay-backdrop.sv-popup{inset:auto;right:18px;bottom:18px;left:auto;top:auto;padding:0;' +
        'justify-content:flex-end;align-items:flex-end;}' +
        '.sv-card{position:relative;max-width:480px;width:100%;border-radius:16px;padding:28px;' +
        'box-sizing:border-box;color:var(--sv-text,#fff);}' +
        '.sv-popup .sv-card{max-width:340px;padding:18px;border-radius:14px;}' +
        '.sv-close{position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:50%;' +
        'border:none;background:rgba(255,255,255,0.15);color:inherit;cursor:pointer;display:flex;' +
        'align-items:center;justify-content:center;padding:0;}' +
        '.sv-close svg{width:14px;height:14px;}' +
        '.sv-badge{display:inline-block;font-size:11px;font-weight:700;letter-spacing:.04em;' +
        'text-transform:uppercase;padding:3px 9px;border-radius:999px;background:var(--sv-accent,#c6ff3d);' +
        'color:var(--sv-accent-text,#101400);margin-bottom:10px;}' +
        '.sv-title{font-size:22px;font-weight:800;margin:0 0 6px;color:var(--sv-title,#fff);line-height:1.25;}' +
        '.sv-desc{font-size:14.5px;line-height:1.55;margin:0 0 16px;color:var(--sv-text,rgba(255,255,255,.8));}' +
        '.sv-cta{display:inline-flex;align-items:center;gap:8px;background:var(--sv-accent,#c6ff3d);' +
        'color:var(--sv-accent-text,#101400);font-weight:700;font-size:14px;padding:10px 16px;border-radius:10px;' +
        'border:none;cursor:pointer;text-decoration:none;}' +
        '.sv-cta svg{width:15px;height:15px;}' +
        '.sv-notify-row{display:flex;gap:8px;margin-top:4px;}' +
        '.sv-notify-input{flex:1;min-width:0;padding:9px 11px;border-radius:9px;border:1px solid rgba(255,255,255,.25);' +
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

      var backdrop = document.createElement('div');
      backdrop.id = 'sv-overlay-backdrop';
      if (isPopup) backdrop.className = 'sv-popup';

      var card = document.createElement('div');
      card.className = 'sv-card';
      card.style.background = 'linear-gradient(160deg,' + (theme.bgFrom || '#111') + ',' + (theme.bgTo || '#000') + ')';
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

      backdrop.appendChild(card);
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
      container.innerHTML = '';

      if (widget.type === 'iframe' && widget.bundleUrl) {
        // Executable widget content is NEVER run in the host page's own
        // context — always a sandboxed iframe pointed at a URL the
        // backend returned, so a compromised/misconfigured widget can
        // at most affect its own frame, never read the host page's
        // cookies/DOM/storage or make requests as the host origin.
        var iframe = document.createElement('iframe');
        iframe.className = 'sv-widget-frame';
        iframe.src = widget.bundleUrl;
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
  } catch (e) {
    // Never throw into the host page.
  }
})();
