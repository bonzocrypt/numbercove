/* Credit card annual fee break-even: keep, downgrade, or replace. No issuer
   recommendations; the user supplies every value. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  function rewardsValue(spend, rows, cpp, scale) {
    return rows.reduce(function (s, r) {
      return s + (r.spend || 0) * (scale == null ? 1 : scale) * (r.rate || 0) * cpp / 100;
    }, 0);
  }

  function compute(v) {
    var spendRows = (v.spend || []).filter(function (r) { return r.spend != null; }).map(function (r, i) {
      return { label: (r.label || "").trim() || "Category " + (i + 1), spend: r.spend, rate: r.rate == null ? 1 : r.rate };
    });
    var benefits = (v.benefits || []).filter(function (b) { return b.value != null; }).map(function (b, i) {
      return { label: (b.label || "").trim() || "Benefit " + (i + 1), value: b.value, use: b.use == null ? 100 : b.use, real: b.value * (b.use == null ? 100 : b.use) / 100 };
    });
    var cpp = v.pointValue;
    var totalSpend = spendRows.reduce(function (s, r) { return s + r.spend; }, 0);
    var rewards = rewardsValue(totalSpend, spendRows, cpp);
    var credits = benefits.reduce(function (s, b) { return s + b.real; }, 0);
    var face = benefits.reduce(function (s, b) { return s + b.value; }, 0);
    var bonusYear = v.bonusPoints ? v.bonusPoints * cpp / 100 : 0;
    var years = Math.max(1, v.years || 1);
    var bonusPerYear = bonusYear / years;
    var keep = rewards + credits - v.fee;
    var keepFirst = keep + bonusYear;
    var altRewards = totalSpend * (v.altRate || 0) / 100;
    var alt = altRewards + (v.altCredits || 0) - (v.altFee || 0);
    var diff = keep - alt;
    /* Spend where the cards break even (rewards scale with spend; credits and fees don't). */
    var perDollarKeep = totalSpend > 0 ? rewards / totalSpend : 0;
    var perDollarAlt = (v.altRate || 0) / 100;
    var fixedKeep = credits - v.fee;
    var fixedAlt = (v.altCredits || 0) - (v.altFee || 0);
    var breakEvenSpend = perDollarKeep > perDollarAlt ? (fixedAlt - fixedKeep) / (perDollarKeep - perDollarAlt) : null;
    var effRate = totalSpend > 0 ? rewards / totalSpend * 100 : 0;
    var breakEvenCpp = totalSpend > 0 ? (alt - credits + v.fee) / spendRows.reduce(function (s, r) { return s + r.spend * r.rate; }, 0) * 100 : null;
    var maxSpend = Math.max(totalSpend * 2, breakEvenSpend && breakEvenSpend > 0 ? breakEvenSpend * 1.4 : 0, 1000);
    var xs = [];
    for (var i = 0; i <= 40; i += 1) xs.push(Math.round(maxSpend * i / 40));
    return {
      v: v, spendRows: spendRows, benefits: benefits, totalSpend: totalSpend, rewards: rewards, credits: credits, face: face, bonusYear: bonusYear, bonusPerYear: bonusPerYear,
      keep: keep, keepFirst: keepFirst, alt: alt, altRewards: altRewards, diff: diff, breakEvenSpend: breakEvenSpend, effRate: effRate, breakEvenCpp: breakEvenCpp,
      xs: xs, perDollarKeep: perDollarKeep, perDollarAlt: perDollarAlt, fixedKeep: fixedKeep, fixedAlt: fixedAlt,
      unused: face - credits,
    };
  }

  function render(res, v, h) {
    var altName = { "No-fee 2% card": "a no-fee " + fmt.pct(v.altRate || 0, (v.altRate || 0) % 1 ? 1 : 0) + " card", "Downgraded card": "the downgraded card", "Other card": "the other card" }[v.altName] || "the alternative";
    var verdict;
    if (res.diff >= 0) {
      verdict = { tone: "good", title: "Keep it: the card is worth " + fmt.money(res.diff) + " more a year than " + altName + ".", body: "After the " + fmt.money(v.fee) + " fee you net " + fmt.money(res.keep) + " a year in rewards and credits you'd actually use, versus " + fmt.money(res.alt) + "." + (res.breakEvenSpend != null && res.breakEvenSpend > 0 ? " That holds as long as you spend at least " + fmt.money(res.breakEvenSpend) + " a year on it." : "") };
    } else {
      verdict = { tone: "warn", title: "Switch: " + altName.charAt(0).toUpperCase() + altName.slice(1) + " comes out " + fmt.money(-res.diff) + " a year ahead.", body: "The card nets " + fmt.money(res.keep) + " after its " + fmt.money(v.fee) + " fee; " + altName + " nets " + fmt.money(res.alt) + "." + (res.breakEvenSpend != null && res.breakEvenSpend > res.totalSpend ? " You'd need to spend about " + fmt.money(res.breakEvenSpend) + " a year for the fee to pay off." : res.unused > 1 ? " Credits you won't use cost you " + fmt.money(res.unused) + " of the card's headline value." : "") };
    }
    var stats = [
      ["Net value of this card", fmt.signed(res.keep), "Rewards + used credits − fee", res.keep >= res.alt ? "good" : ""],
      ["Net value of " + (v.altName || "alternative"), fmt.signed(res.alt), fmt.pct(v.altRate || 0, 1) + " back on " + fmt.money(res.totalSpend) + " spend"],
      ["Break-even annual spend", res.breakEvenSpend == null ? "Never" : res.breakEvenSpend <= 0 ? "Any spend" : fmt.money(res.breakEvenSpend), res.breakEvenSpend == null ? "This card earns less per dollar" : "Where the two cards are equal", "hl"],
      ["Effective reward rate", fmt.pct(res.effRate, 2), "At " + fmt.num(v.pointValue, 2) + "¢ per point"],
      ["Credits you'll really use", fmt.money(res.credits), res.unused > 0.5 ? "Of " + fmt.money(res.face) + " advertised" : "All of them"],
      ["Point value needed to keep", res.breakEvenCpp != null ? fmt.num(res.breakEvenCpp, 2) + "¢" : "—", "Cents per point where the cards tie"],
    ];
    if (res.bonusYear) stats.push(["First year with sign-up bonus", fmt.signed(res.keepFirst), fmt.money(res.bonusPerYear) + "/yr if spread over " + fmt.num(v.years, 0) + " years"]);
    var parts = [];
    res.spendRows.forEach(function (r) { parts.push({ label: r.label + " rewards", sub: fmt.money(r.spend) + " × " + fmt.num(r.rate, 1) + "x", value: r.spend * r.rate * v.pointValue / 100, tone: "1" }); });
    res.benefits.forEach(function (b) { parts.push({ label: b.label, sub: b.use < 100 ? fmt.pct(b.use, 0) + " of " + fmt.money(b.value) + " used" : "", value: b.real, tone: "3" }); });
    parts.push({ label: "Annual fee", value: -v.fee, tone: "bad" });
    parts.push({ label: "Net value", value: res.keep, tone: res.keep >= 0 ? "good" : "bad", highlight: true });
    var bars = h.bars({ title: "What the card is worth to you each year", rows: parts, format: function (n) { return (n < 0 ? "−" : "") + fmt.money(Math.abs(n)); }, ariaLabel: "Annual value of rewards and credits minus the fee" });

    var xs = res.xs;
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [
        { name: "This card", ys: xs.map(function (s) { return res.fixedKeep + res.perDollarKeep * s; }) },
        { name: v.altName || "Alternative", ys: xs.map(function (s) { return res.fixedAlt + res.perDollarAlt * s; }) },
      ],
      markers: [{ x: res.totalSpend, label: "Your spend" }],
      points: res.breakEvenSpend && res.breakEvenSpend > 0 && res.breakEvenSpend <= xs[xs.length - 1] ? [{ x: res.breakEvenSpend, y: res.fixedKeep + res.perDollarKeep * res.breakEvenSpend, tone: "cross", label: "Break-even " + fmt.money(res.breakEvenSpend) }] : [],
      xFormat: function (x) { return "$" + (x >= 1000 ? Math.round(x / 1000) + "k" : x); }, tipX: function (x) { return fmt.money(x) + " a year"; },
      tipY: function (y) { return fmt.signed(y); },
      ariaLabel: "Net annual value of each card by annual spending",
      caption: "Rewards grow with spending while the fee and credits stay fixed. Above the break-even spend, the annual-fee card pulls ahead.",
    });
    var tips = [
      "Value credits at what they save you, not their face value. A $200 airline credit you'd never use otherwise is worth $0.",
      "Use a point value you've actually redeemed at. Transfer-partner values above 1¢ only count if you'll book those redemptions.",
      "Downgrading to a no-fee card in the same family usually keeps your account age and credit line; closing it does not.",
      "Sign-up bonuses are one-time. Judge whether to keep a card in year two on its ongoing value.",
    ];
    return {
      verdict: verdict, stats: stats, side: [bars],
      wide: [
        { title: "Net value by annual spending", html: chart },
        { title: "Before you decide", html: '<ul class="nc-recs">' + tips.map(function (t) { return "<li>" + h.esc(t) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Credit card annual fee check (NumberCove)", "Net value of this card: " + fmt.signed(res.keep), "Net value of " + (v.altName || "alternative") + ": " + fmt.signed(res.alt), "Break-even spend: " + (res.breakEvenSpend == null ? "never" : fmt.money(res.breakEvenSpend))].join("\n"),
    };
  }

  return {
    id: "credit-card-fee",
    inputs: [
      { name: "fee", label: "Annual fee", type: "number", value: 395, min: 0, max: 10000, prefix: "$" },
      { name: "pointValue", label: "Value per point or mile", type: "number", value: 1.25, min: 0, max: 10, suffix: "¢", hint: "1¢ for cash back; use what you actually redeem at", slider: { min: 0.5, max: 2.5, step: 0.05 } },
      {
        name: "spend", label: "Annual spending on this card", type: "list", span: 2, maxRows: 8, addLabel: "Add a category",
        columns: [
          { name: "label", label: "Category", type: "text", placeholder: "Dining" },
          { name: "spend", label: "Spend / yr", type: "number", prefix: "$", min: 0 },
          { name: "rate", label: "Earns", type: "number", suffix: "x", min: 0, max: 100 },
        ],
        rows: [
          { label: "Travel", spend: "4000", rate: "3" },
          { label: "Dining", spend: "3000", rate: "3" },
          { label: "Everything else", spend: "12000", rate: "1" },
        ],
      },
      {
        name: "benefits", label: "Credits and perks", type: "list", span: 2, maxRows: 8, addLabel: "Add a benefit",
        hint: "Face value, and the share you'd really use. Lounge visits: visits × what you'd pay.",
        columns: [
          { name: "label", label: "Benefit", type: "text", placeholder: "Travel credit" },
          { name: "value", label: "Face value", type: "number", prefix: "$", min: 0 },
          { name: "use", label: "You'll use", type: "number", suffix: "%", min: 0, max: 100 },
        ],
        rows: [
          { label: "Travel credit", value: "300", use: "100" },
          { label: "Lounge visits (4 × $40)", value: "160", use: "75" },
          { label: "Streaming credit", value: "120", use: "50" },
        ],
      },
      {
        type: "group", title: "Compare with", open: true, advanced: true,
        hint: "A no-fee downgrade or a flat cash-back card.",
        fields: [
          { name: "altName", label: "Name", type: "select", value: "No-fee 2% card", options: [["No-fee 2% card", "No-fee cash-back card"], ["Downgraded card", "Downgrade (same issuer)"], ["Other card", "Another card"]] },
          { name: "altRate", label: "Earns on all spending", type: "number", value: 2, min: 0, max: 20, suffix: "%" },
          { name: "altFee", label: "Its annual fee", type: "number", value: 0, min: 0, max: 10000, prefix: "$" },
          { name: "altCredits", label: "Credits you'd use", type: "number", value: 0, min: 0, max: 10000, prefix: "$" },
        ],
      },
      {
        type: "group", title: "Sign-up bonus", advanced: true,
        fields: [
          { name: "bonusPoints", label: "Bonus points", type: "number", value: 0, min: 0, max: 10000000, optional: true },
          { name: "years", label: "Years you'll keep the card", type: "number", value: 3, min: 1, max: 30 },
        ],
      },
    ],
    compute: compute,
    render: render,
  };
});
