"use strict";
var assert = require("assert");
var NC = require("../js/nc-calc.js");
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), (msg || "") + ": expected " + b + ", got " + a); }
function defaults(def, over) {
  var v = {};
  (function walk(list) { list.forEach(function (f) { if (f.type === "group") walk(f.fields); else v[f.name] = f.value; }); })(def.inputs);
  return Object.assign(v, over || {});
}
var h = { fmt: NC.fmt, esc: String, wideWidth: 800, sideWidth: 400, line: function () { return "<svg></svg>"; }, bars: function () { return "<div></div>"; }, table: function () { return "<table></table>"; } };
function renders(def, v) {
  var out = def.render(def.compute(v), v, h);
  assert.ok(out.verdict && out.verdict.title && !/NaN|undefined|Infinity/.test(out.verdict.title + out.verdict.body), def.id + " verdict");
  out.stats.forEach(function (s) { assert.ok(!/NaN|undefined/.test(s.join(" ")), def.id + " stat " + s[0]); });
  return out;
}

/* Extended warranty */
var ew = require("../js/calc/extended-warranty.js");
var ev = defaults(ew);
var e = ew._test.expected(ev);
close(e.self, 0.15 * 350, 1e-9, "self-insure = p × R");
close(e.withPlan, 199 + 0.15 * (0.9 * 50 + 0.1 * 350), 1e-9, "plan = price + deductibles + excluded");
close(ew._test.breakEvenChance(ev), 199 / (0.9 * 300) * 100, 1e-9, "break-even chance");
close(ew._test.expected(ev, ew._test.breakEvenChance(ev)).self, ew._test.expected(ev, ew._test.breakEvenChance(ev)).withPlan, 1e-6, "costs equal at break-even");
close(ew._test.expected(defaults(ew, { repairCost: 5000 })).repairCost, 1200, 0, "repair capped at price");
assert.strictEqual(ew._test.breakEvenChance(defaults(ew, { cardYears: 3 })), null, "card covers whole term");
renders(ew, ev);

/* Repair or replace */
var rr = require("../js/calc/repair-or-replace.js");
close(rr._test.crf(0, 10), 0.1, 1e-12, "CRF at 0%");
close(rr._test.crf(0.05, 10), 0.129504574, 1e-8, "CRF 5%, 10 yrs");
close(rr._test.repairLife(0.8, 3), 0.8 * 3 + 0.2 * 0.5, 1e-12, "expected life after repair");
var rv = defaults(rr);
var c = rr._test.costs(rv, rv.age);
var maxV = defaults(rr, { repair: c.maxRepair });
close(rr._test.costs(maxV, maxV.age).eacRepair, c.eacNew, 1e-6, "max repair equalizes yearly cost");
var young = rr._test.costs(rv, 2).maxRepair;
var old = rr._test.costs(rv, 10).maxRepair;
assert.ok(young > old, "worthwhile repair falls with age");
renders(rr, rv);
renders(rr, defaults(rr, { age: 14, repair: 900 }));

/* Buy, rent, hire */
var brh = require("../js/calc/buy-rent-hire.js");
var bv = defaults(brh);
var b = brh.compute(bv);
close(b.t.buy, 1530, 1e-9, "buy total");
close(b.t.rent, 1630, 1e-9, "rent total");
close(b.t.hire, 2400, 1e-9, "hire total");
assert.strictEqual(b.breakEvenProjects, 2);
assert.strictEqual(b.best.id, "buy");
var once = brh.compute(defaults(brh, { future: 0 }));
assert.ok(once.t.rent < once.t.buy, "renting wins for a single use");
renders(brh, bv);

/* Moving */
var mv = require("../js/calc/moving-cost.js");
var mvv = defaults(mv);
var m = mv.compute(mvv);
assert.strictEqual(m.driveDays, 2);
var truck = m.options.filter(function (o) { return o.id === "truck"; })[0];
close(truck.total, 1100 + 850 / 10 * 4.25 + 300 + 200 + 150 + 2 * 40 * 3 + 130 + 2 * 50 + 4 * 8 * 25, 1e-9, "truck total");
var movers = m.options.filter(function (o) { return o.id === "movers"; })[0];
close(movers.total, 4800 * 1.05 + 250 + 200 + 850 * 0.25 + 230 + 3 * 8 * 25 * 0.6, 1e-9, "movers total");
assert.strictEqual(m.best.id, "truck");
renders(mv, mvv);
assert.strictEqual(mv.compute(defaults(mv, { miles: 30 })).driveDays, 1);

/* Heat pump vs furnace */
var hp = require("../js/calc/heat-pump-vs-furnace.js");
var hv = defaults(hp);
var a = hp._test.annual(hv);
close(a.delivered, 600 * 100000 * 0.8, 1e-6, "heat delivered");
close(a.alt.fuel, 48e6 / (100000 * 0.95), 1e-9, "new furnace therms");
close(a.cop, 8.1 / 3.412, 1e-9, "COP from HSPF2");
var expKwh = 48e6 * 0.97 / (a.cop * 3412) + 48e6 * 0.03 / 3412;
close(a.hp.kwh, expKwh, 1e-6, "heat pump kWh");
var hr = hp.compute(hv);
close(hr.breakEvenElec, a.alt.heat / (expKwh + 1500 - 2000), 1e-9, "break-even electricity price");
var atBe = hp._test.annual(hv, hr.breakEvenElec);
close(atBe.hp.total, atBe.alt.total, 1e-6, "running costs equal at break-even price");
close(a.alt.co2, 48e6 / 95000 * 11.665 + 2000 * 0.81, 1e-6, "furnace CO2");
var oil = hp.compute(defaults(hp, { fuel: "oil", fuelPrice: 5.26, usage: 500, newAfue: 87 }));
assert.ok(oil.payback > 3 && oil.payback < 10, "oil payback in a plausible range: " + oil.payback);
var ok = hp.compute(defaults(hp, { fuel: "electric", usage: 15000, afue: 100 }));
assert.ok(ok.a.hp.total < ok.a.alt.total, "heat pump beats resistance heat");
assert.strictEqual(ok.breakEvenElec, null);
[hv, defaults(hp, { scenario: "keep" }), defaults(hp, { acNeeded: true, climate: "veryCold", backupPct: 15 }), defaults(hp, { fuel: "propane", fuelPrice: 2.52, usage: 700 })].forEach(function (x) { renders(hp, x); });
close(hp._test.annual(defaults(hp, { scenario: "keep" })).alt.fuel, 600, 1e-9, "keeping uses current fuel");

console.log("calc-batch3: all tests passed");
