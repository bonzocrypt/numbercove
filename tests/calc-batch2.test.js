"use strict";
var assert = require("assert");
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), (msg || "") + ": expected " + b + ", got " + a); }

/* 401(k) */
var k = require("../js/calc/401k-match.js");
assert.strictEqual(k._test.deferralLimit(45), 24500);
assert.strictEqual(k._test.deferralLimit(55), 32500);
assert.strictEqual(k._test.deferralLimit(61), 35750);
assert.strictEqual(k._test.deferralLimit(64), 32500);
// IRS example: 50% of contributions up to 5% of $30,000 salary
var tiers = [{ rate: 50, upTo: 5 }];
close(k._test.tierMatch(tiers, 1200, 30000), 600, 1e-9, "IRS example 1");
close(k._test.tierMatch(tiers, 2000, 30000), 750, 1e-9, "IRS example 2");
close(k._test.tierMatch([{ rate: 100, upTo: 3 }, { rate: 50, upTo: 2 }], 0.06 * 100000, 100000), 4000, 1e-9, "100% of 3% + 50% of 2%");
var base = { salary: 120000, frequency: "26", age: 45, election: 25, goal: "max", tiers: [{ rate: 100, upTo: 3 }, { rate: 50, upTo: 2 }], period: "paycheck", trueUp: false, increment: "1", bonus: 0, bonusCheck: 26, deferOnBonus: true, matchOnBonus: true, paidSoFar: 0, ytd: 0, vesting: "immediate", years: 2, vestedPct: 100, employerExtra: 0 };
var r = k.compute(base);
assert.strictEqual(r.current.hitAt, 22);
close(r.current.missed, 4 * 120000 / 26 * 0.04, 0.01, "4 paychecks of match missed");
assert.strictEqual(r.maxOutPct, 21);
assert.strictEqual(r.maxOut.hitAt, 26);
close(k.compute(Object.assign({}, base, { trueUp: true })).current.match, 4800, 0.01, "true-up restores full match");
assert.strictEqual(k._test.VESTING.graded6(4), 60);
assert.strictEqual(k._test.VESTING.cliff3(2.9), 0);
var big = k.compute(Object.assign({}, base, { salary: 480000, election: 6, goal: "match" }));
close(big.maxMatch, 360000 * 0.04, 0.01, "match capped at $360,000 compensation");

/* Return to office */
var rto = require("../js/calc/return-to-office.js");
var o = rto.compute({ salary: 100000, days: 2, weeks: 50, taxRate: 25, mode: "drive", miles: 20, carCost: "detailed", mpg: 25, gas: 4, maintCents: 10, depCents: 10, tolls: 0, parking: 10, transitDay: 0, minutes: 30, timeValue: 50, childcare: 0, meals: 10, other: 0, clothes: 0, homeSavings: 0 });
// per day: fuel 20/25*4 = 3.2; wear 2; dep 2; parking 10; meals 10 = 27.2; x 100 days = 2720
close(o.cash, 2720, 1e-9, "annual cost");
close(o.raiseCash, 2720 / 0.75, 1e-9, "gross-up");
close(o.hours, 100, 1e-9, "hours: 30 min x2 x 100 days");
close(o.timeCost, 5000, 1e-9, "time at $50/hr");

/* Credit card fee */
var cc = require("../js/calc/credit-card-fee.js");
var c = cc.compute({ fee: 95, pointValue: 1, spend: [{ label: "All", spend: 10000, rate: 3 }], benefits: [], altName: "No-fee 2% card", altRate: 2, altFee: 0, altCredits: 0, bonusPoints: null, years: 3 });
close(c.keep, 300 - 95, 1e-9, "3% on 10k minus fee");
close(c.alt, 200, 1e-9, "2% card");
close(c.breakEvenSpend, 9500, 1e-9, "95 / (3% - 2%)");

/* Social Security */
var ss = require("../js/calc/social-security.js");
assert.strictEqual(ss._test.fraMonths(1960), 804);
assert.strictEqual(ss._test.fraMonths(1957), 798);
close(ss._test.factorAt(62 * 12, 804), 0.70, 1e-12, "62 with FRA 67 = 70%");
close(ss._test.factorAt(70 * 12, 804), 1.24, 1e-12, "70 with FRA 67 = 124%");
close(ss._test.factorAt(64 * 12, 804), 1 - 36 * 5 / 900, 1e-12, "36 months early = 80%");
var be = ss._test.breakEven(1000, 62 * 12, 70 * 12, 804, 0);
// 700/mo from 62 vs 1240/mo from 70: 700*(t-62) = 1240*(t-70) -> t = (1240*70 - 700*62)/540 = 80.37
close(be, 80.4166, 0.1, "62 vs 70 break-even");

/* Mortgage vs invest */
var mi = require("../js/calc/mortgage-vs-invest.js");
close(mi._test.payment(200000, 6, 360), 1199.10, 0.01, "standard payment");
var same = mi.compute({ balance: 200000, rate: 6, years: 30, extra: 300, returnPct: 6, taxDrag: 0, itemize: false, marginal: 0 });
close(same.breakEven, (Math.pow(1.005, 12) - 1) * 100, 0.01, "break-even equals the mortgage's effective annual rate (6% APR compounded monthly = 6.17%)");
console.log("batch 2 tests passed");
