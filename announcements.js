/* GTG Fitness - shared announcements
   Include on admin / owner, member and trainer dashboards:
   <link rel="stylesheet" href="announcements.css" />
   <script src="announcements.js"></script>
   and put <div id="announcements-root" data-mode="admin" data-author="Rue"></div>   (admin / owner)
   or      <div id="announcements-root" data-mode="view"></div>                       (member / trainer)

   Rules:
   - A posted announcement CAN'T be edited.
   - It can be removed only until its deadline (REMOVE_WINDOW after it was posted); after that it is locked.
*/

(function () {
  var KEY = 'gtg_announcements';
  var MAX_LEN = 200;
  var MAX_TITLE = 60;
  var REMOVE_WINDOW = 24 * 60 * 60 * 1000;   // how long an announcement can still be removed (24 hours)

  var DEFAULTS = [
    { id: 'seed-1', title: 'Zumba Schedule Update', author: 'Rue',
      text: 'New Zumba schedule starts next week. Reserve your slot early.',
      createdAt: new Date(2026, 10, 20, 9, 0).getTime() }
  ];

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) return DEFAULTS.slice();   // first visit only
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function save(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
  }

  function postedAt(ts) {
    return new Date(ts).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  function msLeft(a) { return a.createdAt + REMOVE_WINDOW - Date.now(); }

  function fmtLeft(ms) {
    var m = Math.max(1, Math.ceil(ms / 60000));
    if (m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + 'h' + (r ? ' ' + r + 'm' : '');
  }

  var ICON = {
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M6 6l1 14h10l1-14"></path></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M12 11v5"></path><path d="M12 8h.01"></path></svg>'
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;   // textContent keeps announcements safe from HTML injection
    return n;
  }
  function withIcon(tag, cls, icon, text) {
    var n = el(tag, cls);
    var i = el('span', 'ann__icon'); i.innerHTML = icon; i.setAttribute('aria-hidden', 'true');
    n.appendChild(i);
    n.appendChild(el('span', '', text));
    return n;
  }

  function init(root) {
    var admin = root.getAttribute('data-mode') === 'admin';
    var author = root.getAttribute('data-author') || 'Admin';
    root.classList.add('ann');

    var list = load();
    var form, titleInput, input, counter, listEl;

    function commit() { save(list); renderList(); }

    function buildItem(a) {
      var locked = msLeft(a) <= 0;
      var item = el('article', 'ann__item' + (admin && locked ? ' ann__item--locked' : ''));

      var head = el('header', 'ann__header');
      if (a.title) head.appendChild(el('h4', 'ann__title', a.title));
      head.appendChild(el('p', 'ann__meta', 'Posted by ' + (a.author || author) + ' \u2022 ' + postedAt(a.createdAt)));
      item.appendChild(head);
      item.appendChild(el('p', 'ann__text', a.text));

      if (admin) {
        var foot = el('footer', 'ann__foot');
        if (locked) {
          foot.appendChild(withIcon('span', 'ann__status', ICON.lock, 'Locked \u2022 removal period ended'));
        } else {
          var left = msLeft(a);
          foot.appendChild(withIcon('span', 'ann__status' + (left < 3600000 ? ' ann__status--soon' : ''), ICON.clock,
            'Removable for ' + fmtLeft(left)));
          var del = el('button', 'ann__remove');
          del.type = 'button';
          del.setAttribute('aria-label', 'Remove announcement' + (a.title ? ': ' + a.title : ''));
          del.innerHTML = ICON.trash;
          del.appendChild(el('span', '', 'Remove'));
          del.addEventListener('click', function () {
            if (msLeft(a) <= 0) { renderList(); return; }   // the deadline passed while the page was open
            if (!window.confirm('Remove this announcement? This cannot be undone.')) return;
            list = list.filter(function (x) { return x.id !== a.id; });
            commit();
          });
          foot.appendChild(del);
        }
        item.appendChild(foot);
      }
      return item;
    }

    function renderList() {
      listEl.innerHTML = '';
      if (!list.length) {
        listEl.appendChild(el('p', 'ann__empty',
          admin ? 'Nothing posted yet. Write an announcement above.' : 'No announcements today.'));
        return;
      }
      list.slice().sort(function (a, b) { return b.createdAt - a.createdAt; }).forEach(function (a) {
        listEl.appendChild(buildItem(a));
      });
    }

    if (admin) {
      form = el('form', 'ann__form');
      titleInput = el('input', 'ann__field ann__field--title');
      titleInput.type = 'text';
      titleInput.maxLength = MAX_TITLE;
      titleInput.placeholder = 'Title (optional)';
      titleInput.setAttribute('aria-label', 'Announcement title');
      titleInput.autocomplete = 'off';

      input = el('textarea', 'ann__field ann__field--text');
      input.rows = 3;
      input.maxLength = MAX_LEN;
      input.placeholder = 'Write an announcement for members and trainers';
      input.setAttribute('aria-label', 'New announcement');

      var rule = withIcon('p', 'ann__rule', ICON.info,
        'Once posted, an announcement can\u2019t be edited. You can remove it within 24 hours; after that it is locked.');

      var row = el('div', 'ann__row');
      counter = el('span', 'ann__count', '0/' + MAX_LEN);
      var post = el('button', 'ann__post', 'Post');
      post.type = 'submit';
      row.appendChild(counter);
      row.appendChild(post);

      form.appendChild(titleInput);
      form.appendChild(input);
      form.appendChild(rule);
      form.appendChild(row);
      root.appendChild(form);

      input.addEventListener('input', function () {
        counter.textContent = input.value.length + '/' + MAX_LEN;
      });
      titleInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); input.focus(); }
      });
      // Enter posts, Shift+Enter makes a new line
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
      });
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = input.value.trim();
        if (!text) { input.focus(); return; }
        list.push({ id: 'a' + Date.now(), title: titleInput.value.trim(), author: author, text: text, createdAt: Date.now() });
        titleInput.value = '';
        input.value = '';
        counter.textContent = '0/' + MAX_LEN;
        commit();
      });
    }

    listEl = el('div', 'ann__list');
    listEl.setAttribute('aria-live', 'polite');
    root.appendChild(listEl);
    renderList();

    // Updates when the admin posts / removes in another tab
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { list = load(); renderList(); }
    });
    // Keeps the "can be removed for ..." countdown fresh and locks cards when their deadline passes
    setInterval(renderList, 30000);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var root = document.getElementById('announcements-root');
    if (root) init(root);
  });
})();