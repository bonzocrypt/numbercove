(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NumberCoveStrategyCalculators = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var CONTRACT_MULTIPLIER = 100;

  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function annualize(simpleReturn, days) {
    if (!Number.isFinite(simpleReturn) || days <= 0 || simpleReturn <= -1) return NaN;
    return Math.pow(1 + simpleReturn, 365 / days) - 1;
  }

  function normalCdf(x) {
    var sign = x < 0 ? -1 : 1;
    var z = Math.abs(x) / Math.sqrt(2);
    var t = 1 / (1 + 0.3275911 * z);
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var erf = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    return 0.5 * (1 + sign * erf);
  }

  function finishItmProbability(spot, strike, ivPct, days, ratePct, dividendYieldPct, type) {
    var sigma = ivPct / 100;
    var time = days / 365;
    if (spot <= 0 || strike <= 0 || sigma <= 0 || time <= 0) return NaN;
    var rate = (ratePct || 0) / 100;
    var dividend = (dividendYieldPct || 0) / 100;
    var d2 = (Math.log(spot / strike) + (rate - dividend - 0.5 * sigma * sigma) * time) /
      (sigma * Math.sqrt(time));
    return type === "put" ? normalCdf(-d2) : normalCdf(d2);
  }

  function incomeStrategy(input) {
    var type = input.type === "put" ? "put" : "call";
    var stockPrice = finite(input.stockPrice);
    var costBasis = finite(input.costBasis);
    var strike = finite(input.strike);
    var premium = finite(input.premium);
    var days = finite(input.days);
    var contracts = finite(input.contracts);
    var fees = finite(input.fees || 0);
    var dividendPerShare = finite(input.dividendPerShare || 0);
    var scenarioPrice = finite(input.scenarioPrice);
    var ivPct = finite(input.ivPct);
    var ratePct = finite(input.ratePct || 0);
    var dividendYieldPct = finite(input.dividendYieldPct || 0);
    var shares = contracts * CONTRACT_MULTIPLIER;
    var grossPremium = premium * shares;
    var netPremium = grossPremium - fees;
    var netPremiumPerShare = netPremium / shares;
    var dividends = type === "call" ? dividendPerShare * shares : 0;
    var breakeven;
    var maxProfit;
    var maxLoss;
    var capital;
    var scenarioProfit;
    var flatProfit;
    var upsideForegone = 0;
    var effectivePurchase = NaN;

    if (type === "call") {
      capital = costBasis * shares;
      breakeven = costBasis - netPremiumPerShare - dividendPerShare;
      maxProfit = (strike - costBasis) * shares + netPremium + dividends;
      maxLoss = Math.max(0, capital - netPremium - dividends);
      scenarioProfit = (Math.min(scenarioPrice, strike) - costBasis) * shares + netPremium + dividends;
      flatProfit = (Math.min(stockPrice, strike) - costBasis) * shares + netPremium + dividends;
      upsideForegone = Math.max(0, scenarioPrice - strike) * shares;
    } else {
      capital = strike * shares;
      breakeven = strike - netPremiumPerShare;
      effectivePurchase = breakeven;
      maxProfit = netPremium;
      maxLoss = Math.max(0, capital - netPremium);
      scenarioProfit = netPremium - Math.max(0, strike - scenarioPrice) * shares;
      flatProfit = netPremium - Math.max(0, strike - stockPrice) * shares;
    }

    var incomeReturn = netPremium / capital;
    var maxReturn = maxProfit / capital;
    var scenarioReturn = scenarioProfit / capital;
    var probabilityItm = finishItmProbability(
      stockPrice,
      strike,
      ivPct,
      days,
      ratePct,
      dividendYieldPct,
      type
    );

    return {
      type: type,
      shares: shares,
      grossPremium: grossPremium,
      netPremium: netPremium,
      netPremiumPerShare: netPremiumPerShare,
      dividends: dividends,
      capital: capital,
      breakeven: breakeven,
      effectivePurchase: effectivePurchase,
      maxProfit: maxProfit,
      maxLoss: maxLoss,
      incomeReturn: incomeReturn,
      annualizedIncomeReturn: annualize(incomeReturn, days),
      maxReturn: maxReturn,
      annualizedMaxReturn: annualize(maxReturn, days),
      flatProfit: flatProfit,
      scenarioProfit: scenarioProfit,
      scenarioReturn: scenarioReturn,
      upsideForegone: upsideForegone,
      downsideCushion: type === "call" ? (netPremium + dividends) / capital : (stockPrice - breakeven) / stockPrice,
      probabilityItm: probabilityItm,
      days: days,
      strike: strike,
      stockPrice: stockPrice,
      costBasis: costBasis,
      scenarioPrice: scenarioPrice,
    };
  }

  function incomeProfitAt(result, price) {
    if (result.type === "call") {
      return (Math.min(price, result.strike) - result.costBasis) * result.shares +
        result.netPremium + result.dividends;
    }
    return result.netPremium - Math.max(0, result.strike - price) * result.shares;
  }

  function expectedMove(input) {
    var spot = finite(input.spot);
    var days = finite(input.days);
    var ivPct = finite(input.ivPct);
    var callPrice = finite(input.callPrice || 0);
    var putPrice = finite(input.putPrice || 0);
    var straddleFactor = finite(input.straddleFactor || 0.85);
    var targetPrice = finite(input.targetPrice);
    var time = days / 365;
    var ivMove = spot * (ivPct / 100) * Math.sqrt(time);
    var ivMovePct = ivMove / spot;
    var logMove = (ivPct / 100) * Math.sqrt(time);
    var straddleCost = callPrice + putPrice;
    var straddleMove = straddleCost * straddleFactor;
    var targetMove = Number.isFinite(targetPrice) ? Math.abs(targetPrice - spot) : NaN;
    var targetSigma = ivMove > 0 && Number.isFinite(targetMove) ? targetMove / ivMove : NaN;
    var probabilityAtLeastTarget = Number.isFinite(targetSigma)
      ? clamp(2 * (1 - normalCdf(targetSigma)), 0, 1)
      : NaN;

    return {
      spot: spot,
      days: days,
      ivPct: ivPct,
      ivMove: ivMove,
      ivMovePct: ivMovePct,
      linearLower: Math.max(0, spot - ivMove),
      linearUpper: spot + ivMove,
      lognormalLower: spot * Math.exp(-logMove),
      lognormalUpper: spot * Math.exp(logMove),
      twoSigmaMove: ivMove * 2,
      twoSigmaLower: Math.max(0, spot - ivMove * 2),
      twoSigmaUpper: spot + ivMove * 2,
      dailyMove: spot * (ivPct / 100) / Math.sqrt(365),
      straddleCost: straddleCost,
      straddleMove: straddleMove,
      straddleMovePct: straddleMove / spot,
      straddleLower: Math.max(0, spot - straddleMove),
      straddleUpper: spot + straddleMove,
      straddleBreakevenLower: Math.max(0, spot - straddleCost),
      straddleBreakevenUpper: spot + straddleCost,
      targetPrice: targetPrice,
      targetMove: targetMove,
      targetMovePct: targetMove / spot,
      targetSigma: targetSigma,
      probabilityAtLeastTarget: probabilityAtLeastTarget,
      straddleFactor: straddleFactor,
    };
  }

  function expectedMoveForDays(spot, ivPct, days) {
    return spot * (ivPct / 100) * Math.sqrt(days / 365);
  }

  function wheelCampaign(input) {
    var phase = input.phase === "call" ? "call" : "put";
    var contracts = finite(input.contracts);
    var shares = contracts * CONTRACT_MULTIPLIER;
    var stockPrice = finite(input.stockPrice);
    var stockBasis = finite(input.stockBasis);
    var strike = finite(input.strike);
    var premium = finite(input.premium);
    var priorCredits = finite(input.priorCredits || 0);
    var fees = finite(input.fees || 0);
    var dividends = finite(input.dividends || 0);
    var days = finite(input.days);
    var scenarioPrice = finite(input.scenarioPrice);
    var currentNetPremium = premium * shares - fees;
    var totalCredits = priorCredits + currentNetPremium;
    var economicBreakeven;
    var capital;
    var scenarioProfit;
    var outcomeProfit;
    var maxLoss;

    if (phase === "put") {
      capital = strike * shares;
      economicBreakeven = strike - totalCredits / shares;
      scenarioProfit = totalCredits - Math.max(0, strike - scenarioPrice) * shares;
      outcomeProfit = totalCredits;
      maxLoss = Math.max(0, capital - totalCredits);
    } else {
      capital = stockBasis * shares;
      economicBreakeven = stockBasis - (totalCredits + dividends) / shares;
      scenarioProfit = (Math.min(scenarioPrice, strike) - stockBasis) * shares + totalCredits + dividends;
      outcomeProfit = (strike - stockBasis) * shares + totalCredits + dividends;
      maxLoss = Math.max(0, capital - totalCredits - dividends);
    }

    var currentYield = currentNetPremium / capital;
    return {
      phase: phase,
      shares: shares,
      stockPrice: stockPrice,
      stockBasis: stockBasis,
      strike: strike,
      currentNetPremium: currentNetPremium,
      priorCredits: priorCredits,
      totalCredits: totalCredits,
      dividends: dividends,
      capital: capital,
      economicBreakeven: economicBreakeven,
      scenarioPrice: scenarioPrice,
      scenarioProfit: scenarioProfit,
      outcomeProfit: outcomeProfit,
      maxLoss: maxLoss,
      currentYield: currentYield,
      annualizedCurrentYield: annualize(currentYield, days),
      campaignYield: totalCredits / capital,
      days: days,
    };
  }

  function rollAnalysis(input) {
    var type = input.type === "put" ? "put" : "call";
    var contracts = finite(input.contracts);
    var shares = contracts * CONTRACT_MULTIPLIER;
    var stockPrice = finite(input.stockPrice);
    var stockBasis = finite(input.stockBasis);
    var oldStrike = finite(input.oldStrike);
    var newStrike = finite(input.newStrike);
    var closePrice = finite(input.closePrice);
    var openPrice = finite(input.openPrice);
    var oldDays = finite(input.oldDays);
    var newDays = finite(input.newDays);
    var priorCredits = finite(input.priorCredits || 0);
    var fees = finite(input.fees || 0);
    var scenarioPrice = finite(input.scenarioPrice);
    var closeDebit = closePrice * shares;
    var openCredit = openPrice * shares;
    var netRollCredit = openCredit - closeDebit - fees;
    var totalCredits = priorCredits + netRollCredit;
    var extensionDays = newDays - oldDays;
    var oldOutcome;
    var newOutcome;
    var oldBreakeven;
    var newBreakeven;
    var scenarioProfit;
    var capital;

    if (type === "put") {
      oldBreakeven = oldStrike - priorCredits / shares;
      newBreakeven = newStrike - totalCredits / shares;
      oldOutcome = priorCredits;
      newOutcome = totalCredits;
      scenarioProfit = totalCredits - Math.max(0, newStrike - scenarioPrice) * shares;
      capital = newStrike * shares;
    } else {
      oldBreakeven = stockBasis - priorCredits / shares;
      newBreakeven = stockBasis - totalCredits / shares;
      oldOutcome = (oldStrike - stockBasis) * shares + priorCredits;
      newOutcome = (newStrike - stockBasis) * shares + totalCredits;
      scenarioProfit = (Math.min(scenarioPrice, newStrike) - stockBasis) * shares + totalCredits;
      capital = stockBasis * shares;
    }

    var rollReturn = netRollCredit / capital;
    return {
      type: type,
      shares: shares,
      stockPrice: stockPrice,
      stockBasis: stockBasis,
      oldStrike: oldStrike,
      newStrike: newStrike,
      closeDebit: closeDebit,
      openCredit: openCredit,
      netRollCredit: netRollCredit,
      netRollPerShare: netRollCredit / shares,
      priorCredits: priorCredits,
      totalCredits: totalCredits,
      extensionDays: extensionDays,
      oldDays: oldDays,
      newDays: newDays,
      creditPerAddedDay: extensionDays > 0 ? netRollCredit / extensionDays : NaN,
      oldBreakeven: oldBreakeven,
      newBreakeven: newBreakeven,
      oldOutcome: oldOutcome,
      newOutcome: newOutcome,
      outcomeImprovement: newOutcome - oldOutcome,
      scenarioPrice: scenarioPrice,
      scenarioProfit: scenarioProfit,
      capital: capital,
      rollReturn: rollReturn,
      annualizedRollReturn: netRollCredit > 0 && extensionDays > 0
        ? annualize(rollReturn, extensionDays)
        : NaN,
    };
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;");
  }

  function money(value) {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function signedMoney(value) {
    if (!Number.isFinite(value)) return "—";
    return (value > 0 ? "+" : "") + money(value);
  }

  function percent(value, digits) {
    if (!Number.isFinite(value)) return "—";
    var d = digits == null ? 1 : digits;
    return (value * 100).toLocaleString(undefined, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + "%";
  }

  function number(value, digits) {
    if (!Number.isFinite(value)) return "—";
    return value.toLocaleString(undefined, {
      minimumFractionDigits: digits == null ? 2 : digits,
      maximumFractionDigits: digits == null ? 2 : digits,
    });
  }

  function hero(label, value, sub) {
    return '<div class="result-hero"><p class="label">' + escapeHtml(label) +
      '</p><p class="value">' + value + '</p>' +
      (sub ? '<p class="sub">' + sub + '</p>' : "") + '</div>';
  }

  function stats(rows) {
    return '<div class="stat-grid">' + rows.map(function (row) {
      return '<div class="stat"><span class="label">' + escapeHtml(row[0]) +
        '</span><span class="value">' + row[1] + '</span></div>';
    }).join("") + '</div>';
  }

  function table(headers, rows) {
    return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (header, index) {
      return '<th' + (index ? ' class="num"' : "") + '>' + escapeHtml(header) + '</th>';
    }).join("") + '</tr></thead><tbody>' + rows.map(function (row) {
      return '<tr>' + row.map(function (cell, index) {
        return '<td' + (index ? ' class="num"' : "") + '>' + cell + '</td>';
      }).join("") + '</tr>';
    }).join("") + '</tbody></table></div>';
  }

  function payoffChart(result) {
    var minPrice = Math.max(0, Math.min(result.stockPrice, result.strike, result.breakeven) * 0.55);
    var maxPrice = Math.max(result.stockPrice, result.strike, result.scenarioPrice) * 1.45;
    if (maxPrice <= minPrice) maxPrice = minPrice + 1;
    var points = [];
    var profits = [];
    var i;
    for (i = 0; i <= 32; i += 1) {
      var price = minPrice + (maxPrice - minPrice) * i / 32;
      var profit = incomeProfitAt(result, price);
      points.push({ price: price, profit: profit });
      profits.push(profit);
    }
    profits.push(0);
    var minProfit = Math.min.apply(Math, profits);
    var maxProfit = Math.max.apply(Math, profits);
    if (maxProfit === minProfit) maxProfit = minProfit + 1;
    var width = 620;
    var height = 230;
    var left = 54;
    var right = 18;
    var top = 18;
    var bottom = 40;
    function x(price) { return left + (price - minPrice) / (maxPrice - minPrice) * (width - left - right); }
    function y(profit) { return top + (maxProfit - profit) / (maxProfit - minProfit) * (height - top - bottom); }
    var path = points.map(function (point, index) {
      return (index ? "L" : "M") + x(point.price).toFixed(1) + " " + y(point.profit).toFixed(1);
    }).join(" ");
    var zeroY = y(0);
    var scenarioX = x(clamp(result.scenarioPrice, minPrice, maxPrice));
    var scenarioY = y(incomeProfitAt(result, clamp(result.scenarioPrice, minPrice, maxPrice)));
    return '<div class="strategy-chart" role="img" aria-label="Expiration profit and loss across underlying prices">' +
      '<svg viewBox="0 0 ' + width + ' ' + height + '" aria-hidden="true">' +
      '<line class="strategy-chart-grid" x1="' + left + '" y1="' + zeroY.toFixed(1) + '" x2="' + (width - right) + '" y2="' + zeroY.toFixed(1) + '" />' +
      '<path class="strategy-chart-line" d="' + path + '" />' +
      '<circle class="strategy-chart-dot" cx="' + scenarioX.toFixed(1) + '" cy="' + scenarioY.toFixed(1) + '" r="5" />' +
      '<text class="strategy-chart-label" x="' + left + '" y="' + (height - 12) + '">' + money(minPrice) + '</text>' +
      '<text class="strategy-chart-label" text-anchor="end" x="' + (width - right) + '" y="' + (height - 12) + '">' + money(maxPrice) + '</text>' +
      '<text class="strategy-chart-label" x="6" y="' + Math.max(12, zeroY - 5).toFixed(1) + '">$0</text>' +
      '</svg></div>';
  }

  function formNumber(form, name) {
    var el = form.elements[name];
    return el ? finite(String(el.value).replace(/,/g, "")) : NaN;
  }

  function checkedValue(form, name) {
    var el = form.querySelector('[name="' + name + '"]:checked');
    return el ? el.value : "";
  }

  function validateNumber(C, form, name, label, options) {
    options = options || {};
    var value = formNumber(form, name);
    var el = form.elements[name];
    if (!Number.isFinite(value)) {
      C.setFieldError(el, "Enter " + label + ".");
      return null;
    }
    if (options.gt != null && value <= options.gt) {
      C.setFieldError(el, label + " must be greater than " + options.gt + ".");
      return null;
    }
    if (options.min != null && value < options.min) {
      C.setFieldError(el, label + " must be at least " + options.min + ".");
      return null;
    }
    if (options.max != null && value > options.max) {
      C.setFieldError(el, label + " must be at most " + options.max + ".");
      return null;
    }
    el.setAttribute("aria-invalid", "false");
    return value;
  }

  function incomeFromForm(C, form) {
    var type = checkedValue(form, "strategy") || "call";
    var stockPrice = validateNumber(C, form, "stockPrice", "the current stock price", { gt: 0 });
    var costBasis = type === "call"
      ? validateNumber(C, form, "costBasis", "the stock cost basis", { gt: 0 })
      : stockPrice;
    var strike = validateNumber(C, form, "strike", "the strike price", { gt: 0 });
    var premium = validateNumber(C, form, "premium", "the option premium", { min: 0 });
    var days = validateNumber(C, form, "days", "days to expiration", { gt: 0, max: 1825 });
    var contracts = validateNumber(C, form, "contracts", "the contract count", { gt: 0, max: 10000 });
    var fees = validateNumber(C, form, "fees", "total fees", { min: 0 });
    var scenarioPrice = validateNumber(C, form, "scenarioPrice", "the expiration stock price", { min: 0 });
    var dividendPerShare = type === "call"
      ? validateNumber(C, form, "dividendPerShare", "expected dividends", { min: 0 })
      : 0;
    var ivPct = validateNumber(C, form, "ivPct", "implied volatility", { gt: 0, max: 1000 });
    var ratePct = validateNumber(C, form, "ratePct", "the risk-free rate", { min: -10, max: 100 });
    var dividendYieldPct = validateNumber(C, form, "dividendYieldPct", "the dividend yield", { min: 0, max: 100 });
    if ([stockPrice, costBasis, strike, premium, days, contracts, fees, scenarioPrice, dividendPerShare, ivPct, ratePct, dividendYieldPct].some(function (x) { return x == null; })) return null;
    if (Math.floor(contracts) !== contracts) {
      C.setFieldError(form.elements.contracts, "Contract count must be a whole number.");
      return null;
    }
    return incomeStrategy({
      type: type,
      stockPrice: stockPrice,
      costBasis: costBasis,
      strike: strike,
      premium: premium,
      days: days,
      contracts: contracts,
      fees: fees,
      dividendPerShare: dividendPerShare,
      scenarioPrice: scenarioPrice,
      ivPct: ivPct,
      ratePct: ratePct,
      dividendYieldPct: dividendYieldPct,
    });
  }

  function renderIncome(result) {
    var isCall = result.type === "call";
    var headline = isCall ? "Maximum profit if called away" : "Net premium if the put expires";
    var headlineValue = isCall ? result.maxProfit : result.netPremium;
    var probabilityLabel = isCall ? "Estimated finish above strike" : "Estimated finish below strike";
    var prices = [
      Math.max(0, result.stockPrice * 0.75),
      result.breakeven,
      result.strike,
      result.stockPrice,
      result.scenarioPrice,
      result.stockPrice * 1.25,
    ].filter(function (value, index, values) {
      return value >= 0 && values.findIndex(function (other) { return Math.abs(other - value) < 0.005; }) === index;
    }).sort(function (a, b) { return a - b; });
    var rows = prices.map(function (price) {
      var profit = incomeProfitAt(result, price);
      var outcome;
      if (isCall) outcome = price >= result.strike ? "Shares called away" : "Keep shares";
      else outcome = price < result.strike ? "Likely assigned" : "Put expires OTM";
      return [money(price), signedMoney(profit), percent(profit / result.capital), escapeHtml(outcome)];
    });
    var html = hero(
      headline,
      signedMoney(headlineValue),
      result.shares.toLocaleString() + " shares · " + money(result.netPremium) + " net premium"
    );
    html += stats([
      ["Breakeven at expiration", money(result.breakeven)],
      [isCall ? "Return if called away" : "Premium return on cash", percent(isCall ? result.maxReturn : result.incomeReturn)],
      [isCall ? "Annualized called return" : "Annualized premium return", percent(isCall ? result.annualizedMaxReturn : result.annualizedIncomeReturn)],
      ["Maximum loss if stock reaches $0", money(result.maxLoss)],
      ["P&L at your scenario", signedMoney(result.scenarioProfit)],
      [probabilityLabel, percent(result.probabilityItm)],
    ]);
    html += '<p class="callout' + (result.scenarioProfit < 0 ? ' warn' : '') + '">' +
      (isCall
        ? "At " + money(result.scenarioPrice) + ", the position is " + signedMoney(result.scenarioProfit) +
          ". The call caps stock appreciation above " + money(result.strike) +
          ", leaving " + money(result.upsideForegone) + " of additional share upside outside this strategy."
        : "At " + money(result.scenarioPrice) + ", the put position is " + signedMoney(result.scenarioProfit) +
          ". If assigned, the premium-adjusted purchase price is " + money(result.effectivePurchase) + " per share.") +
      '</p>';
    html += '<h3>Expiration payoff</h3>' + payoffChart(result);
    html += table(["Stock at expiration", "Profit / loss", "Return", "Likely outcome"], rows);
    html += '<p class="result-note">The finish-ITM estimate uses a risk-neutral lognormal model and the IV, rate, and dividend yield entered. It is not the probability of a profitable trade or a forecast.</p>';
    var copy = [
      (isCall ? "Covered call" : "Cash-secured put") + " — NumberCove",
      "Net premium: " + money(result.netPremium),
      "Breakeven: " + money(result.breakeven),
      (isCall ? "Maximum profit if called: " : "Maximum premium profit: ") + money(headlineValue),
      "Maximum loss at $0: " + money(result.maxLoss),
      "Scenario P&L at " + money(result.scenarioPrice) + ": " + signedMoney(result.scenarioProfit),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function expectedMoveFromForm(C, form) {
    var spot = validateNumber(C, form, "spot", "the stock price", { gt: 0 });
    var days = validateNumber(C, form, "days", "days to expiration", { gt: 0, max: 1825 });
    var ivPct = validateNumber(C, form, "ivPct", "implied volatility", { gt: 0, max: 1000 });
    var callPrice = validateNumber(C, form, "callPrice", "the ATM call price", { min: 0 });
    var putPrice = validateNumber(C, form, "putPrice", "the ATM put price", { min: 0 });
    var straddleFactor = validateNumber(C, form, "straddleFactor", "the straddle factor", { gt: 0, max: 2 });
    var targetRaw = String(form.elements.targetPrice.value || "").trim();
    var targetPrice = targetRaw ? validateNumber(C, form, "targetPrice", "the target price", { min: 0 }) : NaN;
    if ([spot, days, ivPct, callPrice, putPrice, straddleFactor].some(function (x) { return x == null; }) || targetPrice == null) return null;
    return expectedMove({
      spot: spot,
      days: days,
      ivPct: ivPct,
      callPrice: callPrice,
      putPrice: putPrice,
      straddleFactor: straddleFactor,
      targetPrice: targetPrice,
    });
  }

  function renderExpectedMove(result) {
    var periods = [1, 7, 14, 21, 30, 45, 60, 90, Math.round(result.days)]
      .filter(function (value, index, values) { return value > 0 && values.indexOf(value) === index; })
      .sort(function (a, b) { return a - b; });
    var rows = periods.map(function (days) {
      var move = expectedMoveForDays(result.spot, result.ivPct, days);
      return [days.toLocaleString(), money(move), percent(move / result.spot), money(Math.max(0, result.spot - move)) + " to " + money(result.spot + move)];
    });
    var html = hero(
      "IV-based one-standard-deviation move",
      "±" + money(result.ivMove),
      percent(result.ivMovePct) + " · " + money(result.linearLower) + " to " + money(result.linearUpper)
    );
    html += stats([
      ["Daily IV move", "±" + money(result.dailyMove)],
      ["Two-standard-deviation move", "±" + money(result.twoSigmaMove)],
      ["ATM straddle cost", money(result.straddleCost)],
      ["Straddle estimate (" + number(result.straddleFactor * 100, 0) + "%)", "±" + money(result.straddleMove)],
      ["Straddle estimated range", money(result.straddleLower) + " – " + money(result.straddleUpper)],
      ["Long-straddle breakevens", money(result.straddleBreakevenLower) + " / " + money(result.straddleBreakevenUpper)],
    ]);
    html += '<div class="range-visual" aria-label="Expected price ranges"><div class="range-track">' +
      '<span class="range-two" style="left:5%;right:5%"></span>' +
      '<span class="range-one" style="left:27%;right:27%"></span>' +
      '<span class="range-spot" style="left:50%"></span></div>' +
      '<div class="range-labels"><span>' + money(result.twoSigmaLower) + '</span><span>' + money(result.spot) + '</span><span>' + money(result.twoSigmaUpper) + '</span></div>' +
      '<p class="hint">Outer band: approximately ±2σ. Inner band: approximately ±1σ.</p></div>';
    if (Number.isFinite(result.targetPrice)) {
      html += '<p class="callout' + (result.targetSigma >= 2 ? ' warn' : '') + '">A move from ' + money(result.spot) +
        ' to ' + money(result.targetPrice) + ' is ' + number(result.targetSigma, 2) +
        ' standard deviations using the entered IV. Under a simplified normal model, the approximate two-sided chance of a move at least that large is ' +
        percent(result.probabilityAtLeastTarget) + '.</p>';
    }
    html += '<h3>IV move by time remaining</h3>' + table(["Calendar days", "Expected move", "Move %", "Approximate range"], rows);
    html += '<p class="result-note">IV-based ranges use spot × IV × √(calendar days ÷ 365). The straight-line range is easy to interpret; the lognormal comparison for the entered period is ' +
      money(result.lognormalLower) + ' to ' + money(result.lognormalUpper) + '. Neither range predicts direction.</p>';
    var copy = [
      "Expected move — NumberCove",
      "Stock price: " + money(result.spot),
      "IV: " + number(result.ivPct, 1) + "%",
      "Days: " + number(result.days, 0),
      "IV one-standard-deviation move: ±" + money(result.ivMove) + " (" + percent(result.ivMovePct) + ")",
      "IV range: " + money(result.linearLower) + " to " + money(result.linearUpper),
      "Straddle estimate: ±" + money(result.straddleMove),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function wheelFromForm(C, form) {
    var phase = checkedValue(form, "phase") || "put";
    var contracts = validateNumber(C, form, "contracts", "the contract count", { gt: 0, max: 10000 });
    var stockPrice = validateNumber(C, form, "stockPrice", "the current stock price", { gt: 0 });
    var stockBasis = phase === "call" ? validateNumber(C, form, "stockBasis", "the share cost basis", { gt: 0 }) : stockPrice;
    var strike = validateNumber(C, form, "strike", "the strike price", { gt: 0 });
    var premium = validateNumber(C, form, "premium", "the current premium", { min: 0 });
    var priorCredits = validateNumber(C, form, "priorCredits", "prior net credits");
    var fees = validateNumber(C, form, "fees", "current trade fees", { min: 0 });
    var dividends = phase === "call" ? validateNumber(C, form, "dividends", "campaign dividends", { min: 0 }) : 0;
    var days = validateNumber(C, form, "days", "days to expiration", { gt: 0, max: 1825 });
    var scenarioPrice = validateNumber(C, form, "scenarioPrice", "the expiration stock price", { min: 0 });
    if ([contracts, stockPrice, stockBasis, strike, premium, priorCredits, fees, dividends, days, scenarioPrice].some(function (x) { return x == null; })) return null;
    if (Math.floor(contracts) !== contracts) {
      C.setFieldError(form.elements.contracts, "Contract count must be a whole number.");
      return null;
    }
    return wheelCampaign({
      phase: phase,
      contracts: contracts,
      stockPrice: stockPrice,
      stockBasis: stockBasis,
      strike: strike,
      premium: premium,
      priorCredits: priorCredits,
      fees: fees,
      dividends: dividends,
      days: days,
      scenarioPrice: scenarioPrice,
    });
  }

  function renderWheel(result) {
    var isPut = result.phase === "put";
    var html = hero(
      isPut ? "Premium-adjusted assignment price" : "Economic share breakeven",
      money(result.economicBreakeven),
      money(result.totalCredits) + " total campaign credits across " + result.shares.toLocaleString() + " shares"
    );
    html += stats([
      ["Current trade net premium", money(result.currentNetPremium)],
      ["Current premium return", percent(result.currentYield)],
      ["Annualized current return", percent(result.annualizedCurrentYield)],
      ["Total campaign credits", money(result.totalCredits)],
      [isPut ? "Profit if put expires OTM" : "Profit if shares are called", signedMoney(result.outcomeProfit)],
      ["P&L at your scenario", signedMoney(result.scenarioProfit)],
    ]);
    html += '<p class="callout' + (result.scenarioProfit < 0 ? ' warn' : '') + '">' +
      (isPut
        ? "At " + money(result.scenarioPrice) + ", the campaign is " + signedMoney(result.scenarioProfit) +
          ". Assignment would buy " + result.shares.toLocaleString() + " shares at " + money(result.strike) +
          ", with an economic entry of " + money(result.economicBreakeven) + " after all entered credits."
        : "At " + money(result.scenarioPrice) + ", the campaign is " + signedMoney(result.scenarioProfit) +
          ". If assigned at " + money(result.strike) + ", total campaign profit is " + signedMoney(result.outcomeProfit) + ".") +
      '</p>';
    html += table(
      ["Campaign measure", "Amount"],
      [
        ["Capital reference", money(result.capital)],
        ["Prior net option credits", money(result.priorCredits)],
        ["Current net option credit", money(result.currentNetPremium)],
        ["Campaign credits as % of capital", percent(result.campaignYield)],
        ["Maximum loss if stock reaches $0", money(result.maxLoss)],
      ]
    );
    html += '<p class="result-note">Economic breakeven allocates prior premiums and dividends to this campaign. It is not the tax basis reported by a broker and does not account for wash-sale, straddle, holding-period, or assignment tax rules.</p>';
    var copy = [
      (isPut ? "Wheel — cash-secured put phase" : "Wheel — covered call phase") + " — NumberCove",
      "Current net premium: " + money(result.currentNetPremium),
      "Total campaign credits: " + money(result.totalCredits),
      "Economic breakeven: " + money(result.economicBreakeven),
      "Scenario P&L at " + money(result.scenarioPrice) + ": " + signedMoney(result.scenarioProfit),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function rollFromForm(C, form) {
    var type = checkedValue(form, "optionType") || "call";
    var contracts = validateNumber(C, form, "rollContracts", "the contract count", { gt: 0, max: 10000 });
    var stockPrice = validateNumber(C, form, "rollStockPrice", "the current stock price", { gt: 0 });
    var stockBasis = type === "call" ? validateNumber(C, form, "rollStockBasis", "the share cost basis", { gt: 0 }) : stockPrice;
    var oldStrike = validateNumber(C, form, "oldStrike", "the old strike", { gt: 0 });
    var newStrike = validateNumber(C, form, "newStrike", "the new strike", { gt: 0 });
    var closePrice = validateNumber(C, form, "closePrice", "the buy-to-close price", { min: 0 });
    var openPrice = validateNumber(C, form, "openPrice", "the sell-to-open price", { min: 0 });
    var oldDays = validateNumber(C, form, "oldDays", "old days to expiration", { min: 0, max: 1825 });
    var newDays = validateNumber(C, form, "newDays", "new days to expiration", { gt: 0, max: 1825 });
    var priorCredits = validateNumber(C, form, "rollPriorCredits", "credits before the roll");
    var fees = validateNumber(C, form, "rollFees", "roll fees", { min: 0 });
    var scenarioPrice = validateNumber(C, form, "rollScenarioPrice", "the new-expiration stock price", { min: 0 });
    if ([contracts, stockPrice, stockBasis, oldStrike, newStrike, closePrice, openPrice, oldDays, newDays, priorCredits, fees, scenarioPrice].some(function (x) { return x == null; })) return null;
    if (Math.floor(contracts) !== contracts) {
      C.setFieldError(form.elements.rollContracts, "Contract count must be a whole number.");
      return null;
    }
    return rollAnalysis({
      type: type,
      contracts: contracts,
      stockPrice: stockPrice,
      stockBasis: stockBasis,
      oldStrike: oldStrike,
      newStrike: newStrike,
      closePrice: closePrice,
      openPrice: openPrice,
      oldDays: oldDays,
      newDays: newDays,
      priorCredits: priorCredits,
      fees: fees,
      scenarioPrice: scenarioPrice,
    });
  }

  function renderRoll(result) {
    var isCredit = result.netRollCredit >= 0;
    var isPut = result.type === "put";
    var html = hero(
      isCredit ? "Net credit for this roll" : "Net debit for this roll",
      signedMoney(result.netRollCredit),
      signedMoney(result.netRollPerShare) + " per share · " +
        (result.extensionDays >= 0 ? result.extensionDays + " added days" : Math.abs(result.extensionDays) + " fewer days")
    );
    html += stats([
      ["Buy-to-close debit", money(result.closeDebit)],
      ["Sell-to-open credit", money(result.openCredit)],
      ["Credits after the roll", money(result.totalCredits)],
      [isPut ? "New effective assignment" : "New economic breakeven", money(result.newBreakeven)],
      [isPut ? "Change in expiry credit" : "Change in called-away profit", signedMoney(result.outcomeImprovement)],
      ["P&L at new-expiration scenario", signedMoney(result.scenarioProfit)],
    ]);
    html += '<p class="callout' + (!isCredit ? ' warn' : '') + '">' +
      (isCredit
        ? "This roll collects " + money(result.netRollCredit) + " after entered fees."
        : "This roll pays " + money(Math.abs(result.netRollCredit)) + ". A debit can still improve a strike or extend time, but it raises the campaign's economic breakeven unless the strike change offsets it.") +
      " The comparison changes the strike from " + money(result.oldStrike) + " to " + money(result.newStrike) + ".</p>";
    html += table(
      ["Before vs after", "Before roll", "After roll", "Change"],
      [
        [isPut ? "Effective assignment price" : "Economic breakeven", money(result.oldBreakeven), money(result.newBreakeven), signedMoney(result.newBreakeven - result.oldBreakeven)],
        [isPut ? "Credit if option expires OTM" : "Profit if called away", signedMoney(result.oldOutcome), signedMoney(result.newOutcome), signedMoney(result.outcomeImprovement)],
        ["Days to expiration", number(result.oldDays, 0), number(result.newDays, 0), (result.extensionDays >= 0 ? "+" : "") + number(result.extensionDays, 0)],
      ]
    );
    if (Number.isFinite(result.creditPerAddedDay)) {
      html += '<p class="result-note">Net roll credit per added calendar day: ' + signedMoney(result.creditPerAddedDay) +
        '. Annualized roll return on the entered capital reference: ' + percent(result.annualizedRollReturn) + '.</p>';
    }
    html += '<p class="result-note">A roll is two trades: closing the old short option and opening a new one. The calculator does not assume a roll repairs a losing position, prevents assignment, or improves expected value.</p>';
    var copy = [
      "Option roll analysis — NumberCove",
      "Net roll: " + signedMoney(result.netRollCredit),
      "Credits after roll: " + money(result.totalCredits),
      "New breakeven: " + money(result.newBreakeven),
      "Outcome change: " + signedMoney(result.outcomeImprovement),
      "Scenario P&L: " + signedMoney(result.scenarioProfit),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function syncIncomeVisibility(form) {
    var strategy = checkedValue(form, "strategy") || "call";
    Array.prototype.forEach.call(form.querySelectorAll("[data-income-strategy]"), function (el) {
      el.classList.toggle("mode-hidden", el.getAttribute("data-income-strategy") !== strategy);
    });
  }

  function syncWheelVisibility(form) {
    var mode = checkedValue(form, "mode") || "wheel";
    var phase = checkedValue(form, "phase") || "put";
    var optionType = checkedValue(form, "optionType") || "call";
    Array.prototype.forEach.call(form.querySelectorAll("[data-campaign-mode]"), function (el) {
      el.classList.toggle("mode-hidden", el.getAttribute("data-campaign-mode") !== mode);
    });
    Array.prototype.forEach.call(form.querySelectorAll("[data-wheel-phase]"), function (el) {
      el.classList.toggle("mode-hidden", el.getAttribute("data-wheel-phase") !== phase);
    });
    Array.prototype.forEach.call(form.querySelectorAll("[data-roll-type]"), function (el) {
      el.classList.toggle("mode-hidden", el.getAttribute("data-roll-type") !== optionType);
    });
  }

  function bind(form, compute, render, sync) {
    var C = window.Calculate;
    var results = document.getElementById("results");
    var copyButton = document.getElementById("copy-results");
    var resetButton = document.getElementById("reset-calc");
    var copyPayload = "";
    var timer;

    function run() {
      C.clearErrors(form);
      if (sync) sync(form);
      var value = compute(C, form);
      if (!value) return;
      var output = render(value);
      results.innerHTML = output.html;
      copyPayload = output.copy;
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, 70);
    }

    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      run();
    });
    if (copyButton) copyButton.addEventListener("click", function () { C.copyText(copyPayload); });
    if (resetButton) resetButton.addEventListener("click", function () {
      form.reset();
      C.clearErrors(form);
      if (sync) sync(form);
      run();
    });
    if (sync) sync(form);
    run();
  }

  function init() {
    if (typeof window === "undefined" || !window.Calculate) return;
    var form = document.querySelector("[data-strategy-calc]");
    if (!form) return;
    var kind = form.getAttribute("data-strategy-calc");
    if (kind === "income") bind(form, incomeFromForm, renderIncome, syncIncomeVisibility);
    if (kind === "expected-move") bind(form, expectedMoveFromForm, renderExpectedMove, null);
    if (kind === "wheel-roll") {
      bind(
        form,
        function (C, currentForm) {
          return (checkedValue(currentForm, "mode") || "wheel") === "roll"
            ? { kind: "roll", value: rollFromForm(C, currentForm) }
            : { kind: "wheel", value: wheelFromForm(C, currentForm) };
        },
        function (wrapped) {
          if (!wrapped.value) return { html: '<p class="placeholder-result">Correct the highlighted fields to see results.</p>', copy: "" };
          return wrapped.kind === "roll" ? renderRoll(wrapped.value) : renderWheel(wrapped.value);
        },
        syncWheelVisibility
      );
    }
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
  }

  return {
    annualize: annualize,
    normalCdf: normalCdf,
    finishItmProbability: finishItmProbability,
    incomeStrategy: incomeStrategy,
    incomeProfitAt: incomeProfitAt,
    expectedMove: expectedMove,
    expectedMoveForDays: expectedMoveForDays,
    wheelCampaign: wheelCampaign,
    rollAnalysis: rollAnalysis,
  };
});
