/* Which coaches are free, and when.
 *
 * For now this is a simple weekly timetable kept in this file so the booking page works on its own.
 * When the backend is ready, replace timesFor() with a call to the server that reads
 * tbl_TrainerAvailability (days off) and tbl_Schedule (slots already taken).
 * The booking page only uses window.GTG_AVAILABILITY, so nothing else has to change.
 */
(function () {
  var SLOTS = ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM',
               '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];

  // days: 0 = Sunday ... 6 = Saturday.  from / to are the first and last start time of the shift.
  var SCHEDULE = {
    'Coach Irene':  [{ days: [1, 2, 3, 4, 5, 6], from: '7:00 AM',  to: '3:00 PM' }],
    'Coach Ken':    [{ days: [1, 2, 3, 4, 5],    from: '10:00 AM', to: '7:00 PM' }],
    'Coach Ryan':   [{ days: [0, 2, 3, 4, 5, 6], from: '7:00 AM',  to: '11:00 AM' },
                     { days: [0, 2, 3, 4, 5, 6], from: '4:00 PM',  to: '7:00 PM' }],
    'Coach Vince':  [{ days: [1, 3, 5, 6],       from: '1:00 PM',  to: '7:00 PM' }],
    'Coach Kyroll': [{ days: [1, 2, 3, 4, 5],    from: '7:00 AM',  to: '11:00 AM' },
                     { days: [6],                from: '7:00 AM',  to: '1:00 PM' }]
  };

  // What each coach is trained to teach (same as the tags on the Trainers page).
  // Keys match the class keys used on the Classes page: gym, boxing, muaythai, taekwondo, zumba, yoga.
  var SPECIALIZATIONS = {
    'Coach Irene':  ['yoga', 'zumba', 'taekwondo', 'gym'],
    'Coach Ken':    ['muaythai', 'taekwondo', 'gym'],
    'Coach Ryan':   ['yoga', 'boxing', 'zumba', 'gym'],
    'Coach Vince':  ['yoga', 'zumba', 'taekwondo', 'gym'],
    'Coach Kyroll': ['taekwondo', 'boxing', 'gym']
  };
  var CLASS_LABELS = { gym: 'Gym', boxing: 'Boxing', muaythai: 'Muay Thai', taekwondo: 'Taekwondo', zumba: 'Zumba', yoga: 'Yoga' };

  // Specific days a coach is away, e.g. 'Coach Ken': ['2026-11-20']  (like tbl_TrainerAvailability = Unavailable)
  var DAYS_OFF = {};

  // Changes a trainer makes on the Trainer Availability page are saved in this browser
  // and picked up here, so the member booking page respects them.
  var DEFAULT_SCHEDULE = JSON.parse(JSON.stringify(SCHEDULE));
  try {
    var savedShifts = JSON.parse(localStorage.getItem('gtg_trainer_shifts') || '{}');
    Object.keys(savedShifts).forEach(function (c) { if (SCHEDULE[c] && Array.isArray(savedShifts[c])) SCHEDULE[c] = savedShifts[c]; });
    var savedOff = JSON.parse(localStorage.getItem('gtg_trainer_daysoff') || '{}');
    Object.keys(savedOff).forEach(function (c) { if (Array.isArray(savedOff[c])) DAYS_OFF[c] = savedOff[c]; });
  } catch (e) { /* no saved changes */ }

  // Only the coaches who are trained for this class (e.g. 'yoga')
  function coachesFor(classKey) {
    return Object.keys(SCHEDULE).filter(function (c) {
      return (SPECIALIZATIONS[c] || []).indexOf(classKey) !== -1;
    });
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function slotDate(date, label) {
    var m = /^(\d+):(\d+) (AM|PM)$/.exec(label);
    var h = parseInt(m[1], 10) % 12 + (m[3] === 'PM' ? 12 : 0);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, parseInt(m[2], 10));
  }

  // Start times this coach can take on `date`.
  //   busy = times the member is already booked for (so they cannot be in two classes at once)
  //   keep = the time of the booking being edited, so it stays pickable
  function timesFor(coach, date, busy, keep) {
    busy = busy || [];
    var out = [];

    if ((DAYS_OFF[coach] || []).indexOf(iso(date)) === -1) {
      (SCHEDULE[coach] || []).forEach(function (shift) {
        if (shift.days.indexOf(date.getDay()) === -1) return;
        for (var i = SLOTS.indexOf(shift.from); i <= SLOTS.indexOf(shift.to); i++) {
          if (out.indexOf(SLOTS[i]) === -1) out.push(SLOTS[i]);
        }
      });
      // today: hide times that have already passed
      var now = new Date();
      if (iso(date) === iso(now)) {
        out = out.filter(function (t) { return slotDate(date, t) > now; });
      }
    }

    if (keep && out.indexOf(keep) === -1) out.push(keep);

    return SLOTS.filter(function (t) { return out.indexOf(t) !== -1 && busy.indexOf(t) === -1; });
  }

  window.GTG_AVAILABILITY = {
    slots: SLOTS,
    coaches: Object.keys(SCHEDULE),
    timesFor: timesFor,
    coachesFor: coachesFor,
    specializations: SPECIALIZATIONS,
    classLabels: CLASS_LABELS,
    shiftsOf: function (coach) { return SCHEDULE[coach] || []; },
    defaultShiftsOf: function (coach) { return DEFAULT_SCHEDULE[coach] || []; },
    daysOffOf: function (coach) { return (DAYS_OFF[coach] || []).slice(); }
  };
})();