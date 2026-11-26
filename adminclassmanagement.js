/* GTG Fitness - Class Management (admin + owner)
 * Edit / Add class popup: image upload, name, description, and the Session / Month options
 * (number + price). The options of each class are kept in this browser's localStorage under
 * "gtg_class_options" until the backend is ready. */
document.addEventListener('DOMContentLoaded', function () {
  'use strict';

  var KEY = 'gtg_class_options';
  var PESO = '₱';
  var PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#e5e7eb"/>' +
    '<path d="M110 280l70-90 50 60 30-40 60 70z" fill="#9ca3af"/><circle cx="150" cy="140" r="26" fill="#9ca3af"/></svg>');

  // Starting options (the current price list), used until a class has been saved once
  var DEFAULTS = {
    gym:       { session: [[1, 100]], month: [[1, 1490], [2, 2780], [3, 3900]] },
    boxing:    { session: [[1, 400], [5, 2000], [10, 3500]], month: [] },
    muaythai:  { session: [[1, 400], [5, 2000], [10, 3500]], month: [] },
    taekwondo: { session: [[10, 3000]], month: [] },
    yoga:      { session: [[1, 300]], month: [[1, 1990]] },
    zumba:     { session: [[1, 200], [2, 350], [3, 480]], month: [] }
  };

  var modal = document.getElementById('class-modal');
  var grid = document.querySelector('.classes-grid');
  if (!modal || !grid) return;

  var panelTitle = document.getElementById('panel-title');
  var editName = document.getElementById('edit-name');
  var editDescription = document.getElementById('edit-description');
  var editImage = document.getElementById('edit-image');
  var uploadBox = document.getElementById('upload-box');
  var preview = document.getElementById('upload-preview');
  var removeImg = document.getElementById('remove-image');
  var list = document.getElementById('option-list');
  var addBtn = document.getElementById('add-option');
  var hint = document.getElementById('option-hint');
  var deleteBtn = document.getElementById('delete-class-btn');
  var errorBox = document.getElementById('cm-error');
  var tabs = { session: document.getElementById('tab-session'), month: document.getElementById('tab-month') };

  var current = null;                 // the class card being edited (null = adding a new class)
  var classKey = '';
  var kind = 'session';               // which tab is showing
  var data = { session: [], month: [] };   // [[number, price], ...] for the open class
  var imageSrc = '';                  // preview / saved image (data URL or existing url)

  /* ---------- storage ---------- */
  function readAll() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function writeAll(o) { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* storage blocked: keep going */ } }
  function slug(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* ---------- option rows ---------- */
  function unit(n) {
    return kind + (Number(n) === 1 ? '' : 's');
  }

  function renderOptions() {
    list.textContent = '';
    var rows = data[kind];
    if (!rows.length) {
      var p = document.createElement('p');
      p.className = 'cm__empty';
      p.textContent = 'No ' + kind + ' options yet. Use + Add ' + kind + ' below.';
      list.appendChild(p);
    }
    rows.forEach(function (r, i) { list.appendChild(buildRow(r, i)); });
    addBtn.textContent = '+ Add ' + kind;
    hint.textContent = 'Ex. 1 ' + kind + ' · Price: ' + PESO + (kind === 'session' ? '400' : '1,990');
    Object.keys(tabs).forEach(function (k) { tabs[k].setAttribute('aria-selected', k === kind ? 'true' : 'false'); });
  }

  function buildRow(r, i) {
    var row = document.createElement('div');
    row.className = 'cm__opt';
    row.setAttribute('data-i', i);

    var qty = document.createElement('label');
    qty.className = 'cm__qty';
    var n = document.createElement('input');
    n.type = 'number'; n.min = '1'; n.step = '1'; n.value = r[0]; n.setAttribute('data-f', 'n');
    n.setAttribute('aria-label', 'Number of ' + kind + 's');
    var u = document.createElement('span');
    u.textContent = unit(r[0]);
    qty.appendChild(n); qty.appendChild(u);

    var price = document.createElement('label');
    price.className = 'cm__price';
    var ps = document.createElement('span');
    ps.textContent = 'Price ' + PESO;
    var p = document.createElement('input');
    p.type = 'number'; p.min = '0'; p.step = '1'; p.value = r[1]; p.setAttribute('data-f', 'p');
    p.setAttribute('aria-label', 'Price in pesos');
    price.appendChild(ps); price.appendChild(p);

    var x = document.createElement('button');
    x.type = 'button'; x.className = 'cm__x'; x.setAttribute('data-del', i);
    x.setAttribute('aria-label', 'Remove this ' + kind + ' option');
    x.innerHTML = '&#10005;';

    row.appendChild(qty); row.appendChild(price); row.appendChild(x);
    return row;
  }

  list.addEventListener('input', function (e) {
    var row = e.target.closest('.cm__opt');
    if (!row) return;
    var i = Number(row.getAttribute('data-i')), f = e.target.getAttribute('data-f');
    if (f === 'n') {
      data[kind][i][0] = e.target.value;
      row.querySelector('.cm__qty span').textContent = unit(e.target.value);
    } else if (f === 'p') {
      data[kind][i][1] = e.target.value;
    }
  });
  list.addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    data[kind].splice(Number(b.getAttribute('data-del')), 1);
    renderOptions();
  });
  addBtn.addEventListener('click', function () {
    data[kind].push(['', '']);
    renderOptions();
    var inputs = list.querySelectorAll('.cm__opt:last-child input');
    if (inputs[0]) { inputs[0].focus(); list.scrollTop = list.scrollHeight; }
  });
  Object.keys(tabs).forEach(function (k) {
    tabs[k].addEventListener('click', function () { kind = k; renderOptions(); });
  });

  /* ---------- image ---------- */
  function showImage(src) {
    imageSrc = src || '';
    preview.hidden = !imageSrc;
    if (imageSrc) preview.src = imageSrc; else preview.removeAttribute('src');
    uploadBox.classList.toggle('has-image', !!imageSrc);
    removeImg.hidden = !imageSrc;
  }
  editImage.addEventListener('change', function () {
    var f = editImage.files && editImage.files[0];
    if (!f) return;
    var rd = new FileReader();
    rd.onload = function () { showImage(String(rd.result)); };
    rd.readAsDataURL(f);
  });
  removeImg.addEventListener('click', function () { editImage.value = ''; showImage(''); });

  /* ---------- arrow on each card: opens the class's prices beside it ---------- */
  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';

  function keyOf(card) {
    var b = card.querySelector('.edit-class-btn');
    return (b && b.dataset.class) || slug(card.querySelector('.class-card__title').textContent);
  }

  function fillPanel(card) {
    var panel = card.querySelector('.cm-info');
    if (!panel) return;
    var k = keyOf(card);
    var o = readAll()[k] || DEFAULTS[k] || { session: [], month: [] };
    var any = false;
    panel.textContent = '';
    [['session', 'Sessions'], ['month', 'Monthly']].forEach(function (g) {
      var rows = o[g[0]] || [];
      if (!rows.length) return;
      any = true;
      var h = document.createElement('h3');
      h.textContent = g[1];
      var ul = document.createElement('ul');
      rows.forEach(function (r) {
        var li = document.createElement('li');
        li.textContent = r[0] + ' ' + g[0] + (Number(r[0]) === 1 ? '' : 's') + ' · ' + PESO + Number(r[1]).toLocaleString('en-US');
        ul.appendChild(li);
      });
      panel.appendChild(h);
      panel.appendChild(ul);
    });
    if (!any) {
      var p = document.createElement('p');
      p.textContent = 'No prices yet. Use Edit to add some.';
      panel.appendChild(p);
    }
  }

  function addArrow(card) {
    if (!card.querySelector('.edit-class-btn') || card.querySelector('.cm-arrow')) return;
    var name = card.querySelector('.class-card__title').textContent.trim();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cm-arrow';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', 'Show prices for ' + name);
    btn.innerHTML = CHEVRON;
    var panel = document.createElement('div');
    panel.className = 'cm-info';
    card.appendChild(btn);
    card.appendChild(panel);
  }

  function toggleCard(card) {
    var open = !card.classList.contains('is-open');
    Array.prototype.forEach.call(grid.querySelectorAll('.class-card.is-open'), function (c) {
      c.classList.remove('is-open');
      var a = c.querySelector('.cm-arrow');
      if (a) a.setAttribute('aria-expanded', 'false');
    });
    if (open) {
      fillPanel(card);
      card.classList.add('is-open');
      card.querySelector('.cm-arrow').setAttribute('aria-expanded', 'true');
    }
  }

  Array.prototype.forEach.call(grid.querySelectorAll('.class-card'), addArrow);
  grid.addEventListener('click', function (e) {
    var a = e.target.closest('.cm-arrow');
    if (a) toggleCard(a.closest('.class-card'));
  });

  /* ---------- open / close ---------- */
  function showError(msg) { errorBox.textContent = msg || ''; errorBox.hidden = !msg; }

  function openModal(card) {
    current = card;
    showError('');
    editImage.value = '';
    kind = 'session';
    if (card) {
      var btn = card.querySelector('.edit-class-btn');
      panelTitle.textContent = 'Edit Class';
      classKey = (btn && btn.dataset.class) || slug(card.querySelector('.class-card__title').textContent);
      editName.value = card.querySelector('.class-card__title').textContent.trim();
      editDescription.value = card.querySelector('.class-card__desc').textContent.trim();
      var img = card.querySelector('.class-card__img');
      showImage(img ? img.getAttribute('src') : '');
      var saved = readAll()[classKey];
      data = clone(saved || DEFAULTS[classKey] || { session: [], month: [] });
      deleteBtn.hidden = false;
    } else {
      panelTitle.textContent = 'Add New Class';
      classKey = '';
      editName.value = '';
      editDescription.value = '';
      showImage('');
      data = { session: [], month: [] };
      deleteBtn.hidden = true;
    }
    renderOptions();
    modal.showModal();
  }

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('.edit-class-btn');
    if (b) openModal(b.closest('.class-card'));
  });
  document.getElementById('add-class-btn').addEventListener('click', function () { openModal(null); });
  document.getElementById('close-modal').addEventListener('click', function () { modal.close(); });
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });   // click the dark backdrop

  /* ---------- save / delete ---------- */
  function cleanRows(rows) {
    return rows.map(function (r) { return [Number(r[0]), Number(r[1])]; })
      .filter(function (r) { return r[0] > 0 && r[1] >= 0 && r[1] === r[1]; });
  }

  document.getElementById('save-class-btn').addEventListener('click', function () {
    var name = editName.value.trim();
    if (!name) { showError('Please enter a class name.'); editName.focus(); return; }

    // every row that was started must be complete
    var bad = ['session', 'month'].some(function (k) {
      return data[k].some(function (r) { return (r[0] === '' || r[1] === '' || Number(r[0]) <= 0 || Number(r[1]) < 0); });
    });
    if (bad) { showError('Fill in a number and a price for every option, or remove the empty row.'); return; }

    var opts = { session: cleanRows(data.session), month: cleanRows(data.month) };
    var card = current;
    var desc = editDescription.value.trim();

    if (!card) {
      card = document.createElement('article');
      card.className = 'class-card';
      card.innerHTML = '<h2 class="class-card__title"></h2><p class="class-card__desc"></p>' +
        '<img class="class-card__img" alt="" />' +
        '<button type="button" class="btn btn-navy edit-class-btn"> Edit </button>';
      grid.insertBefore(card, grid.querySelector('.class-card--add'));
      classKey = slug(name) || ('class' + Date.now());
    }
    card.querySelector('.class-card__title').textContent = name;
    card.querySelector('.class-card__desc').textContent = desc;
    var im = card.querySelector('.class-card__img');
    im.src = imageSrc || PLACEHOLDER;
    im.alt = name;
    var eb = card.querySelector('.edit-class-btn');
    eb.setAttribute('data-class', classKey);
    eb.setAttribute('data-name', name);

    var all = readAll();
    all[classKey] = opts;
    writeAll(all);
    addArrow(card);
    var ar = card.querySelector('.cm-arrow');
    if (ar) ar.setAttribute('aria-label', 'Show prices for ' + name);
    fillPanel(card);
    modal.close();
  });

  deleteBtn.addEventListener('click', function () {
    if (!current) return;
    var name = current.querySelector('.class-card__title').textContent.trim();
    if (!window.confirm('Delete the class "' + name + '"? This cannot be undone.')) return;
    var all = readAll();
    delete all[classKey];
    writeAll(all);
    current.remove();
    current = null;
    modal.close();
  });
});