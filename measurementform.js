/* The "My Measurements" popup, shared by the member dashboard and the booking flow.
 * Needs measurement.js loaded first.
 *
 *   GTG_MEASURE_FORM.open({
 *     title:   'My Measurements',          // optional
 *     intro:   'Short line under the title', // optional
 *     skipLabel: 'Skip for now',           // optional: adds a skip button
 *     onSave:  function (entry) {},        // optional: called after a successful save
 *     onClose: function () {}              // optional: called once when the popup closes (saved, skipped, X or Esc)
 *   });
 *
 *   GTG_MEASURE_FORM.ask({ onDone: function () {} })
 *     Small popup that asks "Do you want to track your measurements?".
 *     Yes -> opens the form above; Not now -> closes. onDone runs once at the end either way.

 */
(function () {
  'use strict';

  var M = window.GTG_MEASUREMENTS;
  var dlg, form, opts = {}, saved = false;

  function $(id) { return document.getElementById(id); }

  function build() {
    dlg = document.createElement('dialog');
    dlg.id = 'measure-modal';
    dlg.className = 'payment-modal';
    dlg.setAttribute('aria-labelledby', 'measure-title');
    dlg.innerHTML = [
'<form class="payment-modal__inner measure-form" id="measure-form" novalidate>',
'  <div class="payment-modal__header">',
'    <h2 id="measure-title">My Measurements</h2>',
'    <button type="button" class="payment-modal__close" aria-label="Close measurements dialog" id="measure-close">',
'      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
'    </button>',
'  </div>',
'  <p class="measure-intro" id="measure-intro" hidden></p>',
'  <fieldset class="goal-options">',
'    <legend class="field-label">Your goal</legend>',
'    <label class="goal-option"><input type="radio" name="goal" value="Bulking" /><span>Bulking</span></label>',
'    <label class="goal-option"><input type="radio" name="goal" value="Cutting" /><span>Cutting</span></label>',
'    <label class="goal-option"><input type="radio" name="goal" value="Maintain" /><span>Maintain</span></label>',
'  </fieldset>',
'  <span class="field-label">Height</span>',
'  <div class="input-row">',
'    <div><label for="m-ft" class="visually-hidden">Height, feet</label>',
'      <input type="number" id="m-ft" class="input-native" placeholder="Feet (e.g. 5)" min="3" max="8" step="1" inputmode="numeric" /></div>',
'    <div><label for="m-in" class="visually-hidden">Height, inches</label>',
'      <input type="number" id="m-in" class="input-native" placeholder="Inches (e.g. 4)" min="0" max="11" step="1" inputmode="numeric" /></div>',
'  </div>',
'  <div class="input-row">',
'    <div><label for="m-weight" class="field-label">Weight (kg)</label>',
'      <input type="number" id="m-weight" class="input-native" placeholder="e.g. 54" min="20" max="300" step="0.1" inputmode="decimal" /></div>',
'    <div><label for="m-muscle" class="field-label">Muscle mass (kg)</label>',
'      <input type="number" id="m-muscle" class="input-native" placeholder="e.g. 40" min="10" max="150" step="0.1" inputmode="decimal" /></div>',
'  </div>',
'  <p class="bmi-readout" id="m-bmi-readout" aria-live="polite"></p>',
'  <span class="field-label">Targets <small>(optional)</small></span>',
'  <div class="input-row">',
'    <div><label for="m-tweight" class="visually-hidden">Target weight in kg</label>',
'      <input type="number" id="m-tweight" class="input-native" placeholder="Target weight (kg)" min="20" max="300" step="0.1" inputmode="decimal" /></div>',
'    <div><label for="m-tmuscle" class="visually-hidden">Target muscle mass in kg</label>',
'      <input type="number" id="m-tmuscle" class="input-native" placeholder="Target muscle (kg)" min="10" max="150" step="0.1" inputmode="decimal" /></div>',
'  </div>',
'  <p class="measure-error" id="m-error" role="alert" hidden></p>',
'  <div class="payment-modal__actions measure-actions">',
'    <button type="button" class="btn measure-skip" id="measure-skip" hidden>Skip for now</button>',
'    <button type="submit" class="btn btn-navy">Send to my trainer</button>',
'  </div>',
'</form>'
    ].join('\n');
    document.body.appendChild(dlg);
    form = $('measure-form');

    ['m-ft', 'm-in', 'm-weight'].forEach(function (id) { $(id).addEventListener('input', updateBmi); });
    $('measure-close').addEventListener('click', function () { dlg.close(); });
    $('measure-skip').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    form.addEventListener('submit', onSubmit);
    dlg.addEventListener('close', function () {
      var cb = opts.onClose; opts.onClose = null;     // fire once
      if (typeof cb === 'function') cb(saved);
    });
  }

  function updateBmi() {
    var v = M.bmi(parseFloat($('m-weight').value), $('m-ft').value, $('m-in').value);
    $('m-bmi-readout').innerHTML = 'BMI: <strong>' + (v ? v + ' &middot; ' + M.bmiLabel(v) : '&mdash;') +
      '</strong> (calculated from your height and weight)';
  }

  function fill(d) {
    form.reset();
    if (d) {
      var r = form.querySelector('input[name="goal"][value="' + d.goal + '"]');
      if (r) r.checked = true;
      $('m-ft').value = d.ft; $('m-in').value = d.inch;
      $('m-weight').value = d.weight; $('m-muscle').value = d.muscle;
      $('m-tweight').value = d.targetWeight || ''; $('m-tmuscle').value = d.targetMuscle || '';
    }
    $('m-error').hidden = true;
    updateBmi();
  }

  function fail(msg) { var e = $('m-error'); e.textContent = msg; e.hidden = false; }
  function inRange(el) { var v = parseFloat(el.value); return v >= +el.min && v <= +el.max; }

  function onSubmit(e) {
    e.preventDefault();
    var goal = form.querySelector('input[name="goal"]:checked');
    if (!goal) return fail('Please choose your goal: bulking, cutting or maintain.');
    if (!inRange($('m-ft')) || !inRange($('m-in'))) return fail('Please enter your height in feet and inches (inches 0–11).');
    if (!inRange($('m-weight'))) return fail('Please enter your weight in kg.');
    if (!inRange($('m-muscle'))) return fail('Please enter your muscle mass in kg.');
    if ($('m-tweight').value && !inRange($('m-tweight'))) return fail('Target weight looks off. Please check it.');
    if ($('m-tmuscle').value && !inRange($('m-tmuscle'))) return fail('Target muscle mass looks off. Please check it.');

    var entry = M.save(M.MEMBER_ID, {
      goal: goal.value,
      ft: $('m-ft').value, inch: $('m-in').value,
      weight: $('m-weight').value, muscle: $('m-muscle').value,
      targetWeight: parseFloat($('m-tweight').value), targetMuscle: parseFloat($('m-tmuscle').value)
    });
    if (!entry) return fail('Could not save. Please check your browser storage settings and try again.');
    saved = true;
    if (typeof opts.onSave === 'function') opts.onSave(entry);
    dlg.close();
  }

  /* ---------- "Do you want to track your measurements?" ---------- */
  var askDlg, askDone = null, askChoice = 'no';

  function buildAsk() {
    askDlg = document.createElement('dialog');
    askDlg.id = 'measure-ask-modal';
    askDlg.className = 'payment-modal';
    askDlg.setAttribute('aria-labelledby', 'measure-ask-title');
    askDlg.innerHTML = [
'<div class="payment-modal__inner payment-success-view">',
'  <div class="payment-success__icon measure-ask__icon" aria-hidden="true">',
'    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 8-8"></path><path d="M15 7h6v6"></path></svg>',
'  </div>',
'  <h2 class="payment-success__title" id="measure-ask-title">Track your progress?</h2>',
'  <p class="payment-success__subtitle">Do you want to track your measurements? Your trainer will see them and plan your sessions around your goal.</p>',
'  <button type="button" class="btn btn-navy booking-continue-btn payment-success__close" id="measure-ask-yes">Yes, track my measurements</button>',
'  <button type="button" class="btn measure-skip measure-ask__no" id="measure-ask-no">Not now</button>',
'</div>'
    ].join('\n');
    document.body.appendChild(askDlg);
    $('measure-ask-yes').addEventListener('click', function () { askChoice = 'yes'; askDlg.close(); });
    $('measure-ask-no').addEventListener('click', function () { askChoice = 'no'; askDlg.close(); });
    askDlg.addEventListener('close', function () {
      var done = askDone; askDone = null;               // run once
      if (askChoice === 'yes') {
        window.GTG_MEASURE_FORM.open({
          title: 'Your measurements',
          intro: 'You can update these any time. Your trainer sees what you send here.',
          skipLabel: 'Skip for now',
          onClose: done
        });
      } else if (typeof done === 'function') { done(); }
    });
  }

  function ask(o) {
    if (!askDlg) buildAsk();
    askDone = (o && o.onDone) || null;
    askChoice = 'no';                                   // X / Esc / backdrop count as "Not now"
    askDlg.addEventListener('click', function onBackdrop(e) {
      if (e.target === askDlg) askDlg.close();
    }, { once: true });
    if (askDlg.showModal) askDlg.showModal(); else askDlg.setAttribute('open', '');
  }

  window.GTG_MEASURE_FORM = {
    ask: ask,
    open: function (o) {
      if (!dlg) build();
      opts = o || {};
      saved = false;
      $('measure-title').textContent = opts.title || 'My Measurements';
      var intro = $('measure-intro');
      intro.textContent = opts.intro || '';
      intro.hidden = !opts.intro;
      var skip = $('measure-skip');
      skip.textContent = opts.skipLabel || 'Skip for now';
      skip.hidden = !opts.skipLabel;
      fill(M.get(M.MEMBER_ID));
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    }
  };
})();