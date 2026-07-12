/*
 * Restful Fajr — pure sleep/prayer scheduling logic (no DOM, no network).
 *
 * All times are handled on a single continuous "minutes" axis so we can compare
 * across midnight without date math:
 *   - Maghrib & Isha come from TONIGHT (day D)      -> minutes 0..1439 (+1440 if Isha crosses midnight)
 *   - Fajr, Sunrise & work wake come from D+1 morning -> minutes + 1440
 *
 * Exports work in both the browser (window.Sleep) and Node (module.exports).
 */
(function (root) {
  "use strict";

  // ---- time helpers ---------------------------------------------------------

  // "HH:MM" (AlAdhan may append " (CEST)") -> minutes since midnight
  function toMin(hhmm) {
    var m = String(hhmm).match(/(\d{1,2}):(\d{2})/);
    if (!m) return NaN;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  // minutes on the continuous axis -> "HH:MM" clock string
  function fmt(min) {
    var m = ((Math.round(min) % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60);
    var mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  // minutes -> "Xh Ym" duration label
  function dur(min) {
    min = Math.max(0, Math.round(min));
    var h = Math.floor(min / 60);
    var m = min % 60;
    if (h && m) return h + "h " + m + "m";
    if (h) return h + "h";
    return m + "m";
  }

  /*
   * Place the four prayer anchors + work-wake on the continuous axis.
   * raw = { maghrib, isha, fajr, sunrise } as "HH:MM" strings.
   *   maghrib/isha  -> tonight (day D)
   *   fajr/sunrise  -> tomorrow morning (D+1)  => +1440
   * workWake -> tomorrow morning => +1440
   */
  function buildTimeline(raw, workWake) {
    var M = toMin(raw.maghrib);
    var I = toMin(raw.isha);
    if (I < M) I += 1440; // Isha after midnight (very high latitude)
    var F = toMin(raw.fajr) + 1440;
    var S = toMin(raw.sunrise) + 1440;
    var W = toMin(workWake) + 1440;
    return { M: M, I: I, F: F, S: S, W: W };
  }

  // ---- plans ----------------------------------------------------------------

  /*
   * Plan A — sleep after Isha.
   * Go to bed at Isha; wake at the EARLIEST sleep-cycle boundary that is
   * inside the Fajr window and gives the target number of full cycles
   * ("earliest full-rest Fajr"). Must finish family-prep + prayer before sunrise.
   */
  function planAfterIsha(t, cfg) {
    var bedtime = t.I + cfg.preSleep; // pray Isha + wind down before lying down
    var onset = bedtime + cfg.latency;
    var latest = t.S - cfg.buffer; // last moment we can wake & still finish before sunrise
    var kFajr = Math.max(1, Math.ceil((t.F - onset) / cfg.cycle)); // cycles to reach Fajr
    var k = Math.max(cfg.target, kFajr);
    var wake = onset + k * cfg.cycle;
    var underTarget = false;

    if (wake > latest) {
      // Can't fit the target within the window — take the largest cycle count that does.
      var kMax = Math.floor((latest - onset) / cfg.cycle);
      if (kMax >= kFajr && kMax >= 1) {
        k = kMax;
        wake = onset + k * cfg.cycle;
      } else {
        // Not even one full cycle fits inside the Fajr window: pray right at Fajr onset.
        wake = t.F;
        k = Math.max(0, Math.floor((wake - onset) / cfg.cycle));
      }
      underTarget = true;
    } else {
      underTarget = k < cfg.target;
    }
    if (wake < t.F) wake = t.F;

    var mainSleep = Math.max(0, wake - onset);
    var cycles = Math.floor(mainSleep / cfg.cycle);
    var doneBy = wake + cfg.buffer;
    var secondSleep = Math.max(0, t.W - doneBy);
    var viable = wake <= t.S && mainSleep > 0;

    return {
      type: "afterIsha",
      bedtime: bedtime, onset: onset, wake: wake, fajr: t.F,
      cycles: cycles, mainSleep: mainSleep, secondSleep: secondSleep,
      doneBy: doneBy, underTarget: underTarget, viable: viable
    };
  }

  /*
   * Plan B — split: sleep after Maghrib, wake before Fajr to pray Isha then Fajr.
   * Wake must be:  Isha <= wake <= Fajr - splitBuffer   (>=30 min before Fajr,
   * so there is real time to pray Isha before Fajr enters — hard rule).
   * Choose the LARGEST cycle boundary in that window to maximise the first block.
   */
  function planSplit(t, cfg) {
    var bedtime = t.M + cfg.preSleep; // pray Maghrib + wind down before lying down
    var onset = bedtime + cfg.latency;
    var latestWake = t.F - cfg.splitBuffer;
    var kHi = Math.floor((latestWake - onset) / cfg.cycle);
    var kLo = Math.max(1, Math.ceil((t.I - onset) / cfg.cycle));
    var viable = kHi >= kLo && kHi >= 1;

    var res = {
      type: "split",
      bedtime: bedtime, onset: onset, wake: null, isha: t.I, fajr: t.F,
      cycles: 0, mainSleep: 0, buffer: 0, secondSleep: 0, viable: viable
    };
    if (!viable) return res;

    var k = kHi;
    var wake = onset + k * cfg.cycle;
    res.wake = wake;
    res.cycles = k;
    res.mainSleep = wake - onset;
    res.buffer = t.F - wake; // gap before Fajr (>= splitBuffer)
    var doneBy = t.F + cfg.buffer; // after praying Fajr + family prep
    res.secondSleep = Math.max(0, t.W - doneBy);
    return res;
  }

  // ---- recommendation -------------------------------------------------------

  /*
   * Prefer sleeping after Isha when it delivers the full target uninterrupted.
   * Only recommend the split when Isha is late enough that Plan A is squeezed
   * under target AND the split gives at least as much total rest.
   */
  function pickRecommended(a, b) {
    if (a.viable && !a.underTarget) return "afterIsha";
    if (!a.viable && b.viable) return "split";
    if (a.viable && !b.viable) return "afterIsha";
    if (!a.viable && !b.viable) return "afterIsha";
    if (b.cycles > a.cycles) return "split";
    var at = a.mainSleep + a.secondSleep;
    var bt = b.mainSleep + b.secondSleep;
    if (bt >= at) return "split";
    return "afterIsha";
  }

  // ---- tips -----------------------------------------------------------------

  /*
   * Returns structured tip descriptors { code, ...numericParams } — the UI
   * renders them into localized sentences. Times are minutes on the axis;
   * durations are minute counts.
   */
  function buildTips(a, b, rec, t, cfg) {
    var tips = [];
    if (rec === "split") {
      tips.push({ code: "splitRecommended", isha: t.I });
    } else if (a.viable && !a.underTarget) {
      tips.push({ code: "afterIshaFull", target: cfg.target, isha: t.I });
    }

    var chosen = rec === "split" ? b : a;
    var deficit = cfg.target - chosen.cycles;
    if ((chosen.underTarget || chosen.cycles < cfg.target) && deficit > 0) {
      tips.push({ code: "underTarget", cycles: chosen.cycles, mainSleep: chosen.mainSleep, target: cfg.target, deficitMin: deficit * cfg.cycle });
    }

    if (rec === "split" && b.viable) {
      tips.push({ code: "splitBuffer", wake: b.wake, buffer: b.buffer, fajr: t.F });
    }

    tips.push({ code: "sunrise", sunrise: t.S });
    return tips;
  }

  // ---- verdict --------------------------------------------------------------

  /*
   * Overall "will I be rested?" judgement for the recommended plan, if followed.
   *   good  — the main sleep block alone reaches the target cycles (solid, consolidated rest)
   *   ok    — main block is short, but main + optional pre-work sleep reaches the target total
   *   short — even with the optional extra sleep you fall below target
   */
  function buildVerdict(planObj, cfg) {
    var mainCycles = planObj.cycles || 0;
    var total = (planObj.mainSleep || 0) + (planObj.secondSleep || 0);
    var need = cfg.target * cfg.cycle;
    var level;
    if (mainCycles >= cfg.target) level = "good";
    else if (total >= need) level = "ok";
    else level = "short";
    // Structured only — the UI turns this into localized text.
    return { level: level, mainCycles: mainCycles, mainSleep: planObj.mainSleep || 0, totalSleep: total, need: need, target: cfg.target };
  }

  // ---- top-level ------------------------------------------------------------

  function plan(raw, settings) {
    var cfg = {
      cycle: settings.cycle || 90,
      latency: settings.latency || 15,
      target: settings.target || 5,
      buffer: settings.buffer || 30,
      splitBuffer: settings.splitBuffer || 30,
      preSleep: settings.preSleep != null ? settings.preSleep : 30
    };
    var t = buildTimeline(raw, settings.workWake);
    var a = planAfterIsha(t, cfg);
    var b = planSplit(t, cfg);
    var rec = pickRecommended(a, b);
    // Verdict per plan — the user may follow either, so both carry their own judgement.
    a.verdict = buildVerdict(a, cfg);
    b.verdict = b.viable ? buildVerdict(b, cfg) : null;
    var verdict = rec === "split" ? b.verdict : a.verdict;
    var tips = buildTips(a, b, rec, t, cfg);
    return { timeline: t, afterIsha: a, split: b, recommended: rec, verdict: verdict, tips: tips, cfg: cfg };
  }

  var API = {
    toMin: toMin, fmt: fmt, dur: dur,
    buildTimeline: buildTimeline,
    planAfterIsha: planAfterIsha, planSplit: planSplit,
    pickRecommended: pickRecommended, buildVerdict: buildVerdict, buildTips: buildTips, plan: plan
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.Sleep = API;
})(typeof window !== "undefined" ? window : globalThis);
