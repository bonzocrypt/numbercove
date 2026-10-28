/* Moving: rental truck vs full-service movers vs portable container. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };

  function compute(v) {
    var miles = v.miles;
    var driveDays = Math.max(1, Math.ceil(miles / Math.max(100, v.milesPerDay || 450)));
    var hourly = v.hourly || 0;
    var lodging = Math.max(0, driveDays - 1) * (v.lodging || 0);
    var meals = driveDays * (v.meals || 0);
    var carCost = v.ownCar ? miles * (v.carPerMile || 0) : 0;

    /* Truck: rental, mileage, fuel, gear, help, and the days you spend. */
    var truckDays = driveDays + 2;
    var truckItems = [
      ["Truck rental", v.truckRate || 0],
      ["Mileage fees", miles * (v.truckPerMile || 0)],
      ["Truck fuel", v.truckMpg > 0 ? miles / v.truckMpg * v.gas : 0],
      ["Car tow or second driver", v.ownCar ? v.towCost || 0 : 0],
      ["Pads, dolly, boxes", v.supplies || 0],
      ["Damage protection", v.truckInsurance || 0],
      ["Loading help", (v.helpers || 0) * (v.helperRate || 0) * (v.helperHours || 0)],
      ["Lodging & meals", lodging + meals],
      ["Your time", truckDays * 8 * hourly],
    ];
    /* Movers: quote, tip, valuation coverage; you travel separately. */
    var moverDays = driveDays + 1;
    var moverItems = [
      ["Movers' quote", v.moverQuote || 0],
      ["Tip", (v.moverQuote || 0) * (v.tipPct || 0) / 100],
      ["Full-value protection", v.moverProtection || 0],
      ["Boxes (you pack)", v.supplies || 0],
      ["Your drive (car)", carCost],
      ["Lodging & meals", lodging + meals],
      ["Your time", moverDays * 8 * hourly * 0.6],
    ];
    /* Container: quote, storage, loading help, your travel. */
    var podDays = driveDays + 2;
    var podItems = [
      ["Container quote", v.podQuote || 0],
      ["Storage between homes", (v.storageMonths || 0) * (v.podStorage || 0)],
      ["Pads, dolly, boxes", v.supplies || 0],
      ["Loading & unloading help", 2 * (v.helpers || 0) * (v.helperRate || 0) * (v.helperHours || 0)],
      ["Your drive (car)", carCost],
      ["Lodging & meals", lodging + meals],
      ["Your time", podDays * 8 * hourly * 0.8],
    ];
    function sum(items) { return items.reduce(function (s, it) { return s + it[1]; }, 0); }
    var options = [
      { id: "truck", name: "Rental truck (DIY)", items: truckItems, total: sum(truckItems), days: truckDays, cash: sum(truckItems) - truckDays * 8 * hourly },
      { id: "movers", name: "Full-service movers", items: moverItems, total: sum(moverItems), days: moverDays, cash: sum(moverItems) - moverDays * 8 * hourly * 0.6 },
      { id: "pod", name: "Portable container", items: podItems, total: sum(podItems), days: podDays, cash: sum(podItems) - podDays * 8 * hourly * 0.8 },
    ];
    var ranked = options.slice().sort(function (a, b) { return a.total - b.total; });
    var byCash = options.slice().sort(function (a, b) { return a.cash - b.cash; });
    return { v: v, driveDays: driveDays, options: options, ranked: ranked, best: ranked[0], cheapestCash: byCash[0] };
  }

  function render(res, v, h) {
    var best = res.best;
    var next = res.ranked[1];
    var verdict = {
      tone: "good",
      title: best.name + " comes out cheapest: " + money0(best.total) + ", " + money0(next.total - best.total) + " less than " + next.name.toLowerCase() + ".",
      body: (res.cheapestCash.id !== best.id ? "On cash alone, " + res.cheapestCash.name.toLowerCase() + " is cheapest at " + money0(res.cheapestCash.cash) + ", but it costs more of your time. " : "") + "Totals include about " + res.driveDays + " day" + (res.driveDays === 1 ? "" : "s") + " on the road and your time at " + money0(v.hourly || 0) + "/hr.",
    };
    var stats = res.options.map(function (o) {
      return [o.name, money0(o.total), money0(o.cash) + " cash · about " + o.days + " days of your time", o.id === best.id ? "good" : ""];
    });
    stats.push(["Distance", fmt.num(v.miles, 0) + " miles", res.driveDays + " driving day" + (res.driveDays === 1 ? "" : "s")]);
    var labels = [];
    res.options.forEach(function (o) { o.items.forEach(function (it) { if (labels.indexOf(it[0]) === -1) labels.push(it[0]); }); });
    var rows = labels.map(function (lab) {
      return [h.esc(lab)].concat(res.options.map(function (o) {
        var it = o.items.filter(function (x) { return x[0] === lab; })[0];
        return it && it[1] > 0.5 ? money0(it[1]) : "—";
      }));
    }).filter(function (r) { return r.slice(1).some(function (c) { return c !== "—"; }); });
    rows.push({ cls: "row-hl", cells: ["<strong>Total</strong>"].concat(res.options.map(function (o) { return "<strong>" + money0(o.total) + "</strong>"; })) });
    var bars = h.bars({
      series: ["Cash cost", "Value of your time"],
      rows: res.options.map(function (o) { return { label: o.name, values: [o.cash, o.total - o.cash], highlight: o.id === best.id }; }),
      format: function (n) { return money0(n); },
      ariaLabel: "Cash cost and time cost of each moving option",
    });
    var tips = [
      "Get at least three binding or not-to-exceed quotes for interstate moves, and check the mover's USDOT number.",
      "Basic liability coverage from interstate movers pays only 60 cents per pound per item; full-value protection costs extra.",
      "Moving mid-month and midweek, outside summer, usually lowers truck and mover prices.",
      "Selling or donating heavy, low-value items before you move cuts weight, which drives both mover and fuel costs.",
    ];
    return {
      verdict: verdict, stats: stats, side: [bars],
      wide: [
        { title: "Side-by-side costs", html: h.table(["Cost", "Rental truck", "Movers", "Container"], rows) },
        { title: "Before you book", html: '<ul class="nc-recs">' + tips.map(function (t) { return "<li>" + h.esc(t) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Moving cost comparison (NumberCove)"].concat(res.ranked.map(function (o) { return o.name + ": " + money0(o.total) + " (" + money0(o.cash) + " cash)"; })).join("\n"),
    };
  }

  return {
    id: "moving-cost",
    inputs: [
      { name: "miles", label: "Moving distance", type: "number", value: 850, min: 1, max: 6000, suffix: "miles" },
      { name: "hourly", label: "Value of your time", type: "number", value: 25, min: 0, max: 1000, prefix: "$", suffix: "/hr" },
      { name: "ownCar", label: "You're bringing a car", type: "toggle", value: true },
      {
        type: "group", title: "Rental truck", open: true, advanced: true,
        fields: [
          { name: "truckRate", label: "Truck rental quote", type: "number", value: 1100, min: 0, max: 100000, prefix: "$", hint: "One-way rate for the days you need" },
          { name: "truckPerMile", label: "Per-mile charge", type: "number", value: 0, min: 0, max: 10, prefix: "$", hint: "Often included on one-way rentals" },
          { name: "truckMpg", label: "Truck fuel economy", type: "number", value: 10, min: 1, max: 40, suffix: "mpg" },
          { name: "gas", label: "Fuel price", type: "number", value: 4.25, min: 0, max: 20, prefix: "$", suffix: "/gal" },
          { name: "towCost", label: "Car trailer or second driver", type: "number", value: 300, min: 0, max: 10000, prefix: "$" },
          { name: "truckInsurance", label: "Damage protection", type: "number", value: 150, min: 0, max: 10000, prefix: "$" },
        ],
      },
      {
        type: "group", title: "Movers", open: true, advanced: true,
        fields: [
          { name: "moverQuote", label: "Movers' quote", type: "number", value: 4800, min: 0, max: 1000000, prefix: "$" },
          { name: "tipPct", label: "Tip", type: "number", value: 5, min: 0, max: 30, suffix: "%" },
          { name: "moverProtection", label: "Full-value protection", type: "number", value: 250, min: 0, max: 100000, prefix: "$" },
        ],
      },
      {
        type: "group", title: "Portable container", open: true, advanced: true,
        fields: [
          { name: "podQuote", label: "Container quote", type: "number", value: 2900, min: 0, max: 1000000, prefix: "$", hint: "Delivery, transport, and pickup" },
          { name: "storageMonths", label: "Months of storage", type: "number", value: 0, min: 0, max: 60 },
          { name: "podStorage", label: "Storage per month", type: "number", value: 200, min: 0, max: 10000, prefix: "$" },
        ],
      },
      {
        type: "group", title: "Shared costs", advanced: true,
        fields: [
          { name: "supplies", label: "Boxes, tape, pads", type: "number", value: 200, min: 0, max: 100000, prefix: "$" },
          { name: "helpers", label: "Hired loading helpers", type: "number", value: 2, min: 0, max: 20, integer: true },
          { name: "helperRate", label: "Helper rate", type: "number", value: 40, min: 0, max: 500, prefix: "$", suffix: "/hr" },
          { name: "helperHours", label: "Hours each to load", type: "number", value: 3, min: 0, max: 100 },
          { name: "milesPerDay", label: "Miles you'll drive per day", type: "number", value: 450, min: 100, max: 1000 },
          { name: "lodging", label: "Lodging per night", type: "number", value: 130, min: 0, max: 2000, prefix: "$" },
          { name: "meals", label: "Meals per travel day", type: "number", value: 50, min: 0, max: 1000, prefix: "$" },
          { name: "carPerMile", label: "Driving your car, per mile", type: "number", value: 0.25, min: 0, max: 5, prefix: "$", hint: "Fuel + wear" },
        ],
      },
    ],
    compute: compute,
    render: render,
  };
});
