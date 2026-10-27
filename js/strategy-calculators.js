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

  /* Simple annualization (return x 365 / days). Compounding a short-dated
     option return assumes the same trade repeats all year, which overstates it. */
  function annualize(simpleReturn, days) {
    if (!Number.isFinite(simpleReturn) || !(days > 0)) return NaN;
    return simpleReturn * 365 / days;
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
    var premiumYield = type === "call" ? netPremium / (stockPrice * shares) : incomeReturn;
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
      premiumYield: premiumYield,
      annualizedPremiumYield: annualize(premiumYield, days),
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

  /* Round before formatting so values like -0.004 never display as "-$0.00". */
  function roundTo(value, digits) {
    var f = Math.pow(10, digits);
    return Math.round(value * f) / f || 0;
  }

  function money(value) {
    if (!Number.isFinite(value)) return "—";
    return roundTo(value, 2).toLocaleString(undefined, { style: "currency", currency: "USD" });
  }

  function signedMoney(value) {
    if (!Number.isFinite(value)) return "—";
    var v = roundTo(value, 2);
    return (v > 0 ? "+" : "") + money(v);
  }

  function percent(value, digits) {
    if (!Number.isFinite(value)) return "—";
    var d = digits == null ? 1 : digits;
    return roundTo(value * 100, d).toLocaleString(undefined, {
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

  /* ---------- Shared SVG line chart with hover readout ---------- */

  var chartWidth = 640;
  var chartSeq = 0;
  var chartRegistry = {};

  function niceTicks(min, max, count) {
    var span = max - min;
    if (!(span > 0)) {
      span = Math.abs(max) || 1;
      min -= span / 2;
      max += span / 2;
      span = max - min;
    }
    var step = Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
    var err = span / count / step;
    if (err >= 7.5) step *= 10;
    else if (err >= 3.5) step *= 5;
    else if (err >= 1.5) step *= 2;
    var ticks = [];
    for (var v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  function axisMoney(v) {
    if (!Number.isFinite(v)) return "";
    var a = Math.abs(v);
    var body;
    if (a >= 1e6) body = (a / 1e6).toFixed(1) + "M";
    else if (a >= 1e4) body = (a / 1e3).toFixed(0) + "k";
    else if (a >= 1e3) body = (a / 1e3).toFixed(1) + "k";
    else if (a >= 100 || a === Math.round(a)) body = a.toFixed(0);
    else body = a.toFixed(2);
    return (v < -1e-9 ? "-" : "") + "$" + body;
  }

  function f1(v) {
    return v.toFixed(1);
  }

  /* o: { xs, series: [{ name, ys, step }], xFormat, yFormat, yAxis, includeZero, yMin,
          areas: [{ x0, x1, cls }], markers: [{ x, label, cls }], refLines: [{ y, label }],
          points: [{ x, y, cls }], xTicks, endLabels, tip(i), ariaLabel, caption } */
  function lineChart(o) {
    var id = "ncc" + (++chartSeq);
    var W = Math.max(280, Math.round(chartWidth));
    var H = o.height || (W < 480 ? 230 : 270);
    var showEnd = o.endLabels && W >= 460;
    var padL = o.yAxis === false ? 12 : 58;
    var padR = showEnd ? 96 : 14;
    var padT;
    var padB = 32;
    var xs = o.xs;
    var xMin = xs[0];
    var xMax = xs[xs.length - 1];
    var all = [];
    o.series.forEach(function (sr) {
      sr.ys.forEach(function (y) { if (Number.isFinite(y)) all.push(y); });
    });
    if (o.includeZero !== false) all.push(0);
    (o.refLines || []).forEach(function (r) { all.push(r.y); });
    var yMin = Math.min.apply(null, all);
    var yMax = Math.max.apply(null, all);
    var span = yMax - yMin || Math.abs(yMax) || 1;
    if (o.yMin != null) yMin = o.yMin;
    else yMin -= span * 0.08;
    yMax += span * 0.1;
    var yTicks = o.yAxis === false ? [] : niceTicks(yMin, yMax, 5);
    if (yTicks.length) {
      if (o.yMin == null) yMin = Math.min(yMin, yTicks[0]);
      yMax = Math.max(yMax, yTicks[yTicks.length - 1]);
    }
    var xTicks = o.xTicks || niceTicks(xMin, xMax, W < 480 ? 4 : 6).filter(function (t) {
      return t >= xMin - 1e-9 && t <= xMax + 1e-9;
    });
    var pw = W - padL - padR;
    function sx(x) { return padL + (xMax > xMin ? (x - xMin) / (xMax - xMin) : 0.5) * pw; }
    /* Stack marker labels into rows so nearby strikes never overlap. */
    var rowEnds = [];
    var markers = (o.markers || []).filter(function (m) { return m.x >= xMin && m.x <= xMax; })
      .sort(function (a, b) { return a.x - b.x; }).map(function (m) {
        var mx = sx(m.x);
        var width = m.label.length * 6.4 + 8;
        var row = 0;
        while (rowEnds[row] != null && mx < rowEnds[row]) row += 1;
        rowEnds[row] = mx + width;
        return { x: m.x, mx: mx, label: m.label, cls: m.cls, row: row };
      });
    padT = 22 + Math.max(0, rowEnds.length - 1) * 14;
    var ph = H - padT - padB;
    function sy(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * ph; }
    var xFormat = o.xFormat || axisMoney;
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">';

    yTicks.forEach(function (t) {
      if (t < yMin - 1e-9 || t > yMax + 1e-9) return;
      svg += '<line class="nc-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(t)) + '" y2="' + f1(sy(t)) + '"/>';
      svg += '<text class="nc-axis" x="' + (padL - 8) + '" y="' + f1(sy(t) + 4) + '" text-anchor="end">' + escapeHtml((o.yFormat || axisMoney)(t)) + "</text>";
    });
    xTicks.forEach(function (t) {
      svg += '<text class="nc-axis" x="' + f1(sx(t)) + '" y="' + (H - padB + 20) + '" text-anchor="middle">' + escapeHtml(xFormat(t)) + "</text>";
    });

    (o.areas || []).forEach(function (a) {
      var ys0 = o.series[0].ys;
      var pts = [];
      for (var i = 0; i < xs.length; i += 1) {
        if (xs[i] >= a.x0 && xs[i] <= a.x1) pts.push(f1(sx(xs[i])) + "," + f1(sy(ys0[i])));
      }
      if (pts.length < 2) return;
      var x0 = Math.max(a.x0, xMin);
      var x1 = Math.min(a.x1, xMax);
      svg += '<polygon class="nc-area ' + a.cls + '" points="' + f1(sx(x0)) + "," + f1(sy(0)) + " " + pts.join(" ") + " " + f1(sx(x1)) + "," + f1(sy(0)) + '"/>';
    });

    if (o.includeZero !== false && 0 >= yMin && 0 <= yMax && o.yAxis !== false) {
      svg += '<line class="nc-zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(0)) + '" y2="' + f1(sy(0)) + '"/>';
    }
    (o.refLines || []).forEach(function (r) {
      svg += '<line class="nc-ref" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(r.y)) + '" y2="' + f1(sy(r.y)) + '"/>';
      svg += '<text class="nc-mlabel" x="' + (padL + 6) + '" y="' + f1(sy(r.y) - 5) + '">' + escapeHtml(r.label) + "</text>";
    });
    markers.forEach(function (m) {
      svg += '<line class="nc-marker ' + (m.cls || "") + '" x1="' + f1(m.mx) + '" x2="' + f1(m.mx) + '" y1="' + (padT - 4 - m.row * 14) + '" y2="' + (H - padB) + '"/>';
      svg += '<text class="nc-mlabel" x="' + f1(m.mx + 4) + '" y="' + (padT - 8 - m.row * 14) + '">' + escapeHtml(m.label) + "</text>";
    });

    for (var k = o.series.length - 1; k >= 0; k -= 1) {
      var sr = o.series[k];
      var d = "";
      sr.ys.forEach(function (y, i) {
        var X = f1(sx(xs[i]));
        var Y = f1(sy(y));
        if (!i) d = "M" + X + " " + Y;
        else if (sr.step) d += " H" + X + " V" + Y;
        else d += " L" + X + " " + Y;
      });
      svg += '<path class="nc-line s' + (k + 1) + '" d="' + d + '"/>';
      if (sr.step) {
        sr.ys.forEach(function (y, i) {
          svg += '<circle class="nc-stepdot s' + (k + 1) + '" cx="' + f1(sx(xs[i])) + '" cy="' + f1(sy(y)) + '" r="3.5"/>';
        });
      }
    }
    (o.points || []).forEach(function (pt) {
      if (!(pt.x >= xMin && pt.x <= xMax) || !Number.isFinite(pt.y)) return;
      svg += '<circle class="nc-point ' + (pt.cls || "") + '" cx="' + f1(sx(pt.x)) + '" cy="' + f1(sy(pt.y)) + '" r="' + (pt.cls === "be" ? 4.5 : 5.5) + '"/>';
    });
    if (showEnd) {
      var ends = o.series.map(function (sr, k) {
        return { k: k, y: sy(sr.ys[sr.ys.length - 1]), name: sr.name };
      }).sort(function (a, b) { return a.y - b.y; });
      for (var e = 1; e < ends.length; e += 1) {
        if (ends[e].y - ends[e - 1].y < 15) ends[e].y = ends[e - 1].y + 15;
      }
      ends.forEach(function (en) {
        svg += '<text class="nc-endlabel" x="' + (W - padR + 6) + '" y="' + f1(en.y + 4) + '">' + escapeHtml(en.name) + "</text>";
      });
    }
    svg += '<line class="nc-cross" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/>';
    o.series.forEach(function (sr, k) {
      svg += '<circle class="nc-hover s' + (k + 1) + '" r="4" visibility="hidden"/>';
    });
    svg += '<rect class="nc-hit" x="' + padL + '" y="' + padT + '" width="' + pw + '" height="' + ph + '"/></svg>';

    var legend = "";
    if (o.series.length > 1) {
      legend = '<div class="nc-legend">' + o.series.map(function (sr, k) {
        return '<span><i class="nc-sw s' + (k + 1) + '"></i>' + escapeHtml(sr.name) + "</span>";
      }).join("") + "</div>";
    }
    chartRegistry[id] = {
      xs: xs, ys: o.series.map(function (sr) { return sr.ys; }), sx: sx, sy: sy, W: W,
      tip: o.tip || function (i) {
        return "<strong>" + escapeHtml(xFormat(xs[i])) + "</strong>" + o.series.map(function (sr, k) {
          return '<span class="nc-tip-row"><i class="nc-sw s' + (k + 1) + '"></i>' + escapeHtml(sr.name) + " <b>" + (o.yFormat || signedMoney)(sr.ys[i]) + "</b></span>";
        }).join("");
      },
    };
    return '<figure class="nc-chart" id="' + id + '" role="img" aria-label="' + escapeHtml(o.ariaLabel || "Chart") + '">' + legend +
      '<div class="nc-plot">' + svg + '<div class="nc-tip" hidden></div></div>' +
      (o.caption ? '<figcaption class="hint">' + o.caption + "</figcaption>" : "") + "</figure>";
  }

  function chartHover(evt) {
    var fig = evt.target && evt.target.closest ? evt.target.closest(".nc-chart") : null;
    if (!fig) return;
    var st = chartRegistry[fig.id];
    var svg = fig.querySelector("svg");
    var tip = fig.querySelector(".nc-tip");
    if (!st || !svg || !tip) return;
    var rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    var scale = st.W / rect.width;
    var px = (evt.clientX - rect.left) * scale;
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < st.xs.length; i += 1) {
      var dist = Math.abs(st.sx(st.xs[i]) - px);
      if (dist < bestD) { bestD = dist; best = i; }
    }
    var x = st.sx(st.xs[best]);
    var cross = svg.querySelector(".nc-cross");
    cross.setAttribute("x1", x);
    cross.setAttribute("x2", x);
    cross.setAttribute("visibility", "visible");
    Array.prototype.forEach.call(svg.querySelectorAll(".nc-hover"), function (dot, k) {
      var y = st.ys[k][best];
      if (!Number.isFinite(y)) return;
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", st.sy(y));
      dot.setAttribute("visibility", "visible");
    });
    tip.innerHTML = st.tip(best);
    tip.hidden = false;
    var left = x / scale + 12;
    if (left + 210 > rect.width) left = x / scale - 222;
    tip.style.left = Math.max(0, left) + "px";
  }

  function chartLeave(evt) {
    var fig = evt.target && evt.target.closest ? evt.target.closest(".nc-chart") : null;
    if (!fig || (evt.relatedTarget && fig.contains(evt.relatedTarget))) return;
    var tip = fig.querySelector(".nc-tip");
    if (tip) tip.hidden = true;
    Array.prototype.forEach.call(fig.querySelectorAll(".nc-cross, .nc-hover"), function (n) {
      n.setAttribute("visibility", "hidden");
    });
  }

  function priceGrid(lo, hi, n) {
    var xs = [];
    for (var i = 0; i <= n; i += 1) xs.push(lo + (hi - lo) * i / n);
    return xs;
  }

  function payoffChart(result) {
    var isCall = result.type === "call";
    var lo = Math.max(0, Math.min(result.stockPrice, result.strike, result.breakeven, result.scenarioPrice) * 0.7);
    var hi = Math.max(result.stockPrice, result.strike, result.scenarioPrice) * 1.3;
    var xs = priceGrid(lo, hi, 120);
    var strategy = xs.map(function (p) { return incomeProfitAt(result, p); });
    var stockOnly = xs.map(function (p) {
      return isCall
        ? (p - result.costBasis) * result.shares + result.dividends
        : (p - result.stockPrice) * result.shares;
    });
    var name1 = isCall ? "Covered call" : "Cash-secured put";
    var name2 = isCall ? "Stock only" : "Buy shares now";
    return lineChart({
      xs: xs,
      series: [{ name: name1, ys: strategy }, { name: name2, ys: stockOnly }],
      markers: [
        { x: result.strike, label: "Strike " + axisMoney(result.strike), cls: "strike" },
        { x: result.stockPrice, label: "Now", cls: "now" },
      ],
      points: [
        { x: result.breakeven, y: 0, cls: "be" },
        { x: result.scenarioPrice, y: incomeProfitAt(result, result.scenarioPrice), cls: "scen" },
      ],
      endLabels: true,
      ariaLabel: name1 + " profit and loss at expiration compared with " + name2.toLowerCase(),
      tip: function (i) {
        var diff = strategy[i] - stockOnly[i];
        return "<strong>Stock at " + money(xs[i]) + "</strong>" +
          '<span class="nc-tip-row"><i class="nc-sw s1"></i>' + name1 + " <b>" + signedMoney(strategy[i]) + "</b></span>" +
          '<span class="nc-tip-row"><i class="nc-sw s2"></i>' + name2 + " <b>" + signedMoney(stockOnly[i]) + "</b></span>" +
          '<span class="nc-tip-row">Difference <b>' + signedMoney(diff) + "</b></span>";
      },
      caption: isCall
        ? "Below the strike, the premium keeps the covered call above owning the stock alone. Above the strike, the gap between the lines is the upside you give up. The open circle marks breakeven; the filled dot marks your expiration price."
        : "Selling the put earns the premium if the stock holds up, while buying shares now captures all the upside. Below the strike both own the stock, and the put stays ahead by the premium plus the lower entry price. The open circle marks breakeven; the filled dot marks your expiration price.",
    });
  }

  function expectedMoveChart(result) {
    var sd = result.ivMove;
    var lo = Math.max(0, result.spot - 3.2 * sd);
    var hi = result.spot + 3.2 * sd;
    if (Number.isFinite(result.targetPrice)) {
      lo = Math.max(0, Math.min(lo, result.targetPrice - 0.3 * sd));
      hi = Math.max(hi, result.targetPrice + 0.3 * sd);
    }
    var xs = priceGrid(lo, hi, 160);
    var ys = xs.map(function (x) {
      var z = (x - result.spot) / sd;
      return Math.exp(-0.5 * z * z);
    });
    var markers = [{ x: result.spot, label: "Now " + axisMoney(result.spot), cls: "now" }];
    if (Number.isFinite(result.targetPrice)) markers.push({ x: result.targetPrice, label: "Target", cls: "target" });
    return lineChart({
      xs: xs,
      series: [{ name: "Price distribution", ys: ys }],
      yAxis: false,
      yMin: 0,
      areas: [
        { x0: result.spot - 2 * sd, x1: result.spot + 2 * sd, cls: "band2" },
        { x0: result.spot - sd, x1: result.spot + sd, cls: "band1" },
      ],
      markers: markers,
      ariaLabel: "Bell curve of possible prices. Plus or minus 1 standard deviation is " + money(result.linearLower) + " to " + money(result.linearUpper) +
        "; plus or minus 2 is " + money(result.twoSigmaLower) + " to " + money(result.twoSigmaUpper) + ".",
      tip: function (i) {
        var z = (xs[i] - result.spot) / sd;
        var chance = clamp(2 * (1 - normalCdf(Math.abs(z))), 0, 1);
        return "<strong>" + money(xs[i]) + "</strong>" +
          '<span class="nc-tip-row">Move <b>' + (z >= 0 ? "+" : "") + percent((xs[i] - result.spot) / result.spot) + "</b></span>" +
          '<span class="nc-tip-row">Std. deviations <b>' + (z >= 0 ? "+" : "") + number(z, 2) + "σ</b></span>" +
          '<span class="nc-tip-row">Chance of a move this large or larger <b>' + percent(chance) + "</b></span>";
      },
      caption: "Dark band: ±1σ, " + money(result.linearLower) + " to " + money(result.linearUpper) +
        " (about 68% of outcomes). Light band: ±2σ, " + money(result.twoSigmaLower) + " to " + money(result.twoSigmaUpper) +
        " (about 95%). Simplified normal model using the entered IV; it shows size, not direction.",
    });
  }

  function rollPnlAt(result, price, after) {
    var strike = after ? result.newStrike : result.oldStrike;
    var credits = after ? result.totalCredits : result.priorCredits;
    if (result.type === "put") return credits - Math.max(0, strike - price) * result.shares;
    return (Math.min(price, strike) - result.stockBasis) * result.shares + credits;
  }

  function rollChart(result) {
    var lo = Math.max(0, Math.min(result.stockPrice, result.oldStrike, result.newStrike, result.scenarioPrice, result.newBreakeven) * 0.75);
    var hi = Math.max(result.stockPrice, result.oldStrike, result.newStrike, result.scenarioPrice) * 1.25;
    var xs = priceGrid(lo, hi, 120);
    var after = xs.map(function (p) { return rollPnlAt(result, p, true); });
    var before = xs.map(function (p) { return rollPnlAt(result, p, false); });
    var markers = [{ x: result.stockPrice, label: "Now", cls: "now" }];
    if (Math.abs(result.oldStrike - result.newStrike) < 0.005) {
      markers.push({ x: result.newStrike, label: "Strike " + axisMoney(result.newStrike), cls: "strike" });
    } else {
      markers.push({ x: result.oldStrike, label: "Old " + axisMoney(result.oldStrike), cls: "strike" });
      markers.push({ x: result.newStrike, label: "New " + axisMoney(result.newStrike), cls: "strike" });
    }
    return lineChart({
      xs: xs,
      series: [{ name: "After roll", ys: after }, { name: "Before roll", ys: before }],
      markers: markers,
      points: [{ x: result.scenarioPrice, y: rollPnlAt(result, result.scenarioPrice, true), cls: "scen" }],
      endLabels: true,
      ariaLabel: "Campaign profit and loss at expiration before and after the roll",
      tip: function (i) {
        return "<strong>Stock at " + money(xs[i]) + "</strong>" +
          '<span class="nc-tip-row"><i class="nc-sw s1"></i>After roll <b>' + signedMoney(after[i]) + "</b></span>" +
          '<span class="nc-tip-row"><i class="nc-sw s2"></i>Before roll <b>' + signedMoney(before[i]) + "</b></span>" +
          '<span class="nc-tip-row">Roll changes it by <b>' + signedMoney(after[i] - before[i]) + "</b></span>";
      },
      caption: "Campaign P&L at each option's expiration: before the roll, if you hold the current option to its expiration in " +
        number(result.oldDays, 0) + " days; after the roll, at the new expiration in " + number(result.newDays, 0) +
        " days. Where the blue line is higher, the roll improves the outcome at that price. The dot marks your new-expiration price.",
    });
  }

  function wheelChart(result, log) {
    var isPut = result.phase === "put";
    var ref = isPut ? result.strike : result.stockBasis;
    var labels = ["Start"];
    var basis = [ref];
    var cum = 0;
    if (log && log.length) {
      log.forEach(function (row, i) {
        cum += row.amount;
        labels.push(row.label || "Trade " + (i + 1));
        basis.push(ref - cum / result.shares);
      });
    } else if (Math.abs(result.priorCredits) > 0.004) {
      cum = result.priorCredits;
      labels.push("Earlier credits");
      basis.push(ref - cum / result.shares);
    }
    cum += result.currentNetPremium;
    labels.push("Current trade");
    basis.push(ref - cum / result.shares);
    if (!isPut && result.dividends > 0) {
      cum += result.dividends;
      labels.push("Dividends");
      basis.push(ref - cum / result.shares);
    }
    var xs = labels.map(function (_, i) { return i; });
    var short = function (i) {
      var t = labels[Math.round(i)] || "";
      return t.length > 11 ? t.slice(0, 10) + "…" : t;
    };
    var ticks = xs.length <= 7 ? xs : niceTicks(0, xs.length - 1, 6).filter(function (t) { return t === Math.round(t); });
    return lineChart({
      xs: xs,
      series: [{ name: "Premium-adjusted basis", ys: basis, step: true }],
      includeZero: false,
      refLines: [
        { y: ref, label: (isPut ? "Put strike " : "Share basis ") + money(ref) },
        { y: result.stockPrice, label: "Stock now " + money(result.stockPrice) },
      ],
      xTicks: ticks,
      xFormat: short,
      yFormat: function (v) { return "$" + v.toFixed(Math.abs(v) >= 100 ? 0 : 2); },
      ariaLabel: "Premium-adjusted cost basis after each trade in the wheel campaign, ending at " + money(result.economicBreakeven) + " per share",
      tip: function (i) {
        var credits = (ref - basis[i]) * result.shares;
        return "<strong>" + escapeHtml(labels[i]) + "</strong>" +
          '<span class="nc-tip-row"><i class="nc-sw s1"></i>Adjusted basis <b>' + money(basis[i]) + "</b></span>" +
          '<span class="nc-tip-row">Credits so far <b>' + signedMoney(credits) + "</b></span>" +
          '<span class="nc-tip-row">Cushion vs stock now <b>' + signedMoney((result.stockPrice - basis[i]) * result.shares) + "</b></span>";
      },
      caption: "Each step is a trade in your campaign. The line is the price per share you effectively pay after all credits so far, measured from the " +
        (isPut ? "put strike" : "share purchase price") + ". Add earlier trades in the trade log to see every step.",
    });
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
      [isCall ? "Return if called away (" + number(result.days, 0) + " days)" : "Premium return on cash", percent(isCall ? result.maxReturn : result.incomeReturn)],
      [isCall ? "Premium yield, annualized" : "Premium return, annualized", percent(result.annualizedPremiumYield) +
        ' <span class="stat-note">' + percent(result.premiumYield) + " for " + number(result.days, 0) + " days" + (isCall ? " on current share value" : "") + "</span>"],
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
    html += '<h3>Expiration payoff vs ' + (isCall ? "owning the stock alone" : "buying shares now") + '</h3>' + payoffChart(result);
    html += table(["Stock at expiration", "Profit / loss", "Return", "Likely outcome"], rows);
    html += '<p class="result-note">The finish-ITM estimate uses a risk-neutral lognormal model and the IV, rate, and dividend yield entered. It is not the probability of a profitable trade or a forecast. Annualized figures use simple annualization (return × 365 ÷ days) and do not assume the trade repeats.</p>';
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
    html += '<h3>Probable price range</h3>' + expectedMoveChart(result);
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
    html += '<h3>Premium-adjusted basis by trade</h3>' + wheelChart(result, wheelLogEntries());
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
    html += '<h3>P&amp;L at expiration: before vs after the roll</h3>' + rollChart(result);
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

  /* ---------- Wheel trade log ---------- */

  var LOG_KEY = "numbercove-wheel-log";
  var DEFAULT_LOG = [{ label: "Put #1 expired", amount: "120" }, { label: "Put #2 expired", amount: "80" }];
  var wheelLog = [];
  var logHost = null;

  function loadLog() {
    try {
      var saved = JSON.parse(localStorage.getItem(LOG_KEY) || "null");
      if (Array.isArray(saved)) return saved.slice(0, 40).map(function (r) {
        return { label: String(r.label || "").slice(0, 40), amount: String(r.amount == null ? "" : r.amount).slice(0, 16) };
      });
    } catch (e) {
      /* storage unavailable */
    }
    return DEFAULT_LOG.map(function (r) { return { label: r.label, amount: r.amount }; });
  }

  function saveLog() {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(wheelLog));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function wheelLogEntries() {
    return wheelLog.map(function (r) {
      return { label: r.label.trim(), amount: finite(String(r.amount).replace(/[$,\s]/g, "")) };
    }).filter(function (r) { return Number.isFinite(r.amount); });
  }

  function renderLogRows() {
    if (!logHost) return;
    if (!wheelLog.length) {
      logHost.innerHTML = '<p class="hint wheel-log-empty">No trades logged. “Previous net option credits” is used instead.</p>';
      return;
    }
    logHost.innerHTML = wheelLog.map(function (r, i) {
      return '<div class="wheel-log-row">' +
        '<input type="text" data-log-label="' + i + '" value="' + escapeHtml(r.label) + '" placeholder="Trade ' + (i + 1) + '" aria-label="Trade ' + (i + 1) + ' description" maxlength="40">' +
        '<span class="input-affix prefix"><span class="affix">$</span><input data-log-amount="' + i + '" inputmode="decimal" value="' + escapeHtml(r.amount) + '" placeholder="Net credit" aria-label="Trade ' + (i + 1) + ' net credit in dollars"></span>' +
        '<button type="button" class="btn btn-ghost wheel-log-remove" data-log-remove="' + i + '" aria-label="Remove trade ' + (i + 1) + '">✕</button></div>';
    }).join("");
  }

  function applyLogToForm(form) {
    var field = form.elements.priorCredits;
    if (!field) return;
    var entries = wheelLogEntries();
    var label = field.closest(".field");
    var hint = label ? label.querySelector(".hint") : null;
    if (entries.length) {
      var sum = entries.reduce(function (t, r) { return t + r.amount; }, 0);
      field.value = roundTo(sum, 2).toFixed(2);
      field.readOnly = true;
      if (hint) hint.textContent = "Sum of the " + entries.length + " trade" + (entries.length === 1 ? "" : "s") + " in your trade log below";
    } else {
      field.readOnly = false;
      if (hint) hint.textContent = "Total dollars from earlier puts, calls, and rolls; enter a negative number for a net debit";
    }
  }

  function initWheelLog(form, schedule) {
    logHost = document.getElementById("wheel-log-rows");
    if (!logHost) return null;
    wheelLog = loadLog();
    renderLogRows();
    applyLogToForm(form);
    logHost.addEventListener("input", function (e) {
      var t = e.target;
      if (t.hasAttribute("data-log-label")) wheelLog[+t.getAttribute("data-log-label")].label = t.value;
      else if (t.hasAttribute("data-log-amount")) wheelLog[+t.getAttribute("data-log-amount")].amount = t.value;
      else return;
      saveLog();
      applyLogToForm(form);
    });
    logHost.addEventListener("click", function (e) {
      var b = e.target.closest("[data-log-remove]");
      if (!b) return;
      wheelLog.splice(+b.getAttribute("data-log-remove"), 1);
      saveLog();
      renderLogRows();
      applyLogToForm(form);
      schedule();
    });
    var add = document.getElementById("wheel-log-add");
    if (add) add.addEventListener("click", function () {
      if (wheelLog.length >= 40) return;
      wheelLog.push({ label: "", amount: "" });
      saveLog();
      renderLogRows();
      var inputs = logHost.querySelectorAll("[data-log-label]");
      if (inputs.length) inputs[inputs.length - 1].focus();
    });
    return {
      reset: function () {
        wheelLog = DEFAULT_LOG.map(function (r) { return { label: r.label, amount: r.amount }; });
        try { localStorage.removeItem(LOG_KEY); } catch (e) { /* ignore */ }
        renderLogRows();
        applyLogToForm(form);
      },
    };
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

  /* Range sliders mirror a numeric field: data-range-for="field", data-range-ref="reference field". */
  function syncRanges(form) {
    Array.prototype.forEach.call(form.querySelectorAll("input[type=range][data-range-for]"), function (range) {
      var target = form.elements[range.getAttribute("data-range-for")];
      var ref = formNumber(form, range.getAttribute("data-range-ref"));
      var value = target ? finite(String(target.value).replace(/,/g, "")) : NaN;
      if (!(ref > 0) || !Number.isFinite(value)) return;
      var lo = roundTo(Math.min(ref * 0.5, value), 2);
      var hi = roundTo(Math.max(ref * 1.5, value), 2);
      range.min = String(lo);
      range.max = String(hi);
      range.step = ref >= 500 ? "0.5" : ref >= 50 ? "0.05" : "0.01";
      if (document.activeElement !== range) range.value = String(value);
    });
  }

  function bind(form, compute, render, sync) {
    var C = window.Calculate;
    var results = document.getElementById("results");
    var copyButton = document.getElementById("copy-results");
    var resetButton = document.getElementById("reset-calc");
    var copyPayload = "";
    var timer;
    var logApi = null;
    var lastWidth = 0;

    function run() {
      C.clearErrors(form);
      if (sync) sync(form);
      syncRanges(form);
      var value = compute(C, form);
      if (!value) return;
      chartWidth = Math.max(280, (results.clientWidth || 640) - 2);
      lastWidth = results.clientWidth;
      chartRegistry = {};
      var output = render(value);
      results.innerHTML = output.html;
      copyPayload = output.copy;
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, 40);
    }

    Array.prototype.forEach.call(form.querySelectorAll("input[type=range][data-range-for]"), function (range) {
      range.addEventListener("input", function () {
        var target = form.elements[range.getAttribute("data-range-for")];
        if (target) target.value = (+range.value).toFixed(2);
      });
    });
    results.addEventListener("pointermove", chartHover);
    results.addEventListener("pointerout", chartLeave);
    window.addEventListener("resize", function () {
      clearTimeout(bind.resizeTimer);
      bind.resizeTimer = setTimeout(function () {
        if (results.clientWidth !== lastWidth) run();
      }, 150);
    });

    logApi = initWheelLog(form, schedule);
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
      if (logApi) logApi.reset();
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
    rollPnlAt: rollPnlAt,
    wheelCampaign: wheelCampaign,
    rollAnalysis: rollAnalysis,
  };
});
