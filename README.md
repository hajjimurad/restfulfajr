# 🌙 Restful Fajr

A tiny web app that plans your sleep around **Maghrib, Isha & Fajr** so you wake
in your lightest sleep and pray Fajr well-rested.

You enter your location, work wake-up time, and family-prep buffer once (saved on
your device). The app pulls tonight's prayer times from the
[AlAdhan API](https://aladhan.com/prayer-times-api) and proposes two plans:

- **Sleep after Isha** — go to bed after Isha and wake at the earliest sleep-cycle
  boundary inside the Fajr window that gives you your target rest.
- **Split** — sleep after Maghrib, then wake **at least 30 minutes before Fajr** to
  pray Isha and then Fajr. Recommended when Isha is late.

It marks one plan as recommended and gives personalized, sun-aware sleep tips.

## Run locally

It's static — open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Test the scheduling logic

The pure sleep/prayer logic lives in `sleep.js` (no DOM, no network) and is unit-tested:

```bash
node test.cjs
```

## Files

- `index.html` — UI, styles, and DOM wiring
- `sleep.js` — pure scheduling logic (timeline, both plans, recommendation, tips)
- `test.cjs` — Node tests for the logic
- `.do/app.yaml` — DigitalOcean App Platform static-site spec

## Notes

Guidance is general sleep-hygiene information, not medical or religious advice.
Prayer-time conventions are configurable (method + high-latitude rule).
