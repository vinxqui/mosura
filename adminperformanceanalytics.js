/* GTG Fitness – Performance Analytics (owner only)
   KPI cards and charts drawn without any library.
   Revenue, membership growth and attendance below are SAMPLE figures until real records exist.
   "Members by class" is real: it reads the Classes list ("gtg_classes"). */
(function () {
  'use strict';

  // Fail closed: nothing is built unless the signed-in role is allowed
  if (!window.GTGAuth || !GTGAuth.guard({ page: 'Performance Analytics', min: 'owner' })) return;
  document.getElementById('op-skeleton').hidden = true;
  document.getElementById('op-content').hidden = false;

  function $(id) { return document.getElementById(id); }
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- sample data: the last 12 months, oldest first ---------- */
  var REVENUE = [182000, 190500, 176200, 205800, 214300, 223900, 219500, 231800, 240100, 236700, 252400, 261000];
  var MEMBERS = [210, 224, 231, 247, 262, 275, 283, 296, 310, 318, 331, 345];
  var ATTENDANCE = [58, 61, 57, 66, 70, 73, 71, 76, 79, 77, 83, 86];       // average people per day
  var WEEKDAY = [['Sun', 22], ['Mon', 74], ['Tue', 69], ['Wed', 71], ['Thu', 66], ['Fri', 58], ['Sat', 49]];
  var STARTING_MEMBERS = 196;                                              // the month before the data begins

  var now = new Date();
  var MONTH_LABELS = REVENUE.map(function (_, i) {
    return new Date(now.getFullYear(), now.getMonth() - (REVENUE.length - 1 - i), 1)
      .toLocaleDateString('en-PH', { month: 'short' });
  });
  var NEW_MEMBERS = MEMBERS.map(function (m, i) { return m - (i === 0 ? STARTING_MEMBERS : MEMBERS[i - 1]); });

  /* ---------- helpers ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function svgEl(name, attrs) {
    var n = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    return n;
  }
  function sum(a) { return a.reduce(function (s, v) { return s + v; }, 0); }
  function peso(n) { return '\u20B1' + Math.round(n).toLocaleString('en-PH'); }
  function pesoShort(n) { return n >= 1000 ? '\u20B1' + Math.round(n / 1000) + 'k' : '\u20B1' + n; }
  function pct(a, b) { return b ? (a - b) / b * 100 : 0; }

  function setDelta(id, text, change) {
    var d = $(id);
    d.textContent = text;
    d.className = 'op-stat__delta' + (change > 0 ? ' is-up' : change < 0 ? ' is-down' : '');
  }
  function signed(n, suffix) { return (n > 0 ? '+' : '') + n + (suffix || ''); }

  /* ---------- charts ---------- */
  function vbars(container, data, format, label) {
    container.innerHTML = '';
    container.setAttribute('aria-label', label);
    var max = Math.max.apply(null, data.map(function (d) { return d[1]; })) || 1;
    data.forEach(function (d) {
      var col = el('div', 'op-vbar');
      col.title = d[0] + ': ' + (format.full ? format.full(d[1]) : d[1]);
      col.appendChild(el('span', 'op-vbar__val', format.short(d[1])));
      var bar = el('div', 'op-vbar__bar');
      bar.style.height = (d[1] / max * 74) + '%';
      col.appendChild(bar);
      col.appendChild(el('span', 'op-vbar__label', d[0]));
      container.appendChild(col);
    });
  }

  function lineChart(container, labels, values, label) {
    container.innerHTML = '';
    container.setAttribute('aria-label', label);
    var W = 600, H = 230, L = 44, R = 16, T = 16, B = 30;
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var pad = (max - min) * 0.15 || 1;
    min -= pad; max += pad;
    var n = values.length;
    function x(i) { return n === 1 ? (L + W - R) / 2 : L + i * ((W - L - R) / (n - 1)); }
    function y(v) { return T + (1 - (v - min) / (max - min)) * (H - T - B); }

    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, 'class': 'op-line', 'aria-hidden': 'true' });

    for (var g = 0; g <= 3; g++) {
      var v = min + (max - min) * g / 3, gy = y(v);
      var gl = svgEl('line', { x1: L, x2: W - R, y1: gy, y2: gy });
      gl.style.stroke = '#eef0f3';
      svg.appendChild(gl);
      var gt = svgEl('text', { x: L - 8, y: gy + 4, 'text-anchor': 'end' });
      gt.textContent = Math.round(v);
      svg.appendChild(gt);
    }

    var pts = values.map(function (v, i) { return x(i) + ',' + y(v); }).join(' ');
    var area = svgEl('polygon', { points: x(0) + ',' + (H - B) + ' ' + pts + ' ' + x(n - 1) + ',' + (H - B) });
    area.style.fill = 'rgba(22, 50, 79, .08)';
    svg.appendChild(area);

    var line = svgEl('polyline', { points: pts });
    line.style.fill = 'none'; line.style.stroke = 'var(--op-navy)'; line.style.strokeWidth = '3';
    line.style.strokeLinejoin = 'round'; line.style.strokeLinecap = 'round';
    svg.appendChild(line);

    values.forEach(function (v, i) {
      var c = svgEl('circle', { cx: x(i), cy: y(v), r: 4 });
      c.style.fill = '#fff'; c.style.stroke = 'var(--op-navy)'; c.style.strokeWidth = '2.5';
      var t = svgEl('title');
      t.textContent = labels[i] + ': ' + v + ' members';
      c.appendChild(t);
      svg.appendChild(c);
      var lt = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle' });
      lt.textContent = labels[i];
      svg.appendChild(lt);
    });
    container.appendChild(svg);
  }

  function classBars() {
    var list = $('chart-classes');
    var note = $('class-note');
    var data = null;
    try {
      var raw = localStorage.getItem('gtg_classes');
      if (raw) { var parsed = JSON.parse(raw); if (Array.isArray(parsed)) data = parsed; }
    } catch (err) { /* use the sample counts below */ }
    if (data) {
      note.textContent = 'Live from your Classes page';
    } else {
      data = [{ name: 'Boxing', members: 11 }, { name: 'Muay Thai', members: 7 }, { name: 'Taekwondo', members: 12 },
              { name: 'Yoga', members: 5 }, { name: 'Zumba', members: 15 }];
      note.textContent = 'Sample counts until the Classes page has been opened';
    }
    data = data.slice().sort(function (a, b) { return b.members - a.members; });
    var max = Math.max.apply(null, data.map(function (c) { return c.members; })) || 1;

    list.innerHTML = '';
    if (!data.length) { list.appendChild(el('li', 'op-empty', 'No classes yet.')); return; }
    data.forEach(function (c) {
      var li = el('li', 'op-bar');
      li.appendChild(el('span', 'op-bar__label', c.name));
      var track = el('span', 'op-bar__track');
      var fill = el('span', 'op-bar__fill');
      fill.style.width = (c.members / max * 100) + '%';
      track.appendChild(fill);
      li.appendChild(track);
      li.appendChild(el('span', 'op-bar__value', String(c.members)));
      list.appendChild(li);
    });
  }

  /* ---------- render for the chosen period ---------- */
  function render() {
    var n = +$('period').value;
    var total = REVENUE.length;
    var from = total - n;
    var last = total - 1;

    // KPI cards
    $('kpi-revenue').textContent = peso(sum(REVENUE.slice(from)));
    var rChange = pct(REVENUE[last], REVENUE[last - 1]);
    setDelta('kpi-revenue-d', signed(rChange.toFixed(1), '%') + ' last month vs the month before', rChange);

    $('kpi-members').textContent = MEMBERS[last];
    var mGain = MEMBERS[last] - MEMBERS[last - 1];
    setDelta('kpi-members-d', signed(mGain) + ' this month', mGain);

    $('kpi-new').textContent = sum(NEW_MEMBERS.slice(from));
    setDelta('kpi-new-d', 'In the last ' + n + ' months', 0);

    var avgAtt = sum(ATTENDANCE.slice(from)) / n;
    $('kpi-att').textContent = Math.round(avgAtt);
    var aChange = pct(ATTENDANCE[last], ATTENDANCE[last - 1]);
    setDelta('kpi-att-d', signed(aChange.toFixed(1), '%') + ' last month vs the month before', aChange);

    // Charts
    var revData = MONTH_LABELS.slice(from).map(function (m, i) { return [m, REVENUE[from + i]]; });
    vbars($('chart-revenue'), revData, { short: pesoShort, full: peso },
      'Revenue by month: ' + revData.map(function (d) { return d[0] + ' ' + peso(d[1]); }).join(', '));

    lineChart($('chart-growth'), MONTH_LABELS.slice(from), MEMBERS.slice(from),
      'Total members by month, from ' + MEMBERS[from] + ' to ' + MEMBERS[last]);

    vbars($('chart-weekday'), WEEKDAY, { short: String, full: function (v) { return v + ' people on average'; } },
      'Average attendance by weekday: ' + WEEKDAY.map(function (d) { return d[0] + ' ' + d[1]; }).join(', '));

    classBars();
  }

  $('period').addEventListener('change', render);
  document.addEventListener('click', function (ev) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(ev.target)) d.removeAttribute('open');
    });
  });

  /* ---------- print / save as PDF ---------- */
  var originalTitle = document.title;

  function fillPrintMeta() {
    var period = $('period').options[$('period').selectedIndex].text;
    $('print-meta').textContent = 'GTG Fitness \u00B7 ' + period + ' \u00B7 Generated ' +
      new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });
    // the browser uses the page title as the default PDF file name
    document.title = 'GTG-Performance-Report-' + new Date().toISOString().slice(0, 10);
  }

  window.addEventListener('beforeprint', fillPrintMeta);
  window.addEventListener('afterprint', function () { document.title = originalTitle; });
  $('print-report').addEventListener('click', function () { window.print(); });

  render();
})();
