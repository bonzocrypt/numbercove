(function () {
  "use strict";

  var C = window.Calculate;
  var E = window.OptionsEngine;
  if (!C || !E) return;

  var MAX_LEGS = 4;
  var DAY_MS = 86400000;
  var YEAR_MS = 365 * DAY_MS;
  var HEAD_STEPS = 201;
  var GRID_STEPS = 101;
  var TZ = "America/New_York";
  var LEG_FIELDS = ["side", "qty", "type", "strike", "exp", "bid", "ask", "iv", "entry", "gDelta", "gGamma", "gTheta", "gVega"];
  var GREEK_FIELDS = [
    { key: "gDelta", greek: "delta", label: "Delta", digits: 3 },
    { key: "gGamma", greek: "gamma", label: "Gamma", digits: 4 },
    { key: "gTheta", greek: "theta", label: "Theta", digits: 4 },
    { key: "gVega", greek: "vega", label: "Vega", digits: 4 },
  ];

  var form;
  var legCount = 1;
  var scen = { pct: 0, date: null, shift: 0 };
  var lastModel = null;
  var lastAnalysis = null;
  var lastCopy = "";
  var ivCache = {};
  var ivCacheSize = 0;
  var frame = 0;
  var urlTimer = 0;

  /* ---------- Exchange-time date helpers ---------- */

  var etFmt = null;
  try {
    etFmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
    });
  } catch (e) {
    etFmt = null;
  }

  function etParts(ms) {
    if (!etFmt) {
      var d = new Date(ms - 5 * 3600000);
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), h: d.getUTCHours() };
    }
    var out = {};
    etFmt.formatToParts(new Date(ms)).forEach(function (p) {
      out[p.type] = p.value;
    });
    return { y: +out.year, m: +out.month, d: +out.day, h: +out.hour % 24 };
  }

  function pad(n) {
    return (n < 10 ? "0" : "") + n;
  }

  var todayMemo = { at: 0, ymd: "" };
  function todayYmd() {
    var now = Date.now();
    if (now - todayMemo.at > 1000) {
      var p = etParts(now);
      todayMemo = { at: now, ymd: p.y + "-" + pad(p.m) + "-" + pad(p.d) };
    }
    return todayMemo.ymd;
  }

  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]);
    if (new Date(t).getUTCMonth() !== +m[2] - 1) return null;
    return t;
  }

  function ymdFromUtc(t) {
    var d = new Date(t);
    return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  }

  function addDays(ymd, n) {
    return ymdFromUtc(parseYmd(ymd) + n * DAY_MS);
  }

  function daysBetween(a, b) {
    return Math.round((parseYmd(b) - parseYmd(a)) / DAY_MS);
  }

  var closeCache = {};
  /* 4:00 p.m. Eastern on a calendar date, as epoch milliseconds. */
  function closeMs(ymd) {
    if (closeCache[ymd]) return closeCache[ymd];
    var base = parseYmd(ymd);
    var guess = base + 20 * 3600000;
    if (etParts(guess).h !== 16) guess = base + 21 * 3600000;
    closeCache[ymd] = guess;
    return guess;
  }

  function valuationMs(ymd) {
    return ymd === todayYmd() ? Date.now() : closeMs(ymd);
  }

  var dateFmtShort = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric" });
  var dateFmtLong = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
  function fmtDate(ymd, withYear) {
    var t = parseYmd(ymd);
    if (t == null) return "—";
    return (withYear ? dateFmtLong : dateFmtShort).format(new Date(t));
  }

  function fridayOnOrAfter(ymd) {
    var dow = new Date(parseYmd(ymd)).getUTCDay();
    return addDays(ymd, (5 - dow + 7) % 7);
  }

  /* ---------- Formatting ---------- */

  /* Cached formatters: the heat map formats hundreds of values per redraw. */
  var moneyFmt = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
  var numFmts = {};
  function numFmt(d) {
    if (!numFmts[d]) numFmts[d] = new Intl.NumberFormat(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
    return numFmts[d];
  }

  /* Values that round to zero display as zero, never "-$0.00". */
  function clean(v, d) {
    var f = Math.pow(10, d);
    var r = Math.round(v * f) / f;
    return r === 0 ? 0 : v;
  }

  function money(v) {
    if (!Number.isFinite(v)) return "—";
    return moneyFmt.format(clean(v, 2));
  }

  function signedMoney(v) {
    if (!Number.isFinite(v)) return "—";
    v = clean(v, 2);
    return (v > 0 ? "+" : "") + moneyFmt.format(v);
  }

  function pct(v, d) {
    if (!Number.isFinite(v)) return "—";
    d = d == null ? 1 : d;
    return numFmt(d).format(clean(v, d)) + "%";
  }

  function signedPct(v, d) {
    if (!Number.isFinite(v)) return "—";
    d = d == null ? 1 : d;
    v = clean(v, d);
    return (v > 0 ? "+" : "") + numFmt(d).format(v) + "%";
  }

  function num(v, d) {
    if (!Number.isFinite(v)) return "—";
    d = d == null ? 2 : d;
    return numFmt(d).format(clean(v, d));
  }

  function compactMoney(v, signed) {
    if (!Number.isFinite(v)) return "—";
    var a = Math.abs(v);
    var body;
    if (a >= 1e6) body = (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
    else if (a >= 1e4) body = (a / 1e3).toFixed(1) + "k";
    else body = numFmt(0).format(a);
    var sign = v < -0.5 ? "-" : signed && v > 0.5 ? "+" : "";
    return sign + "$" + body;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function optNum(v) {
    var n = C.parseNumber(v);
    return Number.isFinite(n) ? n : null;
  }

  /* ---------- Leg form ---------- */

  function el(name) {
    return form.querySelector('[name="' + name + '"]');
  }

  function legInput(i, key, label, attrs, affix, prefix) {
    var input = '<input name="l' + i + "_" + key + '" ' + (attrs || "") + ">";
    if (affix) {
      input = '<span class="input-affix' + (prefix ? " prefix" : "") + '">' +
        (prefix ? '<span class="affix">' + affix + "</span>" + input : input + '<span class="affix">' + affix + "</span>") +
        "</span>";
    }
    return '<label class="field"><span>' + label + "</span>" + input + '<span class="field-error"></span></label>';
  }

  function legSelect(i, key, label, options) {
    return '<label class="field">' + label + '<select name="l' + i + "_" + key + '">' +
      options.map(function (o) {
        return '<option value="' + o[0] + '">' + o[1] + "</option>";
      }).join("") +
      '</select><span class="field-error"></span></label>';
  }

  function legTemplate(i) {
    var opt = '<span class="optional-tag">optional</span>';
    return '<fieldset class="leg" data-leg="' + i + '">' +
      '<legend><span class="leg-title">Leg ' + (i + 1) + '</span> <span class="leg-summary" data-summary="' + i + '"></span></legend>' +
      '<button type="button" class="leg-remove btn btn-ghost" data-remove="' + i + '" aria-label="Remove leg ' + (i + 1) + '">Remove</button>' +
      '<div class="form-grid leg-grid">' +
      legSelect(i, "side", "Action", [["buy", "Buy (long)"], ["sell", "Sell (short)"]]) +
      legInput(i, "qty", "Contracts", 'inputmode="numeric"') +
      legSelect(i, "type", "Type", [["call", "Call"], ["put", "Put"]]) +
      legInput(i, "strike", "Strike", 'inputmode="decimal"', "$", true) +
      legInput(i, "exp", "Expiration", 'type="date"') +
      legInput(i, "iv", "Implied volatility " + opt, 'inputmode="decimal"', "%") +
      legInput(i, "bid", "Bid " + opt, 'inputmode="decimal"', "$", true) +
      legInput(i, "ask", "Ask " + opt, 'inputmode="decimal"', "$", true) +
      legInput(i, "entry", "Custom entry price " + opt, 'inputmode="decimal"', "$", true) +
      "</div>" +
      '<details class="advanced broker-greeks"><summary>Broker Greeks (optional, for comparison)</summary>' +
      '<div class="form-grid leg-grid">' +
      GREEK_FIELDS.map(function (g) {
        return legInput(i, g.key, g.label, 'inputmode="decimal"');
      }).join("") +
      '</div><p class="hint">Per share, as most platforms quote them. Theta per calendar day; vega per 1 point of IV. Blank fields show the model value.</p></details>' +
      "</fieldset>";
  }

  function legVal(i, k) {
    var e = el("l" + i + "_" + k);
    return e ? e.value : "";
  }

  function setLegVal(i, k, v) {
    var e = el("l" + i + "_" + k);
    if (e) e.value = v == null ? "" : v;
  }

  function legDefault(k) {
    return k === "side" ? "buy" : k === "type" ? "call" : k === "qty" ? "1" : "";
  }

  function legRaw(i) {
    var o = {};
    LEG_FIELDS.forEach(function (k) {
      o[k] = legVal(i, k);
    });
    return o;
  }

  function setLegRaw(i, o) {
    LEG_FIELDS.forEach(function (k) {
      setLegVal(i, k, o && o[k] != null ? o[k] : legDefault(k));
    });
  }

  function showLegs() {
    C.$$(".leg", form).forEach(function (fs, i) {
      fs.hidden = i >= legCount;
      var rm = fs.querySelector(".leg-remove");
      if (rm) rm.hidden = legCount === 1;
    });
    var add = document.getElementById("add-leg");
    add.disabled = legCount >= MAX_LEGS;
    add.textContent = legCount >= MAX_LEGS ? "Maximum of 4 legs" : "+ Add leg";
    var ivLeg = document.getElementById("sc-iv-leg");
    if (ivLeg) ivLeg.textContent = legCount > 1 ? "(leg 1)" : "";
  }

  function removeLeg(i) {
    for (var j = i; j < legCount - 1; j += 1) setLegRaw(j, legRaw(j + 1));
    setLegRaw(legCount - 1, null);
    legCount -= 1;
    showLegs();
    schedule();
  }

  function addLeg() {
    if (legCount >= MAX_LEGS) return;
    setLegRaw(legCount, { side: "buy", qty: "1", type: "call", exp: legVal(0, "exp") });
    legCount += 1;
    showLegs();
    var strike = el("l" + (legCount - 1) + "_strike");
    if (strike) strike.focus();
    schedule();
  }

  /* ---------- Defaults & presets ---------- */

  function defaultExp() {
    return fridayOnOrAfter(addDays(todayYmd(), 42));
  }

  function applyDefaults() {
    el("spot").value = "100";
    el("style").value = "american";
    el("rate").value = "";
    el("divYield").value = "";
    el("basis").value = "mid";
    el("multiplier").value = "100";
    for (var i = 0; i < MAX_LEGS; i += 1) setLegRaw(i, null);
    setLegRaw(0, { side: "buy", qty: "1", type: "call", strike: "105", exp: defaultExp(), bid: "2.40", ask: "2.50" });
    legCount = 1;
    scen = { pct: 0, date: todayYmd(), shift: 0 };
    document.getElementById("crush-pct").value = "30";
    document.getElementById("heat-range").value = "20";
    setHeatMetric("pnl");
    showLegs();
  }

  function strikeIncrement(S) {
    if (S < 25) return 0.5;
    if (S < 200) return 1;
    if (S < 1000) return 5;
    return 10;
  }

  function applyPreset(name) {
    var S = optNum(el("spot").value);
    if (!(S > 0)) {
      C.setFieldError(el("spot"), "Enter the underlying price before applying a preset.");
      return;
    }
    var inc = strikeIncrement(S);
    var atm = Math.round(S / inc) * inc;
    var w = Math.max(inc, Math.round((S * 0.05) / inc) * inc);
    var exp = parseYmd(legVal(0, "exp")) != null && legVal(0, "exp") >= todayYmd() ? legVal(0, "exp") : defaultExp();
    var far = fridayOnOrAfter(addDays(exp, 28));
    var iv = legVal(0, "iv");
    if (!optNum(iv) && lastModel && lastModel.legs[0] && lastModel.legs[0].iv > 0) iv = (lastModel.legs[0].iv * 100).toFixed(1);
    function k(v) {
      return String(+v.toFixed(2));
    }
    function L(side, type, strike, qty, e) {
      return { side: side, type: type, strike: k(strike), qty: String(qty || 1), exp: e || exp, iv: iv };
    }
    var legs;
    var lead = legRaw(0);
    switch (name) {
      case "bullCall": legs = [L("buy", "call", atm), L("sell", "call", atm + w)]; break;
      case "bearPut": legs = [L("buy", "put", atm), L("sell", "put", atm - w)]; break;
      case "straddle": legs = [L("buy", "call", atm), L("buy", "put", atm)]; break;
      case "strangle": legs = [L("buy", "call", atm + w), L("buy", "put", atm - w)]; break;
      case "ironCondor": legs = [L("sell", "put", atm - w), L("buy", "put", atm - 2 * w), L("sell", "call", atm + w), L("buy", "call", atm + 2 * w)]; break;
      case "butterfly": legs = [L("buy", "call", atm - w), L("sell", "call", atm, 2), L("buy", "call", atm + w)]; break;
      case "calendar": legs = [L("sell", "call", atm, 1, exp), L("buy", "call", atm, 1, far)]; break;
      case "diagonal": legs = [L("sell", "call", atm + w, 1, exp), L("buy", "call", atm, 1, far)]; break;
      default: legs = [lead];
    }
    for (var i = 0; i < MAX_LEGS; i += 1) setLegRaw(i, legs[i] || null);
    legCount = legs.length;
    scen.shift = 0;
    showLegs();
    schedule();
    if (name !== "single") C.toast("Preset applied. Enter real bids and asks for accurate P&L.");
  }

  /* ---------- Model inputs ---------- */

  function cachedIV(target, o) {
    var key = [target, o.type, o.S, o.K, Math.round(o.T * 525600), o.r, o.q, o.style].join("|");
    if (ivCache[key]) return ivCache[key];
    if (ivCacheSize > 400) {
      ivCache = {};
      ivCacheSize = 0;
    }
    ivCacheSize += 1;
    ivCache[key] = E.impliedVol(target, o, HEAD_STEPS);
    return ivCache[key];
  }

  function info(text) {
    return { kind: "info", text: text };
  }

  function warn(text) {
    return { kind: "warn", text: text };
  }

  function readModel() {
    C.clearErrors(form);
    var notices = [];
    var ok = true;
    var now = Date.now();
    var today = todayYmd();

    var spot = C.requireFinite(form, "spot", "the underlying price", { gt: 0 });
    if (spot == null) ok = false;
    var style = el("style").value === "european" ? "european" : "american";
    var rIn = optNum(el("rate").value);
    var qIn = optNum(el("divYield").value);
    if (el("rate").value.trim() && rIn == null) { C.setFieldError(el("rate"), "Enter a number or leave blank."); ok = false; }
    if (rIn != null && (rIn < -5 || rIn > 50)) { C.setFieldError(el("rate"), "Use a rate between -5% and 50%."); ok = false; }
    if (el("divYield").value.trim() && qIn == null) { C.setFieldError(el("divYield"), "Enter a number or leave blank."); ok = false; }
    if (qIn != null && (qIn < 0 || qIn > 50)) { C.setFieldError(el("divYield"), "Use a yield between 0% and 50%."); ok = false; }
    var mult = C.requireFinite(form, "multiplier", "the contract multiplier", { gt: 0 });
    if (mult == null) ok = false;
    var basis = el("basis").value;

    var legs = [];
    for (var i = 0; i < legCount; i += 1) {
      var p = "l" + i + "_";
      var raw = legRaw(i);
      var qty = C.requireFinite(form, p + "qty", "contracts", { gt: 0 });
      var strike = C.requireFinite(form, p + "strike", "the strike", { gt: 0 });
      var expOk = parseYmd(raw.exp) != null;
      if (!expOk) {
        C.setFieldError(el(p + "exp"), "Enter the expiration date.");
      } else if (raw.exp < today || (raw.exp === today && now >= closeMs(today))) {
        C.setFieldError(el(p + "exp"), "This expiration has passed.");
        expOk = false;
      }
      var leg = {
        index: i,
        side: raw.side === "sell" ? "sell" : "buy",
        type: raw.type === "put" ? "put" : "call",
        qty: qty == null ? null : Math.max(1, Math.round(qty)),
        strike: strike,
        expYmd: raw.exp,
        bid: optNum(raw.bid),
        ask: optNum(raw.ask),
        ivIn: optNum(raw.iv),
        entryIn: optNum(raw.entry),
        broker: {},
      };
      ["bid", "ask", "entry"].forEach(function (k) {
        var v = optNum(raw[k]);
        if (raw[k].trim() && v == null) { C.setFieldError(el(p + k), "Enter a number or leave blank."); ok = false; }
        if (v != null && v < 0) { C.setFieldError(el(p + k), "Cannot be negative."); ok = false; }
      });
      if (raw.iv.trim() && leg.ivIn == null) { C.setFieldError(el(p + "iv"), "Enter a number or leave blank."); ok = false; }
      if (leg.ivIn != null && (leg.ivIn <= 0 || leg.ivIn > 1000)) { C.setFieldError(el(p + "iv"), "Use an IV above 0% and up to 1,000%."); ok = false; }
      if (leg.bid != null && leg.ask != null && leg.bid > leg.ask) { C.setFieldError(el(p + "ask"), "Ask is below the bid."); ok = false; }
      GREEK_FIELDS.forEach(function (g) {
        leg.broker[g.greek] = optNum(raw[g.key]);
      });
      if (qty == null || strike == null || !expOk) ok = false;
      legs.push(leg);
    }
    if (!ok) return { ok: false, notices: notices };

    var r = (rIn || 0) / 100;
    var q = (qIn || 0) / 100;
    if (rIn == null) notices.push(info("Risk-free rate not entered, so 0% is used."));
    if (qIn == null) notices.push(info("Dividend yield not entered, so 0% is used."));

    legs.forEach(function (L) {
      var p = "l" + L.index + "_";
      var n = "Leg " + (L.index + 1);
      L.sign = L.side === "sell" ? -1 : 1;
      L.units = L.sign * L.qty * mult;
      L.expMs = closeMs(L.expYmd);
      L.T0 = Math.max(0, (L.expMs - now) / YEAR_MS);
      L.mid = L.bid != null && L.ask != null ? (L.bid + L.ask) / 2 : null;
      L.base = { type: L.type, S: spot, K: L.strike, T: L.T0, r: r, q: q, style: style };
      var ref = null;
      var refLabel = "";
      if (L.mid != null && L.mid > 0) { ref = L.mid; refLabel = "the mid price"; }
      else if (L.entryIn != null && L.entryIn > 0) { ref = L.entryIn; refLabel = "your custom entry price"; }
      else if (L.bid != null && L.bid > 0) { ref = L.bid; refLabel = "the bid"; }
      else if (L.ask != null && L.ask > 0) { ref = L.ask; refLabel = "the ask"; }
      L.ivSolved = false;
      if (L.ivIn != null) {
        L.iv = L.ivIn / 100;
      } else if (ref != null) {
        var res = cachedIV(ref, L.base);
        if (res.error) {
          C.setFieldError(el(p + "iv"), "Cannot calculate IV: " + res.error + ". Enter IV directly.");
          ok = false;
        } else {
          L.iv = res.iv;
          L.ivSolved = true;
          notices.push(info(n + " IV calculated from " + refLabel + ": " + pct(L.iv * 100, 2) + "."));
        }
      } else {
        C.setFieldError(el(p + "iv"), "Enter IV, or a bid and ask so IV can be calculated.");
        ok = false;
      }
    });
    if (!ok) return { ok: false, notices: notices };

    var entryCost = 0;
    legs.forEach(function (L) {
      var n = "Leg " + (L.index + 1);
      var o = E.assign(L.base, { sigma: L.iv });
      L.modelToday = E.price(o, HEAD_STEPS);
      L.greeksToday = E.greeks(o, HEAD_STEPS);
      if (L.entryIn != null) {
        L.entryPx = L.entryIn;
        L.entrySrc = "custom";
      } else {
        var want = basis === "conservative" ? (L.sign > 0 ? "ask" : "bid") : basis;
        var pick = null;
        if (want === "mid" && L.mid != null) pick = ["mid", L.mid];
        else if (want === "bid" && L.bid != null) pick = ["bid", L.bid];
        else if (want === "ask" && L.ask != null) pick = ["ask", L.ask];
        else if (L.mid != null) pick = ["mid", L.mid];
        else if (L.bid != null) pick = ["bid", L.bid];
        else if (L.ask != null) pick = ["ask", L.ask];
        if (pick) {
          L.entryPx = pick[1];
          L.entrySrc = pick[0];
          if (pick[0] !== want) notices.push(info(n + " has no " + want + ", so the " + pick[0] + " (" + money(pick[1]) + ") is used as the entry price."));
        } else {
          L.entryPx = L.modelToday;
          L.entrySrc = "model";
          notices.push(info(n + " entry price is the model value today (" + money(L.modelToday) + ") because no bid, ask, or custom price was entered."));
        }
      }
      if (!L.ivSolved && L.mid != null && L.mid > 0) {
        var gap = L.modelToday - L.mid;
        if (Math.abs(gap) > Math.max(0.02, 0.03 * L.mid)) {
          var implied = cachedIV(L.mid, L.base);
          notices.push(warn(n + ": the entered IV prices this option at " + money(L.modelToday) + " versus a " + money(L.mid) + " mid" +
            (implied.error ? "." : ". The mid implies IV of " + pct(implied.iv * 100, 2) + ". Leave IV blank to use it.")));
        }
      }
      if (L.mid != null && L.mid > 0 && (L.ask - L.bid) / L.mid > 0.1) {
        notices.push(warn(n + " bid/ask spread is " + pct(((L.ask - L.bid) / L.mid) * 100, 0) + " of the mid. Real fills and exits may differ."));
      }
      entryCost += L.units * L.entryPx;
    });

    var horizonMs = Infinity;
    var latestYmd = legs[0].expYmd;
    var horizonYmd = legs[0].expYmd;
    legs.forEach(function (L) {
      if (L.expMs < horizonMs) { horizonMs = L.expMs; horizonYmd = L.expYmd; }
      if (L.expYmd > latestYmd) latestYmd = L.expYmd;
    });

    return {
      ok: true, notices: notices, now: now, today: today, spot: spot, style: style, r: r, q: q,
      rIn: rIn, qIn: qIn, mult: mult, basis: basis, legs: legs, entryCost: entryCost,
      horizonMs: horizonMs, horizonYmd: horizonYmd, latestYmd: latestYmd,
      multiExpiry: legs.some(function (L) { return L.expMs !== horizonMs; }),
    };
  }

  /* ---------- Valuation ---------- */

  function legSigma(L, shift) {
    return Math.max(0.01, L.iv + shift);
  }

  function legValue(m, L, S, valMs, shift, steps) {
    var T = (L.expMs - valMs) / YEAR_MS;
    if (!(T > 0)) return E.intrinsic(L.type, S, L.strike);
    return E.price({ type: L.type, S: S, K: L.strike, T: T, r: m.r, q: m.q, sigma: legSigma(L, shift), style: m.style }, steps);
  }

  function legGreeks(m, L, S, valMs, shift) {
    var T = (L.expMs - valMs) / YEAR_MS;
    return E.greeks({ type: L.type, S: S, K: L.strike, T: Math.max(0, T), r: m.r, q: m.q, sigma: legSigma(L, shift), style: m.style }, HEAD_STEPS);
  }

  function positionValue(m, S, valMs, shift, steps) {
    var v = 0;
    for (var i = 0; i < m.legs.length; i += 1) v += m.legs[i].units * legValue(m, m.legs[i], S, valMs, shift, steps);
    return v;
  }

  function clampScenario(m) {
    var today = m.today;
    if (!scen.date || scen.date < today) scen.date = today;
    if (scen.date > m.latestYmd) scen.date = m.latestYmd;
    if (!Number.isFinite(scen.pct)) scen.pct = 0;
    scen.pct = Math.max(-99, Math.min(1000, scen.pct));
    if (!Number.isFinite(scen.shift)) scen.shift = 0;
    var lead = m.legs[0].iv;
    if (lead + scen.shift < 0.01) scen.shift = 0.01 - lead;
  }

  function analyze(m) {
    clampScenario(m);
    var S = m.spot * (1 + scen.pct / 100);
    var valMs = valuationMs(scen.date);
    var shift = scen.shift;
    var out = { S: S, valMs: valMs, shift: shift, legs: [] };

    var value = 0;
    var gToday = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    var gScen = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    var valueToday = 0;
    m.legs.forEach(function (L) {
      var v = legValue(m, L, S, valMs, shift, HEAD_STEPS);
      var g = legGreeks(m, L, S, valMs, shift);
      value += L.units * v;
      valueToday += L.units * L.modelToday;
      Object.keys(gScen).forEach(function (k) {
        gScen[k] += L.units * g[k];
        gToday[k] += L.units * L.greeksToday[k];
      });
      out.legs.push({ value: v, greeks: g, pnl: L.units * (v - L.entryPx), expired: L.expMs <= valMs });
    });
    out.value = value;
    out.valueToday = valueToday;
    out.pnl = value - m.entryCost;
    out.pnlPct = Math.abs(m.entryCost) > 0.005 ? (out.pnl / Math.abs(m.entryCost)) * 100 : NaN;
    out.gToday = gToday;
    out.gScen = gScen;

    /* Horizon (first expiration) analysis */
    var hMs = m.horizonMs;
    var fnH = function (x) { return positionValue(m, x, hMs, shift, GRID_STEPS) - m.entryCost; };
    var fnT = function (x) { return positionValue(m, x, valMs, shift, GRID_STEPS) - m.entryCost; };
    out.fnH = fnH;
    out.fnT = fnT;

    var wSum = 0;
    var ivSum = 0;
    m.legs.forEach(function (L) {
      if (L.expMs === hMs) {
        wSum += Math.abs(L.units);
        ivSum += Math.abs(L.units) * L.iv;
      }
    });
    var sigmaPop = wSum > 0 ? ivSum / wSum : m.legs[0].iv;
    var Th = Math.max((hMs - m.now) / YEAR_MS, 1 / (365 * 24));
    var spread = sigmaPop * Math.sqrt(Th);
    var grid = [];
    for (var i = 0; i <= 160; i += 1) grid.push(m.spot * Math.exp(-7 * spread + (14 * spread * i) / 160));
    m.legs.forEach(function (L) { grid.push(L.strike); });
    grid.push(m.spot * 0.001);
    grid = grid.filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });

    var regH = E.profitRegions(fnH, grid);
    out.breakevens = regH.crossings;
    out.pop = E.probabilityOfProfit(regH, m.spot, Th, m.r - m.q, sigmaPop);
    out.sigmaPop = sigmaPop;
    if (scen.date !== m.today && valMs < hMs - 60000) {
      out.breakevensTarget = E.profitRegions(fnT, grid).crossings;
    } else {
      out.breakevensTarget = null;
    }

    var vals = regH.values;
    var maxP = -Infinity;
    var maxL = Infinity;
    vals.forEach(function (v) {
      if (v > maxP) maxP = v;
      if (v < maxL) maxL = v;
    });
    var top = grid[grid.length - 1];
    var slope = fnH(top * 3) - fnH(top * 1.5);
    var tol = 0.01 * Math.max(1, Math.abs(m.entryCost));
    out.maxProfit = slope > tol ? Infinity : maxP;
    out.maxLoss = slope < -tol ? -Infinity : maxL;
    return out;
  }

  /* ---------- Rendering: summary ---------- */

  function stat(label, value, sub) {
    return '<div class="stat"><span class="label">' + label + '</span><span class="value">' + value + "</span>" +
      (sub ? '<span class="stat-sub">' + sub + "</span>" : "") + "</div>";
  }

  function legLabel(m, L) {
    return (L.side === "sell" ? "Sell " : "Buy ") + L.qty + " " + (L.type === "put" ? "Put" : "Call") + " " +
      num(L.strike, L.strike % 1 ? 2 : 0) + " " + fmtDate(L.expYmd);
  }

  function beText(list) {
    if (!list || !list.length) return "None in range";
    return list.slice(0, 4).map(function (x) { return money(x); }).join(", ");
  }

  function renderSummary(m, a) {
    var single = m.legs.length === 1;
    var L0 = m.legs[0];
    var hero;
    var dateText = scen.date === m.today ? "today" : "on " + fmtDate(scen.date, true);
    if (single) {
      hero = '<div class="result-hero"><p class="label">Option value per share at ' + money(a.S) + " " + dateText + '</p><p class="value">' +
        money(a.legs[0].value) + '</p><p class="sub">' + money(Math.abs(a.value)) + " for " + L0.qty + " contract" + (L0.qty > 1 ? "s" : "") +
        " · P&amp;L <strong>" + signedMoney(a.pnl) + "</strong> (" + signedPct(a.pnlPct) + ")</p></div>";
    } else {
      var sameQty = m.legs.every(function (L) { return L.qty === m.legs[0].qty; });
      var minQty = Math.min.apply(null, m.legs.map(function (L) { return L.qty; }));
      var perUnit = a.value / (minQty * m.mult);
      hero = '<div class="result-hero"><p class="label">Net position value at ' + money(a.S) + " " + dateText + '</p><p class="value">' +
        money(a.value) + '</p><p class="sub">' + (a.value < -0.005 ? "Negative means it costs this much to close. " : "") +
        (sameQty || minQty === 1 ? "Net " + money(perUnit) + " per share per spread · " : "") +
        "P&amp;L <strong>" + signedMoney(a.pnl) + "</strong> (" + signedPct(a.pnlPct) + ")</p></div>";
    }
    var debit = m.entryCost >= 0;
    var expLabel = m.multiExpiry ? "at first expiration" : "at expiration";
    var html = hero + '<div class="stat-grid">' +
      stat("Profit / loss", signedMoney(a.pnl), signedPct(a.pnlPct) + " of " + (debit ? "cost" : "credit")) +
      stat(debit ? "Net debit paid" : "Net credit received", money(Math.abs(m.entryCost))) +
      stat("Breakeven " + expLabel, beText(a.breakevens)) +
      stat("Probability of profit", pct(a.pop * 100, 1), "model-implied, " + expLabel) +
      stat("Max profit " + expLabel, a.maxProfit === Infinity ? "Unlimited" : signedMoney(a.maxProfit)) +
      stat("Max loss " + expLabel, a.maxLoss === -Infinity ? "Unlimited" : signedMoney(a.maxLoss)) +
      (a.breakevensTarget ? stat("Breakeven on target date", beText(a.breakevensTarget)) : "") +
      stat("Model value today", money(a.valueToday), "at current price and IV") +
      "</div>";
    if (m.notices.length) {
      html += '<ul class="notice-list">' + m.notices.map(function (n) {
        return '<li class="callout' + (n.kind === "warn" ? " warn" : "") + '">' + esc(n.text) + "</li>";
      }).join("") + "</ul>";
    }
    document.getElementById("results").innerHTML = html;
  }

  /* ---------- Rendering: scenario controls ---------- */

  function syncScenario(m, skip) {
    var priceEl = document.getElementById("sc-price");
    var priceNum = document.getElementById("sc-price-num");
    var pctEl = document.getElementById("sc-pct");
    var pctNum = document.getElementById("sc-pct-num");
    var dateEl = document.getElementById("sc-date");
    var dateInput = document.getElementById("sc-date-input");
    var ivEl = document.getElementById("sc-iv");
    var ivNum = document.getElementById("sc-iv-num");
    var S = m.spot * (1 + scen.pct / 100);
    priceEl.min = (m.spot * 0.5).toFixed(2);
    priceEl.max = (m.spot * 2).toFixed(2);
    priceEl.step = m.spot >= 1000 ? "0.1" : "0.01";
    if (skip !== priceEl) priceEl.value = S.toFixed(2);
    if (skip !== priceNum) priceNum.value = S.toFixed(2);
    if (skip !== pctEl) pctEl.value = scen.pct.toFixed(1);
    if (skip !== pctNum) pctNum.value = (Math.round(scen.pct * 100) / 100).toString();

    var maxDays = daysBetween(m.today, m.latestYmd);
    dateEl.max = String(maxDays);
    if (skip !== dateEl) dateEl.value = String(daysBetween(m.today, scen.date));
    dateInput.min = m.today;
    dateInput.max = m.latestYmd;
    if (skip !== dateInput) dateInput.value = scen.date;
    var daysOut = daysBetween(m.today, scen.date);
    var toFirst = daysBetween(scen.date, m.horizonYmd);
    var dateNote = (daysOut === 0 ? "Today" : daysOut + " day" + (daysOut === 1 ? "" : "s") + " from today") + " · ";
    if (toFirst > 0) dateNote += toFirst + " day" + (toFirst === 1 ? "" : "s") + " to " + (m.multiExpiry ? "first expiration " : "expiration ") + fmtDate(m.horizonYmd);
    else if (toFirst === 0) dateNote += "expiration day (valued at the close)";
    else dateNote += "after the first expiration; expired legs at intrinsic value";
    document.getElementById("sc-date-note").textContent = dateNote;

    var lead = m.legs[0];
    var ivNow = (lead.iv + scen.shift) * 100;
    ivEl.min = "1";
    ivEl.max = String(Math.max(300, Math.ceil(lead.iv * 100 * 1.5)));
    if (skip !== ivEl) ivEl.value = ivNow.toFixed(1);
    if (skip !== ivNum) ivNum.value = (Math.round(ivNow * 10) / 10).toString();
    var base = (lead.ivSolved ? "Calculated " : "Entered ") + pct(lead.iv * 100, 1);
    var shiftPts = scen.shift * 100;
    var note = base + (Math.abs(shiftPts) >= 0.05 ? " · shift " + (shiftPts > 0 ? "+" : "") + num(shiftPts, 1) + " pts" : "");
    if (m.legs.length > 1) note += ". Other legs move by the same points.";
    document.getElementById("sc-iv-note").textContent = note;
  }

  /* ---------- Rendering: payoff chart ---------- */

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

  var chartState = null;

  function renderChart(m, a) {
    var wrap = document.getElementById("payoff-chart");
    var W = Math.max(300, Math.floor(wrap.clientWidth || 640));
    var H = W < 560 ? 260 : 330;
    var padL = 64;
    var padR = 84;
    var padT = 16;
    var padB = 38;
    var R = Math.max(+document.getElementById("heat-range").value / 100, Math.abs(scen.pct) / 100 + 0.05);
    var xMin = Math.max(m.spot * 0.01, m.spot * (1 - R));
    var xMax = m.spot * (1 + R);
    if (a.S > xMax) xMax = a.S * 1.05;
    var N = W < 560 ? 81 : 121;
    var xs = [];
    var yT = [];
    var yH = [];
    for (var i = 0; i < N; i += 1) {
      var x = xMin + ((xMax - xMin) * i) / (N - 1);
      xs.push(x);
      yT.push(a.fnT(x));
      yH.push(a.fnH(x));
    }
    var all = yT.concat(yH).concat([0]);
    var yMin = Math.min.apply(null, all);
    var yMax = Math.max.apply(null, all);
    var padY = (yMax - yMin) * 0.08 || 1;
    yMin -= padY;
    yMax += padY;
    var yTicks = niceTicks(yMin, yMax, 5);
    yMin = Math.min(yMin, yTicks[0]);
    yMax = Math.max(yMax, yTicks[yTicks.length - 1]);
    var xTicks = niceTicks(xMin, xMax, W < 560 ? 4 : 7).filter(function (t) { return t >= xMin && t <= xMax; });
    var pw = W - padL - padR;
    var ph = H - padT - padB;
    function sx(x) { return padL + ((x - xMin) / (xMax - xMin)) * pw; }
    function sy(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * ph; }
    function path(ys) {
      return ys.map(function (y, k) { return (k ? "L" : "M") + sx(xs[k]).toFixed(1) + " " + sy(y).toFixed(1); }).join(" ");
    }
    var svg = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Profit and loss by underlying price on the target date and at expiration">';
    yTicks.forEach(function (t) {
      if (t < yMin || t > yMax) return;
      svg += '<line class="grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + sy(t).toFixed(1) + '" y2="' + sy(t).toFixed(1) + '"/>';
      svg += '<text class="axis" x="' + (padL - 8) + '" y="' + (sy(t) + 4).toFixed(1) + '" text-anchor="end">' + compactMoney(t, true) + "</text>";
    });
    xTicks.forEach(function (t) {
      svg += '<text class="axis" x="' + sx(t).toFixed(1) + '" y="' + (H - padB + 20) + '" text-anchor="middle">$' + num(t, t >= 100 ? 0 : 2) + "</text>";
    });
    svg += '<line class="zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + sy(0).toFixed(1) + '" y2="' + sy(0).toFixed(1) + '"/>';
    if (m.spot >= xMin && m.spot <= xMax) {
      svg += '<line class="now" x1="' + sx(m.spot).toFixed(1) + '" x2="' + sx(m.spot).toFixed(1) + '" y1="' + padT + '" y2="' + (H - padB) + '"/>';
      svg += '<text class="axis now-label" x="' + (sx(m.spot) + 4).toFixed(1) + '" y="' + (padT + 11) + '">Now</text>';
    }
    a.breakevens.forEach(function (b) {
      if (b < xMin || b > xMax) return;
      svg += '<circle class="be" cx="' + sx(b).toFixed(1) + '" cy="' + sy(0).toFixed(1) + '" r="4"/>';
    });
    svg += '<path class="line line-2" d="' + path(yH) + '"/>';
    svg += '<path class="line line-1" d="' + path(yT) + '"/>';
    var scenY = a.fnT(a.S);
    svg += '<circle class="scen-dot" cx="' + sx(a.S).toFixed(1) + '" cy="' + sy(scenY).toFixed(1) + '" r="5.5"/>';
    var endT = sy(yT[N - 1]);
    var endH = sy(yH[N - 1]);
    if (Math.abs(endT - endH) < 15) {
      var mid = (endT + endH) / 2;
      if (endT <= endH) { endT = mid - 8; endH = mid + 8; } else { endT = mid + 8; endH = mid - 8; }
    }
    svg += '<text class="end-label" x="' + (W - padR + 6) + '" y="' + (endT + 4).toFixed(1) + '">Target date</text>';
    svg += '<text class="end-label" x="' + (W - padR + 6) + '" y="' + (endH + 4).toFixed(1) + '">Expiration</text>';
    svg += '<line class="cross" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/>';
    svg += '<circle class="hover-dot hover-1" r="4" visibility="hidden"/><circle class="hover-dot hover-2" r="4" visibility="hidden"/>';
    svg += '<rect class="hit" x="' + padL + '" y="' + padT + '" width="' + pw + '" height="' + ph + '"/>';
    svg += "</svg>";
    wrap.innerHTML = svg + '<div class="chart-tip" hidden></div>';
    chartState = { xs: xs, yT: yT, yH: yH, sx: sx, sy: sy, padL: padL, pw: pw, spot: m.spot, W: W };

    var tDate = scen.date === m.today ? "today" : fmtDate(scen.date);
    document.getElementById("chart-legend").innerHTML =
      '<span class="lg"><i class="sw sw-1"></i>On target date (' + tDate + ")</span>" +
      '<span class="lg"><i class="sw sw-2"></i>At ' + (m.multiExpiry ? "first " : "") + "expiration (" + fmtDate(m.horizonYmd) + ")</span>";
    document.getElementById("chart-note").textContent =
      "The dot marks your scenario price. Circles on the zero line mark breakevens at expiration. Lines use the scenario IV" +
      (Math.abs(scen.shift) >= 0.0005 ? " (" + (scen.shift > 0 ? "+" : "") + num(scen.shift * 100, 1) + " pts)" : "") + ".";
  }

  function chartHover(evt) {
    if (!chartState) return;
    var wrap = document.getElementById("payoff-chart");
    var svg = wrap.querySelector("svg");
    var tip = wrap.querySelector(".chart-tip");
    if (!svg || !tip) return;
    var rect = svg.getBoundingClientRect();
    var scale = chartState.W / rect.width;
    var px = (evt.clientX - rect.left) * scale;
    var cs = chartState;
    var frac = (px - cs.padL) / cs.pw;
    var idx = Math.max(0, Math.min(cs.xs.length - 1, Math.round(frac * (cs.xs.length - 1))));
    var x = cs.sx(cs.xs[idx]);
    var cross = svg.querySelector(".cross");
    cross.setAttribute("x1", x);
    cross.setAttribute("x2", x);
    cross.setAttribute("visibility", "visible");
    var d1 = svg.querySelector(".hover-1");
    var d2 = svg.querySelector(".hover-2");
    d1.setAttribute("cx", x); d1.setAttribute("cy", cs.sy(cs.yT[idx])); d1.setAttribute("visibility", "visible");
    d2.setAttribute("cx", x); d2.setAttribute("cy", cs.sy(cs.yH[idx])); d2.setAttribute("visibility", "visible");
    var move = (cs.xs[idx] / cs.spot - 1) * 100;
    tip.innerHTML = "<strong>" + money(cs.xs[idx]) + "</strong> <span>(" + signedPct(move) + ")</span>" +
      '<span class="tip-row"><i class="sw sw-1"></i>Target date <b>' + signedMoney(cs.yT[idx]) + "</b></span>" +
      '<span class="tip-row"><i class="sw sw-2"></i>Expiration <b>' + signedMoney(cs.yH[idx]) + "</b></span>";
    tip.hidden = false;
    var left = x / scale + 12;
    if (left + 190 > rect.width) left = x / scale - 200;
    tip.style.left = Math.max(0, left) + "px";
    tip.style.top = "8px";
  }

  function chartLeave() {
    var wrap = document.getElementById("payoff-chart");
    var svg = wrap.querySelector("svg");
    var tip = wrap.querySelector(".chart-tip");
    if (tip) tip.hidden = true;
    if (!svg) return;
    C.$$(".cross, .hover-dot", svg).forEach(function (n) { n.setAttribute("visibility", "hidden"); });
  }

  /* ---------- Rendering: heat map ---------- */

  function heatMetric() {
    var c = document.querySelector('input[name="heatMetric"]:checked');
    return c ? c.value : "pnl";
  }

  function setHeatMetric(v) {
    C.$$('input[name="heatMetric"]').forEach(function (r) { r.checked = r.value === v; });
  }

  function renderHeat(m, a) {
    var R = +document.getElementById("heat-range").value / 100;
    var metric = heatMetric();
    var rows = 15;
    var total = daysBetween(m.today, m.latestYmd);
    var cols = Math.min(12, total + 1);
    var offsets = [];
    for (var c = 0; c < cols; c += 1) {
      var off = cols === 1 ? 0 : Math.round((c * total) / (cols - 1));
      if (offsets.indexOf(off) === -1) offsets.push(off);
    }
    var dates = offsets.map(function (o) { return addDays(m.today, o); });
    var valTimes = dates.map(function (d) { return valuationMs(d); });
    var dateLong = dates.map(function (d, k) { return k === 0 ? "today" : fmtDate(d, true); });
    var prices = [];
    for (var r = 0; r < rows; r += 1) prices.push(m.spot * (1 + R - (2 * R * r) / (rows - 1)));
    var basisAbs = Math.abs(m.entryCost);
    var cells = [];
    var maxAbs = 0;
    var minV = Infinity;
    var maxV = -Infinity;
    prices.forEach(function (S) {
      var row = [];
      dates.forEach(function (d, k) {
        var v = positionValue(m, S, valTimes[k], a.shift, GRID_STEPS);
        var pnl = v - m.entryCost;
        var shown = metric === "value" ? v : metric === "pnlPct" ? (basisAbs > 0.005 ? (pnl / basisAbs) * 100 : NaN) : pnl;
        row.push({ v: v, pnl: pnl, shown: shown });
        if (Number.isFinite(shown)) {
          maxAbs = Math.max(maxAbs, Math.abs(shown));
          minV = Math.min(minV, shown);
          maxV = Math.max(maxV, shown);
        }
      });
      cells.push(row);
    });
    var sequential = metric === "value" && minV >= 0;
    var rowNear = 0;
    var bestD = Infinity;
    prices.forEach(function (S, k) {
      if (Math.abs(S - a.S) < bestD) { bestD = Math.abs(S - a.S); rowNear = k; }
    });
    var colNear = 0;
    bestD = Infinity;
    var scenOff = daysBetween(m.today, scen.date);
    offsets.forEach(function (o, k) {
      if (Math.abs(o - scenOff) < bestD) { bestD = Math.abs(o - scenOff); colNear = k; }
    });

    var html = '<table class="heat"><thead><tr><th scope="col">Price</th>';
    dates.forEach(function (d, k) {
      var label = k === 0 ? "Today" : fmtDate(d);
      var sub = d === m.latestYmd ? "exp" : daysBetween(m.today, d) + "d";
      html += '<th scope="col" class="num' + (k === colNear ? " hm-col" : "") + '">' + label + '<span class="hm-sub">' + (k === 0 ? "now" : sub) + "</span></th>";
    });
    html += "</tr></thead><tbody>";
    cells.forEach(function (row, ri) {
      var S = prices[ri];
      var move = (S / m.spot - 1) * 100;
      html += '<tr class="' + (ri === rowNear ? "hm-row" : "") + '"><th scope="row" class="num">' + money(S) + '<span class="hm-sub">' + signedPct(move, 0) + "</span></th>";
      row.forEach(function (cell, ci) {
        var t = 0;
        var cls = "hm-mid";
        if (Number.isFinite(cell.shown) && maxAbs > 0) {
          if (sequential) {
            t = maxV > minV ? (cell.shown - minV) / (maxV - minV) : 0;
            cls = "hm-seq";
          } else {
            t = Math.abs(cell.shown) / maxAbs;
            cls = cell.shown > 0 ? "hm-pos" : cell.shown < 0 ? "hm-neg" : "hm-mid";
          }
        }
        var text = metric === "pnlPct" ? signedPct(cell.shown, 0) : compactMoney(cell.shown, metric !== "value");
        var title = "At " + money(S) + " on " + dateLong[ci] + ": value " + money(cell.v) +
          ", P&L " + signedMoney(cell.pnl) + (basisAbs > 0.005 ? " (" + signedPct((cell.pnl / basisAbs) * 100) + ")" : "");
        html += '<td class="num ' + cls + (ri === rowNear && ci === colNear ? " hm-hit" : "") + '" style="--t:' + Math.round(t * 100) + '%" title="' + esc(title) + '">' + text + "</td>";
      });
      html += "</tr>";
    });
    html += "</tbody></table>";
    document.getElementById("heat-map").innerHTML = html;
    document.getElementById("heat-note").textContent =
      (metric === "value" ? "Position value" : metric === "pnlPct" ? "P&L as a % of net " + (m.entryCost >= 0 ? "cost" : "credit") : "Total P&L in dollars") +
      " at scenario IV" + (Math.abs(a.shift) >= 0.0005 ? " (" + (a.shift > 0 ? "+" : "") + num(a.shift * 100, 1) + " pts)" : "") +
      ". Blue is profit, red is loss, gray is near zero. The outlined cell is closest to your scenario. Hover a cell for details.";
  }

  /* ---------- Rendering: Greeks & legs ---------- */

  function greekStatus(g, broker, model) {
    var diff = broker - model;
    var tolAbs = { delta: 0.03, gamma: 0.002, theta: 0.005, vega: 0.005 }[g];
    var off = Math.abs(diff) > tolAbs && (g === "delta" || Math.abs(diff) > 0.15 * Math.abs(model));
    return off;
  }

  function renderGreeks(m, a) {
    var rowsDef = [
      ["delta", "Delta", "share-equivalents", function (v) { return num(v, 1); }],
      ["gamma", "Gamma", "delta change per $1 move", function (v) { return num(v, 2); }],
      ["theta", "Theta", "$ per calendar day", function (v) { return signedMoney(v); }],
      ["vega", "Vega", "$ per 1 point of IV", function (v) { return signedMoney(v); }],
      ["rho", "Rho", "$ per 1 point of rates", function (v) { return signedMoney(v); }],
    ];
    var html = '<div class="greeks-grid"><div><h3>Position Greeks</h3><div class="table-wrap"><table><thead><tr><th>Greek</th><th class="num">Today</th><th class="num">Scenario</th></tr></thead><tbody>';
    rowsDef.forEach(function (r) {
      html += "<tr><td>" + r[1] + '<span class="hm-sub">' + r[2] + '</span></td><td class="num">' + r[3](a.gToday[r[0]]) + '</td><td class="num">' + r[3](a.gScen[r[0]]) + "</td></tr>";
    });
    html += "</tbody></table></div></div>";

    html += '<div><h3>Leg detail</h3><div class="table-wrap"><table><thead><tr><th>Leg</th><th class="num">IV used</th><th class="num">Entry</th><th class="num">Model today</th><th class="num">Scenario</th><th class="num">Scenario P&amp;L</th></tr></thead><tbody>';
    m.legs.forEach(function (L, i) {
      var la = a.legs[i];
      var src = { mid: "mid", bid: "bid", ask: "ask", custom: "custom", model: "model" }[L.entrySrc];
      html += "<tr><td>" + esc(legLabel(m, L)) + '</td><td class="num">' + pct(legSigma(L, a.shift) * 100, 1) +
        (L.ivSolved ? '<span class="hm-sub">calculated</span>' : "") + '</td><td class="num">' + money(L.entryPx) + '<span class="hm-sub">' + src + "</span></td>" +
        '<td class="num">' + money(L.modelToday) + '</td><td class="num">' + money(la.value) + (la.expired ? '<span class="hm-sub">expired</span>' : "") +
        '</td><td class="num">' + signedMoney(la.pnl) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    html += '<div class="table-wrap"><table><thead><tr><th>Leg Greeks per share</th><th class="num">Delta</th><th class="num">Gamma</th><th class="num">Theta</th><th class="num">Vega</th></tr></thead><tbody>';
    m.legs.forEach(function (L, i) {
      var g = a.legs[i].greeks;
      html += "<tr><td>Leg " + (i + 1) + ' <span class="hm-sub">scenario</span></td><td class="num">' + num(g.delta, 3) + '</td><td class="num">' + num(g.gamma, 4) +
        '</td><td class="num">' + num(g.theta, 4) + '</td><td class="num">' + num(g.vega, 4) + "</td></tr>";
    });
    html += "</tbody></table></div></div></div>";

    var compare = [];
    m.legs.forEach(function (L, i) {
      GREEK_FIELDS.forEach(function (gf) {
        var b = L.broker[gf.greek];
        if (b == null) return;
        var model = L.greeksToday[gf.greek];
        compare.push({ leg: i + 1, label: gf.label, broker: b, model: model, off: greekStatus(gf.greek, b, model), digits: gf.digits });
      });
    });
    if (compare.length) {
      html += '<h3>Your broker Greeks vs the model (today)</h3><div class="table-wrap"><table><thead><tr><th>Leg</th><th>Greek</th><th class="num">Broker</th><th class="num">Model</th><th class="num">Difference</th><th>Status</th></tr></thead><tbody>';
      compare.forEach(function (c) {
        html += "<tr><td>Leg " + c.leg + "</td><td>" + c.label + '</td><td class="num">' + num(c.broker, c.digits) + '</td><td class="num">' + num(c.model, c.digits) +
          '</td><td class="num">' + num(c.broker - c.model, c.digits) + "</td><td>" +
          (c.off ? '<span class="badge badge-warn">⚠ Check</span>' : '<span class="badge badge-ok">✓ Close</span>') + "</td></tr>";
      });
      html += '</tbody></table></div><p class="hint">Broker Greeks are for comparison only and do not change the price. Differences usually come from a different IV, dividend, rate, or a theta quoted per trading day.</p>';
    }
    document.getElementById("greeks").innerHTML = html;
  }

  /* ---------- Placeholders, summaries, URL ---------- */

  function updatePlaceholders(m) {
    for (var i = 0; i < MAX_LEGS; i += 1) {
      var L = m && m.legs[i];
      var ivEl = el("l" + i + "_iv");
      if (ivEl) ivEl.placeholder = L && L.ivSolved ? (L.iv * 100).toFixed(2) + " calc." : "";
      var entryEl = el("l" + i + "_entry");
      if (entryEl) entryEl.placeholder = L && L.entrySrc !== "custom" ? L.entryPx.toFixed(2) + " (" + L.entrySrc + ")" : "";
      GREEK_FIELDS.forEach(function (g) {
        var ge = el("l" + i + "_" + g.key);
        if (ge) ge.placeholder = L ? "model " + num(L.greeksToday[g.greek], g.digits) : "";
      });
      var sum = form.querySelector('[data-summary="' + i + '"]');
      if (sum) sum.textContent = L ? "· " + legLabel(m, L) : "";
    }
  }

  function serialize() {
    var p = new URLSearchParams();
    p.set("s", el("spot").value.trim());
    if (el("style").value === "european") p.set("st", "e");
    if (el("rate").value.trim()) p.set("r", el("rate").value.trim());
    if (el("divYield").value.trim()) p.set("q", el("divYield").value.trim());
    if (el("multiplier").value.trim() !== "100") p.set("m", el("multiplier").value.trim());
    if (el("basis").value !== "mid") p.set("b", el("basis").value);
    for (var i = 0; i < legCount; i += 1) {
      p.set("l" + (i + 1), LEG_FIELDS.map(function (k) { return legVal(i, k).replace(/~/g, "").trim(); }).join("~").replace(/~+$/, ""));
    }
    if (Math.abs(scen.pct) > 1e-9) p.set("sp", String(Math.round(scen.pct * 100) / 100));
    if (scen.date && scen.date !== todayYmd()) p.set("sd", scen.date);
    if (Math.abs(scen.shift) > 1e-9) p.set("sv", String(Math.round(scen.shift * 10000) / 100));
    if (heatMetric() !== "pnl") p.set("hm", heatMetric());
    if (document.getElementById("heat-range").value !== "20") p.set("hr", document.getElementById("heat-range").value);
    if (document.getElementById("crush-pct").value.trim() !== "30") p.set("cr", document.getElementById("crush-pct").value.trim());
    return p.toString();
  }

  function shareUrl() {
    return location.href.split("?")[0].split("#")[0] + "?" + serialize();
  }

  function hydrate(search) {
    var p = new URLSearchParams(search);
    if (!p.has("s") || !p.has("l1")) return false;
    applyDefaults();
    el("spot").value = p.get("s");
    el("style").value = p.get("st") === "e" ? "european" : "american";
    el("rate").value = p.get("r") || "";
    el("divYield").value = p.get("q") || "";
    el("multiplier").value = p.get("m") || "100";
    var b = p.get("b");
    el("basis").value = ["conservative", "bid", "ask"].indexOf(b) !== -1 ? b : "mid";
    var n = 0;
    for (var i = 0; i < MAX_LEGS; i += 1) {
      var v = p.get("l" + (i + 1));
      if (v == null) { setLegRaw(i, null); continue; }
      var parts = v.split("~");
      var o = {};
      LEG_FIELDS.forEach(function (k, j) { o[k] = parts[j] != null ? parts[j] : legDefault(k); });
      if (o.side !== "sell") o.side = "buy";
      if (o.type !== "put") o.type = "call";
      setLegRaw(n, o);
      n += 1;
    }
    legCount = Math.max(1, n);
    scen.pct = optNum(p.get("sp")) || 0;
    scen.date = parseYmd(p.get("sd")) != null ? p.get("sd") : todayYmd();
    scen.shift = (optNum(p.get("sv")) || 0) / 100;
    if (["pnl", "pnlPct", "value"].indexOf(p.get("hm")) !== -1) setHeatMetric(p.get("hm"));
    if (["10", "20", "30", "50"].indexOf(p.get("hr")) !== -1) document.getElementById("heat-range").value = p.get("hr");
    if (p.get("cr")) document.getElementById("crush-pct").value = p.get("cr");
    showLegs();
    return true;
  }

  function queueUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      try {
        history.replaceState(null, "", "?" + serialize());
      } catch (e) {
        /* file:// or sandboxed contexts may block this */
      }
    }, 400);
  }

  function buildCopy(m, a) {
    var lines = ["Options scenario (NumberCove)"];
    m.legs.forEach(function (L) {
      lines.push(legLabel(m, L) + " @ " + money(L.entryPx) + " (" + L.entrySrc + "), IV " + pct(L.iv * 100, 1));
    });
    lines.push("Underlying now: " + money(m.spot) + " · " + (m.style === "american" ? "American" : "European"));
    lines.push("Scenario: " + money(a.S) + " (" + signedPct(scen.pct) + ") on " + (scen.date === m.today ? "today" : fmtDate(scen.date, true)) +
      ", IV shift " + num(a.shift * 100, 1) + " pts");
    lines.push("Position value: " + money(a.value));
    lines.push("P&L: " + signedMoney(a.pnl) + " (" + signedPct(a.pnlPct) + ")");
    lines.push("Breakeven at expiration: " + beText(a.breakevens));
    lines.push("Probability of profit: " + pct(a.pop * 100, 1));
    lines.push("Max profit: " + (a.maxProfit === Infinity ? "Unlimited" : signedMoney(a.maxProfit)) + " · Max loss: " + (a.maxLoss === -Infinity ? "Unlimited" : signedMoney(a.maxLoss)));
    lines.push("Delta " + num(a.gScen.delta, 1) + " sh · Theta " + signedMoney(a.gScen.theta) + "/day · Vega " + signedMoney(a.gScen.vega) + "/pt");
    lines.push(shareUrl());
    return lines.join("\n");
  }

  /* ---------- Main loop ---------- */

  function setWideVisible(on) {
    ["chart-panel", "heat-panel", "greeks-panel"].forEach(function (id) {
      document.getElementById(id).hidden = !on;
    });
    document.getElementById("scenario").classList.toggle("is-disabled", !on);
  }

  function compute(skip) {
    var m = readModel();
    if (!m.ok) {
      lastModel = null;
      C.showFormError(form, "Review the highlighted fields.");
      document.getElementById("results").innerHTML = '<p class="placeholder-result">Fix the highlighted fields to price the position.</p>';
      setWideVisible(false);
      updatePlaceholders(null);
      queueUrl();
      return;
    }
    lastModel = m;
    setWideVisible(true);
    var a = analyze(m);
    lastAnalysis = a;
    syncScenario(m, skip);
    renderSummary(m, a);
    renderChart(m, a);
    renderHeat(m, a);
    renderGreeks(m, a);
    updatePlaceholders(m);
    lastCopy = buildCopy(m, a);
    queueUrl();
  }

  var pendingSkip = null;
  function schedule(skip) {
    pendingSkip = skip || null;
    if (frame) return;
    frame = requestAnimationFrame(function () {
      frame = 0;
      var s = pendingSkip;
      pendingSkip = null;
      compute(s);
    });
  }

  function onScenarioInput(evt) {
    var t = evt.target;
    var m = lastModel;
    if (!m) return;
    var v = C.parseNumber(t.value);
    switch (t.id) {
      case "sc-price":
      case "sc-price-num":
        if (v > 0) scen.pct = (v / m.spot - 1) * 100;
        else return;
        break;
      case "sc-pct":
      case "sc-pct-num":
        if (Number.isFinite(v) && v > -99) scen.pct = v;
        else return;
        break;
      case "sc-date":
        if (Number.isFinite(v)) scen.date = addDays(m.today, Math.round(v));
        break;
      case "sc-date-input":
        if (parseYmd(t.value) != null) scen.date = t.value;
        else return;
        break;
      case "sc-iv":
      case "sc-iv-num":
        if (v > 0) scen.shift = v / 100 - m.legs[0].iv;
        else return;
        break;
      default:
        return;
    }
    schedule(t.type === "range" ? null : t);
  }

  document.addEventListener("DOMContentLoaded", function () {
    form = document.getElementById("calc-form");
    if (!form) return;
    var legsHost = document.getElementById("legs");
    var tpl = "";
    for (var i = 0; i < MAX_LEGS; i += 1) tpl += legTemplate(i);
    legsHost.innerHTML = tpl;

    if (!hydrate(location.search)) applyDefaults();

    form.addEventListener("submit", function (e) { e.preventDefault(); schedule(); });
    form.addEventListener("input", function () { schedule(); });
    form.addEventListener("change", function () { schedule(); });
    legsHost.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-remove]");
      if (btn) removeLeg(+btn.getAttribute("data-remove"));
    });
    document.getElementById("add-leg").addEventListener("click", addLeg);
    document.getElementById("apply-preset").addEventListener("click", function () {
      applyPreset(document.getElementById("preset").value);
    });
    document.getElementById("reset-calc").addEventListener("click", function () {
      applyDefaults();
      ivCache = {};
      ivCacheSize = 0;
      schedule();
    });
    document.getElementById("copy-results").addEventListener("click", function () { C.copyText(lastCopy); });
    document.getElementById("copy-link").addEventListener("click", function () {
      var url = shareUrl();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { C.toast("Share link copied."); }, function () { C.copyText(url); });
      } else {
        C.copyText(url);
      }
    });

    var scenario = document.getElementById("scenario");
    scenario.addEventListener("input", onScenarioInput);
    scenario.addEventListener("change", onScenarioInput);
    document.getElementById("apply-crush").addEventListener("click", function () {
      var m = lastModel;
      var crush = optNum(document.getElementById("crush-pct").value);
      if (!m || crush == null || crush <= 0 || crush >= 100) {
        C.toast("Enter an IV crush between 0% and 100%.");
        return;
      }
      scen.shift = -(crush / 100) * m.legs[0].iv;
      schedule();
      C.toast("Leg 1 IV lowered by " + num(crush, 0) + "%.");
    });
    document.getElementById("reset-scenario").addEventListener("click", function () {
      scen = { pct: 0, date: todayYmd(), shift: 0 };
      schedule();
    });

    C.$$('input[name="heatMetric"]').forEach(function (r) { r.addEventListener("change", function () { schedule(); }); });
    document.getElementById("heat-range").addEventListener("change", function () { schedule(); });

    var chart = document.getElementById("payoff-chart");
    chart.addEventListener("pointermove", chartHover);
    chart.addEventListener("pointerleave", chartLeave);

    var resizeTimer = 0;
    var lastWidth = chart.clientWidth;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (chart.clientWidth !== lastWidth && lastModel && lastAnalysis) {
          lastWidth = chart.clientWidth;
          renderChart(lastModel, lastAnalysis);
        }
      }, 150);
    });

    compute();
  });
})();
