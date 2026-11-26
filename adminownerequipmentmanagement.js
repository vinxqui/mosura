/* GTG Fitness – Equipment Management (owner only)
   Card layout with add / edit / delete. Saved in this browser under "gtg_equipment"
   until a real database is connected. Photos are resized before saving. */
(function () {
  'use strict';

  // Fail closed: nothing is built unless the signed-in role is allowed
  if (!window.GTGAuth || !GTGAuth.guard({ page: 'Equipment Management', min: 'owner' })) return;
  document.getElementById('op-skeleton').hidden = true;
  document.getElementById('op-content').hidden = false;

  function $(id) { return document.getElementById(id); }

  var KEY = 'gtg_equipment';
  var CATEGORIES = ['Cardio', 'Strength', 'Free weights', 'Boxing & martial arts', 'Yoga & studio', 'Other'];
  var STATUSES = {
    good:   'Good',
    repair: 'Needs repair',
    out:    'Out of service'
  };
  var PLACEHOLDER_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"></path></svg>';

  var items = load();
  var editingId = null;
  var deletingId = null;
  var formStatus = 'good';
  var formImage = '';

  /* ---------- storage ---------- */
  function newId() { return 'eq-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function seed() {
    return [
      { id: newId(), name: 'Treadmill',         category: 'Cardio',                qty: 4,  condition: 'good',   price: 0,  image: '', description: 'Walking, jogging and running. Adjustable speed and incline for warm-ups and cardio.' },
      { id: newId(), name: 'Dumbbell set',      category: 'Free weights',          qty: 12, condition: 'good',   price: 50, image: '', description: 'Free-weight strength work: curls, presses, rows and lunges for all levels.' },
      { id: newId(), name: 'Punching bag',      category: 'Boxing & martial arts', qty: 6,  condition: 'repair', price: 30, image: '', description: 'Heavy bag for boxing and Muay Thai drills: punches, kicks and conditioning rounds.' },
      { id: newId(), name: 'Boxing gloves',     category: 'Boxing & martial arts', qty: 20, condition: 'good',   price: 30, image: '', description: 'Protective gloves for bag work, pad work and sparring. Rentable for classes.' },
      { id: newId(), name: 'Yoga mat',          category: 'Yoga & studio',         qty: 15, condition: 'good',   price: 20, image: '', description: 'Non-slip mat for yoga, stretching and floor exercises.' },
      { id: newId(), name: 'Leg press machine', category: 'Strength',              qty: 1,  condition: 'out',    price: 0,  image: '', description: 'Seated machine for lower-body strength: quads, glutes and hamstrings.' }
    ];
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* use the starter list */ }
    var starter = seed();
    try { localStorage.setItem(KEY, JSON.stringify(starter)); } catch (e2) {}
    return starter;
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(items)); return true; }
    catch (e) { toast('Could not save. Browser storage is full or unavailable.'); return false; }
  }

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function find(id) { return items.filter(function (i) { return i.id === id; })[0]; }
  function statusKey(v) { return STATUSES[v] ? v : 'good'; }

  var toastTimer;
  function toast(msg) {
    var t = $('op-toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  function placeholder(cls) {
    var d = el('div', cls + ' eq-ph');
    d.innerHTML = PLACEHOLDER_SVG;
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', 'No photo');
    return d;
  }

  /* ---------- render ---------- */
  function render() {
    var q = $('eq-search').value.trim().toLowerCase();
    var cat = $('eq-filter').value;

    var shown = items.filter(function (i) {
      var okCat = cat === 'all' || i.category === cat;
      var okText = !q || (i.name + ' ' + i.category).toLowerCase().indexOf(q) !== -1;
      return okCat && okText;
    }).sort(function (a, b) { return a.name.localeCompare(b.name); });

    var grid = $('eq-grid');
    var frag = document.createDocumentFragment();

    shown.forEach(function (i) {
      var key = statusKey(i.condition);
      var card = el('article', 'eq-card');
      card.appendChild(el('h2', 'eq-card__name', i.name));
      card.appendChild(el('span', 'eq-pill eq-pill--' + key, STATUSES[key]));

      if (i.image) {
        var img = el('img', 'eq-card__img');
        img.src = i.image;
        img.alt = i.name;
        img.loading = 'lazy';
        card.appendChild(img);
      } else {
        var ph = placeholder('eq-card__img');
        card.appendChild(ph);
      }

      card.appendChild(el('p', 'eq-card__meta', i.category + ' \u00B7 ' + i.qty + (i.qty === 1 ? ' unit' : ' units')));

      var edit = el('button', 'eq-card__edit', 'Edit');
      edit.type = 'button';
      edit.setAttribute('aria-label', 'Edit ' + i.name);
      edit.addEventListener('click', function () { openForm(i.id); });
      card.appendChild(edit);
      frag.appendChild(card);
    });

    var addCard = el('article', 'eq-card eq-card--add');
    var addBtn = el('button', 'eq-add-btn');
    addBtn.type = 'button';
    addBtn.innerHTML = '<span class="eq-add-btn__plus" aria-hidden="true">+</span><span>Add equipment</span>';
    addBtn.addEventListener('click', function () { openForm(null); });
    addCard.appendChild(addBtn);
    frag.appendChild(addCard);

    grid.replaceChildren(frag);

    var empty = $('eq-empty');
    empty.textContent = 'No equipment matches your search.';
    empty.hidden = shown.length !== 0 || !items.length;

    $('kpi-types').textContent = items.length;
    $('kpi-units').textContent = items.reduce(function (s, i) { return s + i.qty; }, 0);
    $('kpi-repair').textContent = items.filter(function (i) { return i.condition === 'repair'; }).length;
    $('kpi-out').textContent = items.filter(function (i) { return i.condition === 'out'; }).length;
  }

  /* ---------- form: selects, status buttons, photo ---------- */
  function fillSelect(sel, list) {
    list.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c; o.textContent = c;
      sel.appendChild(o);
    });
  }
  fillSelect($('eq-category'), CATEGORIES);
  fillSelect($('eq-filter'), CATEGORIES);

  function setStatus(value) {
    formStatus = statusKey(value);
    document.querySelectorAll('#eq-status .eq-status__btn').forEach(function (b) {
      b.setAttribute('aria-checked', b.getAttribute('data-value') === formStatus ? 'true' : 'false');
    });
  }
  document.querySelectorAll('#eq-status .eq-status__btn').forEach(function (b) {
    b.addEventListener('click', function () { setStatus(b.getAttribute('data-value')); });
  });

  function updatePreview() {
    var box = $('eq-photo-preview');
    box.classList.toggle('eq-ph', !formImage);
    if (formImage) {
      var img = document.createElement('img');
      img.src = formImage;
      img.alt = 'Equipment photo preview';
      box.replaceChildren(img);
    } else {
      box.innerHTML = PLACEHOLDER_SVG;
    }
    $('eq-photo-remove').hidden = !formImage;
  }

  function readImage(file, done) {
    if (!/^image\//.test(file.type)) return done(null, 'Please choose an image file.');
    if (file.size > 8 * 1024 * 1024) return done(null, 'That image is too large (max 8 MB).');
    var reader = new FileReader();
    reader.onerror = function () { done(null, 'Could not read that image.'); };
    reader.onload = function () {
      var img = new Image();
      img.onerror = function () { done(null, 'That image could not be opened.'); };
      img.onload = function () {
        var scale = Math.min(1, 480 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        done(c.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  $('eq-photo-pick').addEventListener('click', function () { $('eq-photo-input').click(); });
  $('eq-photo-remove').addEventListener('click', function () { formImage = ''; $('eq-photo-input').value = ''; updatePreview(); });
  $('eq-photo-input').addEventListener('change', function (ev) {
    var file = ev.target.files && ev.target.files[0];
    if (!file) return;
    readImage(file, function (data, err) {
      if (err) { $('eq-error').textContent = err; return; }
      $('eq-error').textContent = '';
      formImage = data;
      updatePreview();
    });
  });

  /* ---------- open / close / submit ---------- */
  function openForm(id) {
    editingId = id || null;
    var item = id ? find(id) : null;
    $('eq-dialog-title').textContent = item ? 'Edit equipment' : 'Add equipment';
    $('eq-save').textContent = item ? 'Save changes' : 'Add equipment';
    $('eq-delete').hidden = !item;
    $('eq-name').value = item ? item.name : '';
    $('eq-category').value = item ? item.category : CATEGORIES[0];
    $('eq-qty').value = item ? item.qty : 1;
    $('eq-price').value = item && item.price ? item.price : '';
    $('eq-desc').value = item && item.description ? item.description : '';
    $('eq-photo-input').value = '';
    $('eq-error').textContent = '';
    formImage = item && item.image ? item.image : '';
    setStatus(item ? item.condition : 'good');
    updatePreview();
    $('eq-dialog').showModal();
    $('eq-name').focus();
  }

  function closeForm() { $('eq-dialog').close(); }
  $('eq-dialog').addEventListener('close', function () { editingId = null; });

  $('eq-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var name = $('eq-name').value.trim();
    var category = $('eq-category').value;
    var qtyRaw = $('eq-qty').value.trim();
    var priceRaw = $('eq-price').value.trim();
    var description = $('eq-desc').value.trim().slice(0, 300);
    var qty = Number(qtyRaw);
    var price = priceRaw === '' ? 0 : Number(priceRaw);

    function fail(msg, field) { $('eq-error').textContent = msg; $(field).focus(); }

    if (!name) return fail('Please enter the equipment name.', 'eq-name');
    if (qtyRaw === '' || !isFinite(qty) || qty < 0 || Math.floor(qty) !== qty) return fail('Quantity must be a whole number, 0 or more.', 'eq-qty');
    if (!isFinite(price) || price < 0) return fail('Rental price can\u2019t be negative.', 'eq-price');

    var duplicate = items.some(function (i) {
      return i.id !== editingId && i.category === category && i.name.toLowerCase() === name.toLowerCase();
    });
    if (duplicate) return fail('That equipment is already in this category. Edit it instead.', 'eq-name');

    if (editingId) {
      var item = find(editingId);
      item.name = name; item.category = category; item.qty = qty;
      item.condition = formStatus; item.price = price; item.image = formImage; item.description = description;
      toast('Changes saved');
    } else {
      items.push({ id: newId(), name: name, category: category, qty: qty, condition: formStatus, price: price, image: formImage, description: description });
      toast('Equipment added');
    }
    if (save()) { closeForm(); render(); }
  });

  /* ---------- delete ---------- */
  $('eq-delete').addEventListener('click', function () {
    var item = find(editingId);
    if (!item) return;
    deletingId = item.id;
    $('eq-delete-msg').textContent = '\u201C' + item.name + '\u201D (' + item.qty + ' unit' + (item.qty === 1 ? '' : 's') + ') will be removed from the list. This can\u2019t be undone.';
    closeForm();
    $('eq-delete-dialog').showModal();
    $('eq-delete-cancel').focus();
  });

  $('eq-delete-confirm').addEventListener('click', function () {
    items = items.filter(function (i) { return i.id !== deletingId; });
    deletingId = null;
    if (save()) toast('Equipment deleted');
    $('eq-delete-dialog').close();
    render();
  });
  $('eq-delete-cancel').addEventListener('click', function () { $('eq-delete-dialog').close(); });

  /* ---------- wiring ---------- */
  $('eq-add').addEventListener('click', function () { openForm(null); });
  $('eq-close').addEventListener('click', closeForm);
  $('eq-cancel').addEventListener('click', closeForm);
  $('eq-search').addEventListener('input', render);
  $('eq-filter').addEventListener('change', render);

  // clicking the dark backdrop closes a dialog
  ['eq-dialog', 'eq-delete-dialog'].forEach(function (id) {
    $(id).addEventListener('click', function (ev) { if (ev.target === ev.currentTarget) ev.currentTarget.close(); });
  });

  document.addEventListener('click', function (ev) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute('open');
    });
  });

  render();
})();
