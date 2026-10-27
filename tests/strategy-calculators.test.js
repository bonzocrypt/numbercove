"use strict";

var assert = require("assert");
var calc = require("../js/strategy-calculators.js");

function close(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= (tolerance || 1e-9),
    (message || "values differ") + ": expected " + expected + ", received " + actual);
}

var coveredCall = calc.incomeStrategy({
  type: "call",
  stockPrice: 52,
  costBasis: 50,
  strike: 55,
  premium: 2,
  days: 30,
  contracts: 1,
  fees: 0,
  dividendPerShare: 0,
  scenarioPrice: 60,
  ivPct: 30,
  ratePct: 4,
  dividendYieldPct: 0,
});
close(coveredCall.netPremium, 200);
close(coveredCall.breakeven, 48);
close(coveredCall.maxProfit, 700);
close(coveredCall.maxLoss, 4800);
close(coveredCall.scenarioProfit, 700);
close(coveredCall.upsideForegone, 500);

var cashPut = calc.incomeStrategy({
  type: "put",
  stockPrice: 50,
  costBasis: 50,
  strike: 45,
  premium: 1.5,
  days: 30,
  contracts: 1,
  fees: 0,
  dividendPerShare: 0,
  scenarioPrice: 40,
  ivPct: 30,
  ratePct: 4,
  dividendYieldPct: 0,
});
close(cashPut.netPremium, 150);
close(cashPut.breakeven, 43.5);
close(cashPut.maxProfit, 150);
close(cashPut.maxLoss, 4350);
close(cashPut.scenarioProfit, -350);
close(cashPut.incomeReturn, 1.5 / 45);

var move = calc.expectedMove({
  spot: 100,
  days: 365,
  ivPct: 20,
  callPrice: 4,
  putPrice: 4,
  straddleFactor: 0.85,
  targetPrice: 120,
});
close(move.ivMove, 20);
close(move.straddleCost, 8);
close(move.straddleMove, 6.8);
close(move.targetSigma, 1);
close(move.linearLower, 80);
close(move.linearUpper, 120);

var wheelPut = calc.wheelCampaign({
  phase: "put",
  contracts: 1,
  stockPrice: 50,
  stockBasis: 50,
  strike: 48,
  premium: 1.5,
  priorCredits: 200,
  fees: 1,
  dividends: 0,
  days: 30,
  scenarioPrice: 44,
});
close(wheelPut.currentNetPremium, 149);
close(wheelPut.totalCredits, 349);
close(wheelPut.economicBreakeven, 44.51);
close(wheelPut.scenarioProfit, -51);

var wheelCall = calc.wheelCampaign({
  phase: "call",
  contracts: 1,
  stockPrice: 50,
  stockBasis: 45,
  strike: 52,
  premium: 1.5,
  priorCredits: 300,
  fees: 0,
  dividends: 0,
  days: 30,
  scenarioPrice: 55,
});
close(wheelCall.totalCredits, 450);
close(wheelCall.economicBreakeven, 40.5);
close(wheelCall.outcomeProfit, 1150);

var rolledCall = calc.rollAnalysis({
  type: "call",
  contracts: 1,
  stockPrice: 54,
  stockBasis: 45,
  oldStrike: 52,
  newStrike: 55,
  closePrice: 1.5,
  openPrice: 2.5,
  oldDays: 7,
  newDays: 37,
  priorCredits: 400,
  fees: 2,
  scenarioPrice: 58,
});
close(rolledCall.netRollCredit, 98);
close(rolledCall.totalCredits, 498);
close(rolledCall.newOutcome, 1498);
close(rolledCall.oldOutcome, 1100);
close(rolledCall.outcomeImprovement, 398);
close(rolledCall.extensionDays, 30);

console.log("strategy calculator tests passed");
