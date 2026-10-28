/* Max buy price for resellers: the most you can pay for an item and still hit
   your target after platform fees, shipping, supplies, returns, tax, and time. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  /* Platform seller fees, matching NumberCove's marketplace payout calculator.
     gross = item price + shipping charged to the buyer. */
  var PLATFORMS = {
    ebay: { name: "eBay (most categories)", fee: function (item, ship) { var g = item + ship; var v = g <= 7500 ? g * 0.136 : 7500 * 0.136 + (g - 7500) * 0.0235; return v + (g <= 10 ? 0.3 : 0.4); }, note: "13.6% of item + shipping (2.35% above $7,500) + $0.30/$0.40 per order" },
    poshmark: { name: "Poshmark", fee: function (item) { return item < 15 ? 2.95 : item * 0.2; }, note: "$2.95 under $15, otherwise 20%" },
    mercari: { name: "Mercari", fee: function (item, ship) { return (item + ship) * 0.1; }, note: "10% of item + buyer shipping" },
    whatnot: { name: "Whatnot", fee: function (item, ship) { return item * 0.08 + (item + ship) * 0.029 + 0.3; }, note: "8% commission + 2.9% + $0.30 processing" },
    etsy: { name: "Etsy", fee: function (item, ship) { return (item + ship) * 0.065 + (item + ship) * 0.03 + 0.25 + 0.2; }, note: "6.5% transaction + 3% + $0.25 processing + $0.20 listing" },
    vinted: { name: "Vinted", fee: function () { return 0; }, note: "No seller fee (buyer pays)" },
    custom: { name: "Custom", fee: null, note: "Your percentage and fixed fee" },
  };

  function feeFor(v, price) {
    var p = PLATFORMS[v.platform] || PLATFORMS.ebay;
    if (v.platform === "custom") return price * (v.customPct || 0) / 100 + (v.customFixed || 0) + (v.shipCharged || 0) * (v.customPct || 0) / 100;
    return p.fee(price, v.shipCharged || 0);
  }

  function breakdown(v, price) {
    var fees = feeFor(v, price);
    var promo = price * (v.promoPct || 0) / 100;
    var returns = price * (v.returnsPct || 0) / 100;
    var time = (v.minutes || 0) / 60 * (v.hourly || 0);
    var revenue = price + (v.shipCharged || 0);
    var net = revenue - fees - promo - (v.shipCost || 0) - (v.supplies || 0) - returns - time;
    var target;
    var maxCost;
    if (v.goal === "roi") {
      maxCost = net / (1 + v.target / 100);
      target = maxCost * v.target / 100;
    } else if (v.goal === "margin") {
      target = price * v.target / 100;
      maxCost = net - target;
    } else {
      target = v.target;
      maxCost = net - target;
    }
    var taxRate = (v.salesTaxPct || 0) / 100;
    var maxBid = maxCost / (1 + taxRate);
    return { price: price, revenue: revenue, fees: fees, promo: promo, returns: returns, time: time, net: net, target: target, maxCost: maxCost, maxBid: maxBid, tax: maxBid * taxRate };
  }

  function compute(v) {
    var b = breakdown(v, v.price);
    var span = [];
    var lo = Math.max(1, Math.round(v.price * 0.5));
    var hi = Math.round(v.price * 1.5);
    var step = Math.max(1, Math.round((hi - lo) / 40));
    for (var p = lo; p <= hi; p += step) span.push(p);
    var breakevenCost = breakdown(Object.assign({}, v, { goal: "dollars", target: 0 }), v.price).maxCost;
    var paid = v.askPrice;
    var actual = null;
    if (paid != null) {
      var cost = paid * (1 + (v.salesTaxPct || 0) / 100);
      var profit = b.net - cost;
      actual = { paid: paid, cost: cost, profit: profit, roi: profit / cost * 100, margin: profit / v.price * 100 };
    }
    return { v: v, b: b, span: span, breakevenCost: breakevenCost, actual: actual, platform: PLATFORMS[v.platform] || PLATFORMS.ebay };
  }

  function goalText(v) {
    if (v.goal === "roi") return fmt.pct(v.target, 0) + " return on cost";
    if (v.goal === "margin") return fmt.pct(v.target, 0) + " profit margin";
    return fmt.money(v.target, 2) + " profit";
  }

  function render(res, v, h) {
    var b = res.b;
    var verdict;
    if (b.maxBid <= 0) {
      verdict = { tone: "bad", title: "Don't buy at any price: this sale can't reach " + goalText(v) + ".", body: "After fees and costs you'd net " + fmt.money(b.net, 2) + " from a " + fmt.money(v.price, 2) + " sale." };
    } else {
      verdict = { tone: "good", title: "Pay no more than " + fmt.money(b.maxBid, 2) + (v.salesTaxPct ? " before tax" : "") + ".", body: "That leaves " + fmt.money(b.target, 2) + " profit (" + goalText(v) + ") on a " + fmt.money(v.price, 2) + " sale on " + res.platform.name + "." };
    }
    if (res.actual) {
      var a = res.actual;
      var ok = a.paid <= b.maxBid + 0.005;
      verdict.body += " At the " + fmt.money(a.paid, 2) + " asking price you'd make " + fmt.signed(a.profit, 2) + " (" + fmt.pct(a.roi, 0) + " ROI)" + (ok ? ", which clears your target." : ", short of your target. Offer " + fmt.money(Math.max(0, b.maxBid), 2) + " or less.");
      if (!ok && b.maxBid > 0) verdict.tone = "warn";
    }
    var stats = [
      ["Max price to pay", fmt.money(Math.max(0, b.maxBid), 2), v.salesTaxPct ? "Plus " + fmt.money(Math.max(0, b.tax), 2) + " sales tax" : "", "hl"],
      ["Break-even cost", fmt.money(res.breakevenCost, 2), "Pay more than this and you lose money"],
      ["Platform fees", fmt.money(b.fees, 2), res.platform.note],
      ["You net before item cost", fmt.money(b.net, 2), fmt.pct(b.net / Math.max(0.01, b.revenue) * 100, 0) + " of what the buyer pays"],
    ];
    var parts = [
      { label: "Buyer pays", value: b.revenue, tone: "1" },
      { label: "Platform fees", value: -b.fees, tone: "bad" },
      { label: "Promoted listing", value: -b.promo, tone: "bad" },
      { label: "Shipping label", value: -(v.shipCost || 0), tone: "bad" },
      { label: "Supplies", value: -(v.supplies || 0), tone: "bad" },
      { label: "Returns & damage allowance", value: -b.returns, tone: "bad" },
      { label: "Your time", value: -b.time, tone: "bad" },
      { label: "Your profit target", value: -b.target, tone: "muted" },
      { label: "Max you can pay (incl. tax)", value: b.maxCost, tone: "good", highlight: true },
    ].filter(function (p) { return Math.abs(p.value) > 0.004 || p.highlight || p.label === "Buyer pays"; });
    var side = [h.bars({ title: "Where the sale price goes", rows: parts, format: function (n) { return (n < 0 ? "−" : "") + fmt.money(Math.abs(n), 2); }, ariaLabel: "Breakdown of the sale price into fees, costs, profit, and maximum buy price" })];

    var xs = res.span;
    var curves = [
      { name: "Your target (" + goalText(v) + ")", ys: xs.map(function (p) { return Math.max(0, breakdown(v, p).maxBid); }) },
      { name: "Break-even", ys: xs.map(function (p) { return Math.max(0, breakdown(Object.assign({}, v, { goal: "dollars", target: 0 }), p).maxCost / (1 + (v.salesTaxPct || 0) / 100)); }), dashed: true },
    ];
    var points = [{ x: v.price, y: Math.max(0, b.maxBid), tone: "s1", label: fmt.money(Math.max(0, b.maxBid), 2) }];
    if (res.actual) points.push({ x: v.price, y: res.actual.paid, tone: res.actual.paid <= b.maxBid ? "s3" : "cross", label: "Asking " + fmt.money(res.actual.paid, 2) });
    var wide = [{
      title: "Max buy price at other sale prices",
      note: "If the item sells for more or less than you expect",
      html: h.line({
        width: h.wideWidth, xs: xs, series: curves, points: points,
        xFormat: function (x) { return "$" + x; }, tipX: function (x) { return "Sells for " + fmt.money(x, 2); },
        tipY: function (y) { return fmt.money(y, 2); },
        markers: [{ x: v.price, label: "Your estimate" }],
        ariaLabel: "Maximum buy price across a range of sale prices",
        caption: "Anything you can buy below the solid line hits your target. Between the lines you profit, but less than you want. Above the dashed line you lose money.",
      }),
    }];
    var tiers = [10, 20, 30, 40, 50, 75, 100];
    wide.push({
      title: "Quick reference",
      note: "Max price to pay for common targets at " + fmt.money(v.price, 2),
      html: h.table(["Target", "Return on cost", "Profit margin"], tiers.map(function (t) {
        var roi = breakdown(Object.assign({}, v, { goal: "roi", target: t }), v.price);
        var mar = t < 100 ? breakdown(Object.assign({}, v, { goal: "margin", target: t }), v.price) : null;
        return [t + "%", fmt.money(Math.max(0, roi.maxBid), 2), mar ? fmt.money(Math.max(0, mar.maxBid), 2) : "—"];
      })),
    });

    return {
      verdict: verdict, stats: stats, side: side, wide: wide,
      copy: ["Max buy price (NumberCove)", "Sale price: " + fmt.money(v.price, 2) + " on " + res.platform.name, "Target: " + goalText(v), "Max price to pay: " + fmt.money(Math.max(0, b.maxBid), 2) + (v.salesTaxPct ? " before tax" : ""), "Break-even cost: " + fmt.money(res.breakevenCost, 2)].join("\n"),
    };
  }

  return {
    id: "max-buy-price",
    inputs: [
      { name: "price", label: "Expected sale price", type: "number", value: 60, min: 0.01, max: 1000000, prefix: "$", hint: "Check recent sold listings, not asking prices" },
      { name: "platform", label: "Where you'll sell", type: "select", value: "ebay", options: [["ebay", "eBay (most categories)"], ["poshmark", "Poshmark"], ["mercari", "Mercari"], ["whatnot", "Whatnot"], ["etsy", "Etsy"], ["vinted", "Vinted"], ["custom", "Custom fee"]] },
      { name: "customPct", label: "Fee percentage", type: "number", value: 12, min: 0, max: 100, suffix: "%", showIf: { platform: "custom" } },
      { name: "customFixed", label: "Fixed fee per order", type: "number", value: 0.3, min: 0, max: 1000, prefix: "$", showIf: { platform: "custom" } },
      { name: "goal", label: "Your target", type: "segment", value: "roi", options: [["roi", "Return on cost"], ["margin", "Profit margin"], ["dollars", "Dollar profit"]], span: 2 },
      { name: "target", label: "Target", type: "number", value: 50, min: 0, max: 100000, hint: "Percent for return or margin, dollars for profit", suffixBy: { field: "goal", map: { roi: "%", margin: "%", dollars: "USD" } }, suffix: "%" },
      { name: "askPrice", label: "Asking price you're considering", type: "number", optional: true, min: 0, max: 1000000, prefix: "$" },
      {
        type: "group", title: "Costs", open: true, advanced: true,
        fields: [
          { name: "shipCharged", label: "Shipping charged to buyer", type: "number", value: 0, min: 0, max: 10000, prefix: "$" },
          { name: "shipCost", label: "Shipping label you pay", type: "number", value: 9, min: 0, max: 10000, prefix: "$" },
          { name: "supplies", label: "Packaging & supplies", type: "number", value: 1, min: 0, max: 10000, prefix: "$" },
          { name: "promoPct", label: "Promoted listing / ad rate", type: "number", value: 0, min: 0, max: 100, suffix: "%" },
          { name: "returnsPct", label: "Returns & damage allowance", type: "number", value: 3, min: 0, max: 100, suffix: "%" },
          { name: "salesTaxPct", label: "Sales tax when you buy", type: "number", value: 0, min: 0, max: 30, suffix: "%", hint: "Use 0 for thrift with resale certificate" },
          { name: "minutes", label: "Your time per item", type: "number", value: 0, min: 0, max: 6000, suffix: "min", hint: "Sourcing, photos, listing, packing" },
          { name: "hourly", label: "Value of your time", type: "number", value: 0, min: 0, max: 1000, prefix: "$", suffix: "/hr" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { breakdown: breakdown, PLATFORMS: PLATFORMS },
  };
});
