# Coyote Point Wind — Agent Instructions

> Read the root `../CLAUDE.md` for global context (credentials, services, rules) before working here.

## What Is This?

A PWA (Progressive Web App) for real-time wind conditions and 10-day hourly forecasts for wingfoiling. Supports multiple locations. Designed for quick mobile glances — installable to the home screen. App is branded **WINDow**.

**Live URL:** https://wind.sendmo.co

## Locations

The app supports 4 spots, toggled via pill buttons at the top:

| Spot | Coordinates | Good Directions | Great Range | Marginal Range | Notes |
|------|-------------|-----------------|-------------|----------------|-------|
| Coyote Point | 37.5933, -122.3196 | W, WNW, NW, NNW, SW, WSW | 12–25 mph | 8–35 mph | West-facing shore |
| Crissy Field | 37.8042, -122.4597 | W, WNW, NW, NNW, SW, WSW | 15–28 mph | 10–38 mph | West-facing shore |
| La Ventana | 24.0465, -109.9943 | N, NNE, NNW, NW, NE | 15–30 mph | 10–40 mph | Coromuel wind spot |
| Milwaukee | 43.0568, -87.8762 | N, NNE, NE, ENE, E, ESE, SE, SSE, S | 14–24 mph | 10–32 mph | East-facing shore on Lake Michigan — W/SW/NW are offshore/dangerous |
| Point Blunt | 37.8532, -122.4191 | W, WNW, NW, NNW, SW, WSW | 18–28 mph | 12–35 mph | SE tip of Angel Island — boat-access only, strong currents in Raccoon Strait |

**Adding a new spot:** Research required before adding. Direction logic is critical and site-specific. Milwaukee took research to get right — west-facing vs. east-facing shore completely reverses the good/bad directions. Local kite communities are the best source.

Each location has direction-aware color coding — cells turn muted when wind blows from a bad direction for that spot.

## Features

- **Current conditions panel** — verdict (Go Foil / Maybe / Too Light / etc.), wind speed, direction, gusts
- **Funny condition-specific tagline** — italic quip that changes with conditions
- **Wing size recommendation** — suggests appropriate wing size based on wind speed
- **Danger warning banner** — red alert shown when conditions are dangerous: offshore winds, speed above marginal ceiling, gusts >35 mph, or gust-to-sustained ratio >40%
- **Wingfoil wind window** — visual range bar with dot marker showing current speed
- **10-day hourly forecast** — iKitesurf-inspired table with day tabs (showing dates)
  - Hours filtered to 10am–8pm (11 columns — full hourly fidelity, trimmed endpoints)
  - **Wind row**: merged cell with speed number + proportional bar (0–30 scale) + direction arrow + compass label, all color-coded
  - **Gust row**: color-coded gust values
  - Clicking any forecast hour updates the entire top conditions panel
  - Selection outline encircles both wind and gust cells together
- **"Next WINDow" button** — scans 10-day forecast and jumps to next hour with good conditions
- **Calendar subscribe** — 📅 button next to each location pill opens popover to subscribe to wind alerts
- **PWA install banner** — prompts iOS/Android users to add to home screen
- **Auto-refresh** every 10 minutes

## Mobile Design (iPhone 14 Pro Max target)

- `@media (max-width: 500px)` handles all mobile sizing
- Card padding reduced to 16px 12px on mobile
- Forecast table uses `table-layout: fixed; width: 100%` on mobile so all 13 hours (9am–9pm) fit without horizontal scroll
- Day tabs scroll horizontally (overflow-x: auto, no scrollbar visible)
- No horizontal scroll anywhere on mobile — this is a hard requirement
- Service worker caches old versions — bypass with `navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()))` then reload during dev

## Data Source

**Open-Meteo API** (free, no API key needed). NOAA GFS/HRRR & ECMWF models.

```
https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON
  &current=wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m
  &forecast_days=10&wind_speed_unit=mph&timezone=America%2FLos_Angeles
```

## Tech Stack

| Layer | Tech |
|-------|------|
| App | Single-file vanilla HTML/CSS/JS (`index.html`) |
| Calendar API | Vercel serverless function (`api/calendar.js`) — CommonJS (`module.exports`) |
| PWA | Service Worker (`sw.js`, currently `coyote-wind-v3`) + Web App Manifest (`manifest.json`) |
| Hosting | **Vercel** — CLI deploy with `--prod --yes --token` |
| Domain | `wind.sendmo.co` — CNAME via Cloudflare DNS pointing to `cname.vercel-dns.com` |

**No build step. No npm. No node_modules.** The app is `index.html` + one serverless function.

## File Structure

```
coyote-wind/
├── CLAUDE.md          ← THIS FILE
├── DECISIONS.md       ← Architectural decisions and gotchas from each session
├── CHANGELOG.md       ← Deployment log — entry required on every `vercel --prod`
├── index.html         ← Entire application (HTML + CSS + JS in one file)
├── api/
│   └── calendar.js    ← Vercel serverless — ICS calendar feed (?spots=cp,cf,lv,mke)
├── manifest.json      ← PWA manifest (name: "WINDow", short_name: "WINDow")
├── sw.js              ← Service worker (cache: coyote-wind-v3)
├── icon.svg           ← App icon
├── netlify.toml       ← Legacy artifact (not used — hosting is Vercel)
├── .vercel/           ← Vercel project config
└── .claude/
    └── launch.json    ← Preview server config (python3 http.server :3456)
```

## Deploying

```bash
# Deploy to production (uses Vercel token from ~/AI Brain/CREDENTIALS.md)
cd ~/AI\ Brain/coyote-wind
vercel --prod --yes --token $VERCEL_TOKEN
```

The Vercel token is in `~/AI Brain/CREDENTIALS.md` — follow the credential access protocol in the root CLAUDE.md before reading it.

**Testing the serverless function locally** (without `vercel dev` which requires auth):
```bash
node -e "
const handler = require('./api/calendar.js');
const req = { query: { spots: 'cp' } };
const res = { setHeader:()=>{}, status:(c)=>res, send:(b)=>console.log(b) };
handler(req, res);
"
```

## Key Code Patterns

### Date parsing
Use `parseLocalTime(str)` instead of `new Date("2026-03-17T14:00")` to avoid UTC-vs-local ambiguity:
```javascript
function parseLocalTime(str) {
  const [date, time] = str.split('T');
  const [y, mo, d] = date.split('-').map(Number);
  const [hr, min] = time.split(':').map(Number);
  return new Date(y, mo - 1, d, hr, min);
}
```

### Wind cell color logic
`windCellColors(speed, dir)` — returns `{bg, fg}` based on speed ranges AND direction quality for the current location. Mutes colors when direction is bad.

### Verdict system
`getVerdict(speed, gusts, dirDeg)` — returns `{cls, icon, main, note, funny, wing}` object used to populate the conditions panel. Includes humorous tagline and wing size suggestion.

### Danger warning
`dangerWarning(speed, gusts, dirDeg)` — returns a warning string (or empty) for: offshore direction, excessive speed, dangerous gusts (>35 mph), or high gust ratio (>40% above sustained). Rendered as a red banner below the verdict card.

### Spot keys (for calendar integration)
`SPOT_KEYS = ['cp', 'cf', 'lv', 'mke', 'pb']` — maps to LOCATIONS array by index. Used for calendar subscribe API URLs (`/api/calendar?spots=KEY`). The ICS endpoint is live at `wind.sendmo.co/api/calendar`. Defined in both `index.html` and `api/calendar.js` — keep in sync when adding locations.

### ICS calendar feed
`api/calendar.js` — CommonJS serverless function. Good wind = speed ≥ `MIN_WIND_SPEED` (12 mph) + direction in `goodDirs`, hours 9am–9pm only. One VEVENT per qualifying day. UIDs are stable per location+date so calendar apps update rather than duplicate events. Events have title `Good wind @ [Location]` and description with hourly breakdown. Calendar name in ICS is `WINDow-[Location Name]` for single-spot subscriptions (e.g. `WINDow-Coyote Point`) or `WINDow Wind Alerts` for multi-spot.

### Next WINDow button
`findNextGoodWindow()` scans all 10 days of hourly data (9am–9pm filter) for the next hour where speed ≥ 12 mph and direction is good for the current location. `jumpToNextGoodWindow()` switches to that day tab and selects that hour.

## Design System

- **Background:** `#0a1628` (dark navy)
- **Card:** `#0f2040`
- **Text:** `#e8f4fd`
- **Accent/muted:** `#5b8ab0`
- **Border:** `#1e3a5f`
- **Great:** `#4cd97a` (green)
- **Marginal:** `#f5c842` (yellow)
- **No-go:** `#f55` (red) / `#2a4060` (muted)
- **Danger:** `rgba(180,20,20,0.25)` bg / `#ff6b6b` text
- Font: System default (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`)
- Cards: `border-radius: 20px`, `box-shadow: 0 20px 60px rgba(0,0,0,0.5)`

## Known Gaps / Future Work

- **Good wind threshold sync** — `MIN_WIND_SPEED = 12` is defined in `api/calendar.js` and hardcoded as `h.speed >= 12` in `findNextGoodWindow()` in `index.html`. If you change the threshold, update both.
- **Milwaukee timezone** — The main app fetch uses `America/Los_Angeles` for all locations (times show in PT). Milwaukee should ideally use `America/Chicago`. The ICS feed correctly uses per-location timezones.
- **Milwaukee local resources** — Adventure Kiteboarding (adventurekiteboarding.com, 414-367-9283) is the go-to local shop. iKitesurf/Windalert is the standard forecast tool used by Great Lakes kiters.

## Agent Rules (Project-Specific)

1. **Keep it a single file.** Do not split `index.html` into separate CSS/JS files — simplicity is the point. The only exception is `api/calendar.js`.
2. **No frameworks, no build tools.** Vanilla JS only.
3. **Mobile-first.** This is a phone-glance app. iPhone 14 Pro Max (430px) is the primary target. No horizontal scroll.
4. **Research before adding spots.** Direction logic is site-specific — always verify good/bad directions for local shore orientation before adding.
5. **When updating the service worker**, bump the cache version string in `sw.js` to force a cache refresh. Current: `coyote-wind-v3`.
6. **Deploy via Vercel**, not Netlify. The `netlify.toml` is a legacy artifact.
7. **Serverless function must use `module.exports`**, not `export default` — Vercel without a `vercel.json` runtime config defaults to CommonJS.
8. **`vercel dev` requires auth** — run the Node test snippet above instead of `vercel dev` when testing the calendar function locally.

---

*Last updated: 2026-03-18*
