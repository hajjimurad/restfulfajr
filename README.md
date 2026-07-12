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

## Roadmap — fitness-tracker integration

The core assumptions today (90-min cycle, 15-min fall-asleep latency, self-reported
schedule) are population averages. Wearables (Apple Watch, Oura, Whoop, Fitbit,
Garmin) could replace guesses with measurements. Rough priority:

**High value — replace assumptions with data**
- **Measured cycle length.** Derive the user's real average cycle length from
  sleep-stage history instead of the guessed 90 min (auto-calibration in place of
  the manual "±5–10 min over a few nights" tuning).
- **Real latency & bedtime.** Use recorded sleep onset instead of the fixed
  15-min latency assumption.
- **Smart-wake window.** Arm a silent vibration alarm for a window before Fajr and
  fire it when the tracker detects light sleep — beats a fixed cycle-boundary time,
  since real cycles drift across the night.

**Close the loop**
- **Validate the verdict.** Compare predicted vs. actual sleep (duration, deep-sleep
  minutes) and flag when a plan under-delivers.
- **Adapt to sleep debt / recovery.** Raise the target cycles or lean toward the
  split plan on under-recovered days (recovery score, resting HR, HRV).

**Refinements**
- Circadian tuning (HRV / resting-HR trends) for morning-light timing and chronotype.
- Nap detection to confirm the optional second-sleep block.

**Architecture & privacy implications**
- Breaks the current static, free, no-backend model: needs either on-device health
  APIs (Apple HealthKit / Android Health Connect → a PWA/native wrapper) or cloud
  APIs (Fitbit/Oura/Garmin/Whoop → OAuth + a backend to hold tokens).
- Vendor APIs are fragmented; no single cross-platform standard.
- Consumer trackers *infer* sleep stages from HR/HRV/motion, not EEG — smart-wake is
  reliable, precise deep-sleep timing is approximate. Don't over-trust it.
- Health data is sensitive: explicit consent, minimal storage, prefer on-device.

**Suggested path**
1. **Manual import** — let users enter their measured average cycle length / latency
   from whatever app they already use. Zero integrations, stays static, immediately
   more accurate.
2. **One deep integration** — pick a single ecosystem (likely Apple HealthKit via a
   thin PWA/native wrapper) for auto cycle-length + smart-wake, rather than every
   vendor. Features that genuinely require a wearable: measured cycle length and
   smart-wake; the rest are "nicer," not "necessary."

## Notes

Guidance is general sleep-hygiene information, not medical or religious advice.
Prayer-time conventions are configurable (method + high-latitude rule).
