/* Makes the trainer pages installable and usable offline:
 *  - registers the service worker (sw.js)
 *  - adds an "Install app" button to the settings menu when the browser allows it
 *  - tells the trainer when the connection drops or comes back
 */
(function () {
  'use strict';

  /* ---------- small toast, also used by trainer.js ---------- */
  var toastTimer = null;
  function toast(message, sticky) {
    var el = document.getElementById('pwa-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'pwa-toast';
      el.className = 'pwa-toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(function () { el.classList.remove('is-visible'); }, 3200);
  }
  window.GTG_toast = toast;

  /* ---------- service worker (needs https or localhost) ---------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* app still works online */ });
    });
  }

  /* ---------- install button ---------- */
  var installEvent = null;

  function addInstallItem() {
    var panel = document.querySelector('.settings-panel');
    if (!panel || panel.querySelector('[data-install]')) return;
    var btn = document.createElement('a');
    btn.href = '#';
    btn.setAttribute('data-install', '');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' +
      '<path d="M12 3v12"></path><path d="m7 10 5 5 5-5"></path><path d="M5 21h14"></path></svg>Install app';
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      if (!installEvent) return;
      installEvent.prompt();
      installEvent.userChoice.then(function () { installEvent = null; btn.remove(); });
    });
    var divider = panel.querySelector('.settings-panel__divider');
    panel.insertBefore(btn, divider || null);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvent = e;
    addInstallItem();
  });

  window.addEventListener('appinstalled', function () {
    var item = document.querySelector('[data-install]');
    if (item) item.remove();
    toast('GTG Trainer installed');
  });

  /* ---------- online / offline ---------- */
  window.addEventListener('offline', function () { toast('You are offline. Saved pages still work.', true); });
  window.addEventListener('online', function () { toast('Back online'); });
  if (navigator.onLine === false) {
    document.addEventListener('DOMContentLoaded', function () { toast('You are offline. Saved pages still work.', true); });
  }
})();
