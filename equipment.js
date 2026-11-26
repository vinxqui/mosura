document.addEventListener('DOMContentLoaded', function () {

  var ITEMS = window.GTG_EQUIPMENT.items;
  var MAX_PER_ITEM = 10;

  var grid = document.getElementById('equip-grid');
  var filters = document.getElementById('equip-filters');
  var orderList = document.getElementById('equip-order-list');
  var orderEmpty = document.getElementById('equip-empty');
  var orderTotal = document.getElementById('equip-total');
  var orderCount = document.getElementById('equip-count');
  var checkoutBtn = document.getElementById('equip-checkout');

  var qty = {};                 // { itemId: quantity }
  var activeCategory = 'All';

  function peso(n) { return '\u20B1' + n.toLocaleString('en-PH'); }
  function maxFor(item) { return Math.min(MAX_PER_ITEM, item.stock); }

  var categories = ['All'];
  ITEMS.forEach(function (i) { if (categories.indexOf(i.category) === -1) categories.push(i.category); });

  function renderFilters() {
    filters.innerHTML = '';
    categories.forEach(function (cat) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (cat === activeCategory ? ' is-selected' : '');
      b.textContent = cat;
      b.setAttribute('data-cat', cat);
      b.setAttribute('aria-pressed', cat === activeCategory ? 'true' : 'false');
      filters.appendChild(b);
    });
  }

  function renderGrid() {
    grid.innerHTML = '';
    ITEMS.filter(function (i) { return activeCategory === 'All' || i.category === activeCategory; })
      .forEach(function (item) {
        var card = document.createElement('article');
        card.className = 'equip-card';
        card.innerHTML =
          '<div class="equip-card__icon" aria-hidden="true"></div>' +
          '<div class="equip-card__body">' +
            '<h3 class="equip-card__name"></h3>' +
            '<p class="equip-card__meta"></p>' +
            '<p class="equip-card__price"></p>' +
          '</div>' +
          '<div class="qty-stepper qty-stepper--sm">' +
            '<button type="button" class="qty-btn" data-id="' + item.id + '" data-dir="-1" aria-label="Remove one"></button>' +
            '<span class="qty-value" data-qty="' + item.id + '">0</span>' +
            '<button type="button" class="qty-btn" data-id="' + item.id + '" data-dir="1" aria-label="Add one"></button>' +
          '</div>';
        card.querySelector('.equip-card__icon').textContent = item.icon;
        card.querySelector('.equip-card__name').textContent = item.name;
        card.querySelector('.equip-card__meta').textContent = item.category + ' \u00B7 ' + item.type + ' \u00B7 ' + item.stock + ' available';
        card.querySelector('.equip-card__price').textContent = peso(item.price) + ' each';
        card.querySelector('[data-dir="-1"]').textContent = '\u2212';
        card.querySelector('[data-dir="1"]').textContent = '+';
        grid.appendChild(card);
      });
    updateSteppers();
  }

  function updateSteppers() {
    ITEMS.forEach(function (item) {
      var q = qty[item.id] || 0;
      var node = grid.querySelector('[data-qty="' + item.id + '"]');
      if (!node) return;
      node.textContent = q;
      grid.querySelector('[data-id="' + item.id + '"][data-dir="-1"]').disabled = q <= 0;
      grid.querySelector('[data-id="' + item.id + '"][data-dir="1"]').disabled = q >= maxFor(item);
    });
  }

  function chosen() {
    return ITEMS.filter(function (i) { return qty[i.id] > 0; });
  }

  function renderOrder() {
    var items = chosen();
    var total = 0, count = 0;
    orderList.innerHTML = '';
    items.forEach(function (item) {
      var line = item.price * qty[item.id];
      total += line;
      count += qty[item.id];
      var li = document.createElement('li');
      var a = document.createElement('span');
      var b = document.createElement('span');
      a.textContent = item.name + ' \u00D7 ' + qty[item.id];
      b.textContent = peso(line);
      li.appendChild(a); li.appendChild(b);
      orderList.appendChild(li);
    });
    orderEmpty.hidden = items.length > 0;
    orderTotal.textContent = peso(total);
    orderCount.textContent = count;
    checkoutBtn.disabled = items.length === 0;
  }

  filters.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-cat]');
    if (!b) return;
    activeCategory = b.getAttribute('data-cat');
    renderFilters();
    renderGrid();
  });

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-id]');
    if (!b || b.disabled) return;
    var item = ITEMS.filter(function (i) { return i.id === b.getAttribute('data-id'); })[0];
    var next = (qty[item.id] || 0) + Number(b.getAttribute('data-dir'));
    if (next < 0 || next > maxFor(item)) return;
    qty[item.id] = next;
    updateSteppers();
    renderOrder();
  });

  checkoutBtn.addEventListener('click', function () {
    var items = chosen();
    if (!items.length) return;
    var total = 0, count = 0;
    var lines = items.map(function (item) {
      total += item.price * qty[item.id];
      count += qty[item.id];
      return { label: item.name + ' \u00D7 ' + qty[item.id], amount: item.price * qty[item.id] };
    });
    GTGCheckout.open({
      ref: 'EQUIPMENT',
      kind: 'equipment',
      className: 'Equipment orders',
      category: count + (count === 1 ? ' equipment item' : ' equipment items'),
      lines: lines,
      total: total,
      what: count + (count === 1 ? ' equipment item' : ' equipment items'),
      doneLabel: 'Back to Equipment',
      onConfirm: function () { qty = {}; updateSteppers(); renderOrder(); }
    });
  });

  renderFilters();
  renderGrid();
  renderOrder();
});