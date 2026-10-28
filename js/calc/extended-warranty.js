/* Extended warranty versus self-insuring. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };

  /* Expected repairs during the coverage term follow a simple model: chance of
     at least one failure p, expected number of failures given one = k. A repair
     never costs more than replacing the product. */
  /* Expected cost over the coverage term. p = chance of a failure, k = repairs
     if something fails, R = repair cost (capped at replacing the product),
     D = deductible, x = chance a failure is excluded, c = share of the term a
     credit card's free extension already covers (failures assumed evenly spread). */
  function expected(v, pOverride) {
    var p = (pOverride != null ? pOverride : v.chance) / 100;
    var k = Math.max(1, v.repeats || 1);
    var R = Math.min(v.repairCost, v.price);
    var D = Math.min(v.deductible, R);
    var x = (v.excluded || 0) / 100;
    var c = Math.min(1, (v.cardYears || 0) / Math.max(0.0001, v.term));
    var self = p * k * (c * x * R + (1 - c) * R);
    var withPlan = v.planPrice + p * k * (c * x * R + (1 - c) * ((1 - x) * D + x * R));
    return { p: p, k: k, repairCost: R, deductible: D, self: self, withPlan: withPlan, cardShare: c, excl: x };
  }

  function breakEvenChance(v) {
    var R = Math.min(v.repairCost, v.price);
    var D = Math.min(v.deductible, R);
    var c = Math.min(1, (v.cardYears || 0) / Math.max(0.0001, v.term));
    var perP = Math.max(1, v.repeats || 1) * (1 - c) * (1 - (v.excluded || 0) / 100) * (R - D);
    if (perP <= 0) return null;
    return v.planPrice / perP * 100;
  }

  function compute(v) {
    var e = expected(v);
    var be = breakEvenChance(v);
    var xs = [];
    for (var p = 0; p <= 100; p += 2) xs.push(p);
    var worstSelf = e.repairCost;
    var worstPlan = v.planPrice + Math.min(v.deductible, e.repairCost);
    return { v: v, e: e, be: be, xs: xs, worstSelf: worstSelf, worstPlan: worstPlan, markup: e.self > 0 ? v.planPrice / e.self : Infinity };
  }

  function render(res, v, h) {
    var e = res.e;
    var saves = e.self - e.withPlan;
    var verdict = saves > 0
      ? { tone: "good", title: "The warranty is worth it on average, saving about " + money0(saves) + ".", body: "That depends on a " + fmt.pct(v.chance, 0) + " chance of a " + money0(e.repairCost) + " repair. It breaks even at a " + fmt.pct(res.be, 0) + " repair chance." }
      : { tone: "warn", title: "Skip it and self-insure. On average the plan costs " + money0(-saves) + " more than it pays back.", body: "It only breaks even if the chance of a repair is at least " + (res.be == null ? "more than 100%" : fmt.pct(res.be, 0)) + "; you estimated " + fmt.pct(v.chance, 0) + ". Set aside " + money0(v.planPrice) + " for repairs instead." };
    if (saves <= 0 && res.worstSelf > (v.cushion || Infinity)) {
      verdict.body += " One exception: a " + money0(res.worstSelf) + " surprise would strain your budget, and that peace of mind may be worth paying for.";
    }
    var stats = [
      ["Expected cost: self-insure", money0(e.self), fmt.pct(v.chance, 0) + " × " + money0(e.repairCost) + (e.k > 1 ? " × " + fmt.num(e.k, 1) + " repairs" : "")],
      ["Expected cost: with warranty", money0(e.withPlan), "Price + expected deductibles + excluded repairs"],
      ["Break-even repair chance", res.be == null ? "Never" : fmt.pct(res.be, 0), "The plan pays off above this", "hl"],
      ["Price vs expected payout", Number.isFinite(res.markup) ? fmt.num(res.markup, 1) + "×" : "—", "Plan price ÷ expected repair cost"],
      ["Worst case without plan", money0(res.worstSelf), "One repair, capped at replacing it"],
      ["Worst case with plan", money0(res.worstPlan), "Plan + deductible"],
    ];
    var self = res.xs.map(function (p) { return expected(v, p).self; });
    var plan = res.xs.map(function (p) { return expected(v, p).withPlan; });
    var chart = h.line({
      width: h.wideWidth, xs: res.xs,
      series: [{ name: "Self-insure", ys: self }, { name: "Buy the warranty", ys: plan }],
      markers: [{ x: v.chance, label: "Your estimate " + fmt.pct(v.chance, 0) }],
      points: res.be != null && res.be <= 100 ? [{ x: res.be, y: expected(v, res.be).self, tone: "cross", label: "Break-even " + fmt.pct(res.be, 0) }] : [],
      xFormat: function (p) { return p + "%"; }, tipX: function (p) { return p + "% chance of a repair"; },
      ariaLabel: "Expected cost of self-insuring versus buying the warranty by repair probability",
      caption: "The warranty line starts at its price. Self-insuring starts at zero and rises with the chance of a repair. Where they cross is the break-even probability.",
    });
    var tips = [
      "Many credit cards add a year to the manufacturer's warranty for free when you pay with the card. Enter it under More detail.",
      "Read the exclusions: wear and tear, cosmetic damage, and pre-existing problems are often not covered.",
      "Retailer plans are priced well above expected repair costs on average; that margin is the seller's profit.",
      "If a repair bill would be a financial emergency, keep an emergency fund or buy only plans on expensive, failure-prone items.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Expected cost by repair probability", html: chart },
        { title: "Before you buy a plan", html: '<ul class="nc-recs">' + tips.map(function (t) { return "<li>" + h.esc(t) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Extended warranty check (NumberCove)", "Plan: " + money0(v.planPrice) + ", deductible " + money0(v.deductible), "Expected cost self-insure: " + money0(e.self), "Expected cost with plan: " + money0(e.withPlan), "Break-even repair chance: " + (res.be == null ? "never" : fmt.pct(res.be, 0))].join("\n"),
    };
  }

  return {
    id: "extended-warranty",
    inputs: [
      { name: "price", label: "Product price", type: "number", value: 1200, min: 1, max: 1000000, prefix: "$", hint: "Caps any repair at the cost to replace it" },
      { name: "planPrice", label: "Warranty price", type: "number", value: 199, min: 0, max: 100000, prefix: "$", slider: { min: 0, max: 600, step: 5 } },
      { name: "term", label: "Coverage beyond the manufacturer's warranty", type: "number", value: 3, min: 0.25, max: 15, suffix: "years" },
      { name: "deductible", label: "Deductible or service fee per claim", type: "number", value: 50, min: 0, max: 10000, prefix: "$" },
      { name: "chance", label: "Chance it needs a repair in that time", type: "number", value: 15, min: 0, max: 100, suffix: "%", slider: { min: 0, max: 60, step: 1 }, hint: "Consumer surveys of reliability are a good guide" },
      { name: "repairCost", label: "Typical repair cost", type: "number", value: 350, min: 0, max: 1000000, prefix: "$" },
      {
        type: "group", title: "More detail", advanced: true,
        fields: [
          { name: "excluded", label: "Chance the failure isn't covered", type: "number", value: 10, min: 0, max: 100, suffix: "%", hint: "Exclusions, wear and tear, accidental damage" },
          { name: "repeats", label: "Repairs if something fails", type: "number", value: 1, min: 1, max: 10, hint: "1 = a single repair" },
          { name: "cardYears", label: "Free extension from your credit card", type: "number", value: 0, min: 0, max: 5, suffix: "years" },
          { name: "cushion", label: "Repair bill you could absorb", type: "number", optional: true, min: 0, max: 1000000, prefix: "$" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { expected: expected, breakEvenChance: breakEvenChance },
  };
});
