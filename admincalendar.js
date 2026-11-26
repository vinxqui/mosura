const monthSelect    = document.getElementById('month-select');
const yearLabel      = document.getElementById('calendar-year');
const calendar       = document.querySelector('.big-calendar');
const scheduleTitle  = document.getElementById('schedule-title');

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const today = new Date();
const currentYear = today.getFullYear(); // year is always the real current year

let selectedCell = null; // tracks the currently highlighted day button

/* ---------- trainers (dropdown) ----------
   Uses the same list as Trainer Management ("gtg_trainers" in localStorage), so a trainer
   that is added, renamed or deleted there shows up here too. */
const trainerSelect = document.getElementById('trainer');
const DEFAULT_TRAINERS = ['Coach Irene', 'Coach Ken', 'Coach Ryan', 'Coach Tiana', 'Coach Vince', 'Coach Kyroll'];

function loadTrainerNames() {
  try {
    const list = JSON.parse(localStorage.getItem('gtg_trainers'));
    if (Array.isArray(list) && list.length) {
      return list.map(t => t && t.name).filter(Boolean);
    }
  } catch (e) { /* fall back to the default list */ }
  return DEFAULT_TRAINERS;
}

function populateTrainerSelect() {
  trainerSelect.innerHTML = '<option value="">Select a trainer</option>';
  loadTrainerNames().forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    trainerSelect.appendChild(opt);
  });
}
populateTrainerSelect();

/* ---------- saved events ---------- */
const EVENTS_KEY = 'gtg_calendar_events';
let events = {};
try { events = JSON.parse(localStorage.getItem(EVENTS_KEY)) || {}; } catch (e) { events = {}; }
function saveEvents() {
  try { localStorage.setItem(EVENTS_KEY, JSON.stringify(events)); } catch (e) { /* storage full */ }
}

function populateMonthSelect(selectedMonth) {
  monthSelect.innerHTML = monthNames
    .map((name, i) => `<option value="${i}"${i === selectedMonth ? ' selected' : ''}>${name}</option>`)
    .join('');
}

function addCell(day, isTodayCell = false) {
  const cell = document.createElement(day ? 'button' : 'span');
  cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank') + (isTodayCell ? ' is-today' : '');
  if (day) {
    cell.type = 'button';
    cell.textContent = day;
    cell.addEventListener('click', () => selectDate(cell, day));
  }
  calendar.appendChild(cell);
}

function renderCalendar(year, month) {
  calendar.querySelectorAll('.big-calendar__cell').forEach(cell => cell.remove());
  calendar.setAttribute('aria-label', `${monthNames[month]} ${year}`);
  selectedCell = null;

  const firstWeekday = new Date(year, month, 1).getDay();       // 0=Sun ... 6=Sat
  const totalDays     = new Date(year, month + 1, 0).getDate(); // handles 28/29/30/31 automatically

  for (let i = 0; i < firstWeekday; i++) addCell(null);
  for (let day = 1; day <= totalDays; day++) addCell(day, isToday(year, month, day));

  // pad the last row out to a full 7 columns
  const trailingBlanks = (7 - ((firstWeekday + totalDays) % 7)) % 7;
  for (let i = 0; i < trailingBlanks; i++) addCell(null);

  // if we're showing the current month, highlight today and select it
  const todayCell = calendar.querySelector('.is-today');
  if (todayCell) selectDate(todayCell, today.getDate());
  else document.dispatchEvent(new CustomEvent('date-cleared'));
}

function isToday(year, month, day) {
  return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
}

let selectedDate = null;

function selectDate(cell, day) {

  if (selectedCell) {
    selectedCell.classList.remove('is-selected');
  }

  cell.classList.add('is-selected');
  selectedCell = cell;

  const month = parseInt(monthSelect.value, 10);

  selectedDate = {
    year: currentYear,
    month: month,
    day: day
  };

  scheduleTitle.textContent =
    `${monthNames[month]} ${day}, ${currentYear}`;

  document.getElementById("empty-message").style.display = "none";
  document.getElementById("event-form").style.display = "block";

  loadEvents();

}

monthSelect.addEventListener('change', () => {
  renderCalendar(currentYear, parseInt(monthSelect.value, 10));
});

// Initial setup — defaults to today's real month/year
yearLabel.textContent = currentYear;
populateMonthSelect(today.getMonth());
renderCalendar(currentYear, today.getMonth());

// Make the "My Schedule" button open schedule.html
document.querySelectorAll('button, a, .btn').forEach(el => {
  if (el.textContent.trim() === 'My Schedule') {
    el.style.cursor = 'pointer';
    el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = 'schedule.html';
    });
  }
});

document.getElementById('save-event')
.addEventListener('click', function () {

    if (!selectedDate) {
        alert('Please select a date first.');
        return;
    }

    const type    = document.getElementById('event-type').value;
    const trainer = trainerSelect.value;
    const start   = document.getElementById('start-time').value;
    const end     = document.getElementById('end-time').value;

    // Holidays and maintenance do not need a trainer
    if ((type === 'Class' || type === 'Training') && !trainer) {
        alert('Please choose a trainer.');
        trainerSelect.focus();
        return;
    }
    if (!start || !end) {
        alert('Please set the start and end time.');
        return;
    }
    if (end <= start) {
        alert('The end time must be after the start time.');
        return;
    }

    const key =
        `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    if (!events[key]) {
        events[key] = [];
    }

    events[key].push({ type: type, trainer: trainer, start: start, end: end });
    saveEvents();

    loadEvents();

    alert('Event Saved!');
});

function formatTime(t) {
    const parts = t.split(':');
    const h = parseInt(parts[0], 10);
    return ((h % 12) || 12) + ':' + parts[1] + ' ' + (h >= 12 ? 'PM' : 'AM');
}

function loadEvents() {

    const container =
        document.getElementById('event-list');

    container.innerHTML =
        '<h3>Events for Selected Day</h3>';

    if (!selectedDate) return;

    const key =
        `${selectedDate.year}-${selectedDate.month}-${selectedDate.day}`;

    const dayEvents =
        events[key] || [];

    if (dayEvents.length === 0) {
        container.innerHTML +=
            '<p>No events scheduled.</p>';
        return;
    }

    // built with textContent so nothing typed or stored can inject HTML
    dayEvents.forEach(function(event) {
        const card = document.createElement('div');
        card.className = 'event-card';

        const title = document.createElement('strong');
        title.textContent = event.type === 'Training' ? 'Personal Training' : event.type;
        card.appendChild(title);

        const time = document.createElement('p');
        time.textContent = formatTime(event.start) + ' - ' + formatTime(event.end);
        card.appendChild(time);

        if (event.trainer) {
            const who = document.createElement('p');
            who.textContent = event.trainer;
            card.appendChild(who);
        }

        container.appendChild(card);
    });
}
