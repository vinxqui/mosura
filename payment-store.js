/* payment-store.js: shared payment records (member <-> owner).
 *
 * Every payment starts as "pending". The owner checks it (reference number, amount)
 * on ownerpayments.html and marks it "verified" (or "rejected"). The member sees the
 * status on the Payment page, in the payment popup and on the Booking Date page.
 *
 * For now it is kept in this browser's localStorage (key: gtg_payments) so the member
 * pages and the owner page work without a backend. When the backend is ready, only
 * read() / write() need to change (for example a tbl_Payments table). Nothing else does.
 *
 * Record shape:
 *   { id, member, kind: 'class' | 'equipment', className, category, amount,
 *     via, reference, email, createdAt (ISO), status: 'pending' | 'verified' | 'rejected',
 *     verifiedAt (ISO | null), taken, total (sessions; null = unlimited) }
 */
(function () {
  'use strict';

  var KEY = 'gtg_payments';
  // Demo member. When the backend is ready, use the logged-in member here.
  var MEMBER = (function () {
    try {
      var u = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (u && u.lastName) return u.lastName + ', ' + (u.firstName || '');
    } catch (e) { /* ignore */ }
    return 'Madriaga, Rafaela';
  })();
  var LABEL = { pending: 'Pending verification', verified: 'Verified', rejected: 'Rejected' };

  // First run only: a few sample records so the Payment page and the owner page are not empty.
  // Delete this block once real records come from the backend.
  function demo() {
    return [
      { id: 'demo-1', member: MEMBER, kind: 'class', className: 'Muay Thai', category: '4-Session Pack', amount: 500, via: 'GCash',
        reference: '1234 5678 9012', email: '', createdAt: '2026-11-03T09:00:00.000Z', status: 'verified', verifiedAt: '2026-11-03T11:30:00.000Z', taken: 2, total: 4 },
      { id: 'demo-2', member: MEMBER, kind: 'class', className: 'Muay Thai', category: 'Single Session', amount: 150, via: 'GCash',
        reference: '5555 4444 3333', email: '', createdAt: '2026-10-12T09:00:00.000Z', status: 'verified', verifiedAt: '2026-10-12T10:00:00.000Z', taken: 1, total: 1 },
      { id: 'demo-3', member: MEMBER, kind: 'class', className: 'Taekwondo', category: '4-Session Pack', amount: 500, via: 'GCash',
        reference: '9876 5432 1098', email: '', createdAt: '2026-11-10T09:00:00.000Z', status: 'pending', verifiedAt: null, taken: 0, total: 4 }
    ];
  }

  function write(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  function read() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw === null) { var d = demo(); write(d); return d; }
      return JSON.parse(raw) || [];
    } catch (e) { return []; }
  }

  // Newest first
  function list() {
    return read().sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }

  function get(id) {
    return read().filter(function (p) { return p.id === id; })[0] || null;
  }

  // New payments always start as pending.
  function add(o) {
    var all = read();
    var rec = {
      id: 'p' + Date.now(),
      member: o.member || MEMBER,
      kind: o.kind || 'class',
      className: o.className || 'Order',
      category: o.category || '',
      amount: Number(o.amount) || 0,
      via: o.via || '',
      reference: o.reference || '',
      email: o.email || '',
      createdAt: new Date().toISOString(),
      status: 'pending',
      verifiedAt: null,
      taken: 0,
      total: o.total === undefined ? null : o.total
    };
    all.push(rec);
    return write(all) ? rec : rec;   // still usable by the popup even if storage is blocked
  }

  // Owner action: 'verified' or 'rejected' (or back to 'pending')
  function setStatus(id, status) {
    var all = read(), hit = null;
    all.forEach(function (p) {
      if (p.id === id) {
        p.status = status;
        p.verifiedAt = status === 'pending' ? null : new Date().toISOString();
        hit = p;
      }
    });
    return hit && write(all) ? hit : null;
  }

  function counts() {
    var c = { pending: 0, verified: 0, rejected: 0 };
    read().forEach(function (p) { if (c[p.status] !== undefined) c[p.status]++; });
    return c;
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }

  /* ---- Month / Year / Category filters (shared by the member and owner payment pages) ----
   * GTG_PAYMENTS.filters({ month: el, year: el, category: el (optional) }, onChange)
   *   fills the dropdowns and returns { refresh(records), match(record) }.
   *   refresh() rebuilds the Year / Category options from the records (keeps the pick),
   *   match() says if a record passes the current Month + Year + Category choice. */
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
                'August', 'September', 'October', 'November', 'December'];

  function opt(value, text) {
    var o = document.createElement('option');
    o.value = value; o.textContent = text;
    return o;
  }

  function fillSelect(sel, allText, values, labelOf) {
    var keep = sel.value;
    sel.textContent = '';
    sel.appendChild(opt('', allText));
    values.forEach(function (v) { sel.appendChild(opt(String(v), labelOf ? labelOf(v) : v)); });
    sel.value = values.map(String).indexOf(keep) !== -1 ? keep : '';
  }

  function filters(els, onChange) {
    fillSelect(els.month, 'All months', MONTHS.map(function (m, i) { return i; }), function (i) { return MONTHS[i]; });
    function refresh(records) {
      var years = {}, cats = {};
      (records || []).forEach(function (r) {
        var d = new Date(r.createdAt);
        if (!isNaN(d)) years[d.getFullYear()] = true;
        if (r.className) cats[r.className] = true;
      });
      years[new Date().getFullYear()] = true;
      fillSelect(els.year, 'All years', Object.keys(years).sort(function (a, b) { return b - a; }));
      if (els.category) fillSelect(els.category, 'All categories', Object.keys(cats).sort());
    }
    function match(r) {
      var d = new Date(r.createdAt);
      if (els.month.value !== '' && (isNaN(d) || d.getMonth() !== +els.month.value)) return false;
      if (els.year.value !== '' && (isNaN(d) || d.getFullYear() !== +els.year.value)) return false;
      if (els.category && els.category.value !== '' && r.className !== els.category.value) return false;
      return true;
    }
    [els.month, els.year, els.category].forEach(function (s) {
      if (s) s.addEventListener('change', function () { if (onChange) onChange(); });
    });
    return { refresh: refresh, match: match };
  }

  window.GTG_PAYMENTS = {
    KEY: KEY, LABEL: LABEL, filters: filters,
    list: list, get: get, add: add, setStatus: setStatus, counts: counts, fmtDate: fmtDate, fmtDateTime: fmtDateTime
  };
})();