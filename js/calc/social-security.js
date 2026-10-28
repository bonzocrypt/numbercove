/* Social Security claiming age: monthly benefit at each age, break-even ages,
   and lifetime value to a planning age. SSA reduction and delayed-credit rules. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  /* Full retirement age in months, by birth year (SSA). */
  function fraMonths(year) {
    if (year <= 1937) return 65 * 12;
    if (year <= 1942) return 65 * 12 + (year - 1937) * 2;
    if (year <= 1954) return 66 * 12;
    if (year <= 1959) return 66 * 12 + (year - 1954) * 2;
    return 67 * 12;
  }

  /* Benefit as a fraction of the full-retirement-age amount (PIA). Early: 5/9 of
     1% per month for the first 36 months, 5/12 of 1% after that. Late: 2/3 of
     1% per month (8% a year) until 70. */
  function factorAt(claimMonths, fra) {
    var k = claimMonths - fra;
    if (k < 0) {
      var m = -k;
      return 1 - (Math.min(m, 36) * 5 / 9 + Math.max(0, m - 36) * 5 / 12) / 100;
    }
    return 1 + Math.min(k, 70 * 12 - fra) * (2 / 3) / 100;
  }

  function fraLabel(fra) {
    var y = Math.floor(fra / 12);
    var m = fra % 12;
    return y + (m ? " and " + m + " month" + (m === 1 ? "" : "s") : "");
  }

  /* Cumulative (optionally discounted) benefits from claim age to each age. */
  function cumulative(pia, claim, fra, toMonth, rMonthly) {
    var monthly = pia * factorAt(claim, fra);
    var total = 0;
    var path = {};
    for (var m = 62 * 12; m <= toMonth; m += 1) {
      if (m >= claim) total += monthly / Math.pow(1 + rMonthly, m - 62 * 12);
      if (m % 12 === 0) path[m / 12] = total;
    }
    return { monthly: monthly, total: total, path: path };
  }

  function breakEven(pia, a1, a2, fra, rMonthly) {
    var b1 = pia * factorAt(a1, fra);
    var b2 = pia * factorAt(a2, fra);
    var t1 = 0;
    var t2 = 0;
    for (var m = 62 * 12; m <= 110 * 12; m += 1) {
      var d = Math.pow(1 + rMonthly, m - 62 * 12);
      if (m >= a1) t1 += b1 / d;
      if (m >= a2) t2 += b2 / d;
      if (m > a2 && t2 >= t1) return m / 12;
    }
    return null;
  }

  function compute(v) {
    var fra = fraMonths(v.birthYear);
    var r = Math.pow(1 + (v.discountPct || 0) / 100, 1 / 12) - 1;
    var claim = Math.round(v.claimAge * 12);
    var plan = Math.round(v.planAge * 12);
    var ages = [];
    for (var a = 62; a <= 70; a += 1) {
      var c = cumulative(v.pia, a * 12, fra, plan, r);
      ages.push({ age: a, months: a * 12, monthly: c.monthly, total: c.total, factor: factorAt(a * 12, fra) });
    }
    var best = ages.reduce(function (b, x) { return x.total > b.total ? x : b; }, ages[0]);
    var mine = cumulative(v.pia, claim, fra, plan, r);
    var be = {
      early: breakEven(v.pia, 62 * 12, fra, fra, r),
      late: breakEven(v.pia, fra, 70 * 12, fra, r),
      span: breakEven(v.pia, 62 * 12, 70 * 12, fra, r),
      mine70: claim < 70 * 12 ? breakEven(v.pia, claim, 70 * 12, fra, r) : null,
    };
    var lines = [62 * 12, fra, 70 * 12].concat(claim !== 62 * 12 && claim !== fra && claim !== 70 * 12 ? [claim] : []).map(function (cm) {
      var c = cumulative(v.pia, cm, fra, 95 * 12, r);
      return { claim: cm, monthly: c.monthly, path: c.path };
    });
    return { v: v, fra: fra, ages: ages, best: best, mine: mine, claim: claim, be: be, lines: lines, plan: plan, r: r };
  }

  function ageText(m) {
    var y = Math.floor(m / 12);
    var mo = Math.round(m - y * 12);
    return y + (mo ? " and " + mo + " mo" : "");
  }

  function render(res, v, h) {
    var best = res.best;
    var beMine = res.be.mine70;
    var verdict = {
      tone: "info",
      title: "Planning to age " + fmt.num(v.planAge, 0) + ", claiming at " + best.age + " pays the most: " + fmt.money(best.total) + (v.discountPct ? " in today's value" : "") + ".",
      body: "Claiming at " + best.age + " pays " + fmt.money(best.monthly) + " a month. Waiting from 62 to 70 pays off if you live past " + (res.be.span ? fmt.num(res.be.span, 1) : "—") + "; from full retirement age to 70, past " + (res.be.late ? fmt.num(res.be.late, 1) : "—") + ".",
    };
    var stats = [
      ["Full retirement age", fraLabel(res.fra), "Born " + v.birthYear],
      ["At 62", fmt.money(res.ages[0].monthly) + "/mo", fmt.pct(res.ages[0].factor * 100, 1) + " of your full benefit"],
      ["At full retirement age", fmt.money(v.pia) + "/mo", "100%"],
      ["At 70", fmt.money(res.ages[8].monthly) + "/mo", fmt.pct(res.ages[8].factor * 100, 0) + " of your full benefit"],
      ["Your choice: " + fmt.num(v.claimAge, v.claimAge % 1 ? 1 : 0), fmt.money(res.mine.monthly) + "/mo", fmt.money(res.mine.total) + " total to " + fmt.num(v.planAge, 0), "hl"],
      ["Break-even vs claiming at 70", beMine ? "Age " + fmt.num(beMine, 1) : "—", beMine ? "Live past this and waiting until 70 wins" : ""],
    ];
    var bars = h.bars({
      rows: res.ages.map(function (a) { return { label: "Age " + a.age, sub: fmt.pct(a.factor * 100, 1), value: a.monthly, tone: a.age === best.age ? "good" : "1", highlight: Math.round(v.claimAge) === a.age }; }),
      format: function (n) { return fmt.money(n) + "/mo"; },
      ariaLabel: "Monthly Social Security benefit for each claiming age from 62 to 70",
    });
    var xs = [];
    for (var a = 62; a <= 95; a += 1) xs.push(a);
    var series = res.lines.map(function (l) {
      var label = l.claim === res.fra ? "Claim at FRA (" + ageText(l.claim) + ")" : "Claim at " + ageText(l.claim);
      return { name: label, ys: xs.map(function (age) { return l.path[age] != null ? l.path[age] : null; }) };
    });
    var points = [];
    if (res.be.early) points.push({ x: res.be.early, y: res.lines[0].monthly * (res.be.early * 12 - 62 * 12), tone: "cross", label: "62 vs FRA: " + fmt.num(res.be.early, 1) });
    if (res.be.late && !v.discountPct) points.push({ x: res.be.late, y: res.lines[1].monthly * (res.be.late * 12 - res.fra), tone: "cross", label: "FRA vs 70: " + fmt.num(res.be.late, 1) });
    var chart = h.line({
      width: h.wideWidth, xs: xs, series: series,
      markers: [{ x: v.planAge, label: "Planning age " + fmt.num(v.planAge, 0) }],
      points: points,
      xFormat: function (x) { return String(x); }, tipX: function (x) { return "Age " + x; },
      ariaLabel: "Cumulative Social Security benefits by age for different claiming ages",
      caption: "Earlier claims start ahead; later claims catch up because the monthly check is larger. Where the lines cross is the break-even age." + (v.discountPct ? " Values are discounted at " + fmt.pct(v.discountPct, 1) + " a year." : " Amounts are in today's dollars; cost-of-living adjustments raise all of them alike."),
    });
    var table = h.table(["Claim at", "Monthly", "% of full", "Total to " + fmt.num(v.planAge, 0), "vs best"], res.ages.map(function (a) {
      return { cls: a.age === best.age ? "row-hl" : "", cells: ["Age " + a.age, fmt.money(a.monthly), fmt.pct(a.factor * 100, 1), fmt.money(a.total), a.age === best.age ? "Best" : "−" + fmt.money(best.total - a.total)] };
    }));
    var notes = [
      "Married? The higher earner's benefit becomes the survivor benefit, so delaying can protect a spouse who outlives you, even if your own break-even is close.",
      "If you claim before full retirement age and keep working, the earnings test can temporarily withhold benefits above an annual earnings limit.",
      "Your exact amounts depend on your earnings record. Get your full-retirement-age benefit (PIA) from your my Social Security statement.",
      "Benefits can be taxable, and Medicare premiums may be deducted from your check; neither is modeled here.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Lifetime benefits by claiming age", html: chart },
        { title: "Monthly benefit by claiming age", note: "Today's dollars", html: bars },
        { title: "Every claiming age", html: table },
        { title: "Before you decide", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Social Security claiming age (NumberCove)", "Full retirement age: " + fraLabel(res.fra), "At 62: " + fmt.money(res.ages[0].monthly) + "/mo; at 70: " + fmt.money(res.ages[8].monthly) + "/mo", "Best claiming age to " + v.planAge + ": " + best.age, "Break-even 62 vs 70: " + (res.be.span ? fmt.num(res.be.span, 1) : "—")].join("\n"),
    };
  }

  return {
    id: "social-security",
    inputs: [
      { name: "birthYear", label: "Birth year", type: "number", value: 1964, min: 1940, max: 2010, integer: true, hint: "Born January 1? Use the year before." },
      { name: "pia", label: "Monthly benefit at full retirement age", type: "number", value: 2400, min: 1, max: 10000, prefix: "$", hint: "From your my Social Security statement" },
      { name: "claimAge", label: "Age you're considering", type: "number", value: 64, min: 62, max: 70, slider: { min: 62, max: 70, step: 0.25 } },
      { name: "planAge", label: "Plan to age", type: "number", value: 88, min: 63, max: 110, hint: "Use a long-lived estimate; many plan to 90+", slider: { min: 70, max: 100, step: 1 } },
      { name: "discountPct", label: "Discount rate (real)", type: "number", value: 0, min: 0, max: 10, suffix: "%", hint: "0 compares total dollars; 2–3% values money sooner more highly" },
    ],
    compute: compute,
    render: render,
    _test: { fraMonths: fraMonths, factorAt: factorAt, breakEven: breakEven },
  };
});
