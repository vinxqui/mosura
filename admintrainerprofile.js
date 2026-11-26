/* GTG Fitness – Trainer profile (admin)
   Opened from Trainer Management:
     admintrainerprofile.html?id=<trainer id>   edit an existing trainer
     admintrainerprofile.html?new=1             add a new trainer
   "Back" returns to Trainer Management without saving.
   Data is saved in localStorage under "gtg_trainers" (same key as Trainer Management). */
(function () {
  'use strict';

  var BACK = 'admintrainermanagement.html';
  var STORAGE_KEY = 'gtg_trainers';
  var CATEGORIES = ['Yoga', 'Zumba', 'Taekwondo', 'Muay Thai', 'Boxing', 'Gym'];
  var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];
  var FIRST_HOUR = 5;   // schedule strip shows 5 AM ...
  var LAST_HOUR = 21;   // ... to 10 PM
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">' +
    '<rect width="400" height="400" fill="#e5e7eb"/>' +
    '<circle cx="200" cy="155" r="70" fill="#9ca3af"/>' +
    '<path d="M60 400c0-95 62-150 140-150s140 55 140 150z" fill="#9ca3af"/></svg>');

  var root = document.getElementById('tp-root');

  /* ---------- small helpers ---------- */

  // Builds elements without innerHTML, so typed text can never inject markup.
  function h(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      var v = props[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k === 'value' || k === 'checked') n[k] = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dateKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function toMin(t) { var p = t.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function fmtTime(t) {
    var p = t.split(':'), hr = +p[0];
    return (((hr + 11) % 12) + 1) + ':' + p[1] + ' ' + (hr < 12 ? 'AM' : 'PM');
  }
  function fmtHour(hr) { return (((hr + 11) % 12) + 1) + (hr < 12 ? ' AM' : ' PM'); }
  function catClass(c) { return 'tag tag--' + c.toLowerCase().replace(/\s+/g, ''); }

  /* ---------- data ---------- */

  function load() {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (Array.isArray(list)) return list;
    } catch (e) { /* ignore */ }
    return [];
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trainers));
      return true;
    } catch (e) {
      window.alert('Could not save. The browser storage may be full; try a smaller photo.');
      return false;
    }
  }

  var trainers = load();
  var params = new URLSearchParams(window.location.search);
  var isNew = params.get('new') === '1';
  var original = isNew ? null : trainers.filter(function (x) { return x.id === params.get('id'); })[0];
  var today = new Date();

  if (!isNew && !original) {
    root.appendChild(h('p', { class: 'trainers-empty', text: 'That trainer could not be found.' }));
    return;
  }

  // Work on a copy so nothing changes until "Save changes" is pressed
  var draft = isNew ? {
    id: 't' + Date.now(), name: '', photo: '', bio: '', rating: 5, categories: [],
    email: '', phone: '', weekly: [1, 2, 3, 4, 5], shift: { start: '09:00', end: '17:00' }, overrides: {}
  } : JSON.parse(JSON.stringify(original));
  if (!draft.overrides) draft.overrides = {};

  var state = {
    month: new Date(today.getFullYear(), today.getMonth(), 1),
    selected: dateKey(today)
  };

  /* ---------- availability (calendar + schedule) ---------- */

  function weeklyOn(t, key) { return t.weekly.indexOf(parseKey(key).getDay()) !== -1; }
  function isOn(t, key) {
    if (t.overrides && Object.prototype.hasOwnProperty.call(t.overrides, key)) return t.overrides[key] === 'on';
    return weeklyOn(t, key);
  }
  function toggleDate(t, key) {
    var next = !isOn(t, key);
    t.overrides = t.overrides || {};
    if (next === weeklyOn(t, key)) delete t.overrides[key];   // back to the normal weekly pattern
    else t.overrides[key] = next ? 'on' : 'off';
  }

  /* ---------- page ---------- */

  var title = document.getElementById('tp-title');
  title.textContent = isNew ? 'Add Trainer' : 'Edit Trainer Profile';
  document.title = title.textContent + ' \u00B7 GTG Fitness';

  var availCard = h('section', { class: 'tp-card', 'aria-label': 'Availability' }, []);
  root.appendChild(h('div', { class: 'tp-layout' }, [buildForm(), availCard]));
  availCard.appendChild(buildManagePanel(draft));

  function buildManagePanel(t) {
    var cal = h('div', { class: 'tm-cal' });
    var sched = h('div', { class: 'tm-sched' });
    var panel = h('div', { class: 'tm-panel tm-manage' }, [
      h('h3', { class: 'tm-panel__title', text: 'Availability' }),
      cal,
      h('div', { class: 'tm-legend' }, [
        h('span', { class: 'tm-legend__item tm-legend__item--on', text: 'On gym' }),
        h('span', { class: 'tm-legend__item tm-legend__item--off', text: 'Not in gym' }),
        h('span', { class: 'tm-legend__hint', text: 'Click a date to switch it.' })
      ]),
      h('h3', { class: 'tm-panel__title', text: 'Schedule' }),
      sched
    ]);
    drawCalendar(t, cal, sched);
    return panel;
  }

  function drawCalendar(t, calEl, schedEl) {
    clear(calEl);
    var y = state.month.getFullYear(), m = state.month.getMonth();
    var todayKey = dateKey(today);

    function shift(delta) {
      state.month = new Date(y, m + delta, 1);
      drawCalendar(t, calEl, schedEl);
    }

    calEl.appendChild(h('div', { class: 'tm-cal__nav' }, [
      h('button', { type: 'button', 'aria-label': 'Previous month', onclick: function () { shift(-1); }, text: '\u2039' }),
      h('strong', { text: MONTHS[m] + ' ' + y }),
      h('button', { type: 'button', 'aria-label': 'Next month', onclick: function () { shift(1); }, text: '\u203A' })
    ]));

    var g = h('div', { class: 'tm-cal__grid' });
    DAY_NAMES.forEach(function (d) { g.appendChild(h('span', { class: 'tm-cal__dow', text: d })); });
    for (var b = 0; b < new Date(y, m, 1).getDay(); b++) g.appendChild(h('span', { 'aria-hidden': 'true' }));

    var total = new Date(y, m + 1, 0).getDate();
    for (var d = 1; d <= total; d++) {
      (function (day) {
        var key = y + '-' + pad(m + 1) + '-' + pad(day);
        var on = isOn(t, key);
        var cls = 'tm-cal__day ' + (on ? 'is-on' : 'is-off') +
          (key === state.selected ? ' is-selected' : '') + (key === todayKey ? ' is-today' : '');
        g.appendChild(h('button', {
          type: 'button', class: cls,
          'aria-label': MONTHS[m] + ' ' + day + ', ' + (on ? 'on gym' : 'not in gym') + '. Click to switch.',
          onclick: function () {
            toggleDate(t, key);
            state.selected = key;
            drawCalendar(t, calEl, schedEl);
          }
        }, [h('span', { class: 'tm-cal__num', text: String(day) })]));
      })(d);
    }
    calEl.appendChild(g);
    drawSchedule(t, schedEl);
  }

  function drawSchedule(t, el) {
    clear(el);
    var on = isOn(t, state.selected);
    var label = parseKey(state.selected).toLocaleDateString('en-PH',
      { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    var startMin = toMin(t.shift.start), endMin = toMin(t.shift.end);

    el.appendChild(h('div', { class: 'tm-sched__head' }, [
      h('strong', { text: label }),
      h('span', {
        class: 'tm-chip ' + (on ? 'tm-chip--on' : 'tm-chip--off'),
        text: on ? 'On gym \u00B7 ' + fmtTime(t.shift.start) + ' \u2013 ' + fmtTime(t.shift.end) : 'Not in gym'
      })
    ]));

    var hours = h('div', { class: 'tm-sched__hours' });
    for (var hr = FIRST_HOUR; hr <= LAST_HOUR; hr++) {
      var working = on && hr * 60 >= startMin && (hr + 1) * 60 <= endMin;
      hours.appendChild(h('span', { class: 'tm-hour ' + (working ? 'is-on' : 'is-off'), text: fmtHour(hr) }));
    }
    el.appendChild(hours);
  }

  /* ---------- profile form ---------- */

  function field(labelText, input, wide) {
    return h('div', { class: 'tm-field' + (wide ? ' tm-field--wide' : '') }, [
      h('label', { for: input.id, text: labelText }), input
    ]);
  }

  function pick(name, value, checked) {
    var input = h('input', { type: 'checkbox', name: name, value: value, checked: checked });
    return h('label', { class: 'tm-pick' }, [input, h('span', { text: value })]);
  }

  function buildForm() {
    var uid = 'tp-';
    var t = draft;
    var draftPhoto = t.photo || '';

    var nameIn = h('input', { class: 'tm-input', id: uid + 'name', type: 'text', maxlength: '40', value: t.name, placeholder: 'e.g. Coach Alex' });
    var urlIn = h('input', {
      class: 'tm-input', id: uid + 'photo', type: 'text',
      value: /^https?:/i.test(draftPhoto) ? draftPhoto : '', placeholder: 'Paste an image link, or upload'
    });
    var fileIn = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', id: uid + 'file' });
    var preview = h('img', { class: 'tp-preview', src: draftPhoto || PLACEHOLDER, alt: 'Photo preview',
      onerror: function () { this.onerror = null; this.src = PLACEHOLDER; } });
    var bioIn = h('textarea', { class: 'tm-input', id: uid + 'bio', rows: '4', maxlength: '260', value: t.bio, placeholder: 'A short intro members will see' });
    var ratingIn = h('select', { class: 'tm-input', id: uid + 'rating' }, [5, 4, 3, 2, 1].map(function (n) {
      var o = h('option', { value: String(n), text: n + (n === 1 ? ' star' : ' stars') });
      if (n === (t.rating || 5)) o.selected = true;
      return o;
    }));
    var emailIn = h('input', { class: 'tm-input', id: uid + 'email', type: 'email', value: t.email, placeholder: 'name@gtgfitness.com' });
    var phoneIn = h('input', { class: 'tm-input', id: uid + 'phone', type: 'tel', value: t.phone, placeholder: '09XX XXX XXXX' });
    var startIn = h('input', { class: 'tm-input', id: uid + 'start', type: 'time', value: t.shift.start });
    var endIn = h('input', { class: 'tm-input', id: uid + 'end', type: 'time', value: t.shift.end });

    var catBox = h('div', { class: 'tm-chips', role: 'group', 'aria-label': 'Specialties' }, CATEGORIES.map(function (c) {
      return pick('cat', c, t.categories.indexOf(c) !== -1);
    }));
    var dayBox = h('div', { class: 'tm-chips', role: 'group', 'aria-label': 'Working days' }, DAY_NAMES.map(function (d, i) {
      return pick('day', d, t.weekly.indexOf(i) !== -1);
    }));
    var error = h('p', { class: 'tm-popup__error', role: 'alert', hidden: true });

    function showError(msg, focusEl) {
      error.textContent = msg;
      error.hidden = false;
      if (focusEl) focusEl.focus();
    }

    urlIn.addEventListener('input', function () {
      draftPhoto = urlIn.value.trim();
      preview.src = draftPhoto || PLACEHOLDER;
    });

    // Uploaded photos are shrunk to 400px so they fit in browser storage
    fileIn.addEventListener('change', function () {
      var file = fileIn.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { showError('Please choose an image file.'); return; }
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, 400 / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          draftPhoto = c.toDataURL('image/jpeg', 0.82);
          urlIn.value = '';
          preview.src = draftPhoto;
          error.hidden = true;
        };
        img.onerror = function () { showError('That image could not be read.'); };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });

    var uploadBtn = h('button', { type: 'button', class: 'tm-btn tm-btn--ghost', onclick: function () { fileIn.click(); } }, ['Upload photo']);

    var form = h('form', { class: 'tp-card tp-form', novalidate: true, 'aria-label': isNew ? 'Add trainer' : 'Edit ' + t.name }, [
      h('h2', { class: 'tm-panel__title', text: 'Profile' }),
      h('div', { class: 'tp-photo' }, [preview, h('div', { class: 'tp-photo__ctl' }, [urlIn, uploadBtn, fileIn])]),
      field('Name', nameIn),
      field('Rating', ratingIn),
      field('Bio', bioIn, true),
      h('div', { class: 'tm-field tm-field--wide' }, [h('span', { class: 'tm-label', text: 'Specialties' }), catBox]),
      field('Email', emailIn),
      field('Phone', phoneIn),
      field('Shift starts', startIn),
      field('Shift ends', endIn),
      h('div', { class: 'tm-field tm-field--wide' }, [h('span', { class: 'tm-label', text: 'Usual working days' }), dayBox]),
      error,
      h('div', { class: 'tp-actions' }, [
        isNew ? null : h('button', {
          type: 'button', class: 'tm-btn tm-btn--danger',
          onclick: function () {
            if (!window.confirm('Delete ' + (t.name || 'this trainer') + '? This cannot be undone.')) return;
            trainers = trainers.filter(function (x) { return x.id !== t.id; });
            if (persist()) window.location.href = BACK;
          }
        }, ['Delete trainer']),
        h('a', { class: 'tm-btn tm-btn--ghost', href: BACK }, ['Cancel']),
        h('button', { type: 'submit', class: 'tm-btn tm-btn--primary' }, [isNew ? 'Add trainer' : 'Save changes'])
      ])
    ]);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = nameIn.value.trim();
      if (!name) { showError('Please enter a name.', nameIn); return; }
      if (!startIn.value || !endIn.value) { showError('Please set the shift start and end times.', startIn); return; }
      if (endIn.value <= startIn.value) { showError('The shift must end after it starts.', endIn); return; }

      t.name = name;
      t.photo = draftPhoto;
      t.bio = bioIn.value.trim();
      t.rating = +ratingIn.value;
      t.email = emailIn.value.trim();
      t.phone = phoneIn.value.trim();
      t.shift = { start: startIn.value, end: endIn.value };
      t.categories = Array.prototype.map.call(catBox.querySelectorAll('input:checked'), function (i) { return i.value; });
      t.weekly = Array.prototype.map.call(dayBox.querySelectorAll('input:checked'), function (i) { return DAY_NAMES.indexOf(i.value); });
      if (isNew) trainers.unshift(t);
      else trainers = trainers.map(function (x) { return x.id === t.id ? t : x; });
      if (persist()) window.location.href = BACK;
    });

    return form;
  }

  // Close the settings menu when clicking elsewhere (same as the other pages)
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });
})();
