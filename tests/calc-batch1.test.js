"use strict";
var assert = require("assert");
function close(a, b, tol, msg) { assert.ok(Math.abs(a - b) <= (tol || 1e-9), (msg || "") + ": expected " + b + ", got " + a); }

/* Dimensional weight */
var dw = require("../js/calc/dim-weight.js");
var C = dw._test.CARRIERS;
var r = dw._test.billOf([18, 14, 12], 9, C[0]);
assert.strictEqual(r.vol, 3024);
assert.strictEqual(r.dim, 22); // 3024/139 = 21.76 -> 22
assert.strictEqual(r.bill, 22);
assert.strictEqual(dw._test.billOf([18, 14, 12], 9, C[1]).bill, 19); // 3024/166 = 18.2 -> 19
assert.strictEqual(dw._test.billOf([11.1, 8.1, 4.1], 1, C[2]).bill, 4); // published example 12x9x5 = 540 / 139 = 3.88 -> 4
var u = dw._test.billOf([12, 12, 12], 3, C[3]);
assert.ok(u.exempt && u.bill === 3, "USPS exempt at exactly 1 cubic foot");
assert.strictEqual(dw._test.billOf([12, 12, 12.2], 3, C[3]).bill, 14); // 12x12x13 = 1872 / 139 = 13.47 -> 14

// Smallest cut: 18x14x12 at /139 billed 22 lb; 21 lb needs vol <= 2919 -> height 11 (18*14*11=2772)
var cut = dw._test.bestCut([18, 14, 12], 139 * 21, [1, 1, 1]);
assert.strictEqual(cut.cut, 1); // 17x14x12 = 2856 or 18x14x11 = 2772, both <= 2919
var full = dw.compute({ units: "imperial", length: 18, width: 14, height: 12, weight: 9, itemLength: 14, itemWidth: 10, itemHeight: 8, padding: 1, trimSide: "height", customDivisor: null, costPerLb: null });
assert.deepStrictEqual(full.fitBox.dims, [16, 12, 10]);
assert.strictEqual(full.fitBox.rows[0].r.bill, 14); // 1920/139 = 13.8 -> 14
assert.strictEqual(full.uspsCubic, null); // no single cut reaches 1,728 in3 without going under item + padding
var metric = dw.compute({ units: "metric", length: 45.72, width: 35.56, height: 30.48, weight: 4.08233, padding: 0, trimSide: "height" });
assert.deepStrictEqual(metric.rounded, [18, 14, 12]);
console.log("batch 1 tests passed");

/* Storage unit */
var su = require("../js/calc/storage-unit.js");
var s = su.compute({ rent: 100, rentIncreasePct: 10, insurance: 0, retrievalCost: 0, resaleValue: 0, replacementCost: 1000, months: 12, sellFeePct: 0, haulCost: 0, inflationPct: 0, depreciationPct: 0, cashReturnPct: 0 });
close(s.all[12].cumRent, 1200, 1e-9, "12 months at $100");
close(s.all[13].cumRent, 1310, 1e-9, "month 13 rent rises 10%");
assert.strictEqual(s.crossReplace, 10); // 10 x 100 = 1000 >= 1000
assert.strictEqual(s.crossRebuy, 11); // keep > 1000 at month 11 (1100)

/* Inventory markdown */
var im = require("../js/calc/inventory-markdown.js");
var g0 = { declinePct: 0, capitalPct: 0, holdCost: 0, perSale: 0, floor: 0, floorFee: 0 };
close(im._test.listingValue({ price: 100, chance: 50, fee: 0 }, g0, 2).ev, 75, 1e-9, "50% for 2 months");
close(im._test.listingValue({ price: 100, chance: 50, fee: 0 }, Object.assign({}, g0, { holdCost: 10 }), 2).ev, 60, 1e-9, "holding 10 then 5 expected");
var be = im._test.breakEvenChance({ price: 100, chance: 0, fee: 0 }, g0, 1, 80);
close(be, 80, 1e-6, "one month: need 80% to match $80");

/* Max buy price */
var mb = require("../js/calc/max-buy-price.js");
var b = mb._test.breakdown({ platform: "ebay", shipCharged: 0, shipCost: 9, supplies: 1, promoPct: 0, returnsPct: 0, minutes: 0, hourly: 0, goal: "roi", target: 50, salesTaxPct: 0 }, 60);
close(b.fees, 60 * 0.136 + 0.4, 1e-9, "eBay fee on $60");
close(b.net, 60 - 8.56 - 10, 1e-9, "net");
close(b.maxCost, (60 - 8.56 - 10) / 1.5, 1e-9, "max cost at 50% ROI");
var bm = mb._test.breakdown({ platform: "poshmark", shipCharged: 0, shipCost: 0, supplies: 0, goal: "margin", target: 25, salesTaxPct: 10 }, 100);
close(bm.maxCost, 100 - 20 - 25, 1e-9, "Poshmark 20% and 25% margin");
close(bm.maxBid, 55 / 1.1, 1e-9, "before 10% tax");
console.log("batch 1 extra tests passed");
