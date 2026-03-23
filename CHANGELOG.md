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
