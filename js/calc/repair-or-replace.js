/* Appliance repair or replace: equivalent annual cost of each path, and the
   most a repair is worth at every age. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };
  /* Midpoints of InterNACHI's estimated life expectancy ranges. */
  var PRESETS = {
    refrigerator: { name: "Refrigerator", life: 11, price: 1600 },
    washer: { name: "Clothes washer", life: 10, price: 900 },
    dryer: { name: "Clothes dryer", life: 13, price: 850 },
    dishwasher: { name: "Dishwasher", life: 9, price: 900 },
    range: { name: "Range / oven", life: 14, price: 1300 },
    waterHeater: { name: "Water heater (tank)", life: 9, price: 1800 },
    furnace: { name: "Gas furnace", life: 20, price: 5000 },
    ac: { name: "Central air conditioner", life: 11, price: 6500 },
    heatPump: { name: "Heat pump", life: 12.5, price: 9000 },
    other: { name: "Other", life: 10, price: 1000 },
  };

  function crf(r, n) {
    if (n <= 0) return Infinity;
    if (r === 0) return 1 / n;
    return r / (1 - Math.pow(1 + r, -n));
  }

  /* Expected service life bought by a repair: it works for the remaining life
     with probability p; otherwise it fails within about half a year. */
  function repairLife(p, remaining) {
    return p * remaining + (1 - p) * Math.min(0.5, remaining);
  }

  function costs(v, age) {
    var r = (v.rate || 0) / 100;
    var lifeNew = v.newLife;
    var newCapital = v.newPrice + (v.disposal || 0) - (v.rebate || 0) - (v.scrap || 0);
    var eacNew = newCapital * crf(r, lifeNew) + v.newEnergy * v.price;
    var remaining = Math.max(0.25, v.expectedLife != null && age === v.age ? v.expectedLife : v.life - age);
    var Leff = repairLife(v.success / 100, remaining);
    var eacRepair = v.repair * crf(r, Leff) + v.oldEnergy * v.price + (v.upkeep || 0);
    var maxRepair = Math.max(0, (eacNew - v.oldEnergy * v.price - (v.upkeep || 0)) / crf(r, Leff));
    return { eacNew: eacNew, eacRepair: eacRepair, maxRepair: maxRepair, Leff: Leff, remaining: remaining, newCapital: newCapital };
  }

  function compute(v) {
    var c = costs(v, v.age);
    var curve = [];
    var top = Math.ceil(v.life * 1.25);
    for (var a = 0; a <= top; a += 0.5) {
      curve.push({ age: a, max: costs(v, a).maxRepair });
    }
    var fifty = 0.5 * v.newPrice;
    var energySaving = (v.oldEnergy - v.newEnergy) * v.price;
    var crossAge = null;
    for (var i = 0; i < curve.length; i += 1) {
      if (curve[i].max < v.repair) { crossAge = curve[i].age; break; }
    }
    return { v: v, c: c, curve: curve, fifty: fifty, energySaving: energySaving, crossAge: crossAge, preset: PRESETS[v.appliance] || PRESETS.other };
  }

  function render(res, v, h) {
    var c = res.c;
    var repairWins = c.eacRepair <= c.eacNew;
    var verdict = repairWins
      ? { tone: "good", title: "Repair it. Fixing it costs " + money0(c.eacNew - c.eacRepair) + " a year less than replacing.", body: "A repair is worth up to " + money0(c.maxRepair) + " at this age; your quote is " + money0(v.repair) + "." + (res.crossAge != null ? " Past about age " + fmt.num(res.crossAge, 1) + ", a repair this size stops making sense." : "") }
      : { tone: "warn", title: "Replace it. A " + money0(v.repair) + " repair is more than this appliance is worth fixing.", body: "At " + fmt.num(v.age, 0) + " years old, the most a repair is worth is " + money0(c.maxRepair) + ". Replacing costs " + money0(c.eacNew) + " a year versus " + money0(c.eacRepair) + " to keep repairing." };
    var stats = [
      ["Most a repair is worth now", money0(c.maxRepair), "Your quote: " + money0(v.repair), repairWins ? "good" : "bad"],
      ["Expected life after repair", fmt.years(c.Leff), fmt.pct(v.success, 0) + " chance it lasts " + fmt.years(c.remaining)],
      ["Yearly cost if you repair", money0(c.eacRepair), "Repair spread over its life + energy"],
      ["Yearly cost if you replace", money0(c.eacNew), "New unit over " + fmt.years(v.newLife, 0) + " + energy"],
      ["Energy savings with new unit", money0(res.energySaving) + "/yr", fmt.num(v.oldEnergy - v.newEnergy, 0) + " kWh a year"],
      ["50% rule of thumb", v.repair <= res.fifty ? "Repair" : "Replace", "Repair if under half the price of new (" + money0(res.fifty) + ")"],
    ];
    var xs = res.curve.map(function (p) { return p.age; });
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [{ name: "Most a repair is worth", ys: res.curve.map(function (p) { return p.max; }), area: true }],
      points: [{ x: v.age, y: v.repair, tone: repairWins ? "s3" : "cross", label: "Your quote " + money0(v.repair) }],
      markers: [{ x: res.preset.life === v.life ? v.life : v.life, label: "Typical life " + fmt.num(v.life, 1) + " yrs" }],
      xFormat: function (a) { return a + " yr"; }, tipX: function (a) { return "Age " + a + " years"; },
      xTicks: xs.filter(function (a) { return a % (v.life > 15 ? 5 : h.wideWidth < 560 ? 4 : 2) === 0; }),
      ariaLabel: "Maximum worthwhile repair cost by appliance age",
      caption: "Below the line, repairing is cheaper than replacing; above it, replace. The line falls as the appliance ages because each repair buys fewer remaining years.",
    });
    var bars = h.bars({
      series: ["Repair", "Replace"],
      rows: [
        { label: "Equipment per year", values: [c.eacRepair - v.oldEnergy * v.price - (v.upkeep || 0), c.eacNew - v.newEnergy * v.price] },
        { label: "Energy per year", values: [v.oldEnergy * v.price, v.newEnergy * v.price] },
        { label: "Total per year", values: [c.eacRepair, c.eacNew], highlight: true },
      ],
      format: function (n) { return money0(n); },
      ariaLabel: "Annual cost of repairing versus replacing",
    });
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "When does a repair stop making sense?", note: res.preset.name + ", " + fmt.num(v.life, 1) + "-year typical life", html: chart },
        { title: "Yearly cost, side by side", html: bars },
      ],
      copy: ["Repair or replace (NumberCove)", res.preset.name + ", age " + v.age, "Repair quote: " + money0(v.repair) + "; most worth paying: " + money0(c.maxRepair), "Yearly cost repair: " + money0(c.eacRepair) + " vs replace: " + money0(c.eacNew), repairWins ? "Verdict: repair" : "Verdict: replace"].join("\n"),
    };
  }

  return {
    id: "repair-or-replace",
    inputs: [
      { name: "appliance", label: "Appliance", type: "select", value: "refrigerator", options: Object.keys(PRESETS).map(function (k) { return [k, PRESETS[k].name]; }), hint: "Fills in a typical lifespan and price; edit below",
        sets: Object.keys(PRESETS).reduce(function (o, k) { o[k] = { life: PRESETS[k].life, newLife: PRESETS[k].life, newPrice: PRESETS[k].price }; return o; }, {}) },
      { name: "age", label: "Age", type: "number", value: 8, min: 0, max: 60, suffix: "years", slider: { min: 0, max: 25, step: 0.5 } },
      { name: "repair", label: "Repair quote", type: "number", value: 450, min: 0, max: 100000, prefix: "$", slider: { min: 0, max: 3000, step: 25 } },
      { name: "success", label: "Chance the repair lasts", type: "number", value: 80, min: 0, max: 100, suffix: "%", hint: "Lower for older units or recurring problems" },
      { name: "newPrice", label: "Replacement price, installed", type: "number", value: 1600, min: 0, max: 1000000, prefix: "$" },
      { name: "life", label: "Typical lifespan", type: "number", value: 11, min: 1, max: 50, suffix: "years" },
      {
        type: "group", title: "Energy", advanced: true, open: true, hint: "From the yellow EnergyGuide label or the manufacturer's spec sheet.",
        fields: [
          { name: "oldEnergy", label: "Current unit uses", type: "number", value: 650, min: 0, max: 100000, suffix: "kWh/yr" },
          { name: "newEnergy", label: "New unit uses", type: "number", value: 420, min: 0, max: 100000, suffix: "kWh/yr" },
          { name: "price", label: "Electricity price", type: "number", value: 0.182, min: 0, max: 2, prefix: "$", suffix: "/kWh", hint: "U.S. average 18.2¢ (EIA, 2026)" },
        ],
      },
      {
        type: "group", title: "More detail", advanced: true,
        fields: [
          { name: "expectedLife", label: "Years left if repaired", type: "number", optional: true, min: 0, max: 50, hint: "Blank uses typical lifespan minus age" },
          { name: "newLife", label: "New unit lifespan", type: "number", value: 11, min: 1, max: 50, suffix: "years" },
          { name: "disposal", label: "Haul-away / install extras", type: "number", value: 0, min: 0, max: 100000, prefix: "$" },
          { name: "rebate", label: "Rebates on new unit", type: "number", value: 0, min: 0, max: 100000, prefix: "$" },
          { name: "scrap", label: "Sale or scrap value of old unit", type: "number", value: 0, min: 0, max: 100000, prefix: "$" },
          { name: "upkeep", label: "Extra upkeep on old unit", type: "number", value: 0, min: 0, max: 100000, prefix: "$", suffix: "/yr" },
          { name: "rate", label: "Interest rate (financing or savings)", type: "number", value: 5, min: 0, max: 40, suffix: "%" },
        ],
      },
    ],
    compute: compute,
    render: render,
    /* Mobile balloon on first load: the default case as a hook. */
    teaser: function (r, v, fmt) {
      if (!(v.repair > r.c.maxRepair)) return null;
      return { tone: "warn", label: "A typical " + v.age + "-year-old " + r.preset.name.toLowerCase(), title: "A " + fmt.money(v.repair, 0) + " repair isn't worth it.", body: "Past about " + fmt.money(r.c.maxRepair, 0) + ", replacing costs less per year. Where's the line for yours?" };
    },
    _test: { crf: crf, repairLife: repairLife, costs: costs, PRESETS: PRESETS },
  };
});
