/* GTG Fitness – Member Management (admin)
   - Lists classes with their member totals (links to adminclassmembers.html?class=<id>)
   - "Add Class" modal: optional photo + name, validated and saved
   - Search box and per-row delete
   Classes are stored in localStorage under "gtg_classes". */
(function () {
  'use strict';

  var PAGE_PREFIX = /(^|[\\/])owner[^\\/]*$/i.test(window.location.pathname) ? 'owner' : 'admin';   // admin pages link to admin*, owner pages to owner*

  var KEY = 'gtg_classes';

  var listEl = document.getElementById('mm-list');
  var emptyEl = document.getElementById('mm-empty');
  var summaryEl = document.getElementById('mm-summary');
  var searchEl = document.getElementById('mm-search');

  var modal = document.getElementById('class-modal');
  var form = document.getElementById('class-form');
  var openBtn = document.getElementById('add-class-btn');
  var closeBtn = document.getElementById('close-class-modal');
  var cancelBtn = document.getElementById('cancel-class');
  var nameInput = document.getElementById('class-name');
  var photoInput = document.getElementById('class-photo');
  var photoPick = document.getElementById('class-photo-pick');
  var photoClear = document.getElementById('class-photo-clear');
  var previewBox = document.getElementById('class-photo-preview');
  var previewImg = previewBox.querySelector('img');
  var errorEl = document.getElementById('class-error');

  var photoData = '';      // resized photo for the class being added
  var justAdded = null;    // id of the newest class, used for the highlight

  /* ---------- data ---------- */

  function seed() {
    return [
      { id: 'boxing', name: 'Boxing', emoji: '\uD83E\uDD4A', photo: '', members: 11 },
      { id: 'muaythai', name: 'Muay Thai', emoji: '\uD83E\uDDB5', photo: '', members: 7 },
      { id: 'taekwondo', name: 'Taekwondo', emoji: '\uD83E\uDD4B', photo: '', members: 12 },
      { id: 'yoga', name: 'Yoga', emoji: '\uD83E\uDDD8', photo: '', members: 5 },
      { id: 'zumba', name: 'Zumba', emoji: '\uD83D\uDC83', photo: '', members: 15 }
    ];
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw !== null) {
        var list = JSON.parse(raw);
        if (Array.isArray(list)) return list;
      }
    } catch (e) { /* use the starter list */ }
    return seed();
  }

  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(classes)); return true; }
    catch (e) { return false; }
  }

  function sortClasses() {
    classes.sort(function (a, b) { return a.name.localeCompare(b.name); });
  }

  function slugify(name) { return name.toLowerCase().replace(/[^a-z0-9]/g, ''); }

  var classes = load();
  sortClasses();

  /* ---------- rendering ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;   // textContent keeps typed names from injecting markup
    return n;
  }

  function svg(markup, cls) {
    var s = el('span', cls);
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = markup;
    return s;
  }

  var CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M9 6l6 6-6 6"></path></svg>';
  var TRASH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path></svg>';

  function buildRow(c) {
    var li = el('li', 'mm-row' + (c.id === justAdded ? ' is-new' : ''));

    var link = el('a', 'mm-row__link');
    link.href = PAGE_PREFIX + 'classmembers.html?class=' + encodeURIComponent(c.id);

    var icon = el('span', 'mm-row__icon');
    icon.setAttribute('aria-hidden', 'true');
    if (c.photo) {
      var img = el('img');
      img.alt = '';
      img.src = c.photo;
      icon.appendChild(img);
    } else {
      icon.textContent = c.emoji || c.name.charAt(0).toUpperCase();
    }

    var count = el('span', 'mm-row__count');
    count.appendChild(el('strong', '', String(c.members)));
    count.appendChild(document.createTextNode(c.members === 1 ? 'member' : 'members'));

    link.appendChild(icon);
    link.appendChild(el('span', 'mm-row__name', c.name));
    link.appendChild(count);
    link.appendChild(svg(CHEVRON, 'mm-row__chev'));

    var del = el('button', 'mm-row__delete');
    del.type = 'button';
    del.setAttribute('aria-label', 'Delete ' + c.name + ' class');
    del.title = 'Delete class';
    del.appendChild(svg(TRASH));
    del.addEventListener('click', function () {
      if (!window.confirm('Delete the ' + c.name + ' class? This cannot be undone.')) return;
      classes = classes.filter(function (x) { return x.id !== c.id; });
      persist();
      render();
    });

    li.appendChild(link);
    li.appendChild(del);
    return li;
  }

  function render() {
    var q = searchEl.value.trim().toLowerCase();
    var shown = classes.filter(function (c) { return !q || c.name.toLowerCase().indexOf(q) !== -1; });

    listEl.innerHTML = '';
    shown.forEach(function (c) { listEl.appendChild(buildRow(c)); });

    var totalMembers = classes.reduce(function (sum, c) { return sum + c.members; }, 0);
    summaryEl.textContent = classes.length + (classes.length === 1 ? ' class' : ' classes') +
      ' \u00B7 ' + totalMembers + (totalMembers === 1 ? ' member' : ' members') + ' subscribed';

    emptyEl.hidden = shown.length !== 0;
    if (!shown.length) {
      emptyEl.textContent = q ? 'No classes match \u201C' + searchEl.value.trim() + '\u201D.'
                              : 'No classes yet. Click \u201CAdd Class\u201D to create one.';
    }
    justAdded = null;
  }

  /* ---------- add class modal ---------- */

  function setPhoto(dataUrl) {
    photoData = dataUrl || '';
    previewImg.hidden = !photoData;
    photoClear.hidden = !photoData;
    if (photoData) previewImg.src = photoData; else previewImg.removeAttribute('src');
  }

  function showError(msg, focusEl) {
    errorEl.textContent = msg;
    errorEl.hidden = false;
    if (focusEl) focusEl.focus();
  }

  function resetForm() {
    form.reset();
    setPhoto('');
    errorEl.hidden = true;
  }

  openBtn.addEventListener('click', function () {
    resetForm();
    modal.showModal();
    nameInput.focus();
  });
  closeBtn.addEventListener('click', function () { modal.close(); });
  cancelBtn.addEventListener('click', function () { modal.close(); });

  // Click on the dimmed backdrop closes the modal (the dialog itself is the target there)
  modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });

  photoPick.addEventListener('click', function () { photoInput.click(); });
  photoClear.addEventListener('click', function () { photoInput.value = ''; setPhoto(''); });

  // Photos are shrunk so they fit comfortably in browser storage
  photoInput.addEventListener('change', function () {
    var file = photoInput.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showError('Please choose an image file.'); photoInput.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { showError('That photo is over 5 MB. Please choose a smaller one.'); photoInput.value = ''; return; }

    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var scale = Math.min(1, 240 / Math.max(img.width, img.height));
        var c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        setPhoto(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85));
        errorEl.hidden = true;
      };
      img.onerror = function () { showError('That image could not be read.'); };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = nameInput.value.trim().replace(/\s+/g, ' ');
    var id = slugify(name);

    if (!name) { showError('Please enter a class name.', nameInput); return; }
    if (!id) { showError('Use letters or numbers in the class name.', nameInput); return; }
    if (classes.some(function (c) { return c.id === id; })) {
      showError('A class with this name already exists.', nameInput);
      return;
    }

    var fresh = { id: id, name: name, emoji: '', photo: photoData, members: 0 };
    classes.push(fresh);
    sortClasses();
    if (!persist()) {
      classes = classes.filter(function (c) { return c !== fresh; });
      showError('Could not save. Browser storage may be full; try a smaller photo.');
      return;
    }

    modal.close();
    searchEl.value = '';
    justAdded = id;
    render();
    var row = listEl.querySelector('.is-new');
    if (row && row.scrollIntoView) row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  searchEl.addEventListener('input', render);

  // Close the settings menu when clicking elsewhere (same as the other pages)
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  render();
})();
