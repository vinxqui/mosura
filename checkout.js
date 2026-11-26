/* =========================================================
   checkout.js — shared payment popup (payment channels).
   Usage:
     GTGCheckout.open({
       ref:     'Boxing',                       // used in the QR code text
       lines:   [{ label: 'Boxing · 2 Sessions', amount: 650 }, ...],
       total:   780,
       what:    '2 Sessions for Boxing + 3 equipment items',
       doneLabel: 'Back to Classes',            // optional
       kind: 'class',                           // optional: 'class' | 'equipment' (how it is filed in the payment records)
       className: 'Boxing',                     // optional: group name shown on the Payment page
       category: '5 Sessions',                  // optional: package / item name shown on the Payment page
       sessions: 5,                             // optional: sessions included (null = unlimited)
       onConfirm: function (payment) { ... }   // optional; payment = { id, status, channel, via, email, total, lines, what, reference }

   Every payment is saved as PENDING (payment-store.js). The owner verifies it later.
     });
   ========================================================= */
(function () {
  'use strict';

  var CHANNELS = {
    gcash: 'GCash',
    maya:  'Maya',
    card:  'Credit / Debit Card',
    bank:  'Bank Transfer',
    cash:  'Pay at Front Desk'
  };

  var dialog, els = {}, order = null;

  function peso(n) { return '\u20B1' + Number(n).toLocaleString('en-PH'); }

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'payment-modal booking-modal';
    dialog.id = 'checkout-modal';
    dialog.innerHTML = [
'<div class="payment-modal__inner" id="co-form-view">',
'  <div class="payment-modal__header">',
'    <h2>Payment</h2>',
'    <button type="button" class="payment-modal__close" aria-label="Close" data-co-close>',
'      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>',
'    </button>',
'  </div>',
'  <div class="order-summary">',
'    <ul class="order-summary__list" id="co-summary-list"></ul>',
'    <p class="order-summary__total"><span>Total</span> <strong id="co-summary-total">\u20B10</strong></p>',
'  </div>',
'  <div class="field-group">',
'    <label id="co-method-label">Select Payment Channel:</label>',
'    <div class="channel-grid" role="radiogroup" aria-labelledby="co-method-label">',
'      <label class="channel-option"><input type="radio" name="co-method" value="gcash" checked />',
'        <img class="gcash-logo" src="https://upload.wikimedia.org/wikipedia/commons/5/52/GCash_logo.svg" alt="GCash" /></label>',
'      <label class="channel-option"><input type="radio" name="co-method" value="maya" />',
'        <span class="channel-option__text channel-option__text--maya">maya</span></label>',
'      <label class="channel-option"><input type="radio" name="co-method" value="card" />',
'        <span class="channel-option__text">Credit / Debit Card</span></label>',
'      <label class="channel-option"><input type="radio" name="co-method" value="bank" />',
'        <span class="channel-option__text">Bank Transfer</span></label>',
'      <label class="channel-option channel-option--wide"><input type="radio" name="co-method" value="cash" />',
'        <span class="channel-option__text">Pay at Front Desk (Cash)</span></label>',
'    </div>',
'  </div>',
'  <label for="co-email" class="visually-hidden">Email</label>',
'  <input type="email" id="co-email" class="input-native" placeholder="Email" autocomplete="email" />',
'  <div id="co-gcash-panel">',
'    <h3>Scan to Pay</h3>',
'    <div class="qr-payment"><img id="co-gcash-qr" src="" alt="GCash payment QR code" />',
'      <p class="qr-payment__caption">Scan with your GCash app to pay <strong id="co-gcash-amount">\u20B10</strong></p></div>',
'    <input type="text" id="co-gcash-ref" class="input-native" placeholder="GCash reference number" inputmode="numeric" aria-label="GCash reference number" />',
'    <p class="field-hint">After paying, enter the reference number so the owner can verify your payment.</p>',
'  </div>',
'  <div id="co-maya-panel" hidden>',
'    <h3>Scan to Pay</h3>',
'    <div class="qr-payment"><img id="co-maya-qr" src="" alt="Maya payment QR code" />',
'      <p class="qr-payment__caption">Scan with your Maya app to pay <strong id="co-maya-amount">\u20B10</strong></p></div>',
'    <input type="text" id="co-maya-ref" class="input-native" placeholder="Maya reference number" inputmode="numeric" aria-label="Maya reference number" />',
'    <p class="field-hint">After paying, enter the reference number so the owner can verify your payment.</p>',
'  </div>',
'  <div id="co-card-panel" hidden>',
'    <h3>Payment Method</h3>',
'    <input type="text" id="co-card-number" class="input-native" placeholder="1234 1234 1234 1234" inputmode="numeric" aria-label="Card number" />',
'    <div class="input-row">',
'      <div><input type="text" id="co-card-expiry" class="input-native" placeholder="MM / YY" aria-label="Expiry date" /></div>',
'      <div><input type="text" id="co-card-cvc" class="input-native" placeholder="CVC" inputmode="numeric" aria-label="CVC" /></div>',
'    </div>',
'    <h3>Cardholder name</h3>',
'    <input type="text" id="co-card-name" class="input-native" placeholder="Full name on card" aria-label="Cardholder name" />',
'    <h3>Country or Region</h3>',
'    <select id="co-country" class="input-native select-native" aria-label="Country or region">',
'      <option>Philippines</option><option>United States</option><option>Singapore</option><option>Australia</option>',
'    </select>',
'  </div>',
'  <div id="co-bank-panel" hidden>',
'    <h3>Bank Transfer Details</h3>',
'    <select id="co-bank-name" class="input-native select-native" aria-label="Bank">',
'      <option value="BDO">BDO</option><option value="BPI">BPI</option><option value="UnionBank">UnionBank</option><option value="Metrobank">Metrobank</option>',
'    </select>',
'    <div class="bank-details">',
'      <p><span>Account name</span> <strong>GTG Fitness</strong></p>',
'      <p><span>Account no.</span> <strong>0000 0000 0000</strong></p>',
'      <p class="bank-details__note">Send the exact total, then enter your transfer reference number below.</p>',
'    </div>',
'    <input type="text" id="co-bank-ref" class="input-native" placeholder="Transfer reference number" aria-label="Transfer reference number" />',
'  </div>',
'  <div id="co-cash-panel" hidden>',
'    <h3>Pay at the Front Desk</h3>',
'    <p class="cash-note">Your order is reserved as pending. Pay the total at the GTG Fitness front desk; the owner will mark it verified once the cash is received.</p>',
'  </div>',
'  <div class="checkbox-row">',
'    <input type="checkbox" id="co-save-info" />',
'    <label for="co-save-info">Save my Information for faster checkout</label>',
'  </div>',
'  <div class="payment-modal__actions">',
'    <button type="button" class="btn btn-navy booking-continue-btn" id="co-confirm-btn">Continue</button>',
'  </div>',
'</div>',
'<div class="payment-modal__inner payment-success-view" id="co-success-view" hidden>',
'  <div class="payment-success__icon" aria-hidden="true">',
'    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="m8 12 3 3 5-6"></path></svg>',
'  </div>',
'  <h2 class="payment-success__title" id="co-success-title">Payment submitted!</h2>',
'  <p class="payment-success__subtitle" id="co-success-line"></p>',
'  <button type="button" class="btn btn-navy booking-continue-btn payment-success__close" id="co-done-btn" data-co-close>Done</button>',
'</div>'
    ].join('\n');
    document.body.appendChild(dialog);

    var ids = ['form-view', 'success-view', 'summary-list', 'summary-total', 'email',
               'gcash-panel', 'maya-panel', 'card-panel', 'bank-panel', 'cash-panel',
               'gcash-qr', 'gcash-amount', 'gcash-ref', 'maya-qr', 'maya-amount', 'maya-ref',
               'card-number', 'card-expiry', 'card-cvc', 'card-name',
               'bank-name', 'bank-ref', 'save-info', 'confirm-btn',
               'success-title', 'success-line', 'done-btn'];
    ids.forEach(function (id) { els[id] = document.getElementById('co-' + id); });

    dialog.querySelectorAll('input[name="co-method"]').forEach(function (r) {
      r.addEventListener('change', function () { showChannel(selected()); });
    });
    dialog.querySelectorAll('[data-co-close]').forEach(function (b) {
      b.addEventListener('click', function () { dialog.close(); });
    });
    dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
    els['confirm-btn'].addEventListener('click', confirm);
  }

  function selected() {
    var c = dialog.querySelector('input[name="co-method"]:checked');
    return c ? c.value : 'gcash';
  }

  function showChannel(channel) {
    ['gcash', 'maya', 'card', 'bank', 'cash'].forEach(function (k) {
      els[k + '-panel'].hidden = k !== channel;
    });
  }

  function qrUrl(channel) {
    return 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' +
      encodeURIComponent('GTGFITNESS-' + channel.toUpperCase() + '-' + (order.ref || 'ORDER') + '-' + order.total);
  }

  function confirm() {
    if (!order) return;
    if (!els.email.value.trim()) { els.email.focus(); return; }

    var channel = selected();
    if (channel === 'card') {
      var req = ['card-number', 'card-expiry', 'card-cvc', 'card-name'];
      for (var i = 0; i < req.length; i++) {
        if (!els[req[i]].value.trim()) { els[req[i]].focus(); return; }
      }
    }
    if (channel === 'bank' && !els['bank-ref'].value.trim()) { els['bank-ref'].focus(); return; }
    if ((channel === 'gcash' || channel === 'maya') && !els[channel + '-ref'].value.trim()) { els[channel + '-ref'].focus(); return; }

    var what = order.what || 'Your order';
    var via = channel === 'bank' ? 'Bank Transfer (' + els['bank-name'].value + ')' : CHANNELS[channel];

    var reference = '';
    if (channel === 'bank') reference = els['bank-ref'].value.trim();
    if (channel === 'gcash' || channel === 'maya') reference = els[channel + '-ref'].value.trim();

    // Save the payment. It always starts as PENDING until the owner verifies it.
    // (Card details are never saved, only the channel, reference number and email.)
    var record = null;
    if (window.GTG_PAYMENTS) {
      record = window.GTG_PAYMENTS.add({
        kind: order.kind, className: order.className || order.ref, category: order.category || what,
        amount: order.total, via: via, reference: reference, email: els.email.value.trim(),
        total: order.sessions
      });
    }

    els['success-title'].textContent = 'Payment submitted!';
    if (channel === 'cash') {
      els['success-line'].textContent = what + '. Please pay ' + peso(order.total) +
        ' at the front desk. Your payment stays pending until the owner confirms it.';
    } else {
      els['success-line'].textContent = what + ' via ' + via +
        '. Your payment is now pending: the owner will verify it and your status will update.';
    }

    els['form-view'].hidden = true;
    els['success-view'].hidden = false;
    if (typeof order.onConfirm === 'function') {
      // details of the payment, so the page can show its own follow-up message
      order.onConfirm({
        id: record ? record.id : null, status: 'pending',
        channel: channel, via: via, email: els.email.value.trim(),
        total: order.total, lines: order.lines || [], what: what,
        reference: reference
      });
    }
  }

  window.GTGCheckout = {
    peso: peso,
    open: function (o) {
      if (!dialog) build();
      order = o;

      els['form-view'].hidden = false;
      els['success-view'].hidden = true;
      els['done-btn'].textContent = o.doneLabel || 'Done';

      els['summary-list'].innerHTML = '';
      (o.lines || []).forEach(function (line) {
        var li = document.createElement('li');
        var a = document.createElement('span');
        var b = document.createElement('span');
        a.textContent = line.label;
        b.textContent = peso(line.amount);
        li.appendChild(a); li.appendChild(b);
        els['summary-list'].appendChild(li);
      });
      els['summary-total'].textContent = peso(o.total);

      ['email', 'card-number', 'card-expiry', 'card-cvc', 'card-name', 'bank-ref', 'gcash-ref', 'maya-ref'].forEach(function (k) {
        els[k].value = '';
      });
      els['bank-name'].selectedIndex = 0;
      els['save-info'].checked = false;
      dialog.querySelector('input[name="co-method"][value="gcash"]').checked = true;
      showChannel('gcash');

      els['gcash-amount'].textContent = peso(o.total);
      els['gcash-qr'].src = qrUrl('gcash');
      els['maya-amount'].textContent = peso(o.total);
      els['maya-qr'].src = qrUrl('maya');

      dialog.showModal();
    }
  };
})();