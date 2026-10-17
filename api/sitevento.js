// sitevento tracking + live banner snippet
//
// Loaded on a customer's site via a RELATIVE-to-your-deployment script
// tag, e.g. if your dashboard is at sitevento12.vercel.app:
//   <script src="https://sitevento12.vercel.app/sitevento.js" data-site="SITE_ID" defer></script>
// The dashboard generates this tag dynamically from its own origin (see
// copyConnectTag() in hooks/useConnectSiteWizard.ts) — there's no
// hardcoded domain anywhere, so this keeps working if you move to a
// custom domain later.
//
// Three independent jobs, each wrapped so a failure in one never breaks
// the others or the host page:
//
//   1. VISIT TRACKING — on load (and on every client-side route change
//      for SPAs), posts a beacon to /api/track with the page path,
//      referrer, viewport size and language. The server fills in
//      everything privacy/network-sensitive (IP-derived country, device/
//      browser/OS parsed from User-Agent) — this script never reads or
//      sends precise geolocation, cookies, or other visitor data.
//
//   2. LIVE BANNER — opens a real-time Firestore listener on the site's
//      public siteOverlay/{siteId} doc and renders/removes the banner
//      the instant the dashboard owner pushes or takes one down. No
//      polling, no page reload required on the visitor's end. This only
//      ever reads that one public doc — it cannot read or write
//      anything else in the project.
//
//   3. BANNER ENGAGEMENT — one beacon per impression/click/close to
//      /api/overlay-track, so the dashboard's live stats move as real
//      visitors see and interact with the banner.
(function () {
  try {
    var currentScript = document.currentScript || (function () {
      var scripts = document.getElementsByTagName('script');
      return scripts[scripts.length - 1];
    })();

    var siteId = currentScript && currentScript.getAttribute('data-site');
    if (!siteId) return;

    // Resolve the API origin from this script's own src — sitevento.js and
    // every /api/* route live on the same deployment as the dashboard
    // itself, whatever that deployment's current URL happens to be. No
    // hardcoded domain, so a redeploy or a future custom domain just
    // works without touching this file.
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

    function beacon(url, payloadObj) {
      var payload = JSON.stringify(payloadObj);
      if (navigator.sendBeacon) {
        var blob = new Blob([payload], { type: 'application/json' });
        var ok = navigator.sendBeacon(url, blob);
        if (ok) return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(function () {});
    }

    // ---- 1. Visit tracking ----

    // One sessionStorage flag per tab marks whether this is the first
    // page view of the session, so the dashboard can tell entry pages
    // apart from mid-session navigation. sessionStorage (not
    // localStorage) on purpose: a "session" ends when the tab closes.
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
      // Storage blocked (private mode / locked-down context) — tracking
      // still works, just without session grouping or a landing flag.
      sessionId = '';
    }

    function send(path) {
      var landingNow = isFirstViewThisSession;
      isFirstViewThisSession = false; // only the very first call in this closure counts as landing
      beacon(TRACK_ENDPOINT, {
        siteId: siteId,
        path: path || (location.pathname + location.search) || '/',
        referrer: document.referrer || '',
        screen: (window.screen && window.screen.width && window.screen.height)
          ? (window.screen.width + 'x' + window.screen.height)
          : null,
        lang: (navigator.language || navigator.userLanguage || '').slice(0, 20) || null,
        landing: landingNow,
        sessionId: sessionId
      });
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

    // ---- 2 & 3. Live banner + engagement ----
    // Firebase config is intentionally public (it's already shipped in
    // sitevento's own dashboard bundle — Firebase web API keys are not
    // secrets, access control lives in Firestore security rules, not in
    // hiding this object). Loaded as a dynamic import so sites that never
    // have a banner pushed don't pay for the Firestore SDK unless/until
    // this code path actually needs it.
    var FIREBASE_CONFIG = {
      apiKey: "AIzaSyCd0d__8akeieiLp4soUaYLU_fT9YmZ_ko",
      authDomain: "autoagent-e750a.firebaseapp.com",
      projectId: "autoagent-e750a",
      storageBucket: "autoagent-e750a.firebasestorage.app",
      messagingSenderId: "420577964097",
      appId: "1:420577964097:web:b4a7cf15d7472f030796c0"
    };

    var DISMISS_KEY = 'sv_overlay_dismissed_' + siteId;

    // ── Art — tiny inline SVGs matching lib/siteAlert.ts's OverlayArt,
    // tinted via currentColor so the theme's accent color drives them
    // with no extra config. ──
    var ART_PATHS = {
      megaphone: '<path d="M10 28V20l54-20v56L10 36v-8z"/><path d="M10 36l6 24h12l-6-24"/><circle cx="76" cy="28" r="6"/>',
      wrench: '<path d="M58 14a20 20 0 0 0-24 27L12 63a9 9 0 0 0 13 13l22-22a20 20 0 0 0 27-24l-13 13-11-3-3-11 13-13z"/>',
      tag: '<path d="M8 36V10a4 4 0 0 1 4-4h26l32 32a4 4 0 0 1 0 6L42 72a4 4 0 0 1-6 0L8 36z"/><circle cx="24" cy="24" r="5"/>',
      spark: '<path d="M40 6l7 20 20 7-20 7-7 20-7-20-20-7 20-7 7-20z"/>',
      confetti: '<path d="M14 70l12-40 26 26-38 14z"/><path d="M42 18v-6M58 28l5-5M66 44h6M50 8l2 3M70 26l3 2"/>',
      bell: '<path d="M20 58c6-5 8-13 8-24a12 12 0 0 1 24 0c0 11 2 19 8 24H20z"/><path d="M34 66a6 6 0 0 0 12 0"/>'
    };

    function artSvg(art) {
      if (!art || art === 'none' || !ART_PATHS[art]) return '';
      return '<svg viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="4" ' +
        'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ART_PATHS[art] + '</svg>';
    }

    function mountStyles() {
      if (document.getElementById('sv-overlay-styles')) return;
      var style = document.createElement('style');
      style.id = 'sv-overlay-styles';
      style.textContent =
        '#sv-overlay-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;' +
        'justify-content:center;padding:20px;box-sizing:border-box;' +
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;}' +
        '#sv-overlay-backdrop.sv-popup{align-items:flex-end;justify-content:flex-end;padding:18px;background:transparent !important;}' +
        '.sv-card{position:relative;width:100%;max-width:460px;border-radius:24px;padding:30px 26px 26px;' +
        'box-sizing:border-box;text-align:center;box-shadow:0 24px 70px rgba(0,0,0,0.45);' +
        'backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);}' +
        '.sv-popup .sv-card{max-width:360px;text-align:left;padding:18px 20px 20px;border-radius:18px;}' +
        '.sv-card.sv-solid{backdrop-filter:none;-webkit-backdrop-filter:none;}' +
        '.sv-art{width:52px;height:52px;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;' +
        'border-radius:16px;background:color-mix(in srgb, currentColor 16%, transparent);color:var(--sv-accent);}' +
        '.sv-popup .sv-art{margin:0 0 10px;width:38px;height:38px;}' +
        '.sv-art svg{width:28px;height:28px;}' +
        '.sv-popup .sv-art svg{width:20px;height:20px;}' +
        '.sv-badge{display:inline-block;padding:5px 12px;border-radius:999px;font-size:11.5px;font-weight:700;' +
        'letter-spacing:.03em;text-transform:uppercase;margin-bottom:12px;background:var(--sv-accent);color:var(--sv-accent-text);}' +
        '.sv-title{margin:0 0 8px;font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.25;color:var(--sv-title);}' +
        '.sv-popup .sv-title{font-size:16px;margin-bottom:5px;}' +
        '.sv-desc{margin:0;font-size:14.5px;line-height:1.55;color:var(--sv-text);}' +
        '.sv-popup .sv-desc{font-size:13px;}' +
        '.sv-cta{display:inline-flex;align-items:center;gap:6px;margin-top:18px;padding:12px 22px;border-radius:12px;' +
        'border:none;font-size:14.5px;font-weight:700;cursor:pointer;background:var(--sv-accent);color:var(--sv-accent-text);' +
        'text-decoration:none;}' +
        '.sv-popup .sv-cta{margin-top:14px;padding:10px 16px;font-size:13px;}' +
        '.sv-cta svg{width:16px;height:16px;}' +
        '.sv-notify-row{margin-top:16px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;}' +
        '.sv-popup .sv-notify-row{justify-content:flex-start;}' +
        '.sv-notify-input{flex:1 1 180px;min-width:0;padding:11px 13px;border-radius:10px;border:1px solid rgba(255,255,255,0.25);' +
        'background:rgba(255,255,255,0.08);color:inherit;font-size:13.5px;}' +
        '.sv-notify-btn{padding:11px 16px;border-radius:10px;border:none;background:var(--sv-accent);color:var(--sv-accent-text);' +
        'font-weight:700;font-size:13.5px;cursor:pointer;white-space:nowrap;}' +
        '.sv-notify-msg{margin-top:8px;font-size:12.5px;color:var(--sv-text);opacity:.85;}' +
        '.sv-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;border:none;' +
        'background:rgba(255,255,255,0.14);color:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;}' +
        '.sv-popup .sv-close{width:24px;height:24px;top:10px;right:10px;}' +
        '.sv-close svg{width:13px;height:13px;}';
      document.head.appendChild(style);
    }

    function removeOverlay() {
      var el = document.getElementById('sv-overlay-backdrop');
      if (el) el.remove();
      try { document.documentElement.style.overflow = ''; } catch (e) {}
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
      try { localStorage.setItem(DISMISS_KEY, String(version)); } catch (e) {}
    }

    function renderOverlay(data) {
      removeOverlay();
      if (!data || !data.active) return;
      if (!data.title && !data.description) return;

      var version = typeof data.version === 'number' ? data.version : 0;

      // "every" reshow mode and non-closable banners must never read a
      // persisted dismissal — they come back on every load by design.
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
      else backdrop.style.background = 'linear-gradient(160deg,' + (theme.bgFrom || '#111') + ',' + (theme.bgTo || '#000') + ')';

      var card = document.createElement('div');
      card.className = 'sv-card' + (theme.card === 'solid' ? ' sv-solid' : '');
      card.style.setProperty('--sv-accent', theme.accent || '#c6ff3d');
      card.style.setProperty('--sv-accent-text', theme.accentText || '#101400');
      card.style.setProperty('--sv-title', theme.titleColor || '#fff');
      card.style.setProperty('--sv-text', theme.textColor || 'rgba(255,255,255,0.78)');
      if (isPopup) {
        card.style.background = 'linear-gradient(160deg,' + (theme.bgFrom || '#111') + ',' + (theme.bgTo || '#000') + ')';
        card.style.color = theme.textColor || '#fff';
      } else {
        card.style.background = theme.card === 'solid'
          ? (theme.bgTo || '#000')
          : 'color-mix(in srgb, ' + (theme.bgFrom || '#111') + ' 55%, transparent)';
        card.style.border = '1px solid color-mix(in srgb, ' + (theme.accent || '#fff') + ' 22%, transparent)';
      }

      if (data.closable !== false) {
        var closeBtn = document.createElement('button');
        closeBtn.className = 'sv-close';
        closeBtn.setAttribute('aria-label', 'Dismiss');
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
          'stroke-linecap="round"><path d="M5 5l14 14M19 5L5 19"/></svg>';
        closeBtn.onclick = function () {
          trackOverlay(version, 'close');
          removeOverlay();
          if (remembers) writeDismissed(version);
        };
        card.appendChild(closeBtn);
      }

      var artHtml = artSvg(data.art);
      if (artHtml) {
        var artWrap = document.createElement('div');
        artWrap.className = 'sv-art';
        artWrap.innerHTML = artHtml;
        card.appendChild(artWrap);
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
        cta.innerHTML = '<span>' + data.ctaLabel.replace(/</g, '&lt;') + '</span>' +
          (data.ctaUrl ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" ' +
            'stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>' : '');
        cta.onclick = function () {
          trackOverlay(version, 'cta');
          if (!data.ctaUrl && data.closable !== false) {
            removeOverlay();
            if (remembers) writeDismissed(version);
          }
        };
        card.appendChild(cta);
      }

      // Locked banner + notify-on-close: plain email capture, no auth
      // required on the visitor's side.
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
        try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
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
          // Read denied/offline/etc — fail silently, no banner shown.
        });
      }).catch(function () {
        // SDK failed to load (network/ad-blocker/CSP) — skip banners,
        // visit tracking above is unaffected.
      });
    }
    startOverlayListener();
  } catch (e) {
    // Never throw into the host page.
  }
})();
