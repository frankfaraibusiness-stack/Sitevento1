// sitevento tracking snippet
//
// Loaded on a customer's site via a RELATIVE-to-your-deployment script
// tag, e.g. if your dashboard is at sitevento1.vercel.app:
//   <script src="https://sitevento1.vercel.app/t.js" data-site="SITE_ID" defer></script>
// The dashboard generates this tag dynamically from its own origin
// (see copyConnectTag() in index.html) — there's no hardcoded domain
// anywhere, so this keeps working if you move to a custom domain later.
//
// Two independent jobs, each wrapped so a failure in one never breaks
// the other or the host page:
//
//   1. VISIT TRACKING — on load (and on every client-side route change
//      for SPAs), posts a beacon to /api/track with the page path and
//      referrer. The server fills in everything privacy/network-sensitive
//      (IP-derived country, device from User-Agent) — this script never
//      reads or sends precise geolocation, cookies, or other visitor data.
//
//   2. LIVE OVERLAY — opens a real-time Firestore listener on the site's
//      public siteOverlay/{siteId} doc and renders/removes a full-screen
//      or popup banner the instant the dashboard owner pushes or takes
//      one down. No polling, no page reload required on the visitor's
//      end. This only ever reads that one public doc (see Firestore
//      rules note below) — it cannot read or write anything else in the
//      project.
(function () {
  try {
    var currentScript = document.currentScript || (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

    var siteId = currentScript && currentScript.getAttribute('data-site');
    if (!siteId) return;

    // Resolve the API origin from this script's own src — t.js, /api/track
    // and /api/verify-site all live on the same Vercel deployment as the
    // dashboard itself (e.g. sitevento1.vercel.app), whatever that
    // deployment's current URL happens to be. No hardcoded domain, so a
    // redeploy to a new *.vercel.app URL or a future custom domain just
    // works without touching this file.
    var API_ORIGIN = (function () {
      try {
        return new URL(currentScript.src).origin;
      } catch (e) {
        // Fallback: script tag had a relative src, so just use wherever
        // this script is currently executing from.
        return window.location.origin;
      }
    })();
    var ENDPOINT = API_ORIGIN + '/api/track';

    function send(path) {
      var payload = JSON.stringify({
        siteId: siteId,
        path: path || (location.pathname + location.search) || '/',
        referrer: document.referrer || ''
      });

      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        var ok = navigator.sendBeacon(ENDPOINT, blob);
        if (ok) return;
      }

      // Fallback for browsers/contexts without sendBeacon support.
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () {});
    }

    // Initial page view.
    send();

    // Best-effort SPA support: log a new visit on pushState/replaceState
    // navigation (common in React/Vue/etc. router setups) without
    // requiring the site to call anything explicitly.
    var wrap = function (fn) {
      return function () {
        var result = fn.apply(this, arguments);
        send();
        return result;
      };
    };
    try {
      history.pushState = wrap(history.pushState);
      history.replaceState = wrap(history.replaceState);
      window.addEventListener('popstate', function () { send(); });
    } catch (e) {
      // If the environment locks down history mutation, initial-load
      // tracking above still works — just skip SPA route tracking.
    }

    // ---- Live overlay ----
    // Firebase config is intentionally public (it's already shipped in
    // sitevento's own dashboard bundle — Firebase web API keys are not
    // secrets, access control lives in Firestore security rules, not in
    // hiding this object). Loaded as a dynamic import so sites that never
    // use overlays don't pay for the Firestore SDK on every page load
    // unless/until this code path runs.
    var FIREBASE_CONFIG = {
      apiKey: "AIzaSyCd0d__8akeieiLp4soUaYLU_fT9YmZ_ko",
      authDomain: "autoagent-e750a.firebaseapp.com",
      projectId: "autoagent-e750a",
      storageBucket: "autoagent-e750a.firebasestorage.app",
      messagingSenderId: "420577964097",
      appId: "1:420577964097:web:b4a7cf15d7472f030796c0"
    };

    function mountOverlayStyles() {
      if (document.getElementById('sv-overlay-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-overlay-styles';
      style.textContent =
        '#sv-overlay-full{position:fixed;inset:0;z-index:2147483000;display:flex;' +
        'align-items:center;justify-content:center;text-align:center;padding:32px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        'font-size:clamp(16px,2.4vw,24px);font-weight:600;line-height:1.45;box-sizing:border-box;}' +
        '#sv-overlay-popup{position:fixed;right:18px;bottom:18px;z-index:2147483000;' +
        'max-width:min(360px,calc(100vw - 36px));border-radius:14px;padding:16px 18px;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;' +
        'font-size:14px;font-weight:600;line-height:1.45;box-shadow:0 10px 30px rgba(0,0,0,0.25);' +
        'box-sizing:border-box;}' +
        '.sv-overlay-close{position:absolute;top:10px;right:10px;width:26px;height:26px;' +
        'border-radius:50%;border:none;background:rgba(255,255,255,0.18);color:inherit;' +
        'cursor:pointer;font-size:15px;line-height:1;display:flex;align-items:center;justify-content:center;}' +
        '#sv-overlay-popup .sv-overlay-close{top:8px;right:8px;width:22px;height:22px;font-size:13px;}';
      document.head.appendChild(style);
    }

    function removeOverlay() {
      var full = document.getElementById('sv-overlay-full');
      var popup = document.getElementById('sv-overlay-popup');
      if (full) full.remove();
      if (popup) popup.remove();
    }

    function renderOverlay(data) {
      removeOverlay();
      if (!data || !data.active || !data.text) return;

      mountOverlayStyles();
      var el = document.createElement('div');
      el.id = data.display === 'popup' ? 'sv-overlay-popup' : 'sv-overlay-full';
      el.style.background = data.bgColor || '#22201c';
      el.style.color = data.textColor || '#f6f2e7';

      var text = document.createElement('div');
      text.textContent = data.text;
      el.appendChild(text);

      var closeBtn = document.createElement('button');
      closeBtn.className = 'sv-overlay-close';
      closeBtn.setAttribute('aria-label', 'Dismiss');
      closeBtn.textContent = '\u00d7';
      closeBtn.onclick = function () { el.remove(); };
      el.appendChild(closeBtn);

      document.body.appendChild(el);
    }

    function startOverlayListener() {
      if (!document.body) {
        // body isn't parsed yet (script is in <head>); wait for it.
        document.addEventListener('DOMContentLoaded', startOverlayListener, { once: true });
        return;
      }
      Promise.all([
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')
      ]).then(function (mods) {
        var appMod = mods[0];
        var fsMod = mods[1];
        var app = appMod.initializeApp(FIREBASE_CONFIG);
        var db = fsMod.getFirestore(app);
        var ref = fsMod.doc(db, 'siteOverlay', siteId);
        fsMod.onSnapshot(ref, function (snap) {
          renderOverlay(snap.exists() ? snap.data() : null);
        }, function () {
          // Read denied/offline/etc — fail silently, no overlay shown.
        });
      }).catch(function () {
        // SDK failed to load (network/ad-blocker/CSP) — skip overlays,
        // visit tracking above is unaffected.
      });
    }
    startOverlayListener();
  } catch (e) {
    // Never throw into the host page.
  }
})();
