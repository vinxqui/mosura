/* GTG Fitness – Feedback Summary (owner only)
   Shows rating totals and member comments, with filters, "mark reviewed" and delete.
   Feedback is read from localStorage "gtg_feedback". Each entry looks like:
   { id, member: "Last, First", category: "Class|Trainer|Equipment|Facility",
     target: "Yoga", rating: 1-5, comment: "...", date: "YYYY-MM-DD", reviewed: false }
   The member feedback page can push entries into the same key. */
(function () {
  'use strict';

  // Fail closed: nothing is built unless the signed-in role is allowed
  if (!window.GTGAuth || !GTGAuth.guard({ page: 'Feedback Summary', min: 'owner' })) return;
  document.getElementById('op-skeleton').hidden = true;
  document.getElementById('op-content').hidden = false;

  var KEY = 'gtg_feedback';
  var CATEGORIES = ['Class', 'Trainer', 'Equipment', 'Facility'];

  function $(id) { return document.getElementById(id); }
  var listEl = $('fb-list'), emptyEl = $('fb-empty'), toastEl = $('op-toast'), confirmModal = $('confirm-modal');
  var searchEl = $('fb-search'), catEl = $('fb-category'), ratingEl = $('fb-rating'), statusEl = $('fb-status');

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // textContent keeps member comments from injecting markup
    return n;
  }
  function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function fmtDate(s) {
    var p = s.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function initials(name) {
    var parts = name.split(',');
    return ((parts[1] || '').trim().charAt(0) + (parts[0] || '').trim().charAt(0)).toUpperCase() || '?';
  }
  function stars(n) {
    var s = el('span', 'op-stars');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', n + ' out of 5 stars');
    for (var i = 1; i <= 5; i++) s.appendChild(el('span', i <= n ? '' : 'off', '\u2605'));
    return s;
  }

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- data ---------- */
  function seed() {
    function ago(n) { return iso(new Date(Date.now() - n * 86400000)); }
    function fb(id, member, category, target, rating, comment, days, reviewed) {
      return { id: id, member: member, category: category, target: target, rating: rating,
               comment: comment, date: ago(days), reviewed: reviewed };
    }
    // Sample entries so the page isn't empty
    return [
      fb('f1', 'Hombre, Riza Marie', 'Trainer', 'Coach Ryan', 5, 'Coach Ryan keeps every session motivating and well planned. I can see real progress after a month.', 1, false),
      fb('f2', 'Canlas, John Theo', 'Class', 'Taekwondo', 4, 'Great class overall, but the evening session gets crowded. A second time slot would help.', 2, false),
      fb('f3', 'Guevarra, Lienna', 'Equipment', 'Gym floor', 2, 'Two treadmills have been out of order for over a week. Please get them repaired.', 3, false),
      fb('f4', 'Villanueva, Stella Ashley', 'Facility', 'Locker room', 3, 'Clean and spacious, but the lockers need working locks.', 5, false),
      fb('f5', 'Panginitan, Marcus', 'Class', 'Boxing', 5, 'Best boxing class I have joined. The drills are challenging and the coach is very encouraging.', 6, true),
      fb('f6', 'Guevarra, Lienna', 'Trainer', 'Coach Irene', 5, 'Yoga sessions with Coach Irene are calming and well paced.', 8, true),
      fb('f7', 'Canlas, John Theo', 'Facility', 'Showers', 1, 'There was no hot water after the 6 PM class.', 9, false),
      fb('f8', 'Hombre, Riza Marie', 'Class', 'Zumba', 4, 'Fun and high energy. The music could be a little quieter.', 12, true)
    ];
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw !== null) { var list = JSON.parse(raw); if (Array.isArray(list)) return list; }
    } catch (err) { /* use the sample entries */ }
    return seed();
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; } catch (err) { return false; }
  }
  var items = load();

  /* ---------- summary ---------- */
  function bar(label, pct, valueText, star) {
    var li = el('li', 'op-bar');
    li.appendChild(el('span', 'op-bar__label', label));
    var track = el('span', 'op-bar__track');
    var fill = el('span', 'op-bar__fill' + (star ? ' op-bar__fill--star' : ''));
    fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    track.appendChild(fill);
    li.appendChild(track);
    li.appendChild(el('span', 'op-bar__value', valueText));
    return li;
  }

  function renderSummary() {
    var total = items.length;
    var sum = items.reduce(function (s, x) { return s + x.rating; }, 0);
    var positive = items.filter(function (x) { return x.rating >= 4; }).length;

    $('fb-avg').textContent = total ? (sum / total).toFixed(1) + ' / 5' : '\u2013';
    $('fb-total').textContent = total;
    $('fb-new').textContent = items.filter(function (x) { return !x.reviewed; }).length;
    $('fb-pos').textContent = total ? Math.round(positive / total * 100) + '%' : '\u2013';

    var dist = $('fb-dist');
    dist.innerHTML = '';
    for (var r = 5; r >= 1; r--) {
      var n = items.filter(function (x) { return x.rating === r; }).length;
      dist.appendChild(bar(r + (r === 1 ? ' star' : ' stars'), total ? n / total * 100 : 0, String(n), true));
    }

    var cats = $('fb-cats');
    cats.innerHTML = '';
    CATEGORIES.forEach(function (c) {
      var inCat = items.filter(function (x) { return x.category === c; });
      var avg = inCat.length ? inCat.reduce(function (s, x) { return s + x.rating; }, 0) / inCat.length : 0;
      cats.appendChild(bar(c, avg / 5 * 100, inCat.length ? avg.toFixed(1) : '\u2013', false));
    });
  }

  /* ---------- list ---------- */
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>';

  function buildItem(x) {
    var li = el('li', 'op-feed__item' + (x.reviewed ? '' : ' is-new'));
    var av = el('span', 'op-avatar', initials(x.member));
    av.setAttribute('aria-hidden', 'true');

    var main = el('div', 'op-feed__main');
    var top = el('div', 'op-feed__top');
    top.appendChild(el('strong', '', x.member));
    top.appendChild(el('span', 'op-chip', x.category + (x.target ? ' \u00B7 ' + x.target : '')));
    top.appendChild(stars(x.rating));
    top.appendChild(el('span', 'op-feed__date', fmtDate(x.date)));
    main.appendChild(top);
    main.appendChild(el('p', 'op-feed__text', x.comment || 'No comment left.'));
    if (!x.reviewed) main.appendChild(el('span', 'op-chip op-chip--warn', 'Needs review'));

    var actions = el('div', 'op-feed__actions');
    var toggle = el('button', 'op-btn op-btn--ghost op-btn--sm', x.reviewed ? 'Mark as new' : 'Mark reviewed');
    toggle.type = 'button';
    toggle.addEventListener('click', function () {
      x.reviewed = !x.reviewed;
      persist();
      refresh();
      toast(x.reviewed ? 'Marked as reviewed' : 'Marked as needs review');
    });
    var del = el('button', 'op-icon-btn op-icon-btn--danger');
    del.type = 'button';
    del.title = 'Delete';
    del.innerHTML = ICON_TRASH;
    del.setAttribute('aria-label', 'Delete feedback from ' + x.member);
    del.addEventListener('click', function () { confirmDelete(x); });
    actions.appendChild(toggle);
    actions.appendChild(del);

    li.appendChild(av);
    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  function renderList() {
    var q = searchEl.value.trim().toLowerCase();
    var shown = items.filter(function (x) {
      if (catEl.value && x.category !== catEl.value) return false;
      if (ratingEl.value && String(x.rating) !== ratingEl.value) return false;
      if (statusEl.value === 'new' && x.reviewed) return false;
      if (statusEl.value === 'done' && !x.reviewed) return false;
      if (!q) return true;
      return [x.member, x.comment, x.target, x.category].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return b.date.localeCompare(a.date); });

    listEl.innerHTML = '';
    shown.forEach(function (x) { listEl.appendChild(buildItem(x)); });

    emptyEl.hidden = shown.length !== 0;
    if (!shown.length) emptyEl.textContent = items.length ? 'No feedback matches your filters.' : 'No feedback yet.';
  }

  function refresh() { renderSummary(); renderList(); }

  /* ---------- delete ---------- */
  var pendingConfirm = null;
  function confirmDelete(x) {
    $('confirm-title').textContent = 'Delete this feedback?';
    $('confirm-msg').textContent = 'The comment from ' + x.member + ' will be removed. This can\u2019t be undone.';
    pendingConfirm = function () {
      items = items.filter(function (i) { return i.id !== x.id; });
      persist();
      refresh();
      toast('Feedback deleted');
    };
    confirmModal.showModal();
  }
  $('confirm-ok').addEventListener('click', function () {
    var run = pendingConfirm; pendingConfirm = null; confirmModal.close(); if (run) run();
  });
  $('confirm-cancel').addEventListener('click', function () { pendingConfirm = null; confirmModal.close(); });
  confirmModal.addEventListener('click', function (ev) { if (ev.target === confirmModal) confirmModal.close(); });

  /* ---------- wiring ---------- */
  [searchEl, catEl, ratingEl, statusEl].forEach(function (c) { c.addEventListener('input', renderList); });
  document.addEventListener('click', function (ev) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute('open');
    });
  });

  refresh();
})();