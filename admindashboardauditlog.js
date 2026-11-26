/* GTG Fitness — Audit log
 * Public API (works on any page that loads this file):
 *   GTGAudit.log('login' | 'logout', { id, first, last, role, cls })
 *
 * Backend-friendly design:
 *   - Event based: each login/logout is ONE small record. The table is built from events.
 *   - Dropdown filters run in the browser (no request per filter change).
 *   - Incremental polling ("since" cursor), paused when the tab is hidden,
 *     exponential backoff + jitter on errors, 304 support.
 *   - Writes are fire-and-forget (sendBeacon), so logging out never waits on the server.
 *   - Rendering is batched (one DOM update per frame) and capped at maxRows.
 *
 * Set CFG.endpoint to your API (e.g. '/api/audit-logs') to go live.
 *   GET  endpoint?since=<cursor>&limit=50 -> { events: [...], cursor: "..." }
 *   POST endpoint  (JSON body = one event)
 * Event shape: { id, action: 'login'|'logout', ts: <ms epoch>, userId, first, last, role, cls }
 * With endpoint = null it runs in demo mode using localStorage (syncs across tabs).
 */
(function () {
  'use strict';

  var CFG = {
    endpoint: null,
    pollMs: 15000,
    maxPollMs: 120000,
    pageSize: 50,
    maxRows: 100,
    storeKey: 'gtg_audit_v1'
  };

  var ROLE_LABEL = { member: 'Member', nonmember: 'NonMember' };

  var tbody = document.getElementById('checkin-body');
  var roleFilter = document.getElementById('role-filter');
  var classFilter = document.getElementById('class-filter');
  var emptyEl = document.getElementById('checkin-empty');
  var attendeesEl = document.getElementById('stat-attendees');
  var inGymEl = document.getElementById('stat-in-gym');

  var day = new Date().toDateString();
  var seen = Object.create(null);   // event id -> true (dedupe)
  var open = Object.create(null);   // userId -> currently open session
  var sessions = [];                // one per login
  var store = loadStore();
  var cursor = null;
  var rafId = 0;

  /* ---------- storage (demo mode / offline cache) ---------- */
  function loadStore() {
    try {
      var s = JSON.parse(localStorage.getItem(CFG.storeKey));
      if (s && s.day === day && Array.isArray(s.events)) return s;
    } catch (e) {}
    return { day: day, events: [] };
  }
  function saveStore() {
    try {
      if (store.events.length > 500) store.events = store.events.slice(-500);
      localStorage.setItem(CFG.storeKey, JSON.stringify(store));
    } catch (e) {}
  }

  /* ---------- core ---------- */
  function uid() {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function apply(ev) {
    if (!ev || !ev.id || seen[ev.id]) return false;
    seen[ev.id] = true;
    if (new Date(ev.ts).toDateString() !== day) return false;
    if (!ROLE_LABEL[ev.role]) return false;          // staff events are logged, not listed

    if (ev.action === 'login') {
      if (open[ev.userId]) return false;             // already inside, ignore duplicate login
      var s = { userId: ev.userId, first: ev.first, last: ev.last,
                role: ev.role, cls: String(ev.cls || '').toLowerCase(),
                timeIn: ev.ts, timeOut: null };
      sessions.push(s);
      open[ev.userId] = s;
      return true;
    }
    if (ev.action === 'logout') {
      var o = open[ev.userId];
      if (!o) return false;                          // logout with no login, ignore
      o.timeOut = ev.ts;
      delete open[ev.userId];
      return true;
    }
    return false;
  }

  function ingest(events) {
    var changed = false;
    events.slice().sort(function (a, b) { return a.ts - b.ts; }).forEach(function (ev) {
      if (apply(ev)) changed = true;
    });
    if (changed) schedule();
  }

  function log(action, user) {
    user = user || {};
    var ev = { id: uid(), action: action, ts: Date.now(), userId: user.id,
               first: user.first, last: user.last, role: user.role, cls: user.cls };
    store.events.push(ev);
    saveStore();
    send(ev);
    if (apply(ev)) schedule();
  }

  function send(ev) {
    if (!CFG.endpoint) return;
    var body = JSON.stringify(ev);
    if (navigator.sendBeacon &&
        navigator.sendBeacon(CFG.endpoint, new Blob([body], { type: 'application/json' }))) return;
    try {
      fetch(CFG.endpoint, { method: 'POST', body: body, keepalive: true,
        credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } });
    } catch (e) {}
  }

  /* ---------- render (batched, capped) ---------- */
  function fmt(ts) {
    return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  function cell(tr, text) {
    var td = document.createElement('td');
    td.textContent = text;
    tr.appendChild(td);
    return td;
  }

  function schedule() {
    if (!tbody || rafId) return;
    rafId = requestAnimationFrame(render);
  }

  function render() {
    rafId = 0;
    if (new Date().toDateString() !== day) return resetDay();

    var role = roleFilter.value, cls = classFilter.value;
    var list = sessions.slice().sort(function (a, b) { return a.timeIn - b.timeIn; });
    list.forEach(function (s, i) { s.n = i + 1; });
    list.reverse();                                   // newest first

    var frag = document.createDocumentFragment(), shown = 0;
    for (var i = 0; i < list.length && shown < CFG.maxRows; i++) {
      var s = list[i];
      if ((role !== 'all' && s.role !== role) || (cls !== 'all' && s.cls !== cls)) continue;
      var tr = document.createElement('tr');
      tr.setAttribute('data-role', s.role);
      tr.setAttribute('data-class', s.cls);
      cell(tr, s.n);
      cell(tr, s.first);
      cell(tr, s.last);
      cell(tr, fmt(s.timeIn));
      cell(tr, s.timeOut ? fmt(s.timeOut) : '—');
      cell(tr, ROLE_LABEL[s.role]);
      var st = cell(tr, '');
      var pill = document.createElement('span');
      pill.className = 'status-pill ' + (s.timeOut ? 'status-pill--out' : 'status-pill--in');
      pill.textContent = s.timeOut ? 'Left' : 'In gym';
      st.appendChild(pill);
      frag.appendChild(tr);
      shown++;
    }
    tbody.replaceChildren(frag);

    emptyEl.textContent = sessions.length ? 'No check-ins match these filters.' : 'No check-ins yet today.';
    emptyEl.hidden = shown !== 0;
    if (attendeesEl) attendeesEl.textContent = sessions.length;
    if (inGymEl) inGymEl.textContent = Object.keys(open).length;
  }

  function resetDay() {
    day = new Date().toDateString();
    seen = Object.create(null); open = Object.create(null); sessions = [];
    store = { day: day, events: [] };
    saveStore();
    schedule();
  }

  /* ---------- polling (only when an endpoint is set) ---------- */
  var delay = CFG.pollMs, timer = 0, ctrl = null;

  function next() {
    clearTimeout(timer);
    timer = setTimeout(poll, delay * (0.85 + Math.random() * 0.3));
  }

  function poll() {
    if (!CFG.endpoint || document.hidden) return;
    ctrl = new AbortController();
    fetch(CFG.endpoint + '?since=' + encodeURIComponent(cursor || '') + '&limit=' + CFG.pageSize,
      { signal: ctrl.signal, credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) {
        if (r.status === 304) return null;
        if (!r.ok) throw new Error(r.status);
        return r.json();
      })
      .then(function (d) {
        delay = CFG.pollMs;
        if (!d) return;
        cursor = d.cursor || cursor;
        ingest(d.events || []);
        if ((d.events || []).length >= CFG.pageSize) delay = 1000;  // catch up if backlog
      })
      .catch(function (e) {
        if (e && e.name === 'AbortError') return;
        delay = Math.min(delay * 2, CFG.maxPollMs);                  // back off
      })
      .then(next);
  }

  /* ---------- demo seed (only when no backend and nothing stored) ---------- */
  function at(h, m) { var d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); }
  function seed() {
    var u = [
      ['u16', 'RJ', 'Nalda', 'member', 'gym', at(8, 12), at(19, 0)],
      ['u17', 'Avril', 'Felix', 'nonmember', 'muay thai', at(9, 27), null],
      ['u18', 'Christoph', 'Estenilo', 'member', 'taekwondo', at(9, 30), at(14, 35)],
      ['u19', 'Eugene', 'Balando', 'nonmember', 'boxing', at(11, 10), at(12, 0)],
      ['u20', 'Francis', 'Madriaga', 'member', 'yoga', at(11, 18), at(12, 5)],
      ['u21', 'Jasmine', 'Mosura', 'nonmember', 'zumba', at(12, 42), null]
    ];
    u.forEach(function (r) {
      var base = { userId: r[0], first: r[1], last: r[2], role: r[3], cls: r[4] };
      store.events.push(Object.assign({ id: 'seed-in-' + r[0], action: 'login', ts: r[5] }, base));
      if (r[6]) store.events.push(Object.assign({ id: 'seed-out-' + r[0], action: 'logout', ts: r[6] }, base));
    });
    saveStore();
  }

  /* ---------- init ---------- */
  window.GTGAudit = { log: log, config: CFG };

  if (!tbody) return;                                  // page has no table: API only

  if (!CFG.endpoint && !store.events.length) seed();
  ingest(store.events);
  schedule();

  roleFilter.addEventListener('change', schedule);
  classFilter.addEventListener('change', schedule);

  // another tab (e.g. the login page) logged something
  window.addEventListener('storage', function (e) {
    if (e.key !== CFG.storeKey) return;
    store = loadStore();
    ingest(store.events);
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { if (ctrl) ctrl.abort(); clearTimeout(timer); }
    else { poll(); }
  });

  if (CFG.endpoint) poll();
})();