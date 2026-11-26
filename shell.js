/* TEMP DEBUG: shows a red bar at the top of the page if a script fails to load or crashes.
 * Delete this block once the trainer calendar problem is solved. */
(function () {
  function show(msg) {
    var bar = document.getElementById('gtg-debug-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'gtg-debug-bar';
      bar.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:99999;background:#b3261e;color:#fff;font:600 13px/1.4 Inter,Arial,sans-serif;padding:8px 14px;white-space:pre-wrap';
      (document.body || document.documentElement).appendChild(bar);
    }
    bar.textContent += (bar.textContent ? '\n' : '') + msg;
  }
  window.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t !== window && (t.tagName === 'SCRIPT' || t.tagName === 'LINK')) {
      show('Could not load: ' + (t.src || t.href));
    } else {
      show('Script error: ' + e.message + '  (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')');
    }
  }, true);
})();

/* Shared page behaviour: close the settings menu when clicking outside it. */
document.addEventListener('click', function (e) {
  document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});