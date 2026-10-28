"use strict";
var assert = require("assert");
var NC = require("../js/nc-calc.js");
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), (msg || "") + ": expected " + b + ", got " + a); }
function defaults(def, over) {
  var v = {};
  (function walk(list) { list.forEach(function (f) { if (f.type === "group") walk(f.fields); else v[f.name] = f.optional && f.value == null ? null : f.value; }); })(def.inputs);
  return Object.assign(v, over || {});
}
var h = { fmt: NC.fmt, esc: String, wideWidth: 800, sideWidth: 400, line: function () { return "<svg></svg>"; }, bars: function () { return "<div></div>"; }, table: function () { return "<table></table>"; } };
function renders(def, v) {
  var out = def.render(def.compute(v), v, h);
  assert.ok(out.verdict && out.verdict.title && !/NaN|undefined|Infinity/.test(out.verdict.title + out.verdict.body), def.id + " verdict: " + out.verdict.title + out.verdict.body);
  out.stats.forEach(function (s) { assert.ok(!/NaN|undefined|Infinity/.test(s.join(" ")), def.id + " stat " + s.join(" | ")); });
  return out;
}

/* EV vs gas */
var ev = require("../js/calc/ev-vs-gas.js");
var evv = defaults(ev);
close(ev._test.chargePrice(evv), 0.8 * 0.182 * 1.12 + 0.1 * 0.3 + 0.1 * 0.48, 1e-12, "blended charging price");
var pm = ev._test.perMile(evv);
close(pm.gas.energy, 4.25 / 30, 1e-12, "gas fuel per mile");
close(pm.ev.energy, 0.3 * ev._test.chargePrice(evv), 1e-12, "EV energy per mile");
var r = ev.compute(evv);
close(ev._test.yearly(evv, r.breakEvenGas).saving, 0, 1e-6, "running costs equal at break-even gas price");
close(r.co2.gas, 12000 / 30 * 18.73, 1e-9, "gas CO2");
assert.ok(r.cross > 5 && r.cross < 15, "premium recovered in plausible years");
close(ev._test.chargePrice(defaults(ev, { homePct: 80, fastPct: 40 })), (80 / 120) * 0.182 * 1.12 + (40 / 120) * 0.48, 1e-12, "mix over 100% is normalized");
renders(ev, evv);
renders(ev, defaults(ev, { homePct: 0, fastPct: 100, gas: 2.5 }));

/* Lease vs buy */
var lb = require("../js/calc/lease-vs-buy.js");
var lv = defaults(lb, { term: "36", loanTerm: "60", endValue: null });
var L = lb._test.leasePayment(Object.assign({}, lv, { term: 36 }));
close(L.dep, (38000 + 995 - 2000 - 23200) / 36, 1e-9, "depreciation fee");
close(L.rent, (36995 + 23200) * 0.0025, 1e-9, "rent charge");
close(L.payment, (L.dep + L.rent) * 1.07, 1e-9, "payment with tax");
close(lb._test.loanPayment(36660, 6.5, 60), 717.29, 0.01, "loan payment");
close(lb._test.balanceAfter(10000, 0, 10, 4), 6000, 1e-9, "zero-rate balance");
close(lb._test.balanceAfter(36660, 6.5, 60, 60), 0, 1e-9, "paid off");
var bal = lb._test.balanceAfter(36660, 6.5, 60, 36);
var pmt = lb._test.loanPayment(36660, 6.5, 60);
close(lb._test.balanceAfter(36660, 6.5, 60, 37), bal * (1 + 0.065 / 12) - pmt, 1e-6, "amortization step");
var lr = lb.compute(lv);
close(lr.leaseTotal, 2000 * 1.07 + L.payment * 36 + 395, 1e-6, "lease total");
close(lr.buyNet, 4000 + pmt * 36 - (23200 - bal), 1e-6, "buy net");
close(lr.path[3].buy, lr.buyNet, 1e-6, "path at lease end equals buy net");
assert.ok(lr.endH.buy < lr.endH.lease, "buying and keeping 8 years beats leasing");
renders(lb, lv);
renders(lb, defaults(lb, { term: "24", loanTerm: "84", milesDriven: 18000, endValue: 20000 }));

/* Solar */
var sp = require("../js/calc/solar-payback.js");
assert.strictEqual(Object.keys(sp._test.STATES).length, 51);
close(sp._test.npv([-100, 110], 0.1), 0, 1e-12, "NPV");
close(sp._test.irr([-100, 110]), 0.1, 1e-6, "IRR");
var sv = defaults(sp);
var f = sp._test.flows(sv, 0);
close(f.cost, 7000 * 2.75, 1e-9, "system cost");
close(f.prod0, 7 * 1421, 1e-9, "Texas production");
close(f.rows[0].saving, 7 * 1421 * 0.159, 1e-6, "first-year savings under net metering");
var reduced = sp._test.flows(defaults(sp, { metering: "reduced", selfUse: 40, exportRate: 0.06 }), 0);
close(reduced.rows[0].saving, 9947 * 0.4 * 0.159 + 9947 * 0.6 * 0.06, 1e-6, "reduced export credit");
var big = sp._test.flows(defaults(sp, { usage: 5000 }), 0);
close(big.rows[0].saving, 5000 * 0.159 + (9947 - 5000) * 0.06, 1e-6, "surplus above usage at export rate");
var sr = sp.compute(sv);
assert.ok(sr.payback > 8 && sr.payback < 14, "Texas payback plausible: " + sr.payback);
close(sp._test.npv(f.flows, sr.irr), 0, 1e-3, "IRR zeroes NPV");
var ma = sp.compute(defaults(sp, { state: "MA", rate: 0.296 }));
assert.strictEqual(ma.bestWait.wait, 0, "high-return state should install now");
assert.ok(ma.payback < sr.payback, "higher rate pays back faster");
[sv, defaults(sp, { state: "WA", rate: 0.149 }), defaults(sp, { state: "AK", rate: 0.282, costPerW: 4.5, priceDecline: 10 }), defaults(sp, { production: 6000 })].forEach(function (x) { renders(sp, x); });

console.log("calc-batch4: all tests passed");
