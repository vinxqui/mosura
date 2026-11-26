/* =========================================================
   payment-history.js
   Every payment goes to the "Payment Status" card first
   (Pending verification, or Rejected). Only after the owner
   verifies it does it move into Payment History.
     - Payment History: verified payments of the class picked in
       the "Classes you Enrolled" dropdown
     - Payment Status (Payment page only): all payments still
       waiting for the owner, each with its own tracker
   Data comes from payment-store.js (the owner updates it in
   ownerpayments.html).
   ========================================================= */
(function () {
  'use strict';

  var P = window.GTG_PAYMENTS;
  var select     = document.getElementById('subscribed-classes');
  var list       = document.getElementById('payment-list');
  var count      = document.getElementById('payment-count');
  var label      = document.getElementById('payment-class');
  var summary    = document.getElementById('payment-summary');
  var statusCard = document.getElementById('status-card');   // Payment page only
  if (!select || !list || !P) return;

  // Payment page: Payment History lists verified payments only (the others sit in Payment Status).
  // Dashboard (no Payment Status card): the Payment History panel lists every payment of the class,
  // with its payment channel and status, so it always reflects the Payment page.
  var historyOnlyVerified = !!statusCard;
  function inHistory(p) { return historyOnlyVerified ? p.status === 'verified' : true; }

  // Month / Year / Category filters (each one is optional on a page)
  function has(id) { return document.getElementById(id); }
  var statusFilter = statusCard && has('status-month') && P.filters({
    month: has('status-month'), year: has('status-year'), category: has('status-category')
  }, function () { renderStatus(); });
  var historyFilter = has('history-month') ? P.filters({
    month: has('history-month'), year: has('history-year')
  }, function () { render(); }) : null;

  var NOTE = {
    pending:  'Waiting for the owner to verify your payment.',
    rejected: 'The owner could not verify this payment. Please visit the front desk or send it again.'
  };

  function verifiedOnly(p) { return p.status === 'verified'; }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function peso(n) {
    return '\u20B1' + Number(n).toLocaleString('en-PH');
  }

  // Dropdown = every class (or order group) that has a payment, newest first
  var filled = false;
  function fillSelect() {
    var keep = filled ? select.value : '';   // first load: show the class with the newest payment
    filled = true;
    var seen = {}, names = [];
    P.list().filter(inHistory).forEach(function (p) {
      if (!seen[p.className]) { seen[p.className] = true; names.push(p.className); }
    });
    select.textContent = '';
    if (!names.length) {
      var none = el('option', '', historyOnlyVerified ? 'No verified payments yet' : 'No payments yet');
      none.value = '';
      select.appendChild(none);
      select.disabled = true;
      return;
    }
    select.disabled = false;
    names.forEach(function (n) {
      var o = el('option', '', n);
      o.value = n;
      select.appendChild(o);
    });
    if (names.indexOf(keep) !== -1) select.value = keep;
  }

  function buildItem(p) {
    var li = el('li', 'payment-item');

    var meta = [P.fmtDate(p.createdAt)];
    if (p.reference) meta.push('Ref ' + p.reference);

    var info = el('div', 'payment-item__info');
    info.appendChild(el('p', 'payment-item__class', p.category || p.className));
    info.appendChild(el('p', 'payment-item__meta', meta.join(' \u00B7 ')));
    // Payment channel (GCash, Maya, card, ...) as chosen at checkout
    var chan = el('p', 'payment-item__channel');
    chan.appendChild(el('span', '', 'Payment channel'));
    chan.appendChild(el('strong', '', p.via || '\u2014'));
    info.appendChild(chan);

    var side = el('div', 'payment-item__side');
    side.appendChild(el('p', 'payment-item__amount', peso(p.amount)));
    side.appendChild(el('span', 'status-pill status-pill--' + p.status, P.LABEL[p.status] || p.status));

    li.appendChild(info);
    li.appendChild(side);

    var sessions = el('div', 'payment-item__sessions');
    var blk = p.status === 'verified' ? sessionsBlock(p) : null;
    if (blk) {
      sessions.appendChild(blk);
    } else if (p.status === 'verified') {
      sessions.appendChild(el('p', 'sessions-note', 'Verified. Your order is confirmed.'));
    } else {
      sessions.appendChild(el('p', 'sessions-note', NOTE[p.status] || ''));
    }
    li.appendChild(sessions);
    return li;
  }

  // The enrollment saved when this payment was made (gives sessions applied / remaining)
  function enrollmentOf(p) {
    try {
      var all = JSON.parse(localStorage.getItem('gtg_enrollments') || '[]');
      return all.filter(function (e) { return e.paymentId === p.id; })[0] || null;
    } catch (err) { return null; }
  }

  // { applied, total (null = unlimited), left (null = unlimited), enr }
  function sessionInfo(p) {
    if (p.kind !== 'class') return null;
    var enr = enrollmentOf(p);
    var total = enr ? enr.total : p.total;
    var applied = enr ? Object.keys(enr.booked || {}).length : (p.taken || 0);
    return { applied: applied, total: total, left: total === null ? null : Math.max(0, total - applied), enr: enr };
  }

  // "Sessions applied x / y" + a button to the calendar while sessions remain
  function sessionsBlock(p) {
    var info = sessionInfo(p);
    if (!info || p.status === 'rejected') return null;
    var box = el('div', 'status-sessions');
    var row = el('div', 'sessions-label');
    row.appendChild(el('span', '', 'Sessions applied'));
    row.appendChild(el('strong', '', info.total === null ? info.applied + ' (unlimited plan)' : info.applied + ' / ' + info.total));
    box.appendChild(row);
    if (info.total !== null) {
      var bar = el('div', 'sessions-bar');
      var fill = el('span');
      fill.style.width = Math.min(100, Math.round((info.applied / info.total) * 100)) + '%';
      bar.appendChild(fill);
      box.appendChild(bar);
    }
    var hasLeft = info.left === null || info.left > 0;
    var foot = el('div', 'status-sessions__foot');
    foot.appendChild(el('span', '', info.left === null ? 'Unlimited sessions remaining'
      : info.left > 0 ? info.left + (info.left === 1 ? ' session remaining' : ' sessions remaining') : 'All sessions applied'));
    if (hasLeft && info.enr) {
      var a = el('a', 'btn btn-navy status-sessions__btn', 'Add Session');
      a.href = 'booking.html';
      a.setAttribute('data-enr', info.enr.id);
      foot.appendChild(a);
    }
    box.appendChild(foot);
    return box;
  }

  var openIds = {};   // which payments have their Details open (kept when the list refreshes)

  // "Payment Status" card: every payment that is not verified yet (pending or rejected),
  // newest first. Verified ones move to Payment History.
  function renderStatus() {
    if (!statusCard) return;
    statusCard.textContent = '';
    var notVerified = P.list().filter(function (p) { return p.status !== 'verified'; });
    if (statusFilter) statusFilter.refresh(notVerified);
    var waiting = statusFilter ? notVerified.filter(statusFilter.match) : notVerified;
    if (!waiting.length) {
      statusCard.appendChild(el('p', 'payment-empty', notVerified.length
        ? 'No payments for this month, year or category.'
        : 'No payments waiting for verification.'));
      return;
    }
    var S = window.GTG_PAYMENT_STATUS;

    waiting.forEach(function (p) {
      var box = el('div', 'status-item');

      // Class name, date and time, status
      var head = el('div', 'status-summary');
      var left = el('div');
      left.appendChild(el('strong', '', p.className));
      left.appendChild(el('span', '', P.fmtDateTime(p.createdAt)));
      head.appendChild(left);
      head.appendChild(el('span', 'status-pill status-pill--' + p.status, P.LABEL[p.status] || p.status));
      box.appendChild(head);

      // Visible part ends here: a Details button opens everything else
      var open = !!openIds[p.id];
      var toggle = el('button', 'status-toggle', open ? 'Hide details' : 'Details');
      toggle.type = 'button';
      toggle.setAttribute('data-toggle', p.id);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      box.appendChild(toggle);

      var more = el('div', 'status-details');
      more.hidden = !open;

      // Payment details
      var rows = [['Package', p.category || '\u2014'], ['Amount', peso(p.amount)], ['Paid via', p.via || '\u2014']];
      if (p.reference) rows.push(['Reference', p.reference]);
      var dl = el('ul', 'pay-status__list');
      rows.forEach(function (r) {
        var li = el('li');
        li.appendChild(el('span', '', r[0]));
        li.appendChild(el('span', '', r[1]));
        dl.appendChild(li);
      });
      more.appendChild(dl);

      // Status tracker
      if (S) {
        var steps = el('ol', 'pay-steps');
        steps.innerHTML = S.stepsHtml(p.status, { submitted: P.fmtDate(p.createdAt), checked: '' });
        more.appendChild(steps);
        more.appendChild(el('p', 'status-msg', (S.TEXT[p.status] || S.TEXT.pending).msg));
      }

      // Sessions applied / remaining, with the Add Session button
      var sess = sessionsBlock(p);
      if (sess) more.appendChild(sess);

      box.appendChild(more);
      statusCard.appendChild(box);
    });
  }

  // Details button: show / hide everything about that payment
  if (statusCard) {
    statusCard.addEventListener('click', function (e) {
      var t = e.target.closest('button[data-toggle]');
      if (!t) return;
      var id = t.getAttribute('data-toggle');
      var show = !openIds[id];
      openIds[id] = show;
      t.setAttribute('aria-expanded', show ? 'true' : 'false');
      t.textContent = show ? 'Hide details' : 'Details';
      t.nextElementSibling.hidden = !show;
    });
  }

  // "Add Session": make that enrollment the active one, then open the calendar
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-enr]');
    if (!a) return;
    try { localStorage.setItem('gtg_active_enrollment', a.getAttribute('data-enr')); } catch (err) { /* ignore */ }
  });

  function render() {
    var cls = select.value;
    var verified = P.list().filter(function (p) { return inHistory(p) && p.className === cls; });
    if (historyFilter) historyFilter.refresh(verified);
    var items = historyFilter ? verified.filter(historyFilter.match) : verified;

    list.textContent = '';
    label.textContent = cls;
    count.textContent = items.length;
    renderStatus();

    if (!items.length) {
      summary.textContent = '';
      list.appendChild(el('li', 'payment-empty', verified.length
        ? 'No payments for this month or year.'
        : historyOnlyVerified ? 'No verified payments yet. A payment shows here after the owner verifies it.'
        : 'No payments yet.'));
      return;
    }

    var taken = 0, total = 0;
    items.forEach(function (p) {
      var info = sessionInfo(p);
      if (info && info.total) { taken += info.applied; total += info.total; }
      list.appendChild(buildItem(p));
    });
    summary.textContent = total ? 'Total sessions applied: ' + taken + ' of ' + total : '';
  }

  select.addEventListener('change', render);

  // The owner verifies in another tab/page: refresh when the records change
  window.addEventListener('storage', function (e) {
    if (e.key === P.KEY) { fillSelect(); render(); }
  });

  fillSelect();
  render();
})();