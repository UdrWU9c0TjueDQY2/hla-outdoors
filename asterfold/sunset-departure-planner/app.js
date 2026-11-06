const byId = id => document.getElementById(id);
const inputIds = ['sunset', 'lead', 'travel', 'setup'];
const calendarIds = ['session-date', 'time-zone', 'viewpoint'];
const resourceUrl = 'https://udrwu9c0tjuedqy2.github.io/hla-outdoors/asterfold/sunset-departure-planner/';
let currentTimeline = null;
const calendarUid = 'hla-sunset-' + crypto.randomUUID();

function formatMinutes(minutes) {
  const day = Math.floor(minutes / 1440);
  const clock = ((minutes % 1440) + 1440) % 1440;
  const time = String(Math.floor(clock / 60)).padStart(2, '0') + ':' + String(clock % 60).padStart(2, '0');
  const earlier = day < 0 ? ' (' + Math.abs(day) + ' day' + (day === -1 ? '' : 's') + ' earlier)' : '';
  return time + earlier;
}

function clearCalendar() {
  byId('calendar-status').textContent = '';
  byId('plan-text').value = '';
  byId('plan-record').hidden = true;
}

function invalidate() {
  currentTimeline = null;
  byId('result').textContent = '';
  byId('calendar-download').disabled = true;
  byId('save-plan').hidden = true;
  clearCalendar();
}

function calculate() {
  invalidate();
  const sunset = byId('sunset').value;
  const values = ['lead', 'travel', 'setup'].map(id => Number(byId(id).value));
  const invalid = ['lead', 'travel', 'setup'].some((id, index) =>
    byId(id).value === '' || !Number.isInteger(values[index]) || values[index] < 0 || values[index] > 600);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(sunset) || invalid) {
    byId('result').textContent = 'Enter a sunset time and whole minutes from 0 to 600 in every field.';
    return;
  }
  const [hour, minute] = sunset.split(':').map(Number);
  const [lead, travel, setup] = values;
  const sun = hour * 60 + minute;
  const ready = sun - lead;
  const arrive = ready - setup;
  const leave = arrive - travel;
  currentTimeline = { sun, ready, arrive, leave, lead, travel, setup };
  byId('result').textContent = 'LEAVE ' + formatMinutes(leave) + '\nARRIVE ' + formatMinutes(arrive) +
    '\nREADY ' + formatMinutes(ready) + '\nSUNSET ' + formatMinutes(sun) + '\n\n' +
    (lead + travel + setup) + ' minutes from departure to the supplied sunset time.';
  byId('calendar-download').disabled = false;
  byId('save-plan').hidden = false;
}

function zonedWallTime(timestamp, formatter) {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
}

function wallTimeToUtc(wallTime, formatter) {
  const offsets = new Set();
  for (const hours of [-36, -12, 0, 12, 36]) {
    const sample = wallTime + hours * 3600000;
    offsets.add(zonedWallTime(sample, formatter) - sample);
  }
  const matches = [...offsets].map(offset => wallTime - offset)
    .filter(candidate => zonedWallTime(candidate, formatter) === wallTime);
  if (matches.length !== 1) {
    throw new Error('A planned time falls in a repeated or skipped clock-change hour. Recheck the date and times before saving a calendar event.');
  }
  return matches[0];
}

function calendarPlan() {
  if (!currentTimeline) throw new Error('Build the current timeline first.');
  const date = byId('session-date').value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < '2000-01-01' || date > '2100-12-31') {
    throw new Error('Choose the sunset date between 2000 and 2100.');
  }
  const midnight = Date.parse(date + 'T00:00:00Z');
  if (!Number.isFinite(midnight) || new Date(midnight).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid sunset date.');
  }
  const zone = byId('time-zone').value.trim();
  let formatter;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    });
  } catch {
    throw new Error('Choose a listed time zone for the viewpoint, such as America/Toronto.');
  }
  const moments = ['leave', 'arrive', 'ready', 'sun'].map(key => {
    const wall = midnight + currentTimeline[key] * 60000;
    return { wall, utc: wallTimeToUtc(wall, formatter) };
  });
  for (let index = 1; index < moments.length; index++) {
    if (moments[index].utc - moments[index - 1].utc !== moments[index].wall - moments[index - 1].wall) {
      throw new Error('This timeline crosses a clock change. Recheck travel and setup times before creating a calendar event.');
    }
  }
  const location = byId('viewpoint').value.trim();
  const labels = ['Leave', 'Arrive', 'Ready', 'Supplied sunset'];
  const lines = moments.map((moment, index) => labels[index] + ' ' +
    new Date(moment.wall).toISOString().slice(0, 16).replace('T', ' '));
  const record = ['Sunset photography plan', 'Time zone ' + zone];
  if (location) record.push('Viewpoint ' + location);
  record.push(...lines, '', 'Travel ' + currentTimeline.travel + ' min', 'Setup ' + currentTimeline.setup + ' min',
    'Ready before sunset ' + currentTimeline.lead + ' min', '',
    'Sunset time and durations were supplied by the user. Check access, conditions and the return journey separately.',
    'The calendar event runs from departure to the supplied sunset time. Calendar apps may apply their own default reminders.',
    '', 'Created with Honest Little Apps', resourceUrl);
  return { date, zone, location, moments, record: record.join('\n') };
}

function escapeCalendarText(value) {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldCalendarLine(line) {
  const encoder = new TextEncoder();
  let result = '';
  let bytes = 0;
  for (const character of line) {
    const length = encoder.encode(character).length;
    if (bytes + length > 75) {
      result += '\r\n ';
      bytes = 1;
    }
    result += character;
    bytes += length;
  }
  return result;
}

function makeCalendar(plan) {
  const formatUtc = value => new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const start = formatUtc(plan.moments[0].utc);
  const end = formatUtc(plan.moments[3].utc);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Honest Little Apps//Sunset Departure Planner//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', 'UID:' + calendarUid + '-' + start + '-' + end,
    'DTSTAMP:' + formatUtc(Date.now()), 'DTSTART:' + start];
  // A zero-minute plan is a single instant. RFC 5545 requires DTEND to follow DTSTART when supplied.
  if (plan.moments[3].utc > plan.moments[0].utc) lines.push('DTEND:' + end);
  lines.push('SUMMARY:Sunset photography plan', 'DESCRIPTION:' + escapeCalendarText(plan.record));
  if (plan.location) lines.push('LOCATION:' + escapeCalendarText(plan.location));
  lines.push('URL:' + resourceUrl, 'END:VEVENT', 'END:VCALENDAR');
  return lines.map(foldCalendarLine).join('\r\n') + '\r\n';
}

byId('calendar-download').addEventListener('click', () => {
  clearCalendar();
  try {
    const plan = calendarPlan();
    byId('plan-text').value = plan.record;
    byId('plan-record').hidden = false;
    const blob = new Blob([makeCalendar(plan)], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sunset-plan-' + plan.date + '.ics';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    byId('calendar-status').textContent = 'Calendar file prepared. Review its date, time zone and reminders in your calendar before importing. The same plan is available below.';
  } catch (error) {
    byId('calendar-status').textContent = error.message;
  }
});

inputIds.forEach(id => byId(id).addEventListener('input', invalidate));
calendarIds.forEach(id => byId(id).addEventListener('input', clearCalendar));
byId('calculate').addEventListener('click', calculate);
byId('reset').addEventListener('click', () => {
  ['16:45', '20', '35', '10'].forEach((value, index) => { byId(inputIds[index]).value = value; });
  invalidate();
});

const today = new Date();
byId('session-date').value = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
byId('time-zone').value = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : ['America/Toronto', 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'];
for (const zone of new Set(['UTC', byId('time-zone').value, ...zones])) {
  const option = document.createElement('option');
  option.value = zone;
  byId('time-zones').append(option);
}
