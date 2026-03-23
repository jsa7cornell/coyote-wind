// Vercel Serverless Function — ICS Calendar Feed for Wind Alerts
// Usage: /api/calendar?spots=cp,cf,lv
// Returns a subscribable .ics calendar with events for days with good wind.

const LOCATIONS = {
  cp: {
    name: 'Coyote Point', lat: 37.5933, lon: -122.3196,
    goodDirs: ['W','WNW','NW','NNW','SW','WSW'],
    tz: 'America/Los_Angeles',
  },
  cf: {
    name: 'Crissy Field', lat: 37.8042, lon: -122.4597,
    goodDirs: ['W','WNW','NW','NNW','SW','WSW'],
    tz: 'America/Los_Angeles',
  },
  lv: {
    name: 'La Ventana', lat: 24.0465, lon: -109.9943,
    goodDirs: ['N','NNE','NNW','NW','NE'],
    tz: 'America/Mazatlan',
  },
  pb: {
    name: 'Point Blunt', lat: 37.8532, lon: -122.4191,
    goodDirs: ['W','WNW','NW','NNW','SW','WSW'],
    tz: 'America/Los_Angeles',
  },
};

// --- Good wind threshold (easy to change later) ---
const MIN_WIND_SPEED = 12; // mph

// --- Helpers ---

function degreesToCompass(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function isGoodWind(speed, dirDeg, goodDirs) {
  if (speed < MIN_WIND_SPEED) return false;
  return goodDirs.includes(degreesToCompass(dirDeg));
}

// Parse "2026-03-17T14:00" as-is (no timezone shift)
function parseHourStr(str) {
  const [date, time] = str.split('T');
  const [y, mo, d] = date.split('-').map(Number);
  const [hr] = time.split(':').map(Number);
  return { y, mo, d, hr, dateStr: date };
}

// Format YYYYMMDD
function icsDate(y, mo, d) {
  return `${y}${String(mo).padStart(2,'0')}${String(d).padStart(2,'0')}`;
}

// Format YYYYMMDDTHHMMSS
function icsDateTime(y, mo, d, hr) {
  return `${icsDate(y, mo, d)}T${String(hr).padStart(2,'0')}0000`;
}

// Build a UID that is stable per location+date (so calendar apps can update events)
function eventUid(spotKey, dateStr) {
  return `wind-${spotKey}-${dateStr}@wind.sendmo.co`;
}

async function fetchForecast(loc) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
    + `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m`
    + `&forecast_days=10&wind_speed_unit=mph&timezone=${encodeURIComponent(loc.tz)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

// Find good-wind days from hourly data.
// Returns array of { dateStr, y, mo, d, startHr, endHr, hours: [{hr, speed, gusts, dir, compass}] }
function findGoodWindDays(hourlyData, goodDirs) {
  const h = hourlyData.hourly;
  const dayMap = {};

  for (let i = 0; i < h.time.length; i++) {
    const parsed = parseHourStr(h.time[i]);
    const speed = Math.round(h.wind_speed_10m[i]);
    const dir = h.wind_direction_10m[i];
    const gusts = Math.round(h.wind_gusts_10m[i]);
    const compass = degreesToCompass(dir);

    // Only consider 9am–9pm
    if (parsed.hr < 9 || parsed.hr > 21) continue;

    if (!isGoodWind(speed, dir, goodDirs)) continue;

    const key = parsed.dateStr;
    if (!dayMap[key]) {
      dayMap[key] = { dateStr: key, y: parsed.y, mo: parsed.mo, d: parsed.d, hours: [] };
    }
    dayMap[key].hours.push({ hr: parsed.hr, speed, gusts, dir: Math.round(dir), compass });
  }

  // For each day, set start/end hour from the good-wind hours
  return Object.values(dayMap).map(day => {
    day.startHr = Math.min(...day.hours.map(h => h.hr));
    day.endHr = Math.max(...day.hours.map(h => h.hr)) + 1; // end is exclusive
    return day;
  });
}

function buildDescription(day, locName) {
  const speeds = day.hours.map(h => h.speed);
  const gusts = day.hours.map(h => h.gusts);
  const avgSpeed = Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
  const maxSpeed = Math.max(...speeds);
  const maxGust = Math.max(...gusts);
  const primaryDir = day.hours[0].compass;

  let desc = `Wingfoil forecast for ${locName}\\n\\n`;
  desc += `Avg wind: ${avgSpeed} mph | Peak: ${maxSpeed} mph\\n`;
  desc += `Max gust: ${maxGust} mph\\n`;
  desc += `Direction: ${primaryDir}\\n\\n`;
  desc += `Hourly breakdown:\\n`;
  for (const h of day.hours) {
    const ampm = h.hr >= 12 ? 'pm' : 'am';
    const hr12 = h.hr === 0 ? 12 : h.hr > 12 ? h.hr - 12 : h.hr;
    desc += `  ${hr12}${ampm}: ${h.speed} mph ${h.compass} (gusts ${h.gusts})\\n`;
  }
  desc += `\\nData: Open-Meteo (NOAA GFS/HRRR & ECMWF)`;
  desc += `\\nApp: https://wind.sendmo.co`;
  return desc;
}

function buildICS(events, calName) {
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CoyoteWind//Wind Alerts//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calName}`,
    'X-WR-CALDESC:Good wingfoil wind predictions from wind.sendmo.co',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
  ];

  for (const evt of events) {
    ics.push(
      'BEGIN:VEVENT',
      `UID:${evt.uid}`,
      `DTSTAMP:${evt.dtstamp}`,
      `DTSTART;TZID=${evt.tz}:${evt.dtstart}`,
      `DTEND;TZID=${evt.tz}:${evt.dtend}`,
      `SUMMARY:${evt.summary}`,
      `DESCRIPTION:${evt.description}`,
      `URL:https://wind.sendmo.co`,
      'STATUS:CONFIRMED',
      `SEQUENCE:${evt.sequence}`,
      'END:VEVENT',
    );
  }

  ics.push('END:VCALENDAR');
  return ics.join('\r\n');
}

module.exports = async function handler(req, res) {
  // CORS headers for browser fetch
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const spotsParam = (req.query.spots || 'cp').toLowerCase();
  const spotKeys = spotsParam.split(',').filter(k => LOCATIONS[k]);

  if (spotKeys.length === 0) {
    res.status(400).send('Invalid spots parameter. Use: cp, cf, lv, pb, mke');
    return;
  }

  try {
    const now = new Date();
    const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
    // Use day-of-year as sequence so calendar apps know it's updated
    const sequence = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);

    const allEvents = [];

    for (const key of spotKeys) {
      const loc = LOCATIONS[key];
      const forecast = await fetchForecast(loc);
      const goodDays = findGoodWindDays(forecast, loc.goodDirs);

      for (const day of goodDays) {
        allEvents.push({
          uid: eventUid(key, day.dateStr),
          dtstamp,
          tz: loc.tz,
          dtstart: icsDateTime(day.y, day.mo, day.d, day.startHr),
          dtend: icsDateTime(day.y, day.mo, day.d, day.endHr),
          summary: `Good wind @ ${loc.name}`,
          description: buildDescription(day, loc.name),
          sequence,
        });
      }
    }

    const calName = spotKeys.length === 1
      ? `WINDow-${LOCATIONS[spotKeys[0]].name}`
      : 'WINDow Wind Alerts';
    const ics = buildICS(allEvents, calName);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="wind-alerts.ics"');
    // Allow caching for 3 hours, but revalidate
    res.setHeader('Cache-Control', 'public, max-age=10800, must-revalidate');
    res.status(200).send(ics);

  } catch (err) {
    console.error('Calendar generation error:', err);
    res.status(500).send('Failed to generate calendar feed.');
  }
}
