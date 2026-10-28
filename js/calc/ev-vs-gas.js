/* EV vs gas car: real cost per mile, total cost of ownership, break-even. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };
  var cents = function (x) { return fmt.num(x * 100, 1) + "¢"; };
  /* EIA CO2 coefficient for finished motor gasoline (ethanol blend), lb per gallon. */
  var GAS_CO2 = 18.73;

  /* Blended price per kWh delivered to the battery, and per kWh from the wall. */
  function chargePrice(v) {
    var home = (v.homePct || 0) / 100;
    var dc = (v.fastPct || 0) / 100;
    if (home + dc > 1) { var k = home + dc; home /= k; dc /= k; }
    var l2 = Math.max(0, 1 - home - dc);
    var loss = 1 + (v.lossPct || 0) / 100;
    /* Home charging pays for losses on your meter; public prices are per kWh delivered. */
    return home * v.homeRate * loss + l2 * v.publicRate + dc * v.fastRate;
  }

  function perMile(v, gasOverride) {
    var gas = gasOverride != null ? gasOverride : v.gas;
    var evEnergy = v.evEff / 100 * chargePrice(v);
    var gasEnergy = gas / v.mpg;
    return {
      ev: { energy: evEnergy, maint: v.evMaint / 100, total: evEnergy + v.evMaint / 100 },
      gas: { energy: gasEnergy, maint: v.gasMaint / 100, total: gasEnergy + v.gasMaint / 100 },
    };
  }

  function yearly(v, gasOverride) {
    var pm = perMile(v, gasOverride);
    var ev = pm.ev.total * v.miles + (v.evInsurance || 0) + (v.evFee || 0);
    var gas = pm.gas.total * v.miles + (v.gasInsurance || 0);
    return { pm: pm, ev: ev, gas: gas, saving: gas - ev };
  }

  function compute(v) {
    var y = yearly(v);
    var years = Math.max(1, Math.round(v.years));
    var evUp = v.evPrice + (v.charger || 0) - (v.evIncentive || 0);
    var gasUp = v.gasPrice;
    var evResale = v.evPrice * (v.evResale || 0) / 100;
    var gasResale = v.gasPrice * (v.gasResale || 0) / 100;
    var ge = (v.gasEsc || 0) / 100;
    var ee = (v.elecEsc || 0) / 100;
    var cum = [{ y: 0, ev: evUp, gas: gasUp }];
    var cross = null;
    var pm = y.pm;
    for (var t = 1; t <= Math.max(years, 15); t += 1) {
      var evYear = (pm.ev.energy * Math.pow(1 + ee, t - 1) + pm.ev.maint) * v.miles + (v.evInsurance || 0) + (v.evFee || 0);
      var gasYear = (pm.gas.energy * Math.pow(1 + ge, t - 1) + pm.gas.maint) * v.miles + (v.gasInsurance || 0);
      var prev = cum[t - 1];
      var next = { y: t, ev: prev.ev + evYear, gas: prev.gas + gasYear };
      if (cross == null && evUp > gasUp && next.ev <= next.gas) {
        var d0 = prev.ev - prev.gas;
        var d1 = next.ev - next.gas;
        cross = t - 1 + d0 / (d0 - d1);
      }
      cum.push(next);
    }
    var end = cum[years];
    var totalEv = end.ev - evResale;
    var totalGas = end.gas - gasResale;
    /* Gas price where both cost the same per mile to run (energy + maintenance + fixed yearly). */
    var fixedDiff = ((v.evInsurance || 0) + (v.evFee || 0) - (v.gasInsurance || 0)) / v.miles;
    var breakEvenGas = (pm.ev.total + fixedDiff - pm.gas.maint) * v.mpg;
    var sens = [];
    for (var g = 2; g <= 7.001; g += 0.25) {
      var s = yearly(v, g);
      sens.push({ g: Math.round(g * 100) / 100, saving: s.saving });
    }
    var co2 = { ev: v.miles * v.evEff / 100 * (1 + (v.lossPct || 0) / 100) * (v.gridCo2 != null ? v.gridCo2 : 0.81), gas: v.miles / v.mpg * GAS_CO2 };
    return { v: v, y: y, years: years, evUp: evUp, gasUp: gasUp, cum: cum, cross: cross, totalEv: totalEv, totalGas: totalGas, evResale: evResale, gasResale: gasResale, breakEvenGas: breakEvenGas, sens: sens, co2: co2, blended: chargePrice(v) };
  }

  function render(res, v, h) {
    var y = res.y;
    var diff = res.totalGas - res.totalEv;
    var verdict = diff > 0
      ? { tone: "good", title: "The EV saves about " + money0(diff) + " over " + res.years + " years.", body: "It costs " + cents(y.pm.ev.total) + " a mile to drive versus " + cents(y.pm.gas.total) + " for gas, saving " + money0(y.saving) + " a year" + (res.cross != null ? ", and earns back its higher price in about " + fmt.num(res.cross, 1) + " years" : "") + ". Totals count resale value at the end." }
      : { tone: "warn", title: "The gas car costs about " + money0(-diff) + " less over " + res.years + " years.", body: y.saving > 0 ? "The EV is cheaper to drive (" + cents(y.pm.ev.total) + " vs " + cents(y.pm.gas.total) + " a mile), but at " + fmt.num(v.miles, 0) + " miles a year the savings don't cover its higher net cost in " + res.years + " years." : "With your charging mix, the EV costs " + cents(y.pm.ev.total) + " a mile versus " + cents(y.pm.gas.total) + ". More home charging is the biggest lever." };
    var stats = [
      ["Cost per mile: EV", cents(y.pm.ev.total), cents(y.pm.ev.energy) + " charging + " + cents(y.pm.ev.maint) + " maintenance", diff > 0 ? "good" : ""],
      ["Cost per mile: gas", cents(y.pm.gas.total), cents(y.pm.gas.energy) + " fuel + " + cents(y.pm.gas.maint) + " maintenance", diff <= 0 ? "good" : ""],
      ["Yearly savings with the EV", money0(y.saving), "At " + fmt.num(v.miles, 0) + " miles a year, incl. insurance and fees"],
      ["Break-even gas price", fmt.money(res.breakEvenGas, 2) + "/gal", "Above this the EV is cheaper to run", "hl"],
      ["Price premium recovered in", res.cross != null ? fmt.num(res.cross, 1) + " years" : res.evUp <= res.gasUp ? "No premium" : "Over 15 years", "Net EV price " + money0(res.evUp) + " vs " + money0(res.gasUp)],
      ["Your charging cost", fmt.money(res.blended, 3) + "/kWh", fmt.pct(v.homePct, 0) + " home, " + fmt.pct(v.fastPct, 0) + " fast charging"],
      ["CO2 per year", fmt.num(res.co2.ev / 2000, 1) + " vs " + fmt.num(res.co2.gas / 2000, 1) + " tons", "EV vs gas, U.S. average grid"],
    ];
    var xs = res.cum.slice(0, res.years + 1).map(function (c) { return c.y; });
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [
        { name: "EV", ys: res.cum.slice(0, res.years + 1).map(function (c) { return c.ev; }) },
        { name: "Gas car", ys: res.cum.slice(0, res.years + 1).map(function (c) { return c.gas; }) },
      ],
      points: res.cross != null && res.cross <= res.years ? [{ x: res.cross, y: interp(res.cum, res.cross, "ev"), tone: "cross", label: "EV ahead after " + fmt.num(res.cross, 1) + " yrs" }] : [],
      xFormat: function (t) { return "Yr " + t; }, tipX: function (t) { return "Year " + t; },
      ariaLabel: "Cumulative cost of an EV versus a gas car",
      caption: "Each line starts at the purchase price (EV includes the home charger, less incentives) and adds fuel or charging, maintenance, insurance, and fees. Resale value is subtracted in the totals above, not in the lines.",
    });
    var sens = h.line({
      width: h.wideWidth, xs: res.sens.map(function (s) { return s.g; }),
      series: [{ name: "Yearly savings with the EV", ys: res.sens.map(function (s) { return s.saving; }), area: true }],
      refLines: [{ y: 0 }],
      markers: [{ x: Math.round(v.gas * 4) / 4, label: "Your gas " + fmt.money(v.gas, 2) }],
      points: res.breakEvenGas >= 2 && res.breakEvenGas <= 7 ? [{ x: res.breakEvenGas, y: 0, tone: "cross", label: "Break-even " + fmt.money(res.breakEvenGas, 2) }] : [],
      xFormat: function (g) { return "$" + g.toFixed(g % 1 ? 2 : 0); }, tipX: function (g) { return "Gas at $" + g.toFixed(2) + "/gal"; },
      xTicks: res.sens.map(function (s) { return s.g; }).filter(function (g) { return g % (h.wideWidth < 560 ? 1 : 0.5) === 0; }),
      ariaLabel: "Yearly EV savings by gas price",
      caption: "Running-cost savings only, before purchase price and resale.",
    });
    /* Cost per mile by where you charge. */
    var mixes = [
      { label: "All home charging", homePct: 100, fastPct: 0 },
      { label: "Your mix", homePct: v.homePct, fastPct: v.fastPct, hl: true },
      { label: "All public Level 2", homePct: 0, fastPct: 0 },
      { label: "All DC fast charging", homePct: 0, fastPct: 100 },
    ];
    var rows = mixes.map(function (m) {
      var pm = perMile(Object.assign({}, v, { homePct: m.homePct, fastPct: m.fastPct }));
      return { label: m.label, value: pm.ev.total, tone: pm.ev.total < y.pm.gas.total ? "good" : "bad", highlight: m.hl };
    });
    rows.push({ label: "Gas car", sub: fmt.num(v.mpg, 0) + " mpg at " + fmt.money(v.gas, 2), value: y.pm.gas.total, tone: "2" });
    var bars = h.bars({ rows: rows, format: function (n) { return cents(n) + "/mi"; }, ariaLabel: "EV cost per mile by charging location, compared with gas" });
    var table = h.table(["Over " + res.years + " years", "EV", "Gas car"], [
      ["Purchase (net)", money0(res.evUp), money0(res.gasUp)],
      ["Charging / fuel", money0(sumEnergy(res, "ev")), money0(sumEnergy(res, "gas"))],
      ["Maintenance", money0(y.pm.ev.maint * v.miles * res.years), money0(y.pm.gas.maint * v.miles * res.years)],
      ["Insurance & fees", money0(((v.evInsurance || 0) + (v.evFee || 0)) * res.years), money0((v.gasInsurance || 0) * res.years)],
      ["Resale value", "−" + money0(res.evResale), "−" + money0(res.gasResale)],
      { cls: "row-hl", cells: ["<strong>Total cost</strong>", "<strong>" + money0(res.totalEv) + "</strong>", "<strong>" + money0(res.totalGas) + "</strong>"] },
    ]);
    var notes = [
      "The federal clean vehicle credit ended for vehicles acquired after September 30, 2025. Some states and utilities still offer EV rebates or lower EV charging rates.",
      "Many states charge an annual EV registration fee to replace gas tax revenue; enter yours under Ownership costs.",
      "Cold weather can cut EV range and efficiency noticeably; use a higher kWh per 100 miles if you live where winters are harsh.",
      "Compare the specific models' efficiency on fueleconomy.gov rather than class averages.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Total cost over " + res.years + " years", html: chart },
        { title: "Cost per mile by where you charge", html: bars },
        { title: "Savings by gas price", html: sens },
        { title: "Where the money goes", html: table },
        { title: "Before you decide", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["EV vs gas (NumberCove)", "EV: " + cents(y.pm.ev.total) + "/mi; gas: " + cents(y.pm.gas.total) + "/mi", "Yearly savings: " + money0(y.saving), res.years + "-year total: EV " + money0(res.totalEv) + " vs gas " + money0(res.totalGas), "Break-even gas price: " + fmt.money(res.breakEvenGas, 2)].join("\n"),
    };
  }

  function sumEnergy(res, key) {
    var v = res.v;
    var pm = res.y.pm;
    var esc = key === "ev" ? (v.elecEsc || 0) / 100 : (v.gasEsc || 0) / 100;
    var total = 0;
    for (var t = 1; t <= res.years; t += 1) total += pm[key].energy * Math.pow(1 + esc, t - 1) * v.miles;
    return total;
  }

  function interp(cum, x, key) {
    var i = Math.floor(x);
    if (i >= cum.length - 1) return cum[cum.length - 1][key];
    return cum[i][key] + (cum[i + 1][key] - cum[i][key]) * (x - i);
  }

  return {
    id: "ev-vs-gas",
    inputs: [
      { name: "miles", label: "Miles driven per year", type: "number", value: 12000, min: 100, max: 100000, slider: { min: 2000, max: 30000, step: 500 } },
      { name: "gas", label: "Gas price", type: "number", value: 4.25, min: 0.5, max: 15, prefix: "$", suffix: "/gal", slider: { min: 2, max: 7, step: 0.05 } },
      { name: "mpg", label: "Gas car fuel economy", type: "number", value: 30, min: 5, max: 100, suffix: "mpg" },
      { name: "evEff", label: "EV efficiency", type: "number", value: 30, min: 10, max: 80, suffix: "kWh/100 mi", hint: "From fueleconomy.gov; 30 ≈ 3.3 mi/kWh" },
      { name: "homeRate", label: "Home electricity price", type: "number", value: 0.182, min: 0, max: 2, prefix: "$", suffix: "/kWh", hint: "U.S. average 18.2¢ (EIA, 2026)" },
      { name: "homePct", label: "Charging at home", type: "number", value: 80, min: 0, max: 100, suffix: "%", slider: { min: 0, max: 100, step: 5 } },
      { name: "fastPct", label: "DC fast charging", type: "number", value: 10, min: 0, max: 100, suffix: "%", hint: "The rest is public Level 2" },
      { name: "evPrice", label: "EV price", type: "number", value: 42000, min: 0, max: 500000, prefix: "$" },
      { name: "gasPrice", label: "Gas car price", type: "number", value: 34000, min: 0, max: 500000, prefix: "$" },
      { name: "years", label: "Years you'll keep it", type: "number", value: 8, min: 1, max: 15, integer: true },
      {
        type: "group", title: "Charging", advanced: true,
        fields: [
          { name: "publicRate", label: "Public Level 2 price", type: "number", value: 0.3, min: 0, max: 2, prefix: "$", suffix: "/kWh" },
          { name: "fastRate", label: "DC fast charging price", type: "number", value: 0.48, min: 0, max: 2, prefix: "$", suffix: "/kWh" },
          { name: "lossPct", label: "Home charging losses", type: "number", value: 12, min: 0, max: 40, suffix: "%" },
          { name: "charger", label: "Home charger installed", type: "number", value: 1200, min: 0, max: 20000, prefix: "$", hint: "0 if you'll use a regular outlet" },
        ],
      },
      {
        type: "group", title: "Ownership costs", advanced: true,
        fields: [
          { name: "evMaint", label: "EV maintenance", type: "number", value: 6.1, min: 0, max: 50, suffix: "¢/mile", hint: "DOE/Argonne estimate" },
          { name: "gasMaint", label: "Gas car maintenance", type: "number", value: 10.1, min: 0, max: 50, suffix: "¢/mile", hint: "DOE/Argonne estimate" },
          { name: "evInsurance", label: "EV insurance", type: "number", value: 2200, min: 0, max: 20000, prefix: "$", suffix: "/yr" },
          { name: "gasInsurance", label: "Gas car insurance", type: "number", value: 1900, min: 0, max: 20000, prefix: "$", suffix: "/yr" },
          { name: "evFee", label: "EV registration fee", type: "number", value: 120, min: 0, max: 2000, prefix: "$", suffix: "/yr", hint: "Extra fee many states charge EVs" },
          { name: "evIncentive", label: "EV rebates", type: "number", value: 0, min: 0, max: 50000, prefix: "$", hint: "State or utility; the federal credit ended 9/30/2025" },
          { name: "evResale", label: "EV value at the end", type: "number", value: 35, min: 0, max: 100, suffix: "% of price" },
          { name: "gasResale", label: "Gas car value at the end", type: "number", value: 40, min: 0, max: 100, suffix: "% of price" },
          { name: "gasEsc", label: "Gas price change per year", type: "number", value: 2, min: -10, max: 20, suffix: "%" },
          { name: "elecEsc", label: "Electricity price change per year", type: "number", value: 2.5, min: -10, max: 20, suffix: "%" },
          { name: "gridCo2", label: "Grid CO2", type: "number", value: 0.81, min: 0, max: 3, suffix: "lb/kWh", hint: "U.S. average (EIA, 2023)" },
        ],
      },
    ],
    compute: compute,
    render: render,
    /* Mobile balloon on first load: the default case as a hook. */
    teaser: function (r, v, fmt) {
      var gap = r.totalEv - r.totalGas;
      if (!(gap > 0) || !(r.y.saving > 0)) return null;
      return { tone: "warn", label: "Surprise", title: "The gas car still wins by " + fmt.money(gap, 0) + " over " + v.years + " years.", body: "Even though the EV saves " + fmt.money(r.y.saving, 0) + " a year to run. Your gas price and charging decide it." };
    },
    _test: { chargePrice: chargePrice, perMile: perMile, yearly: yearly, GAS_CO2: GAS_CO2 },
  };
});
