/* GTG Fitness – roles and page access
   Role order (highest first): owner > admin > trainer > member.
   The signed-in role is worked out from the email that login.html saves in
   localStorage "currentUser" (see EMAIL_ROLES below). If nobody is logged in,
   it falls back to "gtg_role" (the ?role= demo switch), then to admin.

   Add  <script src="auth.js"></script>  before </body> on EVERY admin page.
   Admin and Owner have their own pages:
     - admin*.html  -> Admin (the owner can open them too)
     - owner*.html  -> Owner only. Links to them are hidden for other roles, and opening one by its
       address shows a blank page.
     - Any element can also be limited with an attribute, e.g.  <div data-min-role="owner">...</div>

   IMPORTANT: this runs in the browser, so it hides pages but is NOT real security.
   Anyone can edit localStorage. Real protection has to be checked on a server. */
(function () {
  'use strict';

  var ROLE_KEY = 'gtg_role';

  // While you build the site, open any page with ?role=owner or ?role=admin to switch roles
  // (only used when nobody is logged in). Set this to false before launch.
  // Off once the site is connected to Supabase: roles then come from real logins.
  var ALLOW_DEMO_SWITCH = !(window.GTGDB && window.GTGDB.enabled);

  var LEVELS = { guest: 0, member: 1, trainer: 2, admin: 3, owner: 4 };
  var LABELS = { guest: 'Guest', member: 'Member', trainer: 'Trainer', admin: 'Admin', owner: 'Owner' };

  // Role for each login email (matches the accounts in login.html)
  var EMAIL_ROLES = {
    'member1@gmail.com':  'member',
    'trainer1@gmail.com': 'trainer',
    'admin1@gmail.com':   'admin',
    'owner1@gmail.com':   'owner'
  };

  // file name -> lowest role allowed to open it.
  // Every page whose file name starts with "owner" is owner-only automatically (see needOf).
  var RESTRICTED = {
    'edit-profile-owner.html': 'owner'
  };
  function needOf(file) {
    file = String(file || '').toLowerCase();
    if (file.indexOf('owner') === 0) return 'owner';
    // With real logins (Supabase), admin pages need an admin or the owner
    if (window.GTGDB && window.GTGDB.enabled && file.indexOf('admin') === 0) return 'admin';
    return RESTRICTED[file];
  }

  if (ALLOW_DEMO_SWITCH) {
    try {
      var wanted = (new URLSearchParams(window.location.search).get('role') || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(LEVELS, wanted)) {
        localStorage.setItem(ROLE_KEY, wanted);
        var url = new URL(window.location.href);
        url.searchParams.delete('role');
        window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
    } catch (e) { /* storage or history not available; keep going */ }
  }

  function getRole() {
    try {
      // 1) who logged in (login.html saves { email } in "currentUser")
      var user = JSON.parse(localStorage.getItem('currentUser') || 'null');
      var email = user && user.email ? String(user.email).toLowerCase() : '';
      // Supabase login saves the role from the profiles table
      if (user && user.role && Object.prototype.hasOwnProperty.call(LEVELS, user.role)) {
        return user.role;
      }
      if (email && Object.prototype.hasOwnProperty.call(EMAIL_ROLES, email)) {
        return EMAIL_ROLES[email];
      }
      // 2) the ?role= demo switch, used when nobody is logged in
      var r = (localStorage.getItem(ROLE_KEY) || '').toLowerCase();
      if (Object.prototype.hasOwnProperty.call(LEVELS, r)) return r;
    } catch (e) { /* fall through */ }
    // nobody logged in: a guest once the database is connected, admin in the old demo mode
    return (window.GTGDB && window.GTGDB.enabled) ? 'guest' : 'admin';
  }

  var role = getRole();

  function can(min) { return LEVELS[role] >= LEVELS[min]; }

  function showRoleLabel() {
    document.querySelectorAll('.settings-panel__profile-sub').forEach(function (p) { p.textContent = LABELS[role]; });
  }

  /* ---------- locked page: show a blank screen (no warning message) ---------- */
  function showGate() {
    var main = document.querySelector('.app-main');
    if (!main) return;
    main.classList.add('is-locked');
    // hide everything inside the page area, including the loading placeholder
    Array.prototype.forEach.call(main.children, function (child) {
      child.style.display = 'none';
    });
  }

  // Returns true when the current role may see the page; otherwise shows the filter and returns false
  function guard(opts) {
    opts = opts || {};
    var need = opts.min || 'owner';
    if (can(need)) return true;
    showGate(opts.page || 'This page', need);
    return false;
  }

  /* ---------- hide what this role cannot open ---------- */
  function hide(el) { el.hidden = true; el.style.display = 'none'; }

  function applyAccess() {
    // links to restricted pages (sidebar items are removed as a whole <li>)
    document.querySelectorAll('a[href]').forEach(function (a) {
      var file = (a.getAttribute('href') || '').split('#')[0].split('?')[0].split('/').pop().toLowerCase();
      var need = needOf(file);
      if (need && !can(need)) hide(a.closest('li') || a);
    });
    // anything marked data-min-role="owner" (or admin, trainer ...)
    document.querySelectorAll('[data-min-role]').forEach(function (el) {
      var need = el.getAttribute('data-min-role');
      if (Object.prototype.hasOwnProperty.call(LEVELS, need) && !can(need)) hide(el);
    });
  }

  // opening an owner page by its address as a non-owner: blank page
  function gateThisPage() {
    var file = window.location.pathname.split('/').pop();
    var need = needOf(file);
    if (need && !can(need)) showGate(file, need);
  }

  showRoleLabel();
  gateThisPage();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyAccess);
  else applyAccess();

  window.GTGAuth = { role: role, label: LABELS[role], can: can, guard: guard, apply: applyAccess };
})();
