/* Buy the tool, rent it, or hire a professional. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };

  /* Cost of each path over n projects (this one plus future ones). */
  function totals(v, n) {
    var hours = v.hours || 0;
    var timeCost = hours * (v.hourly || 0);
    var rework = (v.reworkPct || 0) / 100 * ((v.reworkCost || 0) + (v.reworkHours || 0) * (v.hourly || 0));
    var diy = (v.materials || 0) + timeCost + rework;
    var buy = v.toolPrice + (v.consumables || 0) * n + diy * n + (v.upkeep || 0) * Math.max(0, n - 1) - (v.resalePct || 0) / 100 * v.toolPrice;
    var rent = (v.rentPerDay * v.rentDays + (v.consumables || 0) + (v.pickup || 0)) * n + diy * n;
    var hire = (v.quote + (v.quoteHasMaterials ? 0 : v.materials || 0)) * n;
    return { buy: buy, rent: rent, hire: hire, timeCost: timeCost, rework: rework, diy: diy };
  }

  function compute(v) {
    var n = 1 + (v.future || 0);
    var t = totals(v, n);
    var one = totals(v, 1);
    var options = [
      { id: "buy", name: "Buy the tool", total: t.buy },
      { id: "rent", name: "Rent the tool", total: t.rent },
      { id: "hire", name: "Hire a pro", total: t.hire },
    ].sort(function (a, b) { return a.total - b.total; });
    var curve = [];
    for (var k = 1; k <= Math.max(8, n + 3); k += 1) curve.push({ n: k, t: totals(v, k) });
    var rentPerProject = v.rentPerDay * v.rentDays + (v.consumables || 0) + (v.pickup || 0);
    var buyFixed = v.toolPrice * (1 - (v.resalePct || 0) / 100);
    var buyPerExtra = (v.consumables || 0) + (v.upkeep || 0);
    var breakEvenProjects = rentPerProject > buyPerExtra ? Math.max(1, Math.ceil((buyFixed - (v.upkeep || 0) + 1e-9) / (rentPerProject - buyPerExtra))) : null;
    return { v: v, n: n, t: t, one: one, options: options, best: options[0], curve: curve, breakEvenProjects: breakEvenProjects };
  }

  function render(res, v, h) {
    var best = res.best;
    var second = res.options[1];
    var projects = res.n === 1 ? "this project" : res.n + " projects";
    var verdict = {
      tone: "good",
      title: best.name + ": " + money0(best.total) + " for " + projects + ", " + money0(second.total - best.total) + " less than " + second.name.toLowerCase() + ".",
      body: "Counting your time at " + money0(v.hourly || 0) + "/hr" + (v.reworkPct ? " and a " + fmt.pct(v.reworkPct, 0) + " chance of redoing it" : "") + "." + (res.breakEvenProjects ? " Buying beats renting once you'd use the tool " + res.breakEvenProjects + " time" + (res.breakEvenProjects === 1 ? "" : "s") + "." : ""),
    };
    var stats = [
      ["Buy", money0(res.t.buy), "Tool − resale + materials + your time", best.id === "buy" ? "good" : ""],
      ["Rent", money0(res.t.rent), money0(v.rentPerDay) + "/day × " + fmt.num(v.rentDays, 1) + " days per project", best.id === "rent" ? "good" : ""],
      ["Hire", money0(res.t.hire), "Quote" + (v.quoteHasMaterials ? " incl. materials" : " + materials"), best.id === "hire" ? "good" : ""],
      ["Your time per project", fmt.num(v.hours || 0, 1) + " hrs", "Worth " + money0(res.one.timeCost)],
      ["Expected redo cost", money0(res.one.rework), "Per DIY project"],
      ["Buying beats renting after", res.breakEvenProjects ? res.breakEvenProjects + " use" + (res.breakEvenProjects === 1 ? "" : "s") : "Never", "Including resale value", "hl"],
    ];
    var xs = res.curve.map(function (c) { return c.n; });
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [
        { name: "Buy", ys: res.curve.map(function (c) { return c.t.buy; }) },
        { name: "Rent", ys: res.curve.map(function (c) { return c.t.rent; }) },
        { name: "Hire", ys: res.curve.map(function (c) { return c.t.hire; }), slot: 3 },
      ],
      markers: [{ x: res.n, label: "Your plan: " + res.n }],
      xFormat: function (k) { return String(k); }, tipX: function (k) { return k + " project" + (k === 1 ? "" : "s"); },
      xTicks: xs,
      xLabel: "Projects",
      ariaLabel: "Total cost of buying, renting, or hiring by number of projects",
      caption: "Buying has a big first cost that's spread over every future use; renting and hiring cost the same each time. Where the lines cross is where the answer changes.",
    });
    var bars = h.bars({
      series: ["Buy", "Rent", "Hire"],
      rows: [
        { label: "Equipment", values: [v.toolPrice * (1 - (v.resalePct || 0) / 100), (v.rentPerDay * v.rentDays + (v.pickup || 0)) * res.n, 0] },
        { label: "Materials & consumables", values: [((v.materials || 0) + (v.consumables || 0)) * res.n, ((v.materials || 0) + (v.consumables || 0)) * res.n, v.quoteHasMaterials ? 0 : (v.materials || 0) * res.n] },
        { label: "Your time", values: [res.one.timeCost * res.n, res.one.timeCost * res.n, 0] },
        { label: "Redo risk", values: [res.one.rework * res.n, res.one.rework * res.n, 0] },
        { label: "Pro's quote", values: [0, 0, v.quote * res.n] },
      ],
      format: function (n) { return money0(n); },
      ariaLabel: "Cost breakdown for buying, renting, and hiring",
    });
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Total cost by number of projects", html: chart },
        { title: "Where the money goes", note: "For " + projects, html: bars },
      ],
      copy: ["Buy, rent, or hire (NumberCove)", "Buy: " + money0(res.t.buy), "Rent: " + money0(res.t.rent), "Hire: " + money0(res.t.hire), "Best: " + best.name].join("\n"),
    };
  }

  return {
    id: "buy-rent-hire",
    inputs: [
      { name: "toolPrice", label: "Tool price to buy", type: "number", value: 450, min: 0, max: 1000000, prefix: "$" },
      { name: "rentPerDay", label: "Rental price per day", type: "number", value: 85, min: 0, max: 100000, prefix: "$" },
      { name: "rentDays", label: "Rental days per project", type: "number", value: 2, min: 0.25, max: 365 },
      { name: "quote", label: "Pro's quote", type: "number", value: 1200, min: 0, max: 10000000, prefix: "$" },
      { name: "quoteHasMaterials", label: "Quote includes materials", type: "toggle", value: true },
      { name: "materials", label: "Materials (same for DIY)", type: "number", value: 300, min: 0, max: 1000000, prefix: "$" },
      { name: "hours", label: "Your hours per project", type: "number", value: 10, min: 0, max: 1000 },
      { name: "hourly", label: "Value of your time", type: "number", value: 25, min: 0, max: 1000, prefix: "$", suffix: "/hr", slider: { min: 0, max: 100, step: 5 } },
      { name: "future", label: "Future projects using the tool", type: "number", value: 1, min: 0, max: 50, integer: true, hint: "Next few years", slider: { min: 0, max: 10, step: 1 } },
      {
        type: "group", title: "Risk, resale, and extras", advanced: true,
        fields: [
          { name: "reworkPct", label: "Chance you'll need to redo part of it", type: "number", value: 15, min: 0, max: 100, suffix: "%" },
          { name: "reworkCost", label: "Redo materials or pro fix", type: "number", value: 300, min: 0, max: 1000000, prefix: "$" },
          { name: "reworkHours", label: "Redo hours", type: "number", value: 4, min: 0, max: 1000 },
          { name: "resalePct", label: "Resale value when done", type: "number", value: 40, min: 0, max: 100, suffix: "%", hint: "Share of the price you'd get back" },
          { name: "consumables", label: "Consumables per project", type: "number", value: 20, min: 0, max: 100000, prefix: "$", hint: "Blades, bits, sandpaper" },
          { name: "upkeep", label: "Upkeep per extra project (owned)", type: "number", value: 0, min: 0, max: 100000, prefix: "$" },
          { name: "pickup", label: "Rental pickup & return cost", type: "number", value: 15, min: 0, max: 10000, prefix: "$", hint: "Gas, trailer, time" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { totals: totals },
  };
});
