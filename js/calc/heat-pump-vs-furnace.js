/* Heat pump vs furnace: running cost, upfront cost, payback, and CO2. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };
  /* Heat content (EIA) and CO2 per unit (EIA emissions coefficients). */
  var FUELS = {
    gas: { name: "Natural gas", unit: "therm", units: "therms", btu: 100000, co2: 11.665, price: 1.3, usage: 600, afue: 80, newAfue: 95 },
    propane: { name: "Propane", unit: "gal", units: "gallons", btu: 91452, co2: 12.68, price: 2.52, usage: 700, afue: 80, newAfue: 95 },
    oil: { name: "Heating oil", unit: "gal", units: "gallons", btu: 138500, co2: 22.45, price: 5.26, usage: 500, afue: 80, newAfue: 87 },
    electric: { name: "Electric resistance", unit: "kWh", units: "kWh", btu: 3412, co2: 0, price: null, usage: 15000, afue: 100, newAfue: 100 },
  };
  var CLIMATE = {
    warm: { name: "Warm (South)", factor: 1.15, backup: 0 },
    moderate: { name: "Moderate", factor: 1, backup: 3 },
    cold: { name: "Cold (North)", factor: 0.85, backup: 8 },
    veryCold: { name: "Very cold", factor: 0.72, backup: 15 },
  };
  var BTU_KWH = 3412;

  /* Annual energy use and cost for both paths at a given electricity price. */
  function annual(v, elecOverride) {
    var f = FUELS[v.fuel] || FUELS.gas;
    var elec = elecOverride != null ? elecOverride : v.elecPrice;
    var fuelPrice = v.fuel === "electric" ? elec : v.fuelPrice;
    var delivered = v.usage * f.btu * Math.min(1.2, v.afue / 100);
    var keep = v.scenario === "keep";
    var altEff = keep ? v.afue : (v.fuel === "electric" ? 100 : v.newAfue);
    var altFuel = delivered / (f.btu * altEff / 100);
    var climate = CLIMATE[v.climate] || CLIMATE.moderate;
    var cop = v.hspf2 / BTU_KWH * 1000 * climate.factor;
    var backup = Math.min(100, Math.max(0, v.backupPct != null ? v.backupPct : climate.backup)) / 100;
    var hpHeatKwh = delivered * (1 - backup) / (cop * BTU_KWH) + delivered * backup / BTU_KWH;
    var cool = v.coolKwh || 0;
    var hpCoolKwh = cool * v.oldSeer / v.hpSeer;
    var altCoolKwh = v.acNeeded ? cool * v.oldSeer / v.newAcSeer : cool;
    var altHeatCost = altFuel * fuelPrice;
    var alt = { heat: altHeatCost, cool: altCoolKwh * elec, fuel: altFuel, coolKwh: altCoolKwh };
    alt.total = alt.heat + alt.cool;
    var hp = { heat: hpHeatKwh * elec, cool: hpCoolKwh * elec, kwh: hpHeatKwh, coolKwh: hpCoolKwh };
    hp.total = hp.heat + hp.cool;
    var grid = v.gridCo2 != null ? v.gridCo2 : 0.81;
    alt.co2 = altFuel * (v.fuel === "electric" ? grid : f.co2) + altCoolKwh * grid;
    hp.co2 = (hpHeatKwh + hpCoolKwh) * grid;
    return { f: f, delivered: delivered, cop: cop, effCop: delivered / BTU_KWH / hpHeatKwh, backup: backup, alt: alt, hp: hp, altEff: altEff, fuelPrice: fuelPrice, elec: elec };
  }

  function compute(v) {
    var a = annual(v);
    var keep = v.scenario === "keep";
    var hpCap = Math.max(0, v.hpCost - (v.rebates || 0));
    var altCap = (keep ? 0 : v.furnaceCost) + (v.acNeeded ? v.acCost : 0);
    var years = Math.max(1, Math.round(v.years));
    var fe = (v.fuel === "electric" ? v.elecEsc : v.fuelEsc) / 100;
    var ee = (v.elecEsc || 0) / 100;
    var cum = [{ y: 0, hp: hpCap, alt: altCap }];
    var payback = null;
    for (var y = 1; y <= Math.max(years, 25); y += 1) {
      var prev = cum[y - 1];
      var hpYear = a.hp.total * Math.pow(1 + ee, y - 1);
      var altYear = a.alt.heat * Math.pow(1 + fe, y - 1) + a.alt.cool * Math.pow(1 + ee, y - 1);
      var next = { y: y, hp: prev.hp + hpYear, alt: prev.alt + altYear };
      if (payback == null && hpCap > altCap && next.hp <= next.alt) {
        var d0 = prev.hp - prev.alt;
        var d1 = next.hp - next.alt;
        payback = y - 1 + d0 / (d0 - d1);
      }
      cum.push(next);
    }
    var at = cum[years];
    /* Electricity price where both cost the same to run each year. */
    var hpKwh = a.hp.kwh + a.hp.coolKwh;
    var altKwh = a.alt.coolKwh + (v.fuel === "electric" ? a.alt.fuel : 0);
    var breakEvenElec = v.fuel !== "electric" && hpKwh > altKwh ? a.alt.heat / (hpKwh - altKwh) : null;
    var sens = [];
    for (var p = 0.08; p <= 0.4001; p += 0.01) {
      var s = annual(v, p);
      sens.push({ p: Math.round(p * 100) / 100, saving: s.alt.total - s.hp.total });
    }
    return { v: v, a: a, hpCap: hpCap, altCap: altCap, years: years, cum: cum, at: at, payback: payback, breakEvenElec: breakEvenElec, sens: sens, keep: keep };
  }

  function altName(res) {
    var f = res.a.f;
    return res.keep ? "Keep your " + (res.v.fuel === "electric" ? "electric heat" : f.name.toLowerCase() + " furnace") : "New " + (res.v.fuel === "electric" ? "electric furnace" : f.name.toLowerCase() + " furnace");
  }

  function render(res, v, h) {
    var a = res.a;
    var alt = altName(res);
    var saving = a.alt.total - a.hp.total;
    var lifetime = res.at.alt - res.at.hp;
    var verdict;
    if (lifetime > 0) {
      verdict = { tone: "good", title: "The heat pump comes out " + money0(lifetime) + " ahead over " + res.years + " years.", body: "It costs " + money0(saving) + " a year less to run" + (res.payback != null ? " and pays back its extra " + money0(res.hpCap - res.altCap) + " upfront cost in about " + fmt.num(res.payback, 1) + " years" : res.hpCap <= res.altCap ? " and costs no more upfront" : "") + "." };
    } else if (saving > 0) {
      verdict = { tone: "warn", title: "The heat pump is cheaper to run, but doesn't earn back its price within " + res.years + " years.", body: "It saves " + money0(saving) + " a year, against " + money0(res.hpCap - res.altCap) + " more upfront" + (res.payback != null ? "; payback takes about " + fmt.num(res.payback, 1) + " years." : ".") };
    } else {
      verdict = { tone: "warn", title: alt + " is cheaper here: about " + money0(-saving) + " a year less to run.", body: "At " + fmt.money(v.fuelPrice, 2) + "/" + a.f.unit + " for " + a.f.name.toLowerCase() + ", the heat pump breaks even on running cost only if electricity drops to " + (res.breakEvenElec ? fmt.money(res.breakEvenElec, 3) + "/kWh" : "—") + "; you pay " + fmt.money(v.elecPrice, 3) + "." };
    }
    if (a.hp.co2 < a.alt.co2) verdict.body += " Either way, it cuts CO2 by about " + fmt.num((a.alt.co2 - a.hp.co2) / 2000, 1) + " tons a year.";
    var stats = [
      ["Yearly running cost: heat pump", money0(a.hp.total), fmt.num(a.hp.kwh + a.hp.coolKwh, 0) + " kWh heating + cooling", saving > 0 ? "good" : ""],
      ["Yearly running cost: " + (res.keep ? "current system" : "new furnace"), money0(a.alt.total), fmt.num(a.alt.fuel, 0) + " " + (v.fuel === "electric" ? "kWh" : a.f.units) + " + AC", saving <= 0 ? "good" : ""],
      ["Upfront cost difference", money0(res.hpCap - res.altCap), money0(res.hpCap) + " vs " + money0(res.altCap)],
      ["Payback", res.payback != null ? fmt.num(res.payback, 1) + " years" : res.hpCap <= res.altCap ? (saving > 0 ? "Immediate" : "—") : saving <= 0 ? "Never" : "Over 25 years", "Extra upfront cost ÷ yearly savings, with price changes"],
      ["Break-even electricity price", res.breakEvenElec ? fmt.money(res.breakEvenElec, 3) + "/kWh" : "—", "Below this the heat pump is cheaper to run", "hl"],
      ["Heat pump seasonal efficiency", fmt.num(a.effCop, 2) + " COP", fmt.pct(a.effCop * 100, 0) + " vs " + fmt.pct(res.keep ? v.afue : a.altEff, 0) + " for the furnace"],
      ["CO2 per year", fmt.num(a.hp.co2 / 2000, 1) + " vs " + fmt.num(a.alt.co2 / 2000, 1) + " tons", "Heat pump vs " + (res.keep ? "current" : "furnace") + ", U.S. average grid"],
    ];
    var xs = res.cum.slice(0, res.years + 1).map(function (c) { return c.y; });
    var points = res.payback != null && res.payback <= res.years ? [{ x: res.payback, y: interp(res.cum, res.payback, "hp"), tone: "cross", label: "Payback " + fmt.num(res.payback, 1) + " yrs" }] : [];
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [
        { name: "Heat pump", ys: res.cum.slice(0, res.years + 1).map(function (c) { return c.hp; }) },
        { name: res.keep ? "Current system" : "Furnace" + (v.acNeeded ? " + new AC" : ""), ys: res.cum.slice(0, res.years + 1).map(function (c) { return c.alt; }) },
      ],
      points: points,
      xFormat: function (y) { return "Yr " + y; }, tipX: function (y) { return "Year " + y; },
      ariaLabel: "Cumulative cost of a heat pump versus a furnace over time",
      caption: "Each line starts at its installed cost and rises with yearly energy bills. Fuel prices rise " + fmt.pct(v.fuel === "electric" ? v.elecEsc : v.fuelEsc, 1) + " and electricity " + fmt.pct(v.elecEsc, 1) + " a year.",
    });
    var sens = h.line({
      width: h.wideWidth, xs: res.sens.map(function (s) { return s.p; }),
      series: [{ name: "Yearly savings with a heat pump", ys: res.sens.map(function (s) { return s.saving; }), area: true }],
      refLines: [{ y: 0 }],
      markers: [{ x: Math.round(v.elecPrice * 100) / 100, label: "Your rate " + fmt.money(v.elecPrice, 3) }],
      points: res.breakEvenElec && res.breakEvenElec >= 0.08 && res.breakEvenElec <= 0.4 ? [{ x: res.breakEvenElec, y: 0, tone: "cross", label: "Break-even " + fmt.money(res.breakEvenElec, 3) }] : [],
      xFormat: function (p) { return "$" + p.toFixed(2); }, tipX: function (p) { return "$" + p.toFixed(2) + "/kWh"; },
      xTicks: res.sens.map(function (s) { return s.p; }).filter(function (p) { return Math.round(p * 100) % (h.wideWidth < 560 ? 8 : 4) === 0; }),
      ariaLabel: "Yearly heat pump savings by electricity price",
      caption: "Above zero the heat pump is cheaper to run. Time-of-use or heat-pump electric rates from your utility can move you well to the left.",
    });
    /* Cost of a million Btu of delivered heat, by system, at default prices except yours. */
    var mm = 1e6;
    var heatRows = [
      { label: "Heat pump", sub: "COP " + fmt.num(a.effCop, 2), value: mm / BTU_KWH / a.effCop * v.elecPrice, tone: "good" },
    ];
    ["gas", "propane", "oil"].forEach(function (k) {
      var f = FUELS[k];
      var price = v.fuel === k ? v.fuelPrice : f.price;
      heatRows.push({ label: f.name + " furnace", sub: fmt.pct(f.newAfue, 0) + " · " + fmt.money(price, 2) + "/" + f.unit, value: mm / (f.btu * f.newAfue / 100) * price, tone: v.fuel === k ? "1" : "muted", highlight: v.fuel === k });
    });
    heatRows.push({ label: "Electric resistance", sub: "100%", value: mm / BTU_KWH * v.elecPrice, tone: v.fuel === "electric" ? "1" : "muted", highlight: v.fuel === "electric" });
    heatRows.sort(function (x, y) { return x.value - y.value; });
    var bars = h.bars({ rows: heatRows, format: function (n) { return fmt.money(n, 2); }, ariaLabel: "Cost of one million Btu of delivered heat by system" });
    var notes = [
      "The federal 25C tax credit for heat pumps ended for equipment placed in service after December 31, 2025. Check your utility and state for rebates and heat-pump electric rates.",
      "Cold-climate heat pumps keep much of their efficiency well below freezing; check the NEEP cold-climate list for a model's output at 5°F.",
      "A dual-fuel setup keeps your furnace as backup on the coldest days, which can cut costs where gas is cheap.",
      "Get a Manual J load calculation; an oversized system short-cycles and an undersized one leans on backup heat.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Total cost over " + res.years + " years", html: chart },
        { title: "Savings by electricity price", html: sens },
        { title: "What a million Btu of heat costs", note: "Your prices for your fuel; EIA averages for the rest", html: bars },
        { title: "Before you decide", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Heat pump vs furnace (NumberCove)", "Heat pump: " + money0(a.hp.total) + "/yr; " + alt + ": " + money0(a.alt.total) + "/yr", "Upfront difference: " + money0(res.hpCap - res.altCap), "Payback: " + (res.payback != null ? fmt.num(res.payback, 1) + " years" : "—"), "Break-even electricity price: " + (res.breakEvenElec ? fmt.money(res.breakEvenElec, 3) + "/kWh" : "—")].join("\n"),
    };
  }

  function interp(cum, x, key) {
    var i = Math.floor(x);
    if (i >= cum.length - 1) return cum[cum.length - 1][key];
    return cum[i][key] + (cum[i + 1][key] - cum[i][key]) * (x - i);
  }

  var unitMap = { gas: "therms/yr", propane: "gal/yr", oil: "gal/yr", electric: "kWh/yr" };
  var priceMap = { gas: "/therm", propane: "/gal", oil: "/gal", electric: "/kWh" };

  return {
    id: "heat-pump-vs-furnace",
    inputs: [
      { name: "fuel", label: "What heats your home now", type: "select", value: "gas", options: Object.keys(FUELS).map(function (k) { return [k, FUELS[k].name]; }),
        sets: Object.keys(FUELS).reduce(function (o, k) { var f = FUELS[k]; o[k] = { usage: f.usage, afue: f.afue, newAfue: f.newAfue }; if (f.price != null) o[k].fuelPrice = f.price; return o; }, {}) },
      { name: "usage", label: "Heating fuel used per year", type: "number", value: 600, min: 1, max: 1000000, suffix: "therms/yr", suffixBy: { field: "fuel", map: unitMap }, hint: "Add up winter bills, minus summer use for water heating and cooking" },
      { name: "fuelPrice", label: "Fuel price", type: "number", value: 1.3, min: 0, max: 50, prefix: "$", suffix: "/therm", suffixBy: { field: "fuel", map: priceMap }, showIf: { fuel: ["gas", "propane", "oil"] } },
      { name: "elecPrice", label: "Electricity price", type: "number", value: 0.182, min: 0.01, max: 2, prefix: "$", suffix: "/kWh", hint: "U.S. average 18.2¢ (EIA, 2026)", slider: { min: 0.08, max: 0.45, step: 0.005 } },
      { name: "climate", label: "Climate", type: "segment", value: "moderate", options: Object.keys(CLIMATE).map(function (k) { return [k, CLIMATE[k].name]; }),
        sets: Object.keys(CLIMATE).reduce(function (o, k) { o[k] = { backupPct: CLIMATE[k].backup }; return o; }, {}) },
      { name: "scenario", label: "Compare the heat pump with", type: "segment", value: "new", options: [["new", "A new furnace"], ["keep", "Keeping my current one"]] },
      { name: "hpCost", label: "Heat pump installed price", type: "number", value: 14000, min: 0, max: 200000, prefix: "$", slider: { min: 4000, max: 30000, step: 250 } },
      { name: "furnaceCost", label: "New furnace installed price", type: "number", value: 5500, min: 0, max: 100000, prefix: "$", showIf: { scenario: "new" } },
      { name: "acNeeded", label: "Your central AC also needs replacing", type: "toggle", value: false, hint: "A heat pump cools too, so it replaces both" },
      { name: "acCost", label: "New AC installed price", type: "number", value: 6500, min: 0, max: 100000, prefix: "$", showIf: { acNeeded: true } },
      {
        type: "group", title: "Efficiency", advanced: true,
        fields: [
          { name: "hspf2", label: "Heat pump HSPF2", type: "number", value: 8.1, min: 5, max: 15, hint: "On the spec sheet; 7.5 is the federal minimum" },
          { name: "backupPct", label: "Heat from backup electric strips", type: "number", value: 3, min: 0, max: 100, suffix: "%", hint: "Set by climate; edit if you know better" },
          { name: "afue", label: "Current system efficiency (AFUE)", type: "number", value: 80, min: 40, max: 100, suffix: "%" },
          { name: "newAfue", label: "New furnace efficiency (AFUE)", type: "number", value: 95, min: 50, max: 100, suffix: "%", showIf: { scenario: "new" } },
        ],
      },
      {
        type: "group", title: "Cooling", advanced: true,
        fields: [
          { name: "coolKwh", label: "Electricity your AC uses", type: "number", value: 2000, min: 0, max: 100000, suffix: "kWh/yr", hint: "0 if you don't have central AC" },
          { name: "oldSeer", label: "Current AC SEER2", type: "number", value: 12, min: 6, max: 30 },
          { name: "hpSeer", label: "Heat pump SEER2", type: "number", value: 16, min: 10, max: 35 },
          { name: "newAcSeer", label: "New AC SEER2", type: "number", value: 14.3, min: 10, max: 35, showIf: { acNeeded: true } },
        ],
      },
      {
        type: "group", title: "Money and time", advanced: true,
        fields: [
          { name: "rebates", label: "Rebates on the heat pump", type: "number", value: 0, min: 0, max: 100000, prefix: "$", hint: "Utility or state programs" },
          { name: "years", label: "Years to compare", type: "number", value: 15, min: 1, max: 25, integer: true },
          { name: "fuelEsc", label: "Fuel price change per year", type: "number", value: 2, min: -10, max: 20, suffix: "%" },
          { name: "elecEsc", label: "Electricity price change per year", type: "number", value: 2.5, min: -10, max: 20, suffix: "%" },
          { name: "gridCo2", label: "Grid CO2", type: "number", value: 0.81, min: 0, max: 3, suffix: "lb/kWh", hint: "U.S. average (EIA, 2023)" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { annual: annual, FUELS: FUELS, CLIMATE: CLIMATE },
  };
});
