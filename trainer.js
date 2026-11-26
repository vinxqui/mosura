/* Trainer pages: dashboard, calendar, my schedule, member progress, availability.
 * Each page sets <body data-page="..."> and only its own section runs.
 *
 * The trainer's classes always come from their specialization (trainer-availability.js),
 * so a coach only ever sees classes they are trained to teach.
 * Replace the SAMPLE DATA below with real data from your backend when it's ready.
 */
(function () {
  'use strict';

  var AV = window.GTG_AVAILABILITY;
  var COACH = 'Coach Irene';                       // the signed-in trainer (trainer1@gmail.com)
  var FIRST_NAME = 'Irene';
  var SPECS = (AV.specializations[COACH] || []).slice();
  var LABEL = AV.classLabels;
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MAX_CLASSES_PER_DAY = 5;
  var today = new Date();
  var page = document.body.getAttribute('data-page');

  function $(id) { return document.getElementById(id); }
  function esc(t) { var e = document.createElement('span'); e.textContent = t; return e.innerHTML; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }
  function mins(label) {
    var m = /^(\d+):(\d+) (AM|PM)$/.exec(label);
    return (parseInt(m[1], 10) % 12 + (m[3] === 'PM' ? 12 : 0)) * 60 + parseInt(m[2], 10);
  }
  function toast(msg) { if (window.GTG_toast) window.GTG_toast(msg); }
  function tagHtml(cls) { return '<span class="tag tag--' + cls + '">' + esc(LABEL[cls] || cls) + '</span>'; }
  function store(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  /* ---------- SAMPLE DATA: weekly class template (0 = Sunday ... 6 = Saturday) ---------- */
  var WEEKLY_SCHEDULE = {
    0: [],
    1: [{ cls: 'yoga',      time: '8:00 AM',  difficulty: 'Advanced',     filled: 12, capacity: 20 },
        { cls: 'zumba',     time: '9:00 AM',  difficulty: 'Advanced',     filled: 16, capacity: 25 },
        { cls: 'taekwondo', time: '1:00 PM',  difficulty: 'Intermediate', filled: 20, capacity: 25 }],
    2: [{ cls: 'zumba',     time: '9:00 AM',  difficulty: 'Beginner',     filled: 14, capacity: 25 },
        { cls: 'yoga',      time: '5:00 PM',  difficulty: 'Beginner',     filled: 9,  capacity: 20 }],
    3: [{ cls: 'yoga',      time: '8:00 AM',  difficulty: 'Intermediate', filled: 10, capacity: 20 },
        { cls: 'taekwondo', time: '1:00 PM',  difficulty: 'Intermediate', filled: 20, capacity: 25 },
        { cls: 'zumba',     time: '5:00 PM',  difficulty: 'Advanced',     filled: 18, capacity: 25 }],
    4: [{ cls: 'taekwondo', time: '10:00 AM', difficulty: 'Beginner',     filled: 3,  capacity: 5  },
        { cls: 'zumba',     time: '5:00 PM',  difficulty: 'Intermediate', filled: 15, capacity: 25 }],
    5: [{ cls: 'yoga',      time: '8:00 AM',  difficulty: 'Advanced',     filled: 12, capacity: 20 },
        { cls: 'zumba',     time: '9:00 AM',  difficulty: 'Advanced',     filled: 16, capacity: 25 },
        { cls: 'taekwondo', time: '1:00 PM',  difficulty: 'Intermediate', filled: 20, capacity: 25 }],
    6: [{ cls: 'zumba',     time: '10:00 AM', difficulty: 'Beginner',     filled: 22, capacity: 30 },
        { cls: 'yoga',      time: '1:00 PM',  difficulty: 'Beginner',     filled: 8,  capacity: 15 }]
  };

  // Classes held on a date: only the trainer's specialization, and none on a day off or a non-working weekday.
  function sessionsFor(y, m, d) {
    var dow = new Date(y, m, d).getDay();
    if (AV.daysOffOf(COACH).indexOf(iso(y, m, d)) !== -1) return [];
    var works = AV.shiftsOf(COACH).some(function (sh) { return sh.days.indexOf(dow) !== -1; });
    if (!works) return [];
    return (WEEKLY_SCHEDULE[dow] || []).filter(function (s) { return SPECS.indexOf(s.cls) !== -1; });
  }

  /* ---------- Month calendar (used on every page that has one) ---------- */
  function initCalendar(o) {
    var year = today.getFullYear();
    var selected = null;
    o.select.innerHTML = MONTHS.map(function (n, i) {
      return '<option value="' + i + '"' + (i === today.getMonth() ? ' selected' : '') + '>' + n + '</option>';
    }).join('');
    o.year.textContent = year;

    function addCell(day, month) {
      var cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.appendChild(document.createTextNode(day));
        var list = sessionsFor(year, month, day);
        if (o.dots && list.length) {
          var dots = document.createElement('span');
          dots.className = 'class-dots';
          dots.setAttribute('aria-hidden', 'true');
          list.forEach(function (s) {
            var dot = document.createElement('span');
            dot.className = 'class-dot class-dot--' + s.cls;
            dots.appendChild(dot);
          });
          cell.appendChild(dots);
        }
        var date = new Date(year, month, day);
        var startOfToday = new Date(year, today.getMonth(), today.getDate());
        if (o.attended && list.length && date < startOfToday) cell.classList.add('is-attended');
        if (date.getTime() === startOfToday.getTime()) cell.classList.add('is-today');
        cell.setAttribute('aria-label', MONTHS[month] + ' ' + day + ', ' + year +
          (list.length ? ', ' + list.length + (list.length === 1 ? ' class' : ' classes') : ', no classes'));
        cell.addEventListener('click', function () { pick(cell, month, day); });
      }
      o.calendar.appendChild(cell);
      return cell;
    }

    function render(month) {
      o.calendar.querySelectorAll('.big-calendar__cell').forEach(function (c) { c.remove(); });
      o.calendar.setAttribute('aria-label', MONTHS[month] + ' ' + year);
      selected = null;
      var first = new Date(year, month, 1).getDay();
      var total = new Date(year, month + 1, 0).getDate();
      var cells = {};
      for (var i = 0; i < first; i++) addCell(null, month);
      for (var d = 1; d <= total; d++) cells[d] = addCell(d, month);
      var trailing = (7 - ((first + total) % 7)) % 7;
      for (var j = 0; j < trailing; j++) addCell(null, month);
      return cells;
    }

    function pick(cell, month, day) {
      if (selected) selected.classList.remove('is-selected');
      cell.classList.add('is-selected');
      selected = cell;
      if (o.onSelect) o.onSelect(year, month, day);
    }

    function show(month) {
      var cells = render(month);
      if (month === today.getMonth()) pick(cells[today.getDate()], month, today.getDate());
      else if (o.onClear) o.onClear();
    }

    o.select.addEventListener('change', function () { show(parseInt(o.select.value, 10)); });
    show(today.getMonth());
  }

  /* ---------- Assigned classes = specialization ---------- */
  function renderAssignedTags() {
    var el = $('assigned-tags');
    if (el) el.innerHTML = SPECS.map(function (c) { return '<li class="tag tag--' + c + '">' + esc(LABEL[c]) + '</li>'; }).join('');
  }

  /* =====================================================
     Dashboard
     ===================================================== */
  function initDashboard() {
    var h = today.getHours();
    $('greeting').textContent = (h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening') + ', ' + FIRST_NAME + '!';

    var list = sessionsFor(today.getFullYear(), today.getMonth(), today.getDate());
    var nowMin = h * 60 + today.getMinutes();
    var live = list.filter(function (s) { return mins(s.time) <= nowMin && nowMin < mins(s.time) + 60; })[0];
    var next = list.filter(function (s) { return mins(s.time) > nowMin; })[0];

    // On-going class
    var ongoing = $('ongoing');
    if (live) {
      ongoing.innerHTML = '<span class="class-pill">' + esc((LABEL[live.cls] || live.cls).toUpperCase()) + '</span>' +
        '<p class="ongoing-note">' + live.filled + '/' + live.capacity + ' members booked</p>';
    } else {
      ongoing.innerHTML = '<p class="ongoing-empty">' + (list.length ? 'No class right now.' : 'No classes today. Enjoy your day off!') + '</p>' +
        (next ? '<p class="ongoing-note">Next: ' + esc(LABEL[next.cls]) + ' at ' + esc(next.time) + '</p>' : '');
    }

    // Today's classes
    var todayEl = $('today-list');
    if (!list.length) {
      todayEl.outerHTML = '<p class="ongoing-empty">Nothing scheduled today.</p>';
    } else {
      todayEl.innerHTML = list.map(function (s) {
        var start = mins(s.time);
        var state = nowMin >= start + 60 ? 'is-done' : (nowMin >= start ? 'is-now' : '');
        var status = state === 'is-done' ? 'Done' : state === 'is-now' ? 'Now' : 'Upcoming';
        return '<li class="today-item ' + state + '">' +
          '<span class="today-item__time">' + esc(s.time) + '</span>' +
          '<span><strong>' + esc(LABEL[s.cls]) + '</strong><br><span class="today-item__meta">' + esc(s.difficulty) + ' · ' + s.filled + '/' + s.capacity + ' booked</span></span>' +
          '<span class="today-item__status">' + status + '</span></li>';
      }).join('');
    }

    // Check-in / check-out log filter
    var filter = $('role-filter');
    var rows = document.querySelectorAll('#checkin-table tbody tr');
    var empty = $('checkin-empty');
    function applyFilter() {
      var role = filter.value, shown = 0;
      rows.forEach(function (row) {
        var ok = role === 'all' || row.getAttribute('data-role') === role;
        row.classList.toggle('is-hidden', !ok);
        row.classList.remove('is-striped');
        if (ok) { if (shown % 2 === 1) row.classList.add('is-striped'); shown++; }
      });
      empty.hidden = shown !== 0;
    }
    filter.addEventListener('change', applyFilter);
    applyFilter();

    renderAssignedTags();
    initCalendar({ calendar: $('dash-big-calendar'), select: $('dash-month-select'), year: $('dash-calendar-year'), attended: true });
  }

  /* =====================================================
     Calendar + My Schedule
     ===================================================== */
  function sessionCard(s) {
    var pct = Math.round((s.filled / s.capacity) * 100);
    var left = s.capacity - s.filled;
    return '<details class="session-card"><summary>' +
      '<h3 class="session-card__title">' + esc(s.time) + ' – ' + esc(LABEL[s.cls]) + '</h3>' +
      '<div class="session-card__meta">Difficulty: ' + esc(s.difficulty) + '</div>' +
      '<div class="session-card__slots"><span class="session-card__meta">' + s.filled + '/' + s.capacity + ' slots filled</span>' +
      '<div class="session-card__bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + s.capacity + '" aria-valuenow="' + s.filled + '"><span style="width:' + pct + '%"></span></div></div>' +
      '<span class="session-card__caret" aria-hidden="true"></span></summary>' +
      '<p class="session-card__details">' + left + (left === 1 ? ' slot' : ' slots') + ' left · 1 hour</p></details>';
  }

  function initCalendarPage() {
    var title = $('schedule-title'), count = $('schedule-count'), body = $('session-list');
    $('legend-tags').innerHTML = SPECS.map(tagHtml).join('');
    initCalendar({
      calendar: $('big-calendar'), select: $('month-select'), year: $('calendar-year'), dots: true,
      onSelect: function (y, m, d) {
        var list = sessionsFor(y, m, d);
        var isToday = new Date(y, m, d).toDateString() === today.toDateString();
        title.textContent = isToday ? "Today's Schedule" : MONTHS[m] + ' ' + d + ' Schedule';
        count.textContent = list.length + '/' + MAX_CLASSES_PER_DAY + ' Class';
        body.innerHTML = list.length ? list.map(sessionCard).join('') : '<p class="schedule-empty">No classes scheduled for this day.</p>';
      },
      onClear: function () {
        title.textContent = 'Schedule';
        count.textContent = '';
        body.innerHTML = '<p class="schedule-empty">Select a date to see your classes.</p>';
      }
    });
  }

  /* =====================================================
     Member Progress
     ===================================================== */
  // SAMPLE DATA
  var MEMBERS = [
    { name: 'Rafaela Madriaga', cls: 'yoga',      level: 'Intermediate', attended: 7,  total: 12, last: 'Nov 13' },
    { name: 'Francis Madriaga', cls: 'taekwondo', level: 'Advanced',     attended: 10, total: 12, last: 'Nov 14' },
    { name: 'Christoph Estenilo', cls: 'zumba',   level: 'Beginner',     attended: 3,  total: 8,  last: 'Nov 12' },
    { name: 'Avril Felix',      cls: 'yoga',      level: 'Beginner',     attended: 5,  total: 8,  last: 'Nov 14' },
    { name: 'RJ Nalda',         cls: 'taekwondo', level: 'Intermediate', attended: 6,  total: 12, last: 'Nov 11' },
    { name: 'Jasmine Mosura',   cls: 'zumba',     level: 'Advanced',     attended: 9,  total: 10, last: 'Nov 14' },
    { name: 'Eugene Balando',   cls: 'gym',       level: 'Intermediate', attended: 4,  total: 12, last: 'Nov 10' },
    { name: 'Kim Dela Cruz',    cls: 'boxing',    level: 'Beginner',     attended: 2,  total: 8,  last: 'Nov 9' },   // not this coach's class: never shown
    { name: 'Marco Reyes',      cls: 'muaythai',  level: 'Advanced',     attended: 8,  total: 12, last: 'Nov 13' }   // not this coach's class: never shown
  ];

  function initProgress() {
    var classSel = $('progress-class');
    var search = $('progress-search');
    var grid = $('progress-grid');
    var logged = store('gtg_member_progress', {});     // extra sessions the trainer logged, by member name

    classSel.innerHTML = '<option value="all">All my classes</option>' +
      SPECS.map(function (c) { return '<option value="' + c + '">' + esc(LABEL[c]) + '</option>'; }).join('');

    function render() {
      var q = search.value.trim().toLowerCase();
      var list = MEMBERS.filter(function (m) {
        return SPECS.indexOf(m.cls) !== -1 &&
          (classSel.value === 'all' || m.cls === classSel.value) &&
          (!q || m.name.toLowerCase().indexOf(q) !== -1);
      });
      if (!list.length) { grid.innerHTML = '<p class="empty-note">No members match.</p>'; return; }
      grid.innerHTML = list.map(function (m) {
        var done = Math.min(m.total, m.attended + (logged[m.name] || 0));
        var pct = Math.round(done / m.total * 100);
        return '<article class="card member-card">' +
          '<div class="member-card__top"><h2 class="member-card__name">' + esc(m.name) + '</h2>' + tagHtml(m.cls) + '</div>' +
          '<p class="member-card__meta">' + esc(m.level) + ' · last attended ' + esc(m.last) + '</p>' +
          '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="' + m.total + '" aria-valuenow="' + done + '" aria-label="' + done + ' of ' + m.total + ' sessions"><span style="width:' + pct + '%"></span></div>' +
          '<div class="member-card__row"><span>' + done + '/' + m.total + ' sessions (' + pct + '%)</span>' +
          '<button type="button" class="btn-small" data-member="' + esc(m.name) + '"' + (done >= m.total ? ' disabled' : '') + '>+ Log session</button></div>' +
          '</article>';
      }).join('');
    }

    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-member]');
      if (!btn) return;
      var name = btn.getAttribute('data-member');
      logged[name] = (logged[name] || 0) + 1;
      save('gtg_member_progress', logged);
      render();
      toast('Session logged for ' + name);
    });
    classSel.addEventListener('change', render);
    search.addEventListener('input', render);
    render();
  }

  /* =====================================================
     Trainer Availability
     ===================================================== */
  function initAvailability() {
    var slots = AV.slots;
    var weekEl = $('week-rows');
    var errEl = $('avail-error');

    function shiftForDay(shifts, d) {
      return shifts.filter(function (sh) { return sh.days.indexOf(d) !== -1; })[0] || null;
    }
    function options(selected) {
      return slots.map(function (t) { return '<option' + (t === selected ? ' selected' : '') + '>' + t + '</option>'; }).join('');
    }
    function drawWeek(shifts) {
      weekEl.innerHTML = DAY_NAMES.map(function (name, d) {
        var sh = shiftForDay(shifts, d);
        var from = sh ? sh.from : '8:00 AM', to = sh ? sh.to : '3:00 PM';
        return '<div class="week-row" data-day="' + d + '">' +
          '<label class="week-row__day"><input type="checkbox"' + (sh ? ' checked' : '') + ' /> ' + name + '</label>' +
          '<select class="select-native" aria-label="' + name + ' first class"' + (sh ? '' : ' disabled') + '>' + options(from) + '</select>' +
          '<select class="select-native" aria-label="' + name + ' last class"' + (sh ? '' : ' disabled') + '>' + options(to) + '</select>' +
          '</div>';
      }).join('');
    }
    weekEl.addEventListener('change', function (e) {
      if (e.target.type !== 'checkbox') return;
      e.target.closest('.week-row').querySelectorAll('select').forEach(function (s) { s.disabled = !e.target.checked; });
    });

    $('save-week').addEventListener('click', function () {
      var shifts = [], bad = '';
      weekEl.querySelectorAll('.week-row').forEach(function (row) {
        if (!row.querySelector('input').checked) return;
        var sel = row.querySelectorAll('select');
        var d = parseInt(row.getAttribute('data-day'), 10);
        if (slots.indexOf(sel[0].value) > slots.indexOf(sel[1].value)) bad = DAY_NAMES[d] + ': the first class must be before the last one.';
        shifts.push({ days: [d], from: sel[0].value, to: sel[1].value });
      });
      if (bad) { errEl.textContent = bad; errEl.hidden = false; return; }
      errEl.hidden = true;
      var all = store('gtg_trainer_shifts', {});
      all[COACH] = shifts;
      save('gtg_trainer_shifts', all);
      toast('Availability saved. Members will only see these days and times.');
    });

    $('reset-week').addEventListener('click', function () {
      var all = store('gtg_trainer_shifts', {});
      delete all[COACH];
      save('gtg_trainer_shifts', all);
      drawWeek(AV.defaultShiftsOf(COACH));
      errEl.hidden = true;
      toast('Back to the default schedule');
    });

    // Days off
    var offList = $('dayoff-list');
    var dateInput = $('dayoff-date');
    var daysOff = (store('gtg_trainer_daysoff', {})[COACH] || AV.daysOffOf(COACH)).slice();
    dateInput.min = iso(today.getFullYear(), today.getMonth(), today.getDate());

    function niceDate(s) {
      var p = s.split('-');
      var d = new Date(+p[0], +p[1] - 1, +p[2]);
      return DAY_NAMES[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
    }
    function persistOff() {
      var all = store('gtg_trainer_daysoff', {});
      all[COACH] = daysOff;
      save('gtg_trainer_daysoff', all);
    }
    function drawOff() {
      daysOff.sort();
      offList.innerHTML = daysOff.length
        ? daysOff.map(function (s) {
            return '<li class="chip"><span>' + esc(niceDate(s)) + '</span><button type="button" data-remove="' + s + '" aria-label="Remove ' + esc(niceDate(s)) + '">Remove</button></li>';
          }).join('')
        : '<li class="empty-note">No days off scheduled.</li>';
    }
    $('add-dayoff').addEventListener('click', function () {
      var v = dateInput.value;
      if (!v) return;
      if (daysOff.indexOf(v) === -1) daysOff.push(v);
      persistOff(); drawOff(); dateInput.value = '';
      toast('Day off added');
    });
    offList.addEventListener('click', function (e) {
      var b = e.target.closest('[data-remove]');
      if (!b) return;
      daysOff = daysOff.filter(function (s) { return s !== b.getAttribute('data-remove'); });
      persistOff(); drawOff();
    });

    $('spec-tags').innerHTML = SPECS.map(tagHtml).join('');
    drawWeek(AV.shiftsOf(COACH));
    drawOff();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (page === 'dashboard') initDashboard();
    else if (page === 'calendar' || page === 'myschedule') initCalendarPage();
    else if (page === 'progress') initProgress();
    else if (page === 'availability') initAvailability();
  });
})();
