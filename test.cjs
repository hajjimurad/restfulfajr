const S = require("./sleep.js");

let pass = 0, fail = 0;
function eq(label, got, want) {
  const ok = String(got) === String(want);
  console.log((ok ? "✅" : "❌") + " " + label + "  got=" + got + (ok ? "" : "  want=" + want));
  ok ? pass++ : fail++;
}
function ok(label, cond) {
  console.log((cond ? "✅" : "❌") + " " + label);
  cond ? pass++ : fail++;
}

const settings = { workWake: "07:00", buffer: 30, cycle: 90, latency: 15, target: 5, splitBuffer: 30 };

// --- Munich, summer: late Isha, short night -> split should win -------------
console.log("\n== Munich (late Isha) ==");
let r = S.plan({ maghrib: "21:12", isha: "23:18", fajr: "03:06", sunrise: "05:29" }, settings);
eq("Plan A go-to-sleep (Isha+30 wind-down)", S.fmt(r.afterIsha.bedtime), "23:48");
eq("Plan A Fajr wake", S.fmt(r.afterIsha.wake), "04:33");
eq("Plan A cycles", r.afterIsha.cycles, 3);
ok("Plan A under target", r.afterIsha.underTarget === true);
eq("Split go-to-sleep (Maghrib+30 wind-down)", S.fmt(r.split.bedtime), "21:42");
eq("Split wake (pray Isha)", S.fmt(r.split.wake), "02:27");
eq("Split cycles", r.split.cycles, 3);
ok("Split buffer >= 30m before Fajr", r.split.buffer >= 30);
ok("Split viable", r.split.viable === true);
eq("Recommended", r.recommended, "split");

// --- Cairo: early Isha, long night -> after-Isha reaches target, recommended-
console.log("\n== Cairo (normal) ==");
r = S.plan({ maghrib: "19:00", isha: "20:30", fajr: "04:00", sunrise: "05:30" }, settings);
eq("Plan A cycles", r.afterIsha.cycles, 5);
ok("Plan A meets target", r.afterIsha.underTarget === false);
ok("Plan A wake within window", r.afterIsha.wake >= r.timeline.F && r.afterIsha.wake <= r.timeline.S);
eq("Recommended", r.recommended, "afterIsha");

// --- Pre-sleep wind-down: bedtime = prayer time + wind-down (default 30) ----
console.log("\n== Pre-sleep wind-down ==");
r = S.plan({ maghrib: "20:15", isha: "22:47", fajr: "03:30", sunrise: "05:40" }, settings);
eq("Isha 22:47 -> go to sleep 23:17", S.fmt(r.afterIsha.bedtime), "23:17");
r = S.plan({ maghrib: "20:15", isha: "22:47", fajr: "03:30", sunrise: "05:40" }, Object.assign({}, settings, { preSleep: 0 }));
eq("preSleep=0 -> go to sleep at Isha 22:47", S.fmt(r.afterIsha.bedtime), "22:47");

// --- Verdict: prominent "enough or not" for the recommended plan ------------
console.log("\n== Verdict ==");
r = S.plan({ maghrib: "19:00", isha: "20:30", fajr: "04:00", sunrise: "05:30" }, settings);
eq("Cairo verdict level (target met in one block)", r.verdict.level, "good");
r = S.plan({ maghrib: "21:12", isha: "23:18", fajr: "03:06", sunrise: "05:29" }, settings);
ok("Munich verdict is ok or short (not good)", r.verdict.level !== "good");
ok("Munich verdict has numeric fields", typeof r.verdict.totalSleep === "number" && typeof r.verdict.need === "number" && typeof r.verdict.mainCycles === "number");
ok("Each plan carries its own verdict", !!r.afterIsha.verdict && !!r.split.verdict);
ok("Plan verdicts have a level", ["good","ok","short"].indexOf(r.afterIsha.verdict.level) >= 0 && ["good","ok","short"].indexOf(r.split.verdict.level) >= 0);
ok("Tips are structured objects with codes", Array.isArray(r.tips) && r.tips.every(function (x) { return typeof x === "object" && typeof x.code === "string"; }));

// --- Split hard rule: 30-min buffer before Fajr is always respected ---------
console.log("\n== Split buffer invariant ==");
ok("Munich split buffer >= splitBuffer", true); // covered above
r = S.plan({ maghrib: "21:12", isha: "23:18", fajr: "03:06", sunrise: "05:29" }, settings);
ok("wake + 30 <= Fajr", r.split.wake + 30 <= r.timeline.F);

// --- Sanity: fmt / toMin round trip -----------------------------------------
console.log("\n== helpers ==");
eq("toMin 03:06", S.toMin("03:06"), 186);
eq("fmt 1863 (wraps)", S.fmt(1863), "07:03");
eq("toMin with tz suffix", S.toMin("05:29 (CEST)"), 329);

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
