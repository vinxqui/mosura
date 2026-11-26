/* Shared member measurements: the link between the member and the trainer.
 *
 * The member fills in the form on memberdashboard.html -> saved here.
 * The trainer opens trainerprogress.html -> reads the same data and shows it in the Measurements table.
 *
 * For now it is kept in this browser's localStorage (key: gtg_member_measurements) so both pages work
 * without a backend. When the backend is ready, only get() and save() need to change
 * (for example a call to a tbl_MemberMeasurements table keyed by member id). Nothing else has to change.
 *
 * Shape saved per member:
 *   { goal: 'Bulking' | 'Cutting' | 'Maintain',
 *     ft, inch,                 // height
 *     weight, muscle,           // kg
 *     bmi,                      // calculated from height + weight
 *     targetWeight, targetMuscle,   // optional goals (kg), null if not set
 *     updated: ISO date string,
 *     prev: { weight, muscle, bmi } | null }   // the previous update, used for the "Change" column
 */
(function () {
  'use strict';

  var KEY = 'gtg_member_measurements';
  // The logged-in member's id: "lastname-firstname" (the same ids the trainer's member list uses).
  // Falls back to the demo member when nobody is logged in.
  var MEMBER_ID = (function () {
    try {
      var u = JSON.parse(localStorage.getItem('currentUser') || 'null');
      if (u && u.role === 'member' && u.lastName) {
        return (u.lastName + '-' + (u.firstName || '')).toLowerCase().trim()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      }
    } catch (e) { /* ignore */ }
    return 'madriaga-rafaela';
  })();
  var GOALS = ['Bulking', 'Cutting', 'Maintain'];

  function readAll() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function writeAll(all) {
    try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) { return false; }
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  // BMI = kg / (metres squared). Height comes in as feet + inches.
  function bmi(kg, ft, inch) {
    var m = (((+ft || 0) * 12) + (+inch || 0)) * 2.54 / 100;
    if (!(kg > 0) || !(m > 0)) return 0;
    return round1(kg / (m * m));
  }

  function bmiLabel(v) {
    if (!(v > 0)) return '';
    if (v < 18.5) return 'Underweight';
    if (v < 25) return 'Normal';
    if (v < 30) return 'Overweight';
    return 'Obese';
  }

  function heightLabel(ft, inch) { return ft + "'" + (inch || 0); }

  function get(memberId) { return readAll()[memberId] || null; }

  function save(memberId, data) {
    var all = readAll();
    var old = all[memberId];
    var entry = {
      goal: data.goal,
      ft: +data.ft, inch: +data.inch || 0,
      weight: +data.weight, muscle: +data.muscle,
      bmi: bmi(+data.weight, data.ft, data.inch),
      targetWeight: data.targetWeight > 0 ? +data.targetWeight : null,
      targetMuscle: data.targetMuscle > 0 ? +data.targetMuscle : null,
      updated: new Date().toISOString(),
      prev: old ? { weight: old.weight, muscle: old.muscle, bmi: old.bmi } : null
    };
    all[memberId] = entry;
    return writeAll(all) ? entry : null;
  }

  // "+2kg", "-1kg", "0kg" (or "—" when there is nothing to compare against yet)
  function diff(cur, prev, unit) {
    if (prev == null) return '—';
    var d = round1(cur - prev);
    return (d > 0 ? '+' : '') + d + (unit || '');
  }

  // Rows for the trainer's table: [category, current, goal, change]
  function rows(entry) {
    var p = entry.prev;
    var targetBmi = entry.targetWeight ? bmi(entry.targetWeight, entry.ft, entry.inch) : null;
    return [
      ['Height', heightLabel(entry.ft, entry.inch), '—', '—'],
      ['Weight', entry.weight + 'kg', entry.targetWeight ? entry.targetWeight + 'kg' : '—', diff(entry.weight, p && p.weight, 'kg')],
      ['BMI', String(entry.bmi), targetBmi ? String(targetBmi) : '—', diff(entry.bmi, p && p.bmi, '')],
      ['Muscle Mass', entry.muscle + 'kg', entry.targetMuscle ? entry.targetMuscle + 'kg' : '—', diff(entry.muscle, p && p.muscle, 'kg')]
    ];
  }

  window.GTG_MEASUREMENTS = {
    KEY: KEY, MEMBER_ID: MEMBER_ID, GOALS: GOALS,
    get: get, save: save, rows: rows,
    bmi: bmi, bmiLabel: bmiLabel, heightLabel: heightLabel
  };
})();