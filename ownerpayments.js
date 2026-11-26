/* ownerpayments.js: the owner checks member payments and marks them verified / rejected.
 * Reads and writes the same records the member pages use (payment-store.js). */
(function () {
  'use strict';

  var P = window.GTG_PAYMENTS;
  var body   = document.getElementById('owner-body');
  var empty  = document.getElementById('owner-empty');
  var filter = document.getElementById('status-filter');
  if (!body || !P) return;

  var F = P.filters({
    month: document.getElementById('month-filter'),
    year: document.getElementById('year-filter'),
    category: document.getElementById('category-filter')
  }, function () { render(); });

  function peso(n) { return '\u20B1' + Number(n).toLocaleString('en-PH'); }

  function cell(text) {
    var td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  function button(text, act, id, ghost) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'owner-btn' + (ghost ? ' owner-btn--ghost' : '');
    b.setAttribute('data-act', act);
    b.setAttribute('data-id', id);
    b.textContent = text;
    return b;
  }

  function renderCounts() {
    var c = P.counts();
    ['pending', 'verified', 'rejected'].forEach(function (k) {
      document.getElementById('count-' + k).textContent = c[k];
    });
  }

  function render() {
    renderCounts();
    var want = filter.value;
    var inStatus = P.list().filter(function (p) { return want === 'all' || p.status === want; });
    F.refresh(P.list());
    var items = inStatus.filter(F.match);

    body.textContent = '';
    empty.hidden = items.length > 0;

    items.forEach(function (p) {
      var tr = document.createElement('tr');
      tr.appendChild(cell(P.fmtDate(p.createdAt)));
      tr.appendChild(cell(p.member));
      tr.appendChild(cell(p.className + (p.category ? ' \u00B7 ' + p.category : '')));
      tr.appendChild(cell(peso(p.amount)));
      tr.appendChild(cell(p.via || '\u2014'));
      tr.appendChild(cell(p.reference || '\u2014'));

      var st = document.createElement('td');
      var pill = document.createElement('span');
      pill.className = 'status-pill status-pill--' + p.status;
      pill.textContent = P.LABEL[p.status] || p.status;
      st.appendChild(pill);
      tr.appendChild(st);

      var act = document.createElement('td');
      var box = document.createElement('div');
      box.className = 'owner-actions';
      if (p.status === 'pending') {
        box.appendChild(button('Verify', 'verified', p.id));
        box.appendChild(button('Reject', 'rejected', p.id, true));
      } else {
        box.appendChild(button('Undo', 'pending', p.id, true));
      }
      act.appendChild(box);
      tr.appendChild(act);

      body.appendChild(tr);
    });
  }

  body.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    P.setStatus(b.getAttribute('data-id'), b.getAttribute('data-act'));
    render();
  });

  filter.addEventListener('change', render);

  // A member sends a new payment in another tab: show it here
  window.addEventListener('storage', function (e) { if (e.key === P.KEY) render(); });

  render();
})();