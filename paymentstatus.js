/* Payment status: popup shown right after a payment is sent, plus the step tracker
 * that the Payment page reuses.
 *
 *   GTG_PAYMENT_STATUS.open({
 *     payment:   { id, status, via, email, total, reference },   // from GTGCheckout's onConfirm
 *     className: 'Boxing',
 *     pkg:       '5 Sessions',
 *     note:      'optional line under the details',
 *     okLabel:   'Continue',
 *     onClose:   function () {}     // called once when the popup closes (button, X, Esc)
 *   });
 *
 *   GTG_PAYMENT_STATUS.stepsHtml(status, { submitted: 'Nov 10, 2026', checked: 'Nov 11, 2026' })
 *     -> the 3-step tracker: Payment submitted > Owner verification > Sessions confirmed
 *
 * Status (set by the owner in ownerpayments.html, kept by payment-store.js):
 *   pending  -> the owner has not checked the payment yet
 *   verified -> the owner checked it, sessions are confirmed
 *   rejected -> the owner could not verify it
 */
(function () {
  'use strict';

  var dlg, onClose = null;

  function peso(n) { return '₱' + Number(n).toLocaleString('en-PH'); }
  function esc(t) { var e = document.createElement('span'); e.textContent = t == null ? '' : t; return e.innerHTML; }

  var TEXT = {
    pending:  { chip: 'Pending verification', msg: 'We received your payment details. The owner will check your payment and verify it. The status updates here and on your Payment page.' },
    verified: { chip: 'Verified',             msg: 'The owner verified your payment. Your sessions are confirmed.' },
    rejected: { chip: 'Rejected',             msg: 'The owner could not verify this payment. Please visit the GTG Fitness front desk or send the payment again.' }
  };

  // The three steps. state is one of: done | current | failed | todo
  function stepsHtml(status, dates) {
    dates = dates || {};
    var s2 = status === 'verified' ? 'done' : status === 'rejected' ? 'failed' : 'current';
    var s3 = status === 'verified' ? 'done' : 'todo';
    var steps = [
      ['done', 'Payment submitted', dates.submitted || ''],
      [s2, 'Owner verification',
        status === 'verified' ? (dates.checked ? 'Checked ' + dates.checked : 'Checked by the owner')
          : status === 'rejected' ? 'Could not be verified'
          : 'Waiting for the owner to check your payment'],
      [s3, 'Sessions confirmed', status === 'verified' ? 'You are all set' : 'Unlocks after verification']
    ];
    var mark = { done: '✓', failed: '✕', current: '', todo: '' };
    return steps.map(function (st) {
      return '<li class="pay-steps__item is-' + st[0] + '">' +
        '<span class="pay-steps__dot" aria-hidden="true">' + mark[st[0]] + '</span>' +
        '<div><strong>' + esc(st[1]) + '</strong>' + (st[2] ? '<span>' + esc(st[2]) + '</span>' : '') + '</div></li>';
    }).join('');
  }

  function build() {
    dlg = document.createElement('dialog');
    dlg.id = 'payment-status-modal';
    dlg.className = 'payment-modal';
    dlg.setAttribute('aria-labelledby', 'ps-title');
    dlg.innerHTML = [
'<div class="pay-status">',
'  <div class="pay-status__head"><h2 id="ps-title">Payment status</h2><span class="pay-status__chip" id="ps-chip"></span></div>',
'  <p class="pay-status__msg" id="ps-msg"></p>',
'  <ol class="pay-steps" id="ps-steps"></ol>',
'  <ul class="pay-status__list" id="ps-list"></ul>',
'  <p class="pay-status__note" id="ps-note"></p>',
'  <div class="payment-modal__actions"><button type="button" class="btn btn-navy" id="ps-ok">Continue</button></div>',
'</div>'
    ].join('\n');
    document.body.appendChild(dlg);
    document.getElementById('ps-ok').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () {
      var cb = onClose; onClose = null;        // fire once
      if (typeof cb === 'function') cb();
    });
  }

  window.GTG_PAYMENT_STATUS = {
    TEXT: TEXT,
    stepsHtml: stepsHtml,
    open: function (o) {
      if (!dlg) build();
      var p = o.payment || {};
      var status = TEXT[p.status] ? p.status : 'pending';
      onClose = o.onClose || null;

      var chip = document.getElementById('ps-chip');
      chip.textContent = TEXT[status].chip;
      chip.className = 'pay-status__chip pay-status__chip--' + status;
      document.getElementById('ps-msg').textContent = TEXT[status].msg;
      document.getElementById('ps-steps').innerHTML = stepsHtml(status, {
        submitted: window.GTG_PAYMENTS ? window.GTG_PAYMENTS.fmtDate(new Date().toISOString()) : ''
      });

      var rows = [['Class', o.className || '—'], ['Package', o.pkg || '—'], ['Amount', peso(p.total || 0)], ['Paid via', p.via || '—']];
      if (p.reference) rows.push(['Reference', p.reference]);
      if (p.email) rows.push(['Email', p.email]);
      document.getElementById('ps-list').innerHTML = rows.map(function (r) {
        return '<li><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></li>';
      }).join('');

      var note = document.getElementById('ps-note');
      note.textContent = o.note || '';
      note.hidden = !o.note;
      document.getElementById('ps-ok').textContent = o.okLabel || 'Continue';

      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }
  };
})();