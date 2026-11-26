/* GTG Fitness – Employee Management (owner only)
   Add, edit and delete employees; search and filter the list.
   Employees are stored in localStorage under "gtg_employees". */
(function () {
  'use strict';

  // Fail closed: nothing is built unless the signed-in role is allowed
  if (!window.GTGAuth || !GTGAuth.guard({ page: 'Employee Management', min: 'owner' })) return;
  document.getElementById('op-skeleton').hidden = true;
  document.getElementById('op-content').hidden = false;

  var KEY = 'gtg_employees';
  var POSITIONS = ['Admin', 'Front Desk', 'Maintenance', 'Cleaner', 'Sales', 'Other'];

  function $(id) { return document.getElementById(id); }
  var body = $('emp-body'), emptyEl = $('emp-empty'), toastEl = $('op-toast');
  var searchEl = $('emp-search'), posFilter = $('emp-position-filter'), statusFilter = $('emp-status-filter');
  var modal = $('emp-modal'), form = $('emp-form'), errorEl = $('emp-error'), confirmModal = $('confirm-modal');
  var f = {
    last: $('emp-last'), first: $('emp-first'), position: $('emp-position'), status: $('emp-status'),
    email: $('emp-email'), phone: $('emp-phone'), start: $('emp-start'), end: $('emp-end'), hired: $('emp-hired')
  };

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // textContent keeps typed text from injecting markup
    return n;
  }
  function fmtTime(t) {
    if (!t) return '\u2014';
    var p = t.split(':'), h = +p[0];
    return (((h + 11) % 12) + 1) + ':' + p[1] + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function fmtDate(iso) {
    if (!iso) return '\u2014';
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function fullName(e) { return e.last + ', ' + e.first; }
  function initials(e) { return ((e.first || '').charAt(0) + (e.last || '').charAt(0)).toUpperCase() || '?'; }

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- data ---------- */
  function seed() {
    function e(id, last, first, position, start, end, hired, status) {
      return { id: id, last: last, first: first, position: position, email: '', phone: '',
               start: start, end: end, hired: hired, status: status };
    }
    // Sample staff so the page isn't empty. Edit or delete them freely.
    return [
      e('e1', 'Santos', 'Rue', 'Admin', '08:00', '17:00', '2025-01-06', 'Active'),
      e('e2', 'Reyes', 'Marco', 'Front Desk', '06:00', '14:00', '2025-03-17', 'Active'),
      e('e3', 'Dela Cruz', 'Anna', 'Front Desk', '14:00', '22:00', '2025-06-02', 'Active'),
      e('e4', 'Bautista', 'Joel', 'Maintenance', '09:00', '18:00', '2025-08-11', 'On leave'),
      e('e5', 'Lim', 'Carla', 'Cleaner', '05:00', '13:00', '2026-01-12', 'Active')
    ];
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw !== null) { var list = JSON.parse(raw); if (Array.isArray(list)) return list; }
    } catch (err) { /* use the sample staff */ }
    return seed();
  }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(employees)); return true; } catch (err) { return false; }
  }
  var employees = load();

  /* ---------- rendering ---------- */
  var ICON_EDIT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>';

  function statusChip(s) {
    return el('span', 'op-chip ' + (s === 'Active' ? 'op-chip--ok' : s === 'On leave' ? 'op-chip--warn' : 'op-chip--bad'), s);
  }

  function buildRow(e) {
    var tr = el('tr');

    var who = el('td');
    var person = el('div', 'op-person');
    var av = el('span', 'op-avatar', initials(e));
    av.setAttribute('aria-hidden', 'true');
    var txt = el('div');
    txt.appendChild(el('strong', '', fullName(e)));
    txt.appendChild(el('span', '', e.email || 'No email'));
    person.appendChild(av);
    person.appendChild(txt);
    who.appendChild(person);
    tr.appendChild(who);

    var pos = el('td'); pos.appendChild(el('span', 'op-chip', e.position)); tr.appendChild(pos);
    tr.appendChild(el('td', '', e.start && e.end ? fmtTime(e.start) + ' \u2013 ' + fmtTime(e.end) : '\u2014'));
    tr.appendChild(el('td', '', e.phone || '\u2014'));
    tr.appendChild(el('td', '', fmtDate(e.hired)));
    var st = el('td'); st.appendChild(statusChip(e.status)); tr.appendChild(st);

    var actions = el('td');
    var wrap = el('div', 'op-actions');
    var edit = el('button', 'op-icon-btn');
    edit.type = 'button'; edit.title = 'Edit'; edit.innerHTML = ICON_EDIT;
    edit.setAttribute('aria-label', 'Edit ' + fullName(e));
    edit.addEventListener('click', function () { openForm(e); });
    var del = el('button', 'op-icon-btn op-icon-btn--danger');
    del.type = 'button'; del.title = 'Delete'; del.innerHTML = ICON_TRASH;
    del.setAttribute('aria-label', 'Delete ' + fullName(e));
    del.addEventListener('click', function () { confirmDelete(e); });
    wrap.appendChild(edit); wrap.appendChild(del);
    actions.appendChild(wrap);
    tr.appendChild(actions);
    return tr;
  }

  function render() {
    var q = searchEl.value.trim().toLowerCase();
    var shown = employees.filter(function (e) {
      if (posFilter.value && e.position !== posFilter.value) return false;
      if (statusFilter.value && e.status !== statusFilter.value) return false;
      if (!q) return true;
      return [fullName(e), e.email, e.phone, e.position].join(' ').toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });

    body.innerHTML = '';
    shown.forEach(function (e) { body.appendChild(buildRow(e)); });

    $('stat-total').textContent = employees.length;
    $('stat-active').textContent = employees.filter(function (e) { return e.status === 'Active'; }).length;
    $('stat-leave').textContent = employees.filter(function (e) { return e.status === 'On leave'; }).length;

    emptyEl.hidden = shown.length !== 0;
    if (!shown.length) {
      emptyEl.textContent = employees.length ? 'No employees match your search or filters.'
                                              : 'No employees yet. Click \u201CAdd Employee\u201D to add the first one.';
    }
  }

  /* ---------- add / edit ---------- */
  POSITIONS.forEach(function (p) {
    f.position.appendChild(el('option', '', p));
    posFilter.appendChild(el('option', '', p));
  });

  var editing = null;
  function showError(msg, focusEl) { errorEl.textContent = msg; errorEl.hidden = false; if (focusEl) focusEl.focus(); }

  function openForm(e) {
    editing = e || null;
    form.reset();
    errorEl.hidden = true;
    $('emp-modal-title').textContent = e ? 'Edit Employee' : 'Add Employee';
    $('emp-save').textContent = e ? 'Save changes' : 'Add employee';
    if (e) {
      f.last.value = e.last; f.first.value = e.first; f.position.value = e.position; f.status.value = e.status;
      f.email.value = e.email; f.phone.value = e.phone; f.start.value = e.start; f.end.value = e.end; f.hired.value = e.hired;
    } else {
      f.position.value = 'Front Desk'; f.status.value = 'Active';
    }
    modal.showModal();
    f.last.focus();
  }

  $('add-employee-btn').addEventListener('click', function () { openForm(null); });
  $('emp-close').addEventListener('click', function () { modal.close(); });
  $('emp-cancel').addEventListener('click', function () { modal.close(); });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var last = f.last.value.trim().replace(/\s+/g, ' ');
    var first = f.first.value.trim().replace(/\s+/g, ' ');
    var email = f.email.value.trim();
    var phone = f.phone.value.trim();

    if (!last) { showError('Please enter a last name.', f.last); return; }
    if (!first) { showError('Please enter a first name.', f.first); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError('That email address doesn\u2019t look right.', f.email); return; }
    if (phone && !/^[0-9+()\-\s]{7,20}$/.test(phone)) { showError('Phone numbers can only use digits, spaces, + ( ) and -.', f.phone); return; }
    if ((f.start.value || f.end.value) && (!f.start.value || !f.end.value || f.start.value === f.end.value)) {
      showError('Set both shift times, and make them different.', f.start); return;
    }

    var values = {
      last: last, first: first, position: f.position.value, status: f.status.value,
      email: email, phone: phone, start: f.start.value, end: f.end.value, hired: f.hired.value
    };

    if (editing) {
      var before = {};
      Object.keys(values).forEach(function (k) { before[k] = editing[k]; });
      Object.assign(editing, values);
      if (!persist()) { Object.assign(editing, before); showError('Could not save. Browser storage may be full.'); return; }
      toast('Changes saved');
    } else {
      var fresh = Object.assign({ id: 'e' + Date.now() }, values);
      employees.push(fresh);
      if (!persist()) { employees.pop(); showError('Could not save. Browser storage may be full.'); return; }
      toast(fullName(fresh) + ' added');
    }
    modal.close();
    render();
  });

  /* ---------- delete ---------- */
  var pendingConfirm = null;
  function confirmDelete(e) {
    $('confirm-title').textContent = 'Delete ' + fullName(e) + '?';
    $('confirm-msg').textContent = 'This removes them from the employee list. This can\u2019t be undone.';
    pendingConfirm = function () {
      employees = employees.filter(function (x) { return x.id !== e.id; });
      persist();
      render();
      toast(fullName(e) + ' deleted');
    };
    confirmModal.showModal();
  }
  $('confirm-ok').addEventListener('click', function () {
    var run = pendingConfirm; pendingConfirm = null; confirmModal.close(); if (run) run();
  });
  $('confirm-cancel').addEventListener('click', function () { pendingConfirm = null; confirmModal.close(); });

  /* ---------- wiring ---------- */
  [searchEl, posFilter, statusFilter].forEach(function (c) { c.addEventListener('input', render); });
  [modal, confirmModal].forEach(function (d) {
    d.addEventListener('click', function (ev) { if (ev.target === d) d.close(); });
  });
  document.addEventListener('click', function (ev) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute('open');
    });
  });

  render();
})();
