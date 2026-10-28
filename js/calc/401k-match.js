/* 401(k) match and paycheck pacing: capture the full employer match without
   hitting the annual limit early. 2026 IRS limits. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var LIMITS = { year: 2026, deferral: 24500, catchUp50: 8000, catchUp60: 11250, comp: 360000, additions: 72000 };
  var VESTING = {
    immediate: function () { return 100; },
    cliff3: function (y) { return y >= 3 ? 100 : 0; },
    graded6: function (y) { return y < 2 ? 0 : Math.min(100, (Math.floor(y) - 1) * 20); },
    graded5: function (y) { return y < 1 ? 0 : Math.min(100, Math.floor(y) * 20); },
  };

  function deferralLimit(age) {
    if (age >= 60 && age <= 63) return LIMITS.deferral + LIMITS.catchUp60;
    if (age >= 50) return LIMITS.deferral + LIMITS.catchUp50;
    return LIMITS.deferral;
  }

  function tierMatch(tiers, deferral, comp) {
    var m = 0;
    var lower = 0;
    tiers.forEach(function (t) {
      var width = t.upTo / 100 * comp;
      var portion = Math.max(0, Math.min(deferral - lower, width));
      m += portion * t.rate / 100;
      lower += width;
    });
    return m;
  }

  /* Simulate the year paycheck by paycheck at election pct (whole year, or the
     remaining paychecks when some are already paid). */
  function simulate(v, pct, ctx) {
    var N = ctx.N;
    var limit = ctx.limit;
    var cumComp = 0;
    var cumDef = 0;
    var cumMatch = 0;
    var cumMatchComp = 0;
    var hitAt = null;
    var rows = [];
    var done = Math.min(v.paidSoFar || 0, N);
    var ytd = Math.min(v.ytd || 0, limit);
    for (var i = 1; i <= N; i += 1) {
      var base = v.salary / N;
      var bonusHere = v.bonus && i === ctx.bonusAt ? v.bonus : 0;
      /* Pay above the IRS compensation limit doesn't count for contributions. */
      var gross = base + bonusHere;
      var scale = gross > 0 ? Math.min(1, Math.max(0, LIMITS.comp - cumComp) / gross) : 0;
      cumComp += gross;
      var defComp = (base + (v.deferOnBonus ? bonusHere : 0)) * scale;
      var matchComp = (base + (v.matchOnBonus ? bonusHere : 0)) * scale;
      var d;
      if (i <= done) d = done ? ytd / done : 0;
      else d = Math.min(pct / 100 * defComp, Math.max(0, limit - cumDef));
      if (i > done && hitAt == null && cumDef + d >= limit - 0.005 && limit > 0) hitAt = i;
      cumDef += d;
      cumMatchComp += matchComp;
      var mt = v.period === "annual" ? 0 : tierMatch(ctx.tiers, d, matchComp);
      cumMatch += mt;
      rows.push({ i: i, deferral: d, match: mt, cumDef: cumDef, cumMatch: cumMatch, comp: defComp });
    }
    var annualMatch = tierMatch(ctx.tiers, cumDef, cumMatchComp);
    var paid = v.period === "annual" ? annualMatch : (v.trueUp ? Math.max(cumMatch, annualMatch) : cumMatch);
    var maxMatch = ctx.maxMatch;
    return { rows: rows, total: cumDef, match: paid, perCheckMatch: cumMatch, annualMatch: annualMatch, trueUpPaid: v.period !== "annual" && v.trueUp ? Math.max(0, annualMatch - cumMatch) : 0, missed: Math.max(0, maxMatch - paid), hitAt: hitAt, limitReached: cumDef >= limit - 0.005 };
  }

  function compute(v) {
    var tiers = (v.tiers || []).filter(function (t) { return t.rate != null && t.upTo != null && t.upTo > 0; });
    if (!tiers.length) {
      var e = new Error("no tiers");
      e.userMessage = "Enter at least one match tier, such as 100% on the first 3% of pay.";
      throw e;
    }
    var N = +v.frequency;
    var limit = deferralLimit(v.age);
    var threshold = tiers.reduce(function (s, t) { return s + t.upTo; }, 0);
    var yearComp = Math.min(LIMITS.comp, v.salary + (v.bonus || 0));
    var matchCompYear = Math.min(LIMITS.comp, v.salary + (v.matchOnBonus ? v.bonus || 0 : 0));
    var maxMatch = tierMatch(tiers, threshold / 100 * matchCompYear, matchCompYear);
    var bonusAt = Math.max(1, Math.min(N, Math.round(v.bonusCheck || N)));
    var ctx = { N: N, limit: limit, tiers: tiers, maxMatch: maxMatch, bonusAt: bonusAt };
    var current = simulate(v, v.election, ctx);

    /* Max-out election: the lowest rate that still reaches the limit by the last
       paycheck, in the plan's increments. */
    var step = +v.increment || 1;
    var lo = 0;
    var hi = 100;
    for (var k = 0; k < 40; k += 1) {
      var mid = (lo + hi) / 2;
      if (simulate(v, mid, ctx).limitReached) hi = mid;
      else lo = mid;
    }
    var exact = hi;
    var maxOutPct = Math.ceil(exact / step - 1e-9) * step;
    var floorPct = Math.floor(exact / step + 1e-9) * step;
    var maxOut = simulate(v, Math.min(100, maxOutPct), ctx);
    var maxOutFloor = simulate(v, floorPct, ctx);
    /* Prefer the election that hits the limit on the last paycheck: if rounding up
       hits it early and loses match, use the rounded-down rate. */
    var pick = maxOut;
    var pickPct = maxOutPct;
    if (maxOut.missed > 0.5 && maxOutFloor.missed <= maxOut.missed) { pick = maxOutFloor; pickPct = floorPct; }
    var matchPct = Math.ceil(threshold / step - 1e-9) * step;
    var forMatch = simulate(v, matchPct, ctx);
    var vest = v.vesting === "custom" ? (v.vestedPct || 0) : VESTING[v.vesting](v.years || 0);
    var additions = current.total + current.match + (v.employerExtra || 0) / 100 * yearComp;
    var addLimit = LIMITS.additions + (limit - LIMITS.deferral);
    return {
      v: v, N: N, limit: limit, tiers: tiers, threshold: threshold, maxMatch: maxMatch, current: current, exact: exact, maxOutPct: pickPct, maxOut: pick,
      matchPct: matchPct, forMatch: forMatch, vest: vest, yearComp: yearComp, additions: additions, addLimit: addLimit, bonusAt: bonusAt,
    };
  }

  function render(res, v, h) {
    var c = res.current;
    var verdict;
    if (v.goal === "max") {
      if (Math.abs(res.maxOutPct - v.election) < 1e-9 && c.missed < 0.5) {
        verdict = { tone: "good", title: "Keep " + fmt.pct(v.election, res.maxOutPct % 1 ? 1 : 0) + ". You max out on the last paycheck and keep the full match.", body: "You'll contribute " + fmt.money(c.total) + " and receive " + fmt.money(c.match) + " in match." };
      } else {
        verdict = { tone: c.missed > 0.5 ? "bad" : "warn", title: "Set your contribution to " + fmt.pct(res.maxOutPct, res.maxOutPct % 1 ? 1 : 0) + " to max out without losing match.", body: (c.hitAt && c.hitAt < res.N && c.missed > 0.5 ? "At " + fmt.pct(v.election, 0) + " you hit the " + fmt.money(res.limit) + " limit on paycheck " + c.hitAt + " of " + res.N + " and lose " + fmt.money(c.missed) + " of match because there's no true-up. " : c.limitReached ? "" : "At " + fmt.pct(v.election, 0) + " you'll contribute " + fmt.money(c.total) + ", " + fmt.money(res.limit - c.total) + " short of the limit. ") + "At " + fmt.pct(res.maxOutPct, res.maxOutPct % 1 ? 1 : 0) + " you contribute " + fmt.money(res.maxOut.total) + " and get " + fmt.money(res.maxOut.match) + " in match." };
      }
    } else if (c.missed > 0.5) {
      var reason = c.hitAt && c.hitAt < res.N && v.election >= res.threshold ? "you hit the annual limit on paycheck " + c.hitAt + " and your plan has no true-up" : "your " + fmt.pct(v.election, 0) + " is below the " + fmt.pct(res.threshold, 0) + " the match requires";
      verdict = { tone: "bad", title: "You're leaving " + fmt.money(c.missed) + " of free match on the table.", body: "Because " + reason + ". Contribute at least " + fmt.pct(res.matchPct, res.matchPct % 1 ? 1 : 0) + (c.hitAt && v.election >= res.threshold ? ", but no more than " + fmt.pct(res.maxOutPct, 0) : "") + " to collect the full " + fmt.money(res.maxMatch) + "." };
    } else {
      verdict = { tone: "good", title: "You're capturing the full " + fmt.money(res.maxMatch) + " match.", body: "Contribute at least " + fmt.pct(res.matchPct, 0) + " of pay to keep it. Room left under the limit: " + fmt.money(Math.max(0, res.limit - c.total)) + "." };
    }

    var stats = [
      ["Full match available", fmt.money(res.maxMatch), "Needs " + fmt.pct(res.threshold, res.threshold % 1 ? 1 : 0) + " of eligible pay"],
      ["Your contributions", fmt.money(c.total), "At " + fmt.pct(v.election, v.election % 1 ? 1 : 0) + " · limit " + fmt.money(res.limit)],
      ["Match you'll receive", fmt.money(c.match), c.trueUpPaid > 0.5 ? "Includes " + fmt.money(c.trueUpPaid) + " year-end true-up" : (c.missed > 0.5 ? fmt.money(c.missed) + " missed" : "Full match"), c.missed > 0.5 ? "bad" : "good"],
      ["Limit reached", c.hitAt ? "Paycheck " + c.hitAt + " of " + res.N : "Not reached", c.hitAt && c.hitAt < res.N ? "Contributions stop early" : ""],
      ["Max-out election", fmt.pct(res.maxOutPct, res.maxOutPct % 1 ? 1 : 0), "Exact: " + fmt.pct(res.exact, 2) + " of pay", "hl"],
      ["Vested in match", fmt.pct(res.vest, 0), fmt.money(c.match * res.vest / 100) + " of this year's match is yours if you leave now"],
    ];

    var xs = c.rows.map(function (r) { return r.i; });
    var series = [
      { name: "You at " + fmt.pct(v.election, v.election % 1 ? 1 : 0), ys: c.rows.map(function (r) { return r.cumDef; }) },
      { name: "You at " + fmt.pct(res.maxOutPct, res.maxOutPct % 1 ? 1 : 0) + " (max-out)", ys: res.maxOut.rows.map(function (r) { return r.cumDef; }), dashed: true },
      { name: "Employer match at " + fmt.pct(v.election, 0), ys: c.rows.map(function (r) { return r.cumMatch; }), slot: 3 },
    ];
    var markers = [];
    if (c.hitAt && c.hitAt < res.N) markers.push({ x: c.hitAt, label: "Limit hit", tone: "bad" });
    if (v.bonus) markers.push({ x: res.bonusAt, label: "Bonus" });
    var chart = h.line({
      width: h.wideWidth, xs: xs, series: series, markers: markers,
      refLines: [{ y: res.limit, label: LIMITS.year + " limit " + fmt.money(res.limit) }],
      xFormat: function (x) { return "#" + x; }, tipX: function (x) { return "Paycheck " + x; },
      xTicks: xs.filter(function (x) { return x === 1 || x % (res.N > 26 ? 8 : res.N > 12 ? 4 : 2) === 0; }),
      ariaLabel: "Cumulative 401(k) contributions and employer match by paycheck",
      caption: "When your line reaches the limit before the last paycheck, contributions stop and, without a true-up, so does the match. The dashed line paces you to finish exactly at the limit.",
    });

    var options = [res.matchPct, Math.max(res.matchPct, 10), res.maxOutPct, Math.min(100, res.maxOutPct + 5), v.election].filter(function (x, i, a) { return a.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var simFn = def._simulate;
    var table = h.table(["Election", "You contribute", "Match", "Missed match", "Limit hit"], options.map(function (p) {
      var s = simFn(v, p);
      return { cls: p === v.election ? "row-hl" : "", cells: [fmt.pct(p, p % 1 ? 1 : 0) + (p === res.maxOutPct ? " (max-out)" : p === res.matchPct ? " (full match)" : ""), fmt.money(s.total), fmt.money(s.match), s.missed > 0.5 ? fmt.money(s.missed) : "None", s.hitAt ? "Paycheck " + s.hitAt : "No"] };
    }));

    var notes = [
      "2026 limits: " + fmt.money(LIMITS.deferral) + " employee deferrals, plus " + fmt.money(LIMITS.catchUp50) + " catch-up at 50 or older (" + fmt.money(LIMITS.catchUp60) + " at ages 60 to 63). Pay above " + fmt.money(LIMITS.comp) + " doesn't count for plan contributions.",
      "Total contributions to your account (yours, match, and other employer money) are capped at " + fmt.money(res.addLimit) + " for your age. Estimated this year: " + fmt.money(res.additions) + ".",
      "If you earned more than $150,000 in Social Security wages last year, catch-up contributions in 2026 must go to the Roth side of the plan.",
      "Match formulas, true-ups, and vesting are set by your plan document. Check your summary plan description.",
    ];
    return {
      verdict: verdict,
      stats: stats,
      side: [],
      wide: [
        { title: "Your contributions through the year", note: res.N + " paychecks", html: chart },
        { title: "Compare elections", html: table },
        { title: "Limits and rules", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["401(k) match plan (NumberCove)", "Full match available: " + fmt.money(res.maxMatch), "Your election " + fmt.pct(v.election, 1) + ": contribute " + fmt.money(c.total) + ", match " + fmt.money(c.match) + (c.missed > 0.5 ? ", missed " + fmt.money(c.missed) : ""), "Max-out election: " + fmt.pct(res.maxOutPct, 1), "Minimum for full match: " + fmt.pct(res.matchPct, 1)].join("\n"),
    };
  }

  var def = {
    id: "401k-match",
    inputs: [
      { name: "salary", label: "Annual salary", type: "number", value: 120000, min: 1, max: 10000000, prefix: "$", hint: "Base pay the plan counts" },
      { name: "frequency", label: "Pay frequency", type: "select", value: "26", options: [["52", "Weekly (52)"], ["26", "Every two weeks (26)"], ["24", "Twice a month (24)"], ["12", "Monthly (12)"]] },
      { name: "age", label: "Your age at year-end", type: "number", value: 45, min: 16, max: 100, integer: true, hint: "50+ adds catch-up room" },
      { name: "election", label: "Your contribution", type: "number", value: 25, min: 0, max: 100, suffix: "% of pay", slider: { min: 0, max: 50, step: 1 } },
      { name: "goal", label: "Your goal", type: "segment", value: "max", options: [["max", "Max out the limit"], ["match", "Just get the full match"]], span: 2 },
      {
        name: "tiers", label: "Employer match formula", type: "list", span: 2, maxRows: 4, addLabel: "Add a tier",
        hint: "Example: 100% on the first 3% of pay, then 50% on the next 2%.",
        columns: [
          { name: "rate", label: "Match rate", type: "number", suffix: "%", min: 0, max: 500 },
          { name: "upTo", label: "On the next … of pay", type: "number", suffix: "%", min: 0, max: 100 },
        ],
        rows: [{ rate: "100", upTo: "3" }, { rate: "50", upTo: "2" }],
      },
      { name: "period", label: "Match is calculated", type: "segment", value: "paycheck", options: [["paycheck", "Each paycheck"], ["annual", "On the whole year"]], span: 2 },
      { name: "trueUp", label: "Plan makes a year-end true-up", type: "toggle", value: false, hint: "Pays any match you missed by front-loading", showIf: { period: "paycheck" } },
      { name: "increment", label: "Plan allows elections in steps of", type: "select", value: "1", options: [["1", "Whole percent"], ["0.5", "Half percent"], ["0.01", "Any amount"]] },
      {
        type: "group", title: "Bonus", advanced: true,
        fields: [
          { name: "bonus", label: "Bonus this year", type: "number", value: 0, min: 0, max: 10000000, prefix: "$", optional: true },
          { name: "bonusCheck", label: "Paid with paycheck #", type: "number", value: 26, min: 1, max: 52, integer: true },
          { name: "deferOnBonus", label: "Your % applies to the bonus", type: "toggle", value: true },
          { name: "matchOnBonus", label: "Match applies to the bonus", type: "toggle", value: true },
        ],
      },
      {
        type: "group", title: "Mid-year and vesting", advanced: true,
        fields: [
          { name: "paidSoFar", label: "Paychecks already paid this year", type: "number", value: 0, min: 0, max: 52, integer: true },
          { name: "ytd", label: "Contributed so far this year", type: "number", value: 0, min: 0, max: 100000, prefix: "$" },
          { name: "vesting", label: "Match vesting schedule", type: "select", value: "immediate", options: [["immediate", "Immediate"], ["cliff3", "3-year cliff"], ["graded6", "6-year graded (20% a year from year 2)"], ["graded5", "5-year graded (20% a year)"], ["custom", "Enter my vested %"]] },
          { name: "years", label: "Years of service", type: "number", value: 2, min: 0, max: 60 },
          { name: "vestedPct", label: "Vested percentage", type: "number", value: 100, min: 0, max: 100, suffix: "%", showIf: { vesting: "custom" } },
          { name: "employerExtra", label: "Other employer contributions", type: "number", value: 0, min: 0, max: 100, suffix: "% of pay", hint: "Profit sharing or safe-harbor nonelective" },
        ],
      },
    ],
    compute: compute,
    render: render,
  };
  def._simulate = null;
  var origCompute = compute;
  def.compute = function (v) {
    var res = origCompute(v);
    var ctx = { N: res.N, limit: res.limit, tiers: res.tiers, maxMatch: res.maxMatch, bonusAt: res.bonusAt };
    def._simulate = function (vv, pct) { return simulate(vv, pct, ctx); };
    return res;
  };
  def._test = { tierMatch: tierMatch, deferralLimit: deferralLimit, LIMITS: LIMITS, VESTING: VESTING };
  return def;
});
