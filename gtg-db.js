/* gtg-db.js : connects FITBOOK to Supabase.
 *
 * The pages were written to keep everything in localStorage (keys that start with
 * "gtg_" / "gtg-"). This file makes Supabase the real database without rewriting
 * every page:
 *   1. Before the page's own scripts run, it loads the latest data from Supabase
 *      into localStorage (one request: rpc/app_dump).
 *   2. Whenever a page saves (localStorage.setItem on a gtg key), only the items
 *      that changed are sent to Supabase (rpc/app_sync).
 *   3. Login, sign up and log out use Supabase Auth.
 *
 * It must be the FIRST script on every page, right after supabase-config.js:
 *   <script src="supabase-config.js"></script>
 *   <script src="gtg-db.js"></script>
 */
(function () {
  'use strict';

  var CFG = window.GTG_SUPABASE || {};
  var BASE = String(CFG.url || '').replace(/\/+$/, '');
  var ANON = String(CFG.anonKey || '');
  var enabled = !!(BASE && ANON && !/YOUR_|PASTE/i.test(BASE + ANON));

  var proto = Storage.prototype;
  var nativeGet = proto.getItem, nativeSet = proto.setItem, nativeRemove = proto.removeItem;
  var ls;
  try { ls = window.localStorage; } catch (e) { ls = null; }

  var SESSION_KEY = 'gtg__session';
  var PENDING_KEY = 'gtg__pending';
  var status = { enabled: enabled, loaded: false, online: null, lastError: '' };

  function lget(k) { try { return nativeGet.call(ls, k); } catch (e) { return null; } }
  function lset(k, v) { try { nativeSet.call(ls, k, v); } catch (e) { /* storage full */ } }
  function ldel(k) { try { nativeRemove.call(ls, k); } catch (e) { /* ignore */ } }
  function jparse(s, fb) { try { var v = JSON.parse(s); return v === null || v === undefined ? fb : v; } catch (e) { return fb; } }

  /* ---------------- which keys live in the database ---------------- */
  var LOCAL_ONLY = { gtg_role: 1, gtg_active_enrollment: 1 };
  function isSynced(k) {
    if (typeof k !== 'string' || !/^gtg[_-]/.test(k)) return false;
    if (k.indexOf('gtg__') === 0 || k.indexOf('gtg-debug') === 0) return false;
    return !LOCAL_ONLY[k];
  }
  function isPersonal(k) { return k.indexOf('gtg-profile-') === 0; }
  // Database name of a localStorage key ("personal" keys get the user id added)
  function collectionOf(k) {
    if (!isPersonal(k)) return k;
    var s = getSession();
    return s && s.user ? k + '@' + s.user.id : null;
  }

  /* ---------------- session (Supabase Auth) ---------------- */
  function getSession() { return jparse(lget(SESSION_KEY), null); }
  function setSession(s) { if (s) lset(SESSION_KEY, JSON.stringify(s)); else ldel(SESSION_KEY); }

  function headers(token) {
    return {
      'apikey': ANON,
      'Authorization': 'Bearer ' + (token || ANON),
      'Content-Type': 'application/json'
    };
  }

  // Synchronous request: only used while the page is starting, so the page's own
  // scripts see the fresh data. Returns { status, body }.
  function syncRequest(path, body, token) {
    var x = new XMLHttpRequest();
    try {
      x.open('POST', BASE + path, false);
      var h = headers(token);
      Object.keys(h).forEach(function (n) { x.setRequestHeader(n, h[n]); });
      x.send(JSON.stringify(body || {}));
      return { status: x.status, body: jparse(x.responseText, null), text: x.responseText };
    } catch (e) {
      return { status: 0, body: null, text: String(e) };
    }
  }

  function sessionFromAuth(body) {
    if (!body || !body.access_token) return null;
    return {
      access_token: body.access_token,
      refresh_token: body.refresh_token,
      expires_at: body.expires_at || Math.floor(Date.now() / 1000) + (body.expires_in || 3600),
      user: { id: body.user && body.user.id, email: body.user && body.user.email }
    };
  }

  // Keeps the login alive. Returns a usable access token or null.
  function tokenSync() {
    var s = getSession();
    if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    var r = syncRequest('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token });
    var fresh = r.status === 200 && sessionFromAuth(r.body);
    if (fresh) { fresh.profile = s.profile; setSession(fresh); return fresh.access_token; }
    if (r.status >= 400 && r.status < 500) clearLogin();   // refresh token no longer valid
    return null;
  }

  function tokenAsync() {
    var s = getSession();
    if (!s) return Promise.resolve(null);
    if (s.expires_at - 60 > Date.now() / 1000) return Promise.resolve(s.access_token);
    return fetch(BASE + '/auth/v1/token?grant_type=refresh_token', {
      method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: s.refresh_token })
    }).then(function (res) { return res.json().then(function (b) { return { ok: res.ok, b: b }; }); })
      .then(function (r) {
        var fresh = r.ok && sessionFromAuth(r.b);
        if (!fresh) return null;
        fresh.profile = s.profile;
        setSession(fresh);
        return fresh.access_token;
      }).catch(function () { return null; });
  }

  function clearLogin() {
    setSession(null);
    ldel('currentUser');
  }

  /* ---------------- turning a stored value into rows and back ---------------- */
  // value string -> { shape, items: [[id, data, order]] }
  function explode(str) {
    if (str === null || str === undefined) return null;
    var v;
    try { v = JSON.parse(str); } catch (e) { return { shape: 'value', items: [['value', { __raw: String(str) }, 0]] }; }
    if (Array.isArray(v)) {
      var ids = v.map(function (x) {
        return x && typeof x === 'object' && !Array.isArray(x) &&
          (typeof x.id === 'string' || typeof x.id === 'number') && x.id !== '' ? String(x.id) : null;
      });
      var seen = {}, unique = ids.every(function (id) { if (!id || seen[id]) return false; seen[id] = 1; return true; });
      return { shape: 'array', items: v.map(function (x, i) { return [unique ? ids[i] : '#' + i, x, i]; }) };
    }
    if (v && typeof v === 'object') {
      return { shape: 'object', items: Object.keys(v).map(function (k, i) { return [k, v[k], i]; }) };
    }
    return { shape: 'value', items: [['value', v, 0]] };
  }

  // { shape, rows: [[id, data]] } -> value string
  function implode(c) {
    var rows = c.rows || [];
    if (c.shape === 'array') return JSON.stringify(rows.map(function (r) { return r[1]; }));
    if (c.shape === 'object') {
      var o = {};
      rows.forEach(function (r) { o[r[0]] = r[1]; });
      return JSON.stringify(o);
    }
    var d = rows.length ? rows[0][1] : null;
    if (d && typeof d === 'object' && Object.prototype.hasOwnProperty.call(d, '__raw')) return String(d.__raw);
    return JSON.stringify(d);
  }

  function diff(oldStr, newStr) {
    var a = explode(oldStr), b = explode(newStr);
    if (!b) b = { shape: a ? a.shape : 'array', items: [] };
    // Rewrite the whole list only when its shape changed (never just because this
    // browser had no copy yet: that could wipe other people's items)
    var replace = !!a && a.shape !== b.shape;
    var before = {};
    if (a && !replace) a.items.forEach(function (it) { before[it[0]] = it; });
    var ups = [], keep = {};
    b.items.forEach(function (it) {
      keep[it[0]] = 1;
      var old = before[it[0]];
      if (!old || old[2] !== it[2] || JSON.stringify(old[1]) !== JSON.stringify(it[1])) {
        ups.push({ id: it[0], data: it[1] === undefined ? null : it[1], sort_order: it[2] });
      }
    });
    var dels = replace ? [] : Object.keys(before).filter(function (id) { return !keep[id]; });
    if (!replace && !ups.length && !dels.length) return null;
    return { shape: b.shape, up: ups, del: dels, rep: replace };
  }

  /* ---------------- sending changes ---------------- */
  var seq = 0;
  function readQueue() { return jparse(lget(PENDING_KEY), []); }
  function writeQueue(q) { if (q.length) lset(PENDING_KEY, JSON.stringify(q)); else ldel(PENDING_KEY); }

  function enqueue(collection, d) {
    var op = { c: collection, s: d.shape, up: d.up, del: d.del, rep: d.rep, ts: Date.now() * 1000 + (seq++ % 1000) };
    var q = readQueue();
    q.push(op);
    writeQueue(q);
    return op;
  }
  function dropOp(op) {
    writeQueue(readQueue().filter(function (o) { return !(o.ts === op.ts && o.c === op.c); }));
  }
  function opBody(op) {
    return { p_collection: op.c, p_shape: op.s, p_upserts: op.up, p_deletes: op.del, p_replace: !!op.rep, p_ts: op.ts };
  }

  var toastTimer;
  function toast(msg, bad) {
    var show = function () {
      var t = document.getElementById('gtg-db-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'gtg-db-toast';
        t.setAttribute('role', 'status');
        t.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;' +
          'padding:10px 16px;border-radius:8px;font:14px/1.4 system-ui,sans-serif;color:#fff;' +
          'box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:90vw;text-align:center';
        document.body.appendChild(t);
      }
      t.style.background = bad ? '#b42318' : '#1f7a3f';
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { t.style.display = 'none'; }, bad ? 6000 : 2500);
    };
    if (document.body) show(); else document.addEventListener('DOMContentLoaded', show);
  }

  function handleFailure(op, httpStatus, text) {
    var body = jparse(text, {});
    var msg = (body && (body.message || body.msg)) || text || ('HTTP ' + httpStatus);
    status.lastError = msg;
    if (httpStatus === 401 || httpStatus === 403 || httpStatus === 400 || httpStatus === 404) {
      dropOp(op);   // will never succeed as it is: do not retry
      console.warn('[FITBOOK DB] not saved (' + op.c + '):', msg);
      toast('Not saved to the database: ' + msg, true);
    }
  }

  var sending = false;
  function flushAsync() {
    if (!enabled || sending) return Promise.resolve();
    var q = readQueue();
    if (!q.length) return Promise.resolve();
    sending = true;
    var op = q[0];
    return tokenAsync().then(function (token) {
      if (!token) { dropOp(op); toast('Log in to save changes to the database.', true); return; }
      var body = JSON.stringify(opBody(op));
      return fetch(BASE + '/rest/v1/rpc/app_sync', {
        method: 'POST', headers: headers(token), body: body, keepalive: body.length < 60000
      }).then(function (res) {
        if (res.ok) { dropOp(op); status.online = true; return; }
        return res.text().then(function (t) { handleFailure(op, res.status, t); });
      });
    }).catch(function (e) {
      status.online = false;
      status.lastError = String(e);
    }).then(function () {
      sending = false;
      if (readQueue().length && status.online !== false) return flushAsync();
    });
  }

  // While the page starts: push anything left from the last page (synchronously).
  function flushSync(token) {
    var q = readQueue().slice(0, 30);
    for (var i = 0; i < q.length; i++) {
      var op = q[i];
      if (!token) { dropOp(op); continue; }
      var r = syncRequest('/rest/v1/rpc/app_sync', opBody(op), token);
      if (r.status >= 200 && r.status < 300) dropOp(op);
      else if (r.status === 0 || r.status >= 500) return false;   // offline: keep for later
      else handleFailure(op, r.status, r.text);
    }
    return true;
  }

  /* ---------------- loading data before the page runs ---------------- */
  function loadAll() {
    var token = tokenSync();
    if (!flushSync(token)) { status.online = false; return; }
    var r = syncRequest('/rest/v1/rpc/app_dump', {}, token);
    if (r.status === 401 && token) {          // token rejected: continue as a guest
      clearLogin();
      r = syncRequest('/rest/v1/rpc/app_dump', {});
    }
    if (r.status !== 200 || !r.body || !r.body.collections) {
      status.online = false;
      status.lastError = r.text;
      console.warn('[FITBOOK DB] could not load data, using what this browser has.', r.status, r.text);
      return;
    }
    status.online = true;
    var cols = r.body.collections;
    var s = getSession();
    var me = s && s.user ? s.user.id : null;
    var wanted = {};
    Object.keys(cols).forEach(function (name) {
      var at = name.indexOf('@');
      var key = name;
      if (at > 0) {
        if (name.slice(at + 1) !== me) return;    // someone else's personal data
        key = name.slice(0, at);
      }
      wanted[key] = implode(cols[name]);
    });
    // replace every synced key with what the database has
    var existing = [];
    for (var i = 0; i < ls.length; i++) existing.push(ls.key(i));
    existing.forEach(function (k) {
      if (!isSynced(k) || Object.prototype.hasOwnProperty.call(wanted, k)) return;
      if (isPersonal(k) && !me) return;           // not logged in: keep personal drafts
      ldel(k);
    });
    Object.keys(wanted).forEach(function (k) { lset(k, wanted[k]); });
    if (s && r.body.role && s.profile) {
      s.profile.role = r.body.role;
      setSession(s);
      var cu = jparse(lget('currentUser'), null);
      if (cu && cu.role !== r.body.role && r.body.role !== 'guest') { cu.role = r.body.role; lset('currentUser', JSON.stringify(cu)); }
    }
    status.loaded = true;
  }

  /* ---------------- watch the pages' saves ---------------- */
  function onWrite(key, oldStr, newStr) {
    var c = collectionOf(key);
    if (!c) return;
    var d = diff(oldStr, newStr);
    if (!d) return;
    enqueue(c, d);
    flushAsync();
  }

  if (enabled && ls) {
    proto.setItem = function (k, v) {
      if (this === ls && isSynced(k)) {
        var oldStr = nativeGet.call(ls, k);
        nativeSet.call(ls, k, v);
        var newStr = nativeGet.call(ls, k);
        if (oldStr !== newStr) onWrite(k, oldStr, newStr);
        return;
      }
      return nativeSet.call(this, k, v);
    };
    proto.removeItem = function (k) {
      if (this === ls && isSynced(k)) {
        var oldStr = nativeGet.call(ls, k);
        nativeRemove.call(ls, k);
        if (oldStr !== null) onWrite(k, oldStr, null);
        return;
      }
      return nativeRemove.call(this, k);
    };
    loadAll();
    window.addEventListener('online', flushAsync);
    window.addEventListener('pagehide', function () { flushAsync(); });
  }

  /* ---------------- login / sign up / log out ---------------- */
  var DASHBOARD = {
    member: 'memberdashboard.html', trainer: 'trainerdashboard.html',
    admin: 'admindashboard.html', owner: 'ownerdashboard.html'
  };

  function authError(b, fallback) {
    var m = b && (b.error_description || b.msg || b.message || b.error);
    if (/invalid login credentials/i.test(m || '')) return 'Incorrect email or password. Please try again.';
    if (/email not confirmed/i.test(m || '')) return 'Please confirm your email first (check your inbox).';
    if (/already registered/i.test(m || '')) return 'This email already has an account. Please log in.';
    return m || fallback;
  }

  function login(email, password) {
    return fetch(BASE + '/auth/v1/token?grant_type=password', {
      method: 'POST', headers: headers(), body: JSON.stringify({ email: email, password: password })
    }).then(function (res) { return res.json().then(function (b) { return { ok: res.ok, b: b }; }); })
      .then(function (r) {
        var s = r.ok && sessionFromAuth(r.b);
        if (!s) throw new Error(authError(r.b, 'Login failed. Please try again.'));
        return fetch(BASE + '/rest/v1/rpc/my_profile', { method: 'POST', headers: headers(s.access_token), body: '{}' })
          .then(function (res) { return res.json(); })
          .then(function (p) {
            p = p || {};
            s.profile = { role: p.role || 'member', first_name: p.first_name || '', last_name: p.last_name || '' };
            setSession(s);
            ldel('gtg_role');
            lset('currentUser', JSON.stringify({
              id: s.user.id, email: s.user.email, role: s.profile.role,
              firstName: s.profile.first_name, lastName: s.profile.last_name
            }));
            return { role: s.profile.role, dashboard: DASHBOARD[s.profile.role] || 'memberdashboard.html' };
          });
      });
  }

  function signup(email, password, firstName, lastName) {
    return fetch(BASE + '/auth/v1/signup', {
      method: 'POST', headers: headers(),
      body: JSON.stringify({ email: email, password: password, data: { first_name: firstName, last_name: lastName } })
    }).then(function (res) { return res.json().then(function (b) { return { ok: res.ok, b: b }; }); })
      .then(function (r) {
        if (!r.ok) throw new Error(authError(r.b, 'Sign up failed. Please try again.'));
        // Supabase hides "already registered" behind a fake user with no identities
        var u = r.b.user || r.b;
        if (u && Array.isArray(u.identities) && u.identities.length === 0) {
          throw new Error('This email already has an account. Please log in.');
        }
        return { needsConfirm: !r.b.access_token };
      });
  }

  // Contact form: anyone can send (no login needed)
  function contact(m) {
    return fetch(BASE + '/rest/v1/rpc/submit_contact', {
      method: 'POST', headers: headers(), body: JSON.stringify({
        p_first_name: m.firstName || '', p_last_name: m.lastName || '', p_email: m.email || '',
        p_phone: m.phone || '', p_topic: m.topic || '', p_message: m.message || ''
      })
    }).then(function (res) {
      if (res.ok) return true;
      return res.json().catch(function () { return {}; }).then(function (b) {
        throw new Error((b && b.message) || 'Could not send your message. Please try again.');
      });
    });
  }

  function logout() {
    var s = getSession();
    if (s && enabled) {
      try {
        fetch(BASE + '/auth/v1/logout', { method: 'POST', headers: headers(s.access_token), keepalive: true });
      } catch (e) { /* ignore */ }
    }
    clearLogin();
    // forget this user's copy of the data; the next page loads it fresh
    var keys = [];
    for (var i = 0; i < ls.length; i++) keys.push(ls.key(i));
    keys.forEach(function (k) { if (isSynced(k) || k === 'gtg_active_enrollment') ldel(k); });
  }

  // Every "Log Out" link in the settings panel
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('.settings-panel__logout, [data-logout]');
    if (a && enabled) logout();
  }, true);

  window.GTGDB = {
    enabled: enabled,
    status: status,
    login: login,
    signup: signup,
    contact: contact,
    logout: logout,
    session: getSession,
    flush: flushAsync,
    pending: function () { return readQueue().length; },
    dashboardFor: function (role) { return DASHBOARD[role] || 'memberdashboard.html'; }
  };
})();
