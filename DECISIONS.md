# WINDow — Architectural Decisions & Gotchas

> Add to this file any time a non-obvious decision is made or a hard-won debugging insight is found.

---

## 2026-03-17 — Calendar Integration Session

### ICS Feed over Google Calendar API
**Decision:** Use a subscribable `.ics` calendar feed instead of direct Google Calendar API integration.

**Why:** The app has no backend, no user accounts, and no database. Full Google Calendar OAuth would require all three. An ICS feed is stateless — Vercel generates it fresh on each request from Open-Meteo data. No tokens, no storage, no user friction.

**Trade-off:** Google Calendar only refreshes subscribed ICS feeds every ~12-24 hours, so events won't appear/disappear in real-time. Acceptable for a daily wind forecast use case.

---

### One Event Per Day (Not Per Wind Window)
**Decision:** Generate one VEVENT per qualifying day, spanning the first to last good hour (9am–9pm filter).

**Why:** A day with multiple good-wind windows (e.g., 10am–1pm, then 4pm–7pm with a gap) would create confusing fragmented events. One event per day is simpler to understand in a calendar view.

---

### Good Wind Threshold = 12 mph + Good Direction
**Decision:** `MIN_WIND_SPEED = 12` mph (constant in `api/calendar.js`) + direction must be in the spot's `goodDirs` array. This applies to both the ICS feed and the "Next WINDow" button in the app.

**Why:** 12 mph is the bottom of the "great" range for Coyote Point (the Bay Area standard). Below that you can technically foil but it's marginal. Direction is equally important — offshore wind at any speed is dangerous and useless for foiling.

**Important:** The threshold is defined in two places — `api/calendar.js` (`MIN_WIND_SPEED`) and `index.html` (`findNextGoodWindow` hardcodes `h.speed >= 12`). Keep them in sync.

---

### Per-Location Calendar Icons (UX 3)
**Decision:** Small 📅 icon next to each location pill, opening a popover. Rejected alternatives: bottom card (too buried), floating action button (too generic).

**Why:** Per-location icons make the relationship clear — you're subscribing to *that spot's* alerts, not a generic feed. The popover shows "Wind alerts for Coyote Point" and offers "Add to Google Calendar" + "Copy link".

---

### Vercel Serverless Uses `module.exports`, Not `export default`
**Gotcha:** Vercel serverless functions without a `vercel.json` runtime config default to CommonJS. Using `export default` causes a 404/silent failure. Use `module.exports = async function handler(req, res) {...}`.

---

### `vercel dev` Requires Authentication
**Gotcha:** `vercel dev` requires `vercel login` or a `--token` flag to run locally. Without it, it throws "No existing credentials found." To test the serverless function without deploying, run it directly with Node (see `CLAUDE.md` for the snippet).

---

### WINDow Branding
**Decision:** App renamed from "Coyote Point Wind" to "WINDow" — a pun on WIND + Window (as in "wind window", the optimal speed range for wingfoiling).

**Visual treatment:** `<span style="color:#4cd97a">WIND</span><span style="color:#3d6080">ow</span>` — WIND in great-condition green, "ow" in muted blue. Displayed above the location pills in uppercase with wide letter-spacing.

---

### "John's Spots" Positioning
**Decision:** App is framed as John's personal spots with "More locations available — request yours." linking to a pre-filled mailto. This gives the app personality and creates organic word-of-mouth.

**Request email:** `jsa7cornell@gmail.com?subject=WINDow%20spot%20request`

---

### Next WINDow Button — Initial State
**Decision:** Button starts `disabled` with class `none` (greyed out) in HTML. `updateNextWindowBtn()` is called at the end of `renderForecast()`, which activates/updates it once data loads.

**Why:** If the initial state is green/active and the fetch fails, the button is misleadingly clickable with no data behind it. Starting disabled is honest.

---

### iOS vs Android Install Banner
**Decision:** Two different flows:
- **iOS Safari:** Cannot programmatically trigger install. Show instructions: "Tap Share ⬆ then Add to Home Screen."
- **Android/Chrome:** Intercept `beforeinstallprompt`, defer it, show "Install" button that calls `deferredPrompt.prompt()`.
- **Already installed:** `window.navigator.standalone === true` (iOS) or `display-mode: standalone` (Android) — hide banner entirely.
- **Dismissed:** Stored in `localStorage` as `pwa-install-dismissed`. Never shown again once dismissed.

---

### Service Worker Cache Versioning
- `v1` — Original launch
- `v2` — Calendar UI added
- `v3` — WINDow rebrand + "Next WINDow" button + install banner
- `v4` — Point Blunt location + per-location descriptions + WINDow-[name] calendar naming

**Rule:** Always bump the cache version in `sw.js` when deploying significant changes to ensure returning users get fresh code.

---

## 2026-03-18 — Point Blunt + Location Descriptions

### Point Blunt (Angel Island) Added
**Decision:** Added Point Blunt (37.8532, -122.4191) as the 5th location, spot key `pb`.

**Research notes:** SE tip of Angel Island, in the strongest Bay seabreeze corridor. Good dirs are W/WNW/NW/NNW/SW/WSW (same as other Bay spots). Prime 18–28 mph, marginal 12–35. **Boat-access only — no shore launch.** Strong tidal currents in Raccoon Strait to the north. Active shipping traffic. Advanced riders only. Best resource: https://www.sailflow.com/spot/512 (SailFlow station 512).

---

### Per-Location Descriptions
**Decision:** Added 4-sentence `description` + `learnMoreUrl` fields to each location in the LOCATIONS array (`index.html`). Rendered as a small text block between the coordinates and the verdict card, with a "Learn more →" link.

**Why:** Helps users understand the spot's character and ideal conditions without leaving the app.

**Note:** The `description` field is display-only in `index.html` — `api/calendar.js` has its own LOCATIONS object (no description needed there).

---

### Calendar Named WINDow-[Location]
**Decision:** ICS `X-WR-CALNAME` is now `WINDow-Coyote Point`, `WINDow-Crissy Field`, etc. (single-spot) or `WINDow Wind Alerts` (multi-spot). Previously hardcoded as `Wind Alerts - Coyote Wind`.

**Why:** The calendar name is what appears in the user's calendar app sidebar. `WINDow-[spot]` is immediately recognizable and consistent with app branding.
