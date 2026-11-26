/* GTG Fitness – Class Members (admin)
   Reads ?class=<id> from the Classes page and lets the admin:
   add, view, edit and remove members, and log / remove attendance entries.
   Members are stored in localStorage under "gtg_class_members" (one list per class),
   and the class's member total in "gtg_classes" is kept in sync. */
(function () {
  'use strict';

  var MEM_KEY = 'gtg_class_members';
  var CLS_KEY = 'gtg_classes';
  var KNOWN = { boxing: 'Boxing', muaythai: 'Muay Thai', taekwondo: 'Taekwondo', yoga: 'Yoga', zumba: 'Zumba' };

  var classId = (new URLSearchParams(window.location.search).get('class') || 'yoga').toLowerCase();

  function $(id) { return document.getElementById(id); }

  var listEl = $('mc-list'), emptyEl = $('mc-empty'), countEl = $('mc-count'), titleEl = $('mc-title');
  var searchEl = $('mc-search'), profileEl = $('mc-profile'), toastEl = $('mc-toast');
  var addBtn = $('add-member-btn');

  var memberModal = $('member-modal'), memberForm = $('member-form'), memberError = $('member-error');
  var photoFile = $('member-photo-file'), photoPreview = $('member-photo-preview');
  var photoImg = photoPreview.querySelector('img'), photoPick = $('member-photo-pick'), photoClear = $('member-photo-clear');
  var logModal = $('log-modal'), logForm = $('log-form'), logError = $('log-error');
  var confirmModal = $('confirm-modal');

  var f = {
    last: $('member-last'), first: $('member-first'), age: $('member-age'), gender: $('member-gender'),
    height: $('member-height'), weight: $('member-weight'), start: $('member-start'), end: $('member-end')
  };

  /* ---------- small helpers ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // textContent keeps typed text from injecting markup
    return n;
  }
  function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoFromDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function todayISO() { return isoFromDate(new Date()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function longDate(iso) {
    return iso ? parseISO(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' }) : '\u2014';
  }
  function shortDate(iso) {
    return parseISO(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  function usDate(iso) { var p = iso.split('-'); return p[1] + '/' + p[2] + '/' + p[0]; }
  function fmtTime(t) {
    var p = t.split(':'), h = +p[0];
    return (((h + 11) % 12) + 1) + ':' + p[1] + ' ' + (h < 12 ? 'AM' : 'PM');
  }
  function relative(iso) {
    if (!iso) return '\u2014';
    var days = Math.round((parseISO(todayISO()) - parseISO(iso)) / 86400000);
    if (days < 0) return longDate(iso);
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 60) return days + ' days ago';
    return Math.floor(days / 30) + ' months ago';
  }

  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }

  /* ---------- data ---------- */

  function lookupClassName() {
    try {
      var list = JSON.parse(localStorage.getItem(CLS_KEY) || '[]');
      for (var i = 0; i < list.length; i++) if (list[i].id === classId) return list[i].name;
    } catch (e) { /* fall back below */ }
    return KNOWN[classId] || (classId.charAt(0).toUpperCase() + classId.slice(1));
  }
  var className = lookupClassName();

  function seedStore() {
    var img = 'https://i.pravatar.cc/300?img=';
    function m(id, last, first, n) {
      return { id: id, last: last, first: first, photo: img + n, age: '', gender: '', height: '', weight: '',
               start: '', end: '', lastActive: '', attended: [] };
    }
    var riza = m('m4', 'Hombre', 'Riza Marie', 5);
    riza.age = '21'; riza.gender = 'Female'; riza.height = '6\'3"'; riza.weight = '50';
    riza.start = '2026-03-26'; riza.end = '2026-05-26';
    riza.lastActive = isoFromDate(new Date(Date.now() - 86400000));
    riza.attended = [
      { id: 'a1', date: '2026-05-02', from: '17:00', to: '18:00' },
      { id: 'a2', date: '2026-05-03', from: '17:00', to: '18:00' },
      { id: 'a3', date: '2026-05-04', from: '17:00', to: '18:00' }
    ];
    return {
      yoga: [m('m1', 'Guevarra', 'Lienna', 1), m('m2', 'Canlas', 'John Theo', 2),
             m('m3', 'Villanueva', 'Stella Ashley', 3), riza, m('m5', 'Panginitan', 'Marcus', 6)]
    };
  }

  function loadStore() {
    try {
      var raw = localStorage.getItem(MEM_KEY);
      if (raw !== null) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object' && !Array.isArray(s)) return s;
      }
    } catch (e) { /* use the starter data */ }
    return seedStore();
  }

  var store = loadStore();
  function members() { return store[classId] || (store[classId] = []); }

  // Saves members and keeps the class total on the Classes page up to date
  function save() {
    try { localStorage.setItem(MEM_KEY, JSON.stringify(store)); } catch (e) { return false; }
    try {
      var raw = localStorage.getItem(CLS_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) {
          list.forEach(function (c) { if (c.id === classId) c.members = members().length; });
          localStorage.setItem(CLS_KEY, JSON.stringify(list));
        }
      }
    } catch (e) { /* the class total is a nice-to-have */ }
    return true;
  }

  function fullName(m) { return m.last && m.first ? m.last + ', ' + m.first : (m.last || m.first || 'Unnamed'); }
  function initials(m) { return ((m.first || '').charAt(0) + (m.last || '').charAt(0)).toUpperCase() || '?'; }
  function status(m) { return m.end ? (m.end >= todayISO() ? 'active' : 'expired') : null; }
  function findMember(id) {
    var list = members();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function sortedMembers() {
    return members().slice().sort(function (a, b) { return fullName(a).localeCompare(fullName(b)); });
  }

  var state = { selected: null, query: '' };
  var first = sortedMembers()[0];
  if (first) state.selected = first.id;

  /* ---------- avatars ---------- */

  function initialsEl(m, cls) {
    var s = el('span', cls + ' is-initials', initials(m));
    s.setAttribute('aria-hidden', 'true');
    return s;
  }
  function avatar(m, cls) {
    if (!m.photo) return initialsEl(m, cls);
    var img = el('img', cls);
    img.alt = '';
    img.src = m.photo;
    img.addEventListener('error', function () {
      if (img.parentNode) img.parentNode.replaceChild(initialsEl(m, cls), img);
    });
    return img;
  }

  /* ---------- rendering ---------- */

  function renderHeader() {
    titleEl.textContent = 'Subscribed for ' + className.toUpperCase() + ' CLASS';
    document.title = className + ' Members \u00B7 GTG Fitness';
    var n = members().length;
    countEl.textContent = n + (n === 1 ? ' member' : ' members');
  }

  function buildRow(m) {
    var selected = m.id === state.selected;
    var b = el('button', 'mc-row' + (selected ? ' is-selected' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', selected ? 'true' : 'false');

    var st = status(m);
    var sub = st ? (st === 'active' ? 'Ends ' : 'Ended ') + shortDate(m.end) : 'No membership dates';

    var text = el('span', 'mc-row__text');
    text.appendChild(el('span', 'mc-row__name', fullName(m)));
    text.appendChild(el('span', 'mc-row__sub', sub));

    b.appendChild(avatar(m, 'mc-avatar'));
    b.appendChild(text);
    if (st) {
      var dot = el('span', 'mc-dot mc-dot--' + st);
      dot.title = st === 'active' ? 'Membership active' : 'Membership expired';
      b.appendChild(dot);
    }
    b.addEventListener('click', function () {
      state.selected = m.id;
      renderList();
      renderProfile();
    });
    var li = el('li');
    li.appendChild(b);
    return li;
  }

  function renderList() {
    var q = state.query.toLowerCase();
    var all = sortedMembers();
    var shown = all.filter(function (m) { return !q || fullName(m).toLowerCase().indexOf(q) !== -1; });

    clear(listEl);
    shown.forEach(function (m) { listEl.appendChild(buildRow(m)); });

    emptyEl.hidden = shown.length !== 0;
    if (!all.length) emptyEl.textContent = 'No one is subscribed to ' + className + ' yet. Click \u201CAdd Member\u201D to add the first member.';
    else if (!shown.length) emptyEl.textContent = 'No members match \u201C' + state.query.trim() + '\u201D.';
    renderHeader();
  }

  function fact(dl, label, value) {
    dl.appendChild(el('dt', '', label));
    dl.appendChild(el('dd', '', value || '\u2014'));
  }

  function renderProfile() {
    var m = findMember(state.selected);
    clear(profileEl);

    if (!m) {
      profileEl.appendChild(el('p', 'mc-profile__empty', members().length
        ? 'Select a member to see their profile.'
        : 'Members you add will show up here.'));
      return;
    }

    profileEl.appendChild(avatar(m, 'mc-avatar mc-avatar--lg'));
    profileEl.appendChild(el('h2', 'mc-profile__name', fullName(m)));

    var st = status(m);
    if (st) profileEl.appendChild(el('span', 'mc-chip mc-chip--' + st, st === 'active' ? 'Active membership' : 'Membership expired'));

    var actions = el('div', 'mc-profile__actions');
    var edit = el('button', 'mc-btn mc-btn--ghost mc-btn--sm', 'Edit');
    edit.type = 'button';
    edit.addEventListener('click', function () { openMemberForm(m); });
    var remove = el('button', 'mc-btn mc-btn--danger-ghost mc-btn--sm', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', function () { confirmRemove(m); });
    actions.appendChild(edit);
    actions.appendChild(remove);
    profileEl.appendChild(actions);

    var dl = el('dl', 'mc-facts');
    fact(dl, 'Age', m.age);
    fact(dl, 'Gender', m.gender);
    fact(dl, 'Height', m.height);
    fact(dl, 'Weight', m.weight ? m.weight + ' kg' : '');
    fact(dl, 'Start', m.start ? longDate(m.start) : '');
    fact(dl, 'End', m.end ? longDate(m.end) : '');
    profileEl.appendChild(dl);

    profileEl.appendChild(el('p', 'mc-active', 'Active: ' + relative(m.lastActive)));

    var box = el('div', 'mc-attend');
    var head = el('div', 'mc-attend__head');
    head.appendChild(el('h3', '', 'Classes Attended'));
    var log = el('button', 'mc-btn mc-btn--primary mc-btn--sm', '+ Log');
    log.type = 'button';
    log.setAttribute('aria-label', 'Log attendance for ' + fullName(m));
    log.addEventListener('click', function () { openLog(); });
    head.appendChild(log);
    box.appendChild(head);

    var ul = el('ul', 'mc-attend__list');
    var entries = (m.attended || []).slice().sort(function (a, b) {
      return (b.date + b.from).localeCompare(a.date + a.from);
    });
    if (!entries.length) {
      var none = el('li');
      none.appendChild(el('p', 'mc-attend__none', 'No attendance logged yet.'));
      ul.appendChild(none);
    }
    entries.forEach(function (a) {
      var li = el('li', 'mc-attend__item');
      var info = el('div');
      info.appendChild(el('strong', '', className));
      info.appendChild(el('span', '', usDate(a.date) + '  \u00B7  ' + fmtTime(a.from) + ' \u2013 ' + fmtTime(a.to)));
      var del = el('button', 'mc-icon-btn mc-icon-btn--danger');
      del.type = 'button';
      del.setAttribute('aria-label', 'Remove attendance on ' + usDate(a.date));
      del.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>';
      del.addEventListener('click', function () {
        m.attended = m.attended.filter(function (x) { return x.id !== a.id; });
        save();
        renderProfile();
        toast('Attendance entry removed');
      });
      li.appendChild(info);
      li.appendChild(del);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    profileEl.appendChild(box);
  }

  function renderAll() { renderList(); renderProfile(); }

  /* ---------- add / edit member ---------- */

  var editing = null;      // the member being edited, or null when adding
  var draftPhoto = '';

  function setPhoto(url) {
    draftPhoto = url || '';
    photoImg.hidden = !draftPhoto;
    photoClear.hidden = !draftPhoto;
    if (draftPhoto) photoImg.src = draftPhoto; else photoImg.removeAttribute('src');
  }
  function showMemberError(msg, focusEl) {
    memberError.textContent = msg;
    memberError.hidden = false;
    if (focusEl) focusEl.focus();
  }

  function openMemberForm(m) {
    editing = m || null;
    memberForm.reset();
    memberError.hidden = true;
    $('member-modal-title').textContent = m ? 'Edit Member' : 'Add Member to ' + className;
    $('member-save').textContent = m ? 'Save changes' : 'Add member';
    if (m) {
      f.last.value = m.last; f.first.value = m.first; f.age.value = m.age; f.gender.value = m.gender;
      f.height.value = m.height; f.weight.value = m.weight; f.start.value = m.start; f.end.value = m.end;
    }
    setPhoto(m ? m.photo : '');
    memberModal.showModal();
    f.last.focus();
  }

  addBtn.addEventListener('click', function () { openMemberForm(null); });
  $('member-close').addEventListener('click', function () { memberModal.close(); });
  $('member-cancel').addEventListener('click', function () { memberModal.close(); });

  photoPick.addEventListener('click', function () { photoFile.click(); });
  photoClear.addEventListener('click', function () { photoFile.value = ''; setPhoto(''); });

  // Photos are shrunk to 300px so they fit comfortably in browser storage
  photoFile.addEventListener('change', function () {
    var file = photoFile.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showMemberError('Please choose an image file.'); photoFile.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showMemberError('That photo is over 5 MB. Please choose a smaller one.'); photoFile.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 300 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL('image/jpeg', 0.85));
        memberError.hidden = true;
      };
      img.onerror = function () { showMemberError('That image could not be read.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  memberForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var last = f.last.value.trim().replace(/\s+/g, ' ');
    var firstName = f.first.value.trim().replace(/\s+/g, ' ');
    var age = f.age.value.trim();

    if (!last) { showMemberError('Please enter a last name.', f.last); return; }
    if (!firstName) { showMemberError('Please enter a first name.', f.first); return; }
    if (age !== '' && !(/^\d+$/.test(age) && +age >= 1 && +age <= 120)) {
      showMemberError('Age must be a whole number between 1 and 120.', f.age); return;
    }
    if (f.start.value && f.end.value && f.end.value < f.start.value) {
      showMemberError('The membership end date can\u2019t be before the start date.', f.end); return;
    }

    var values = {
      last: last, first: firstName, photo: draftPhoto, age: age, gender: f.gender.value,
      height: f.height.value.trim(), weight: f.weight.value.trim(),
      start: f.start.value, end: f.end.value
    };

    if (editing) {
      var before = {};
      Object.keys(values).forEach(function (k) { before[k] = editing[k]; });
      Object.assign(editing, values);
      if (!save()) {
        Object.assign(editing, before);
        showMemberError('Could not save. Browser storage may be full; try a smaller photo.');
        return;
      }
      state.selected = editing.id;
      toast('Changes saved');
    } else {
      var fresh = Object.assign({ id: 'm' + Date.now(), lastActive: '', attended: [] }, values);
      members().push(fresh);
      if (!save()) {
        members().pop();
        showMemberError('Could not save. Browser storage may be full; try a smaller photo.');
        return;
      }
      state.selected = fresh.id;
      state.query = '';
      searchEl.value = '';
      toast(fullName(fresh) + ' added to ' + className);
    }
    memberModal.close();
    renderAll();
    var row = listEl.querySelector('.is-selected');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  /* ---------- remove member ---------- */

  var pendingConfirm = null;
  function confirmRemove(m) {
    $('confirm-title').textContent = 'Remove ' + fullName(m) + '?';
    $('confirm-msg').textContent = 'This removes their profile and attendance history from the ' + className + ' class. This can\u2019t be undone.';
    pendingConfirm = function () {
      var list = members();
      var idx = list.indexOf(m);
      if (idx === -1) return;
      list.splice(idx, 1);
      save();
      var next = sortedMembers()[0];
      state.selected = next ? next.id : null;
      renderAll();
      toast(fullName(m) + ' removed');
    };
    confirmModal.showModal();
  }
  $('confirm-ok').addEventListener('click', function () {
    var run = pendingConfirm;
    pendingConfirm = null;
    confirmModal.close();
    if (run) run();
  });
  $('confirm-cancel').addEventListener('click', function () { pendingConfirm = null; confirmModal.close(); });

  /* ---------- log attendance ---------- */

  function openLog() {
    if (!findMember(state.selected)) return;
    logForm.reset();
    logError.hidden = true;
    $('log-date').value = todayISO();
    $('log-from').value = '17:00';
    $('log-to').value = '18:00';
    logModal.showModal();
  }
  $('log-close').addEventListener('click', function () { logModal.close(); });
  $('log-cancel').addEventListener('click', function () { logModal.close(); });

  logForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = findMember(state.selected);
    var date = $('log-date').value, from = $('log-from').value, to = $('log-to').value;
    if (!m) { logModal.close(); return; }
    if (!date || !from || !to) { logError.textContent = 'Please fill in the date and both times.'; logError.hidden = false; return; }
    if (to <= from) { logError.textContent = 'The end time must be after the start time.'; logError.hidden = false; return; }

    m.attended = m.attended || [];
    m.attended.push({ id: 'a' + Date.now(), date: date, from: from, to: to });
    if (!m.lastActive || date > m.lastActive) m.lastActive = date;
    if (!save()) {
      m.attended.pop();
      logError.textContent = 'Could not save. Browser storage may be full.';
      logError.hidden = false;
      return;
    }
    logModal.close();
    renderProfile();
    toast('Attendance logged');
  });

  /* ---------- page wiring ---------- */

  searchEl.addEventListener('input', function () { state.query = searchEl.value; renderList(); });

  // Clicking the dimmed backdrop closes a modal (the dialog itself is the target there)
  [memberModal, logModal, confirmModal].forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });

  // Close the settings menu when clicking elsewhere (same as the other admin pages)
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  renderAll();
})();
