/* GTG Fitness – Trainer Management (admin)
   - Cards are all the same size (same look as the member page)
   - The arrow on a card extends it to show the trainer's details
   - "Edit details" and the dashed "+" panel open admintrainerprofile.html
   Data is saved in localStorage under "gtg_trainers" so other pages can read it later. */
(function () {
  'use strict';

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

  var grid = document.getElementById('tm-grid');
  var emptyMsg = document.getElementById('tm-empty');
  var filterSel = document.getElementById('category-filter');

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

  function mk(id, name, photo, bio, rating, cats, days, start, end) {
    return {
      id: id, name: name, photo: photo, bio: bio, rating: rating, categories: cats,
      email: '', phone: '', weekly: days, shift: { start: start, end: end }, overrides: {}
    };
  }

  function seed() {
    var u = 'https://images.unsplash.com/';
    var q = '?auto=format&fit=crop&w=400&q=80';
    return [
      mk('t1', 'Coach Irene', u + 'photo-1594381898411-846e7d193883' + q,
        'Hi! I\'m Coach Irene. I mix strength, flexibility and fun so every session leaves you stronger.',
        5, ['Yoga', 'Zumba', 'Taekwondo', 'Gym'], [1, 2, 3, 4, 5, 6], '08:00', '17:00'),
      mk('t2', 'Coach Ken', u + 'photo-1568602471122-7832951cc4c5' + q,
        'Hi! I\'m Coach Ken. Expect sharp technique, solid conditioning and a lot of encouragement.',
        4, ['Muay Thai', 'Taekwondo', 'Gym'], [1, 2, 3, 4, 5], '09:00', '18:00'),
      mk('t3', 'Coach Ryan', u + 'photo-1567013127542-490d757e51fc' + q,
        'Hi! I\'m Coach Ryan, your chill but driven coach guiding you with smart training and steady progress. Fitness made rewarding and simple!',
        3, ['Yoga', 'Boxing', 'Zumba', 'Gym'], [1, 3, 4, 5, 6], '10:00', '19:00'),
      mk('t4', 'Coach Tiana', u + 'photo-1573496359142-b8d87734a5a2' + q,
        'Hi! I\'m Coach Tiana, your bold and unstoppable coach! With a mix of grit, glam and high-energy moves, I\'ll keep you pushing past limits while having fun.',
        4, ['Muay Thai', 'Yoga', 'Gym'], [0, 2, 3, 4, 5], '07:00', '16:00'),
      mk('t5', 'Coach Vince', u + 'photo-1583468982228-19f19164aee2' + q,
        'Hi! I\'m Coach Vince. Whether you\'re new or experienced, I\'ll build a plan that fits your pace.',
        4, ['Yoga', 'Zumba', 'Taekwondo', 'Gym'], [1, 2, 3, 4, 5], '08:00', '17:00'),
      mk('t6', 'Coach Kyroll', u + 'photo-1519085360753-af0119f7cbe7' + q,
        'Hi! I\'m Coach Kyroll. I focus on power, speed and discipline for striking sports.',
        5, ['Taekwondo', 'Boxing', 'Gym'], [2, 3, 4, 5, 6], '12:00', '21:00')
    ];
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) { /* fall through to seed data */ }
    var fresh = seed();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (e2) { /* ignore */ }
    return fresh;   // saved once so the profile page can find each trainer by id
  }

  var trainers = load();
  var today = new Date();
  var state = { openId: null, filter: 'all categories' };

  /* ---------- availability ---------- */

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

  /* ---------- rendering ---------- */

  function matchesFilter(t) {
    if (state.filter === 'all categories') return true;
    return t.categories.some(function (c) { return c.toLowerCase() === state.filter; });
  }

  function render() {
    clear(grid);
    var shown = 0;
    trainers.forEach(function (t) {
      if (!matchesFilter(t)) return;
      grid.appendChild(buildCard(t));
      shown++;
    });
    grid.appendChild(buildAddCard());
    emptyMsg.hidden = shown !== 0 || state.filter === 'all categories';
  }

  // Dashed "+" panel, same size as a trainer panel; opens the add-trainer page
  function buildAddCard() {
    return h('a', {
      class: 'trainer-card tm-card tm-add-card', href: 'admintrainerprofile.html?new=1',
      'aria-label': 'Add a new trainer'
    }, [h('span', { class: 'tm-add-card__plus', text: '+', 'aria-hidden': 'true' })]);
  }

  function chevron() {
    var s = h('span', { 'aria-hidden': 'true' });
    s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"></path></svg>';
    return s;
  }

  function tagList(cats) {
    return h('ul', { class: 'tag-list' }, cats.map(function (c) {
      return h('li', { class: catClass(c), text: c });
    }));
  }

  function stars(n) {
    var wrap = h('span', { class: 'tm-stars', role: 'img', 'aria-label': n + ' out of 5 stars' });
    for (var i = 1; i <= 5; i++) wrap.appendChild(h('span', { class: i <= n ? '' : 'off', text: '\u2605' }));
    return wrap;
  }

  function buildCard(t) {
    var isOpen = state.openId === t.id;
    var card = h('article', {
      class: 'trainer-card tm-card' + (isOpen ? ' is-open' : ''),
      'data-id': t.id
    });
    var row = h('div', { class: 'tm-card__row' });

    var photo = h('img', {
      class: 'trainer-card__photo', src: t.photo || PLACEHOLDER, alt: (t.name || 'Trainer') + ' portrait',
      onerror: function () { this.onerror = null; this.src = PLACEHOLDER; }
    });
    var toggle = h('button', {
      type: 'button', class: 'tm-card__toggle',
      'aria-expanded': isOpen ? 'true' : 'false',
      'aria-label': (isOpen ? 'Hide details for ' : 'Show details for ') + (t.name || 'trainer'),
      onclick: function () { toggleCard(t); }
    }, [chevron()]);

    // the arrow lives inside the photo wrapper so it always sits right beside THIS card's photo
    row.appendChild(h('div', { class: 'tm-card__main' }, [
      h('h2', { class: 'trainer-card__name', text: t.name || 'New trainer' }),
      h('div', { class: 'tm-card__photo-wrap' }, [photo, toggle]),
      tagList(t.categories)
    ]));
    if (isOpen) row.appendChild(buildDetailsPanel(t));
    card.appendChild(row);
    return card;
  }

  function toggleCard(t) {
    state.openId = state.openId === t.id ? null : t.id;
    render();
  }

  function buildDetailsPanel(t) {
    var on = isOn(t, dateKey(today));
    var days = t.weekly.length === 7 ? 'Every day'
      : (t.weekly.length ? t.weekly.slice().sort().map(function (d) { return DAY_NAMES[d]; }).join(', ') : 'No set days');

    var facts = h('dl', { class: 'tm-facts' }, [
      h('dt', { text: 'Shift' }), h('dd', { text: fmtTime(t.shift.start) + ' \u2013 ' + fmtTime(t.shift.end) }),
      h('dt', { text: 'Works' }), h('dd', { text: days }),
      h('dt', { text: 'Email' }), h('dd', { text: t.email || '\u2014' }),
      h('dt', { text: 'Phone' }), h('dd', { text: t.phone || '\u2014' })
    ]);

    return h('div', { class: 'tm-panel tm-details' }, [
      h('div', { class: 'tm-details__top' }, [
        stars(t.rating || 0),
        h('span', { class: 'tm-chip ' + (on ? 'tm-chip--on' : 'tm-chip--off'), text: on ? 'On gym today' : 'Not in gym today' })
      ]),
      h('p', { class: 'tm-bio', text: t.bio || 'No bio yet.' }),
      facts,
      h('div', { class: 'tm-details__actions' }, [
        h('a', {
          class: 'tm-btn tm-btn--primary',
          href: 'admintrainerprofile.html?id=' + encodeURIComponent(t.id)
        }, ['Edit details'])
      ])
    ]);
  }

  /* ---------- page controls ---------- */

  filterSel.addEventListener('change', function () {
    state.filter = filterSel.value.trim().toLowerCase();
    render();
  });

  // Close the settings menu when clicking elsewhere (same as the other pages)
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  render();
})();