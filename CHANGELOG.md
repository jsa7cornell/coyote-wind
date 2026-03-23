# WINDow — Deployment Changelog

> **Every agent: add an entry here when deploying to production.**
> Deploy = `vercel --prod` from `coyote-wind/`. Newest entries go at the top. Follow the template.

---

## Entry Template

```markdown
## [YYYY-MM-DD] — Short title

**Deploy:** `vercel --prod` / auto

### What shipped
- Bullet list of user-visible changes

### What changed (files)
- `index.html` — describe what changed
- `api/calendar.js` — if applicable
- `sw.js` — if service worker bumped (include new cache version)

### Notes
- Anything future agents should know (gotchas, follow-ups, known issues)
```

---

## [2026-03-23] — Calendar month view with historical wind data

**Deploy:** `vercel --prod` → https://wind.sendmo.co

### What shipped
- **Month view** — toggle between Hours and Month in the forecast header. Month grid shows every day color-coded by wind quality (green = great, olive = marginal, dim = no wind).
- **Historical data** — past months fetch from Open-Meteo archive API (available back to 1940, ~5-day lag). In-memory cache so navigating back is instant.
- **Today highlighted** — current day has a white border ring in the grid.
- **Tap to jump** — tapping a future day (within forecast window) switches to Hours view for that day.
- **Month navigation** — ‹ › arrows navigate months; forward limited to current month + 1 (forecast range), backward to 2020.
- **Mobile-ready** — calendar grid scales to full width on iPhone with smaller day cells.

### What changed (files)
- `index.html` — added `.cal-view` CSS block + mobile override; `view-toggle` buttons in forecast header; `#cal-view` div sibling to `#chart-wrap`; `setView()`, `dayQuality()`, `dayQualityFromForecast()`, `fetchArchiveMonth()`, `calDayClick()`, `prevMonth()`, `nextMonth()`, `renderCalView()` functions; `switchLocation()` resets calYear/calMonth in month view; `fetchWind()` triggers re-render of calendar when in month view
- `sw.js` — bumped cache to `coyote-wind-v11`

### Notes
- Archive API URL: `https://archive-api.open-meteo.com/v1/archive` — same params as forecast, ~5ms response, no auth needed
- `archiveCache[locIdx][YYYY-MM]` = `{YYYY-MM-DD: 'great'|'marginal'|'none'}` or `null` (loading)
- Quality computation uses same `goodDirs` + `great`/`marginal` ranges per location — identical logic to forecast coloring
- Days in the ~5-day archive lag show as dim (no data) — intentional, not a bug

---

## [2026-03-23] — Wind quality colors, colored day tabs, mobile layout, day outlook summary

**Commit:** `28d2abb`
**Deploy:** `vercel --prod` → https://wind.sendmo.co

### What shipped
- **Quality-gradient wind colors** — forecast cells now lerp from dark green (peak great range) to yellowish-green (barely marginal). Bad direction and out-of-range speeds stay muted/red as before. Color is computed per-location using each spot's `great` and `marginal` ranges.
- **Colored day tabs** — date text on each day tab turns green when that day has great-range hours, yellowish-green when it only has marginal hours. No-wind days stay dim.
- **Tighter time window** — forecast now shows 10am–8pm (11 columns) instead of 9am–9pm (13 columns). Full hourly fidelity preserved; the rarely-useful 9am and 9pm slots removed to give cells more room on mobile.
- **Day outlook in conditions panel** — a new line below the verdict note summarizes the day: "Should be rideable 2pm–6pm", "Great now through 5pm", "No rideable window today", etc. Clears when tapping a specific forecast hour.

### What changed (files)
- `index.html` — `windCellColors()` rewritten with quality gradient; `.day-tab.has-great/.has-marginal` CSS + tab coloring logic in `renderForecast()`; `displayHours` mobile filter in `renderForecast()`; `getDayOutlook()` function; `.verdict-outlook` CSS + HTML element; `getDayOutlook()` wired into `fetchWind()` and cleared in `selectHour()`

### Notes
- Service worker cache version (`coyote-wind-v3` in `sw.js`) should be bumped before deploying so users get the updated `index.html`
- `windCellColors` is now location-aware — it reads `getLoc().great` and `getLoc().marginal` on every call, so color thresholds automatically adapt when switching spots
- `getDayOutlook` always summarizes today, not the currently-viewed day tab — this is intentional (most actionable info when glancing at the app)
