/* Inventory aging and markdown timing: hold for full price, take an offer now,
   or liquidate, valued in today's dollars after holding and opportunity costs. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  function net(price, feePct, perSale) {
    return price * (1 - feePct / 100) - perSale;
  }

  /* Expected present value of a listing option.
     p: chance of selling in any given month at this price. The achievable price
     falls d per month (age, season). Each unsold month costs h to hold. Cash is
     discounted at r per month. Anything unsold after H months is liquidated at
     the floor price (also aging). */
  function listingValue(o, g, H) {
    var p = Math.min(1, Math.max(0, o.chance / 100));
    var d = g.declinePct / 100;
    var r = Math.pow(1 + g.capitalPct / 100, 1 / 12) - 1;
    var alive = 1;
    var ev = 0;
    var expMonths = 0;
    for (var t = 1; t <= H; t += 1) {
      var disc = Math.pow(1 + r, t);
      ev -= alive * g.holdCost / disc;
      var priceT = o.price * Math.pow(1 - d, t);
      ev += alive * p * net(priceT, o.fee, g.perSale) / disc;
      expMonths += alive * p * t;
      alive *= 1 - p;
    }
    var floorT = g.floor * Math.pow(1 - d, H);
    ev += alive * net(floorT, g.floorFee, g.perSale) / Math.pow(1 + r, H);
    expMonths += alive * H;
    return { ev: ev, unsold: alive, expMonths: expMonths };
  }

  function valueOf(o, g, H) {
    if (o.when === "now") return { ev: net(o.price, o.fee, g.perSale), unsold: 0, expMonths: 0 };
    return listingValue(o, g, H);
  }

  /* Monthly sell-through needed for a listing to match a benchmark value. */
  function breakEvenChance(o, g, H, target) {
    var lo = 0;
    var hi = 100;
    if (listingValue(Object.assign({}, o, { chance: 100 }), g, H).ev < target) return null;
    for (var i = 0; i < 50; i += 1) {
      var mid = (lo + hi) / 2;
      if (listingValue(Object.assign({}, o, { chance: mid }), g, H).ev >= target) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  function compute(v) {
    var g = { declinePct: v.declinePct, capitalPct: v.capitalPct, holdCost: v.holdCost, perSale: v.perSale || 0, floor: v.floor, floorFee: v.floorFee || 0 };
    var H = v.horizon;
    var options = (v.options || []).filter(function (o) { return o.price != null; }).map(function (o, i) {
      return { label: (o.label || "").trim() || "Option " + (i + 1), price: o.price, when: o.when === "now" ? "now" : "list", chance: o.chance == null ? 0 : o.chance, fee: o.fee == null ? 0 : o.fee };
    });
    if (!options.length) {
      var err = new Error("no options");
      err.userMessage = "Add at least one option with a price.";
      throw err;
    }
    options.forEach(function (o) {
      var r = valueOf(o, g, H);
      o.ev = r.ev;
      o.unsold = r.unsold;
      o.expMonths = r.expMonths;
      o.profit = r.ev - (v.cost || 0);
    });
    var ranked = options.slice().sort(function (a, b) { return b.ev - a.ev; });
    var best = ranked[0];
    var bestNow = options.filter(function (o) { return o.when === "now"; }).sort(function (a, b) { return b.ev - a.ev; })[0];
    var bestList = options.filter(function (o) { return o.when !== "now"; }).sort(function (a, b) { return b.ev - a.ev; })[0];
    var needed = bestList && bestNow ? breakEvenChance(bestList, g, H, bestNow.ev) : null;
    var horizonCurve = [];
    for (var m = 0; m <= Math.max(24, H); m += 1) {
      horizonCurve.push({ m: m, evs: options.map(function (o) { return o.when === "now" ? o.ev : (m === 0 ? net(g.floor, g.floorFee, g.perSale) : listingValue(o, g, m).ev); }) });
    }
    return { v: v, g: g, H: H, options: options, ranked: ranked, best: best, bestNow: bestNow, bestList: bestList, needed: needed, curve: horizonCurve };
  }

  function render(res, v, h) {
    var best = res.best;
    var second = res.ranked[1];
    var edge = second ? best.ev - second.ev : 0;
    var verdict = {
      tone: best.when === "now" ? "warn" : "good",
      title: "Best move: " + h.esc(best.label.charAt(0).toLowerCase() + best.label.slice(1)) + ".",
      body: "It's worth " + fmt.money(best.ev, 2) + " in today's money" + (second ? ", " + fmt.money(edge, 2) + " more than " + h.esc(second.label.toLowerCase()) : "") + ", after fees, holding costs, " + fmt.pct(v.declinePct, 1) + "/month price decay, and the cost of tying up cash.",
    };
    var stats = [];
    if (res.bestList) {
      stats.push(["Waiting for " + fmt.money(res.bestList.price), fmt.money(res.bestList.ev, 2), fmt.num(res.bestList.expMonths, 1) + " months expected · " + fmt.pct(res.bestList.unsold * 100, 0) + " chance it's still unsold at month " + res.H]);
    }
    if (res.bestNow) stats.push(["Best take-it-now option", fmt.money(res.bestNow.ev, 2), h.esc(res.bestNow.label)]);
    if (res.needed != null && res.bestNow && res.bestList) {
      stats.push(["Sell-through needed to justify waiting", fmt.pct(res.needed, 1) + "/mo", "You entered " + fmt.pct(res.bestList.chance, 1) + "/mo", res.bestList.chance >= res.needed ? "good" : "bad"]);
    } else if (res.bestNow && res.bestList) {
      stats.push(["Sell-through needed to justify waiting", "Not reachable", "Even a sale in month 1 can't beat taking the offer", "bad"]);
    }
    stats.push(["Monthly cost of holding", fmt.money(v.holdCost + (v.capitalPct / 100 / 12) * (res.bestList ? res.bestList.price : best.price) + (res.bestList ? res.bestList.price * v.declinePct / 100 : 0), 2), "Storage + cash tied up + price decay"]);
    if (v.cost) stats.push(["Profit on best option", fmt.signed(best.profit, 2), "Versus your " + fmt.money(v.cost, 2) + " cost"]);

    var bars = h.bars({
      title: "Value of each option in today's dollars",
      rows: res.ranked.map(function (o) { return { label: o.label, sub: o.when === "now" ? "Sell now" : fmt.pct(o.chance, 0) + "/mo chance at " + fmt.money(o.price), value: o.ev, tone: o === res.best ? "good" : "1" }; }),
      format: function (n) { return fmt.money(n, 2); },
      ariaLabel: "Expected value of each pricing option",
    });

    var curve = res.curve;
    var wide = [{
      title: "How long is it worth waiting?",
      note: "Value of each option if you liquidate whatever hasn't sold by that month",
      html: h.line({
        width: h.wideWidth,
        xs: curve.map(function (c) { return c.m; }),
        series: res.options.slice(0, 4).map(function (o, k) { return { name: o.label, ys: curve.map(function (c) { return c.evs[k]; }), dashed: o.when === "now" }; }),
        includeZero: false,
        xFormat: function (m) { return m + " mo"; },
        tipX: function (m) { return "Give it " + m + " month" + (m === 1 ? "" : "s"); },
        yFormat: function (y) { return "$" + y.toFixed(0); },
        tipY: function (y) { return fmt.money(y, 2); },
        markers: [{ x: res.H, label: "Your limit: " + res.H + " mo" }],
        ariaLabel: "Expected value by months waited before liquidating",
        caption: "Dashed lines are take-it-now offers. A listing's value rises while the chance of a sale outruns holding costs and price decay, then levels off or falls.",
      }),
    }];
    wide.push({
      title: "Option detail",
      html: h.table(["Option", "Price", "When", "Chance / month", "Fees", "Expected months", "Value today"], res.ranked.map(function (o) {
        return { cls: o === res.best ? "row-hl" : "", cells: [h.esc(o.label), fmt.money(o.price, 2), o.when === "now" ? "Now" : "Listed", o.when === "now" ? "100% now" : fmt.pct(o.chance, 1), fmt.pct(o.fee, 1), o.when === "now" ? "0" : fmt.num(o.expMonths, 1), "<strong>" + fmt.money(o.ev, 2) + "</strong>"] };
      })),
    });

    return {
      verdict: verdict, stats: stats, side: [bars], wide: wide,
      copy: ["Markdown decision (NumberCove)"].concat(res.ranked.map(function (o) { return o.label + ": " + fmt.money(o.ev, 2) + " today"; })).concat(res.needed != null ? ["Sell-through needed to justify waiting: " + fmt.pct(res.needed, 1) + " per month"] : []).join("\n"),
    };
  }

  return {
    id: "inventory-markdown",
    inputs: [
      {
        name: "options", label: "Your options", type: "list", span: 2, maxRows: 6, addLabel: "Add an option",
        hint: "“Now” means a sale you can make today. For listings, enter the chance it sells in any given month at that price.",
        columns: [
          { name: "label", label: "Option", type: "text", placeholder: "Hold at $100" },
          { name: "price", label: "Price", type: "number", prefix: "$" },
          { name: "when", label: "When", type: "select", options: [["list", "Listed"], ["now", "Now"]], value: "list" },
          { name: "chance", label: "Chance/mo", type: "number", suffix: "%", optional: true, min: 0, max: 100 },
          { name: "fee", label: "Fees", type: "number", suffix: "%", optional: true, min: 0, max: 100 },
        ],
        rows: [
          { label: "Wait for $100", price: "100", when: "list", chance: "15", fee: "13.6" },
          { label: "Accept $80 offer now", price: "80", when: "now", chance: "", fee: "13.6" },
          { label: "Liquidate at $60 now", price: "60", when: "now", chance: "", fee: "0" },
        ],
      },
      { name: "holdCost", label: "Holding cost per unit", type: "number", value: 3, min: 0, max: 100000, prefix: "$", suffix: "/mo", hint: "Storage, space, insurance per item" },
      { name: "declinePct", label: "Price decline while it ages", type: "number", value: 3, min: 0, max: 50, suffix: "%/mo", hint: "Seasonality, newer models, trends", slider: { min: 0, max: 15, step: 0.5 } },
      { name: "capitalPct", label: "Cost of tied-up cash", type: "number", value: 10, min: 0, max: 100, suffix: "%/yr", hint: "What that money would earn or save elsewhere" },
      { name: "horizon", label: "Most months you'll wait", type: "number", value: 6, min: 1, max: 60, integer: true, slider: { min: 1, max: 24, step: 1 } },
      { name: "floor", label: "If unsold, liquidate at", type: "number", value: 50, min: 0, max: 1000000, prefix: "$", hint: "Today's liquidation price; it ages too" },
      {
        type: "group", title: "More detail", advanced: true,
        fields: [
          { name: "perSale", label: "Cost per sale", type: "number", value: 0, min: 0, max: 10000, prefix: "$", hint: "Packaging or shipping you pay" },
          { name: "floorFee", label: "Fees on liquidation", type: "number", value: 0, min: 0, max: 100, suffix: "%" },
          { name: "cost", label: "Your cost for the item", type: "number", value: 35, min: 0, max: 1000000, prefix: "$", optional: true, hint: "Shows profit; doesn't change the decision" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { listingValue: listingValue, breakEvenChance: breakEvenChance, net: net },
  };
});
