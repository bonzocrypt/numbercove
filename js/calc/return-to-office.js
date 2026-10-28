/* Return-to-office and commute cost: what going in costs, and the raise that
   would offset it. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var IRS_RATE = 0.76;

  function perDay(v) {
    var drive = v.mode !== "transit";
    var transit = v.mode !== "drive";
    var miles = drive ? v.miles || 0 : 0;
    var items = [];
    if (drive) {
      if (v.carCost === "irs") {
        items.push({ key: "car", label: "Driving at the IRS rate", day: miles * IRS_RATE, note: fmt.num(miles, 0) + " mi × $0.76" });
      } else {
        items.push({ key: "fuel", label: "Fuel", day: v.mpg > 0 ? miles / v.mpg * v.gas : 0, note: fmt.num(miles, 0) + " mi ÷ " + fmt.num(v.mpg, 0) + " mpg × " + fmt.money(v.gas, 2) });
        items.push({ key: "wear", label: "Maintenance & tires", day: miles * (v.maintCents || 0) / 100, note: fmt.num(v.maintCents, 1) + "¢/mi" });
        items.push({ key: "dep", label: "Depreciation", day: miles * (v.depCents || 0) / 100, note: fmt.num(v.depCents, 1) + "¢/mi" });
      }
      items.push({ key: "tolls", label: "Tolls", day: v.tolls || 0 });
      items.push({ key: "parking", label: "Parking", day: v.parking || 0 });
    }
    if (transit) items.push({ key: "transit", label: "Transit fares", day: v.transitDay || 0 });
    items.push({ key: "childcare", label: "Extra childcare", day: v.childcare || 0 });
    items.push({ key: "meals", label: "Meals & coffee", day: v.meals || 0 });
    items.push({ key: "pet", label: "Pet care & other", day: v.other || 0 });
    return items;
  }

  function compute(v) {
    var days = v.days * v.weeks;
    var items = perDay(v).map(function (it) { return Object.assign(it, { year: it.day * days }); });
    items.push({ key: "clothes", label: "Work clothes & dry cleaning", day: null, year: (v.clothes || 0) * 12 });
    var savingsYear = (v.homeSavings || 0) * days;
    var cash = items.reduce(function (s, it) { return s + it.year; }, 0) - savingsYear;
    var hours = (v.minutes || 0) * 2 / 60 * days;
    var hourly = v.timeValue != null ? v.timeValue : v.salary / 2080;
    var timeCost = hours * hourly;
    var tax = v.taxRate / 100;
    var raiseCash = tax < 1 ? cash / (1 - tax) : NaN;
    var raiseAll = tax < 1 ? (cash + timeCost) / (1 - tax) : NaN;
    var effectiveHourly = v.salary / (2080 + hours) ;
    var byDays = [1, 2, 3, 4, 5].map(function (d) {
      var dd = d * v.weeks;
      var c = items.reduce(function (s, it) { return s + (it.day == null ? it.year : it.day * dd); }, 0) - (v.homeSavings || 0) * dd;
      var t = (v.minutes || 0) * 2 / 60 * dd * hourly;
      return { d: d, cash: c, time: t, raise: tax < 1 ? c / (1 - tax) : NaN };
    });
    return {
      v: v, days: days, items: items, cash: cash, savingsYear: savingsYear, hours: hours, hourly: hourly, timeCost: timeCost, raiseCash: raiseCash, raiseAll: raiseAll,
      monthly: cash / 12, perDay: days ? cash / days : 0, byDays: byDays, effectiveHourly: effectiveHourly, takeHomeHit: cash, pctOfSalary: cash / v.salary * 100,
    };
  }

  function render(res, v, h) {
    var verdict = {
      tone: res.raiseCash / v.salary > 0.05 ? "bad" : "warn",
      title: "Going in " + v.days + " day" + (v.days === 1 ? "" : "s") + " a week costs " + fmt.money(res.cash) + " a year. You'd need a " + fmt.pct(res.raiseCash / v.salary * 100, 1) + " raise to break even.",
      body: "That's a " + fmt.money(res.raiseCash) + " raise before tax to cover " + fmt.money(res.monthly) + " a month in commuting costs. Count your " + fmt.num(res.hours, 0) + " unpaid hours on the road and the raise needed is " + fmt.money(res.raiseAll) + " (" + fmt.pct(res.raiseAll / v.salary * 100, 1) + ").",
    };
    var stats = [
      ["Monthly cost", fmt.money(res.monthly), fmt.money(res.perDay, 2) + " per office day"],
      ["Annual cost", fmt.money(res.cash), fmt.pct(res.pctOfSalary, 1) + " of salary, paid with after-tax money"],
      ["Raise to break even", fmt.money(res.raiseCash), "Pre-tax, at " + fmt.pct(v.taxRate, 0) + " combined tax", "hl"],
      ["Unpaid time commuting", fmt.num(res.hours, 0) + " hours/yr", "Worth " + fmt.money(res.timeCost) + " at " + fmt.money(res.hourly, 2) + "/hr"],
      ["Raise including your time", fmt.money(res.raiseAll), fmt.pct(res.raiseAll / v.salary * 100, 1) + " of salary"],
      ["Real hourly pay", fmt.money(res.effectiveHourly, 2) + "/hr", "Salary over work + commute hours, before costs"],
    ];
    var ranked = res.items.filter(function (it) { return it.year > 0.5; }).sort(function (a, b) { return b.year - a.year; });
    if (res.savingsYear > 0) ranked.push({ label: "Savings on office days", year: -res.savingsYear, note: "Home utilities, food" });
    var bars = h.bars({
      title: "Where the money goes each year",
      rows: ranked.map(function (it) { return { label: it.label, sub: it.note || "", value: it.year, tone: it.year < 0 ? "good" : "1" }; }),
      format: function (n) { return (n < 0 ? "−" : "") + fmt.money(Math.abs(n)); },
      ariaLabel: "Annual commute and office costs by category",
    });
    var dayTable = h.table(["Office days a week", "Annual cost", "Monthly", "Unpaid hours", "Raise to break even", "Raise incl. time"], res.byDays.map(function (b) {
      return { cls: b.d === v.days ? "row-hl" : "", cells: [b.d + (b.d === 1 ? " day" : " days"), fmt.money(b.cash), fmt.money(b.cash / 12), fmt.num((v.minutes || 0) * 2 / 60 * b.d * v.weeks, 0), fmt.money(b.raise), fmt.money((b.cash + b.time) / (1 - v.taxRate / 100))] };
    }));
    var dayBars = h.bars({
      series: ["Commuting costs", "Value of commute time"],
      rows: res.byDays.map(function (b) { return { label: b.d + " day" + (b.d === 1 ? "" : "s") + "/week", values: [b.cash, b.time], highlight: b.d === v.days }; }),
      format: function (n) { return fmt.money(n); },
      ariaLabel: "Annual cost by number of office days per week",
    });
    return {
      verdict: verdict, stats: stats, side: [bars],
      wide: [
        { title: "Cost by office days per week", note: "Same commute, " + v.weeks + " working weeks a year", html: dayBars + dayTable },
        { title: "Why the raise is bigger than the cost", html: '<p class="hint">Commuting costs are paid from take-home pay and generally aren\'t tax deductible for employees, so a raise has to cover your taxes too: raise = cost ÷ (1 − tax rate). At ' + fmt.pct(v.taxRate, 0) + ", every " + fmt.money(1000) + " of commuting needs " + fmt.money(1000 / (1 - v.taxRate / 100)) + " in gross pay.</p>" },
      ],
      copy: ["Return-to-office cost (NumberCove)", v.days + " days/week, " + v.weeks + " weeks", "Annual cost: " + fmt.money(res.cash) + " (" + fmt.money(res.monthly) + "/mo)", "Raise to break even: " + fmt.money(res.raiseCash) + " (" + fmt.pct(res.raiseCash / v.salary * 100, 1) + ")", "Unpaid commute hours: " + fmt.num(res.hours, 0), "Raise including time: " + fmt.money(res.raiseAll)].join("\n"),
    };
  }

  return {
    id: "return-to-office",
    inputs: [
      { name: "salary", label: "Annual salary", type: "number", value: 85000, min: 1, max: 10000000, prefix: "$" },
      { name: "days", label: "Office days per week", type: "number", value: 3, min: 0, max: 7, slider: { min: 1, max: 5, step: 1 } },
      { name: "weeks", label: "Working weeks per year", type: "number", value: 48, min: 1, max: 52, integer: true, hint: "After vacation and holidays" },
      { name: "taxRate", label: "Combined tax rate on a raise", type: "number", value: 30, min: 0, max: 70, suffix: "%", hint: "Federal + state + 7.65% payroll tax" },
      { name: "mode", label: "How you get there", type: "segment", value: "drive", options: [["drive", "Drive"], ["transit", "Transit"], ["both", "Drive + transit"]], span: 2 },
      {
        type: "group", title: "Driving", showIf: { mode: ["drive", "both"] },
        fields: [
          { name: "miles", label: "Round-trip miles", type: "number", value: 30, min: 0, max: 1000 },
          { name: "carCost", label: "Car cost method", type: "select", value: "detailed", options: [["detailed", "Fuel + wear + depreciation"], ["irs", "IRS rate (76¢/mile)"]] },
          { name: "mpg", label: "Fuel economy", type: "number", value: 28, min: 1, max: 200, suffix: "mpg", showIf: { carCost: "detailed" } },
          { name: "gas", label: "Gas price", type: "number", value: 4.25, min: 0, max: 20, prefix: "$", suffix: "/gal", showIf: { carCost: "detailed" } },
          { name: "maintCents", label: "Maintenance & tires", type: "number", value: 10, min: 0, max: 100, suffix: "¢/mi", showIf: { carCost: "detailed" } },
          { name: "depCents", label: "Extra depreciation", type: "number", value: 15, min: 0, max: 200, suffix: "¢/mi", hint: "Value lost per added mile", showIf: { carCost: "detailed" } },
          { name: "tolls", label: "Tolls per day", type: "number", value: 0, min: 0, max: 500, prefix: "$" },
          { name: "parking", label: "Parking per day", type: "number", value: 12, min: 0, max: 500, prefix: "$" },
        ],
      },
      { name: "transitDay", label: "Transit fares per day", type: "number", value: 6, min: 0, max: 500, prefix: "$", showIf: { mode: ["transit", "both"] }, hint: "Round trip, or monthly pass ÷ office days" },
      {
        type: "group", title: "Everything else", advanced: true, open: true,
        fields: [
          { name: "minutes", label: "One-way commute time", type: "number", value: 40, min: 0, max: 600, suffix: "min" },
          { name: "timeValue", label: "Value of your time", type: "number", optional: true, min: 0, max: 10000, prefix: "$", suffix: "/hr", hint: "Blank uses your salary's hourly rate" },
          { name: "childcare", label: "Extra childcare per office day", type: "number", value: 0, min: 0, max: 1000, prefix: "$" },
          { name: "meals", label: "Meals & coffee per office day", type: "number", value: 14, min: 0, max: 500, prefix: "$" },
          { name: "other", label: "Pet care & other per office day", type: "number", value: 0, min: 0, max: 1000, prefix: "$" },
          { name: "clothes", label: "Work clothes & dry cleaning", type: "number", value: 40, min: 0, max: 5000, prefix: "$", suffix: "/mo" },
          { name: "homeSavings", label: "Savings per office day", type: "number", value: 3, min: 0, max: 500, prefix: "$", hint: "Home heating, cooling, and food you don't use" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { IRS_RATE: IRS_RATE },
  };
});
