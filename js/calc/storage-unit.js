/* Storage unit: keep paying, sell now and rebuy later, or let it go. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  /* Month-by-month model. Month m = 1..M.
     Keep: rent rises by the annual increase every 12 months; insurance monthly;
           one-time cost to move the items out when you need them.
     Sell & rebuy: net sale proceeds now (after fees and hauling) grow at the
           cash return; at month m you rebuy at today's replacement cost grown by
           price inflation. */
  function series(v, months) {
    var out = [];
    var cumRent = 0;
    var rent = v.rent;
    var proceeds = v.resaleValue * (1 - v.sellFeePct / 100) - v.haulCost;
    for (var m = 0; m <= months; m += 1) {
      if (m > 0) {
        if (m > 1 && (m - 1) % 12 === 0) rent *= 1 + v.rentIncreasePct / 100;
        cumRent += rent + (v.insurance || 0);
      }
      var keepCost = cumRent + (m > 0 ? v.retrievalCost : 0);
      var replace = v.replacementCost * Math.pow(1 + v.inflationPct / 100, m / 12);
      var grown = proceeds * Math.pow(1 + (v.cashReturnPct || 0) / 100, m / 12);
      var sellRebuy = replace - grown;
      var stuffValue = v.resaleValue * Math.pow(1 - v.depreciationPct / 100, m / 12);
      out.push({ m: m, rent: m ? rent : 0, cumRent: cumRent, keepCost: keepCost, replace: replace, proceeds: grown, sellRebuy: sellRebuy, stuffValue: stuffValue });
    }
    return { rows: out, proceedsNow: proceeds };
  }

  function firstMonth(rows, test) {
    for (var i = 1; i < rows.length; i += 1) if (test(rows[i])) return rows[i].m;
    return null;
  }

  function compute(v) {
    var horizon = v.months || 0;
    var span = Math.max(36, horizon ? horizon + 12 : 0);
    var s = series(v, 240);
    var crossRebuy = firstMonth(s.rows, function (r) { return r.keepCost > r.sellRebuy; });
    var crossReplace = firstMonth(s.rows, function (r) { return r.cumRent >= r.replace; });
    var cut = Math.min(240, Math.max(span, (crossRebuy || 0) + 6, (crossReplace || 0) + 6));
    var rows = s.rows.slice(0, cut + 1);
    var at = horizon ? s.rows[horizon] : null;
    return {
      v: v, rows: rows, all: s.rows, proceedsNow: s.proceedsNow, crossRebuy: crossRebuy, crossReplace: crossReplace,
      horizon: horizon, at: at, monthlyNow: v.rent + (v.insurance || 0),
      yearOne: s.rows[12].cumRent,
    };
  }

  function render(res, v, h) {
    var at = res.at;
    var verdict;
    if (at) {
      var keep = at.keepCost;
      var swap = at.sellRebuy;
      var diff = keep - swap;
      if (diff > 0) {
        verdict = { tone: "warn", title: "Sell now. Rebuying in " + fmt.months(res.horizon) + " costs " + fmt.money(diff) + " less than storing.", body: "Storage would cost " + fmt.money(keep) + " by then, including moving out. Selling nets " + fmt.money(res.proceedsNow) + " today and rebuying would cost about " + fmt.money(at.replace) + "." };
      } else {
        verdict = { tone: "good", title: "Keep it. Storing for " + fmt.months(res.horizon) + " is " + fmt.money(-diff) + " cheaper than selling and rebuying.", body: "Storage costs " + fmt.money(keep) + " by then. Selling and rebuying would cost " + fmt.money(swap) + "." + (res.crossRebuy ? " The answer flips after month " + res.crossRebuy + "." : "") };
      }
    } else {
      verdict = res.crossRebuy
        ? { tone: "info", title: "Storage stops making sense after month " + res.crossRebuy + ".", body: "If you won't need these things for more than " + fmt.months(res.crossRebuy) + ", selling now and rebuying later is cheaper. Enter when you'll need them for a firm answer." }
        : { tone: "good", title: "Storing beats selling and rebuying for the next 20 years.", body: "Your replacement cost is high relative to rent." };
    }

    var stats = [
      ["Monthly cost today", fmt.money(res.monthlyNow, 2), "Rent plus insurance"],
      ["First-year storage cost", fmt.money(res.yearOne), fmt.pct(res.yearOne / Math.max(1, v.replacementCost) * 100, 0) + " of replacement cost"],
      ["Storage passes replacement cost", res.crossReplace ? "Month " + res.crossReplace : "Not within 20 yrs", res.crossReplace ? fmt.months(res.crossReplace) + " of rent buys everything new" : "", res.crossReplace && res.crossReplace <= (res.horizon || 24) ? "bad" : ""],
      ["Selling and rebuying wins after", res.crossRebuy ? "Month " + res.crossRebuy : "Not within 20 yrs", "Counts sale proceeds and moving out", "hl"],
      ["Sell today, net", fmt.money(res.proceedsNow), "After " + fmt.pct(v.sellFeePct, 0) + " selling costs and hauling"],
      ["Rent increase pace", fmt.pct(v.rentIncreasePct, 1) + "/yr", "Rent in year 3: " + fmt.money(res.all[25].rent, 2) + "/mo"],
    ];

    var rows = res.rows;
    var xs = rows.map(function (r) { return r.m; });
    var points = [];
    if (res.crossRebuy && res.crossRebuy <= xs[xs.length - 1]) {
      var cr = res.all[res.crossRebuy];
      points.push({ x: cr.m, y: cr.keepCost, tone: "cross", label: "Month " + cr.m });
    }
    var markers = [];
    if (res.horizon && res.horizon <= xs[xs.length - 1]) markers.push({ x: res.horizon, label: "You need it back" });
    if (res.crossReplace && res.crossReplace <= xs[xs.length - 1]) markers.push({ x: res.crossReplace, label: "Rent = buy it all new", tone: "bad" });
    var chart = h.line({
      width: h.wideWidth,
      xs: xs,
      series: [
        { name: "Keep storing", ys: rows.map(function (r) { return r.keepCost; }) },
        { name: "Sell now, rebuy later", ys: rows.map(function (r) { return r.sellRebuy; }) },
        { name: "Replacement cost", ys: rows.map(function (r) { return r.replace; }), dashed: true, slot: 3 },
      ],
      markers: markers,
      points: points,
      xFormat: function (m) { return m % 12 === 0 ? (m / 12) + " yr" : m + " mo"; },
      tipX: function (m) { return "Month " + m; },
      xTicks: xs.filter(function (m) { return m % (xs.length > 72 ? 24 : 12) === 0; }),
      ariaLabel: "Cumulative cost of storing versus selling now and rebuying later, by month",
      caption: "Where the blue line crosses above orange, selling now and rebuying later becomes cheaper. The dashed line is what it would cost to replace everything at that point.",
    });

    var yearRows = [];
    for (var y = 1; y <= Math.min(10, Math.floor((rows.length - 1) / 12)); y += 1) {
      var r = res.all[y * 12];
      var better = r.keepCost <= r.sellRebuy;
      yearRows.push({ cls: res.horizon && Math.ceil(res.horizon / 12) === y ? "row-hl" : "", cells: ["Year " + y, fmt.money(r.rent, 2), fmt.money(r.keepCost), fmt.money(r.sellRebuy), fmt.money(r.stuffValue), better ? "Keep" : "Sell & rebuy"] });
    }

    var notes = [];
    notes.push("Counted: rent rising " + fmt.pct(v.rentIncreasePct, 1) + " a year, " + fmt.money(v.insurance || 0, 2) + "/month insurance, and " + fmt.money(v.retrievalCost) + " to move everything out when you need it.");
    notes.push("Sell-and-rebuy uses today's " + fmt.money(v.replacementCost) + " replacement cost rising " + fmt.pct(v.inflationPct, 1) + " a year, less " + fmt.money(res.proceedsNow) + " in sale proceeds" + (v.cashReturnPct ? " earning " + fmt.pct(v.cashReturnPct, 1) + " a year" : "") + ".");
    notes.push("Not counted: sentimental value, items that can't be replaced, or your time to sell and shop. Pull those out and store only what truly can't be replaced.");

    return {
      verdict: verdict,
      stats: stats,
      side: [],
      wide: [
        { title: "Keep storing vs selling and rebuying", note: "Cumulative cost from today", html: chart },
        { title: "Year by year", note: "Cumulative totals from today", html: h.table(["Year", "Rent / month", "Total to keep", "Sell now & rebuy", "Stored items' resale value", "Cheaper"], yearRows) },
        { title: "What's included", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Storage unit: keep or sell (NumberCove)", "Monthly cost today: " + fmt.money(res.monthlyNow, 2), "Selling and rebuying wins after: " + (res.crossRebuy ? "month " + res.crossRebuy : "not within 20 years"), "Storage passes replacement cost: " + (res.crossReplace ? "month " + res.crossReplace : "not within 20 years")].concat(at ? ["At " + res.horizon + " months: keep " + fmt.money(at.keepCost) + " vs sell & rebuy " + fmt.money(at.sellRebuy)] : []).join("\n"),
    };
  }

  return {
    id: "storage-unit",
    inputs: [
      { name: "rent", label: "Monthly rent", type: "number", value: 165, min: 0, max: 10000, prefix: "$" },
      { name: "rentIncreasePct", label: "Rent increase per year", type: "number", value: 8, min: 0, max: 100, suffix: "%", hint: "Facilities often raise rents on existing tenants; check your history", slider: { min: 0, max: 30, step: 0.5 } },
      { name: "insurance", label: "Insurance / protection plan", type: "number", value: 12, min: 0, max: 1000, prefix: "$", suffix: "/mo", optional: true },
      { name: "retrievalCost", label: "Cost to move it all out", type: "number", value: 350, min: 0, max: 50000, prefix: "$", hint: "Truck, movers, gas, time" },
      { name: "resaleValue", label: "What it would sell for today", type: "number", value: 2500, min: 0, max: 10000000, prefix: "$", hint: "Realistic used prices, not what you paid" },
      { name: "replacementCost", label: "Cost to rebuy what you'd actually want", type: "number", value: 6000, min: 0, max: 10000000, prefix: "$", hint: "Only the items you'd replace" },
      { name: "months", label: "Months until you'll need it", type: "number", value: 24, min: 0, max: 240, integer: true, optional: true, hint: "Leave blank if you don't know", slider: { min: 1, max: 120, step: 1 } },
      {
        type: "group", title: "Fine-tune", advanced: true,
        fields: [
          { name: "sellFeePct", label: "Selling costs", type: "number", value: 10, min: 0, max: 100, suffix: "%", hint: "Marketplace fees, discounts to sell fast" },
          { name: "haulCost", label: "Cost to haul away what doesn't sell", type: "number", value: 0, min: 0, max: 50000, prefix: "$" },
          { name: "inflationPct", label: "Replacement price inflation", type: "number", value: 3, min: -20, max: 50, suffix: "%/yr" },
          { name: "depreciationPct", label: "Stored items lose value", type: "number", value: 10, min: 0, max: 100, suffix: "%/yr" },
          { name: "cashReturnPct", label: "Return on cash from selling", type: "number", value: 4, min: 0, max: 50, suffix: "%/yr", hint: "Savings account or paying down debt" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { series: series },
  };
});
