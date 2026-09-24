(function () {
  "use strict";

  var C = window.Calculate;
  if (!C) return;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function resultHero(label, value, sub) {
    return (
      '<div class="result-hero">' +
      '<p class="label">' +
      escapeHtml(label) +
      "</p>" +
      '<p class="value">' +
      value +
      "</p>" +
      (sub ? '<p class="sub">' + sub + "</p>" : "") +
      "</div>"
    );
  }

  function stats(rows) {
    return (
      '<div class="stat-grid">' +
      rows
        .map(function (r) {
          return (
            '<div class="stat"><span class="label">' +
            escapeHtml(r[0]) +
            '</span><span class="value">' +
            r[1] +
            "</span></div>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function tableHtml(headers, rows, rightFrom, rowClasses, wrapClass) {
    rightFrom = rightFrom == null ? 1 : rightFrom;
    var thead =
      "<thead><tr>" +
      headers
        .map(function (h, i) {
          return "<th" + (i >= rightFrom ? ' class="num"' : "") + ">" + escapeHtml(h) + "</th>";
        })
        .join("") +
      "</tr></thead>";
    var tbody =
      "<tbody>" +
      rows
        .map(function (row, ri) {
          var cls = rowClasses && rowClasses[ri] ? ' class="' + rowClasses[ri] + '"' : "";
          return (
            "<tr" +
            cls +
            ">" +
            row
              .map(function (cell, i) {
                return "<td" + (i >= rightFrom ? ' class="num"' : "") + ">" + cell + "</td>";
              })
              .join("") +
            "</tr>"
          );
        })
        .join("") +
      "</tbody>";
    return (
      '<div class="table-wrap' +
      (wrapClass ? " " + wrapClass : "") +
      '"><table>' +
      thead +
      tbody +
      "</table></div>"
    );
  }

  function payoutRankClass(index, total) {
    if (total <= 1 || index === 0) return "rank-best";
    if (index === total - 1) return "rank-worst";
    var t = index / (total - 1);
    if (t <= 0.25) return "rank-good";
    if (t <= 0.5) return "rank-mid";
    return "rank-poor";
  }

  function rankLegend(bestLabel, worstLabel) {
    return (
      '<p class="rank-legend" aria-hidden="true">' +
      '<span class="rank-swatch rank-swatch--best">' +
      escapeHtml(bestLabel || "Lowest fees") +
      "</span>" +
      '<span class="rank-swatch rank-swatch--mid">Typical</span>' +
      '<span class="rank-swatch rank-swatch--worst">' +
      escapeHtml(worstLabel || "Highest fees") +
      "</span>" +
      "</p>"
    );
  }

  function bindCalc(form, compute) {
    var results = document.getElementById("results");
    var copyBtn = document.getElementById("copy-results");
    var resetBtn = document.getElementById("reset-calc");
    var copyPayload = "";
    var timer = null;

    function render(html, text) {
      results.innerHTML = html;
      copyPayload = text || "";
    }

    function run() {
      C.clearErrors(form);
      var out = compute(form);
      if (!out) {
        if (!results.querySelector(".placeholder-result") && !results.querySelector(".result-hero")) {
          render('<p class="placeholder-result">Enter values to see results.</p>', "");
        }
        return;
      }
      render(out.html, out.copy);
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, 80);
    }

    form.addEventListener("input", schedule);
    form.addEventListener("change", schedule);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run();
    });
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        C.copyText(copyPayload);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        C.clearErrors(form);
        syncToggles(form);
        run();
      });
    }
    syncToggles(form);
    run();
  }

  function syncToggles(form) {
    var unit = form.querySelector("[name='unit']:checked") || form.elements.unit;
    if (unit && unit.value) {
      C.$$("[data-unit]").forEach(function (el) {
        var show = el.getAttribute("data-unit") === unit.value;
        el.classList.toggle("unit-hidden", !show);
      });
    }
    var item = ((form.querySelector("[name='itemType']") || {}).value || "").trim();
    var platform = ((form.querySelector("[name='platform']") || {}).value || "all").trim();
    if (item || form.querySelector("[name='platform']")) {
      C.$$("[data-item], [data-platform]", form).forEach(function (el) {
        var itemAllow = el.getAttribute("data-item");
        var platformAllow = el.getAttribute("data-platform");
        var itemOk = !itemAllow || itemAllow.split(/\s+/).indexOf(item) !== -1;
        var platformOk = !platformAllow || platformAllow.split(/\s+/).indexOf(platform) !== -1;
        el.classList.toggle("mode-hidden", !itemOk || !platformOk);
      });
    }
    var mode = form.querySelector("[name='mode']:checked") || form.elements.mode;
    if (mode && mode.value) {
      C.$$("[data-mode]").forEach(function (el) {
        var show = el.getAttribute("data-mode") === mode.value;
        el.classList.toggle("mode-hidden", !show);
      });
    }
    var sex = form.querySelector("[name='sex']:checked") || form.elements.sex;
    C.$$("[data-sex]").forEach(function (el) {
      if (!sex) return;
      var val = sex.value || sex;
      el.classList.toggle("mode-hidden", el.getAttribute("data-sex") !== val);
    });
  }

  function mortgage(form) {
    var price = C.requireFinite(form, "homePrice", "Home price", { gt: 0 });
    var down = C.requireFinite(form, "downPayment", "Down payment", { min: 0 });
    var rate = C.requireFinite(form, "rate", "Interest rate", { min: 0, max: 50 });
    var years = C.requireFinite(form, "termYears", "Loan term", { gt: 0, max: 50 });
    if (price == null || down == null || rate == null || years == null) return null;
    if (down >= price) {
      C.setFieldError(form.elements.downPayment, "Down payment must be less than the home price.");
      return null;
    }
    var extra = C.parseNumber(form.elements.extraPayment.value) || 0;
    var tax = C.parseNumber(form.elements.propertyTax.value) || 0;
    var ins = C.parseNumber(form.elements.insurance.value) || 0;
    var hoa = C.parseNumber(form.elements.hoa.value) || 0;
    var principal = price - down;
    var months = Math.round(years * 12);
    var downPct = (down / price) * 100;
    var pmiRaw = form.elements.pmiRate.value;
    var pmiRate = C.parseNumber(pmiRaw);
    if (!Number.isFinite(pmiRate)) pmiRate = downPct < 20 ? 0.5 : 0;
    var pmiMonthly = downPct < 20 ? (principal * (pmiRate / 100)) / 12 : 0;
    var pi = C.payment(principal, rate, months);
    var housing = pi + extra + tax / 12 + ins / 12 + hoa + pmiMonthly;
    var sched = C.amortize(principal, rate, months, extra);
    var payoff = C.formatDate(C.addMonths(new Date(), sched.months));

    var html =
      resultHero("Monthly principal & interest", C.formatMoney(pi), "Loan amount " + C.formatMoney(principal)) +
      stats([
        ["Estimated total monthly", C.formatMoney(housing)],
        ["Total interest", C.formatMoney(sched.totalInterest)],
        ["Total of payments", C.formatMoney(sched.totalPaid)],
        ["Payoff", payoff + " (" + sched.months + " mo)"],
        ["Down payment", C.formatPercent(downPct) + " · " + C.formatMoney(down)],
        ["PMI (monthly)", pmiMonthly ? C.formatMoney(pmiMonthly) : "None"],
      ]) +
      (tax || ins || hoa
        ? '<p class="hint">Total monthly includes tax, insurance, HOA, PMI, and extra principal if entered.</p>'
        : "") +
      tableHtml(
        ["Month", "Payment", "Principal", "Interest", "Balance"],
        sched.rows.map(function (r) {
          return [
            r.n === sched.months ? r.n + " (final)" : String(r.n),
            C.formatMoney(r.payment),
            C.formatMoney(r.principal),
            C.formatMoney(r.interest),
            C.formatMoney(r.balance),
          ];
        })
      ) +
      '<p class="hint">Table shows the first 12 payments and the final payment.</p>';

    var copy = [
      "Mortgage results",
      "Home price: " + C.formatMoney(price),
      "Loan amount: " + C.formatMoney(principal),
      "Rate: " + C.formatPercent(rate) + " · Term: " + years + " years",
      "Monthly P&I: " + C.formatMoney(pi),
      "Estimated total monthly: " + C.formatMoney(housing),
      "Total interest: " + C.formatMoney(sched.totalInterest),
      "Payoff: " + payoff,
    ].join("\n");

    return { html: html, copy: copy };
  }

  function refinance(form) {
    var balance = C.requireFinite(form, "currentBalance", "Current balance", { gt: 0 });
    var curRate = C.requireFinite(form, "currentRate", "Current rate", { min: 0, max: 50 });
    var remainYears = C.requireFinite(form, "remainingYears", "Years remaining", { gt: 0, max: 50 });
    var newRate = C.requireFinite(form, "newRate", "New rate", { min: 0, max: 50 });
    var newYears = C.requireFinite(form, "newTermYears", "New term", { gt: 0, max: 50 });
    var closing = C.requireFinite(form, "closingCosts", "Closing costs", { min: 0 });
    if (
      balance == null ||
      curRate == null ||
      remainYears == null ||
      newRate == null ||
      newYears == null ||
      closing == null
    )
      return null;

    var cashOut = C.parseNumber(form.elements.cashOut.value) || 0;
    var points = C.parseNumber(form.elements.points.value) || 0;
    var remainMonths = Math.round(remainYears * 12);
    var newMonths = Math.round(newYears * 12);
    var currentPayInput = C.parseNumber(form.elements.currentPayment.value);
    var currentPay = Number.isFinite(currentPayInput)
      ? currentPayInput
      : C.payment(balance, curRate, remainMonths);
    var newPrincipal = balance + cashOut;
    var pointsCost = newPrincipal * (points / 100);
    var upfront = closing + pointsCost;
    var newPay = C.payment(newPrincipal, newRate, newMonths);
    var monthlySave = currentPay - newPay;
    var currentInterest = currentPay * remainMonths - balance;
    var newSched = C.amortize(newPrincipal, newRate, newMonths, 0);
    var breakEven =
      monthlySave > 0 ? upfront / monthlySave : Infinity;
    var lifetime = currentInterest - (newSched.totalInterest + upfront);

    var html =
      resultHero(
        monthlySave >= 0 ? "Monthly savings" : "Monthly increase",
        C.formatMoney(Math.abs(monthlySave)),
        "Current " + C.formatMoney(currentPay) + " → new " + C.formatMoney(newPay)
      ) +
      stats([
        ["New loan amount", C.formatMoney(newPrincipal)],
        ["Upfront cost", C.formatMoney(upfront)],
        ["Break-even", Number.isFinite(breakEven) ? C.formatNumber(breakEven, 1) + " months" : "Does not break even"],
        ["Interest left (current)", C.formatMoney(Math.max(0, currentInterest))],
        ["Interest (new loan)", C.formatMoney(newSched.totalInterest)],
        ["Net interest difference", C.formatMoney(lifetime)],
      ]) +
      '<div class="compare">' +
      '<div class="stat"><span class="label">Keep current loan</span><span class="value">' +
      C.formatMoney(currentPay) +
      "/mo</span></div>" +
      '<div class="stat"><span class="label">Refinance</span><span class="value">' +
      C.formatMoney(newPay) +
      "/mo</span></div>" +
      "</div>" +
      (monthlySave <= 0
        ? '<p class="callout warn">The new payment is not lower. Refinancing may still make sense to cash out or change term, but it will not cut the monthly bill.</p>'
        : '<p class="callout">Closing costs are recouped after about ' +
          C.formatNumber(breakEven, 1) +
          " months if you keep the loan that long.</p>");

    var copy = [
      "Refinance comparison",
      "Current payment: " + C.formatMoney(currentPay),
      "New payment: " + C.formatMoney(newPay),
      "Monthly difference: " + C.formatMoney(monthlySave),
      "Upfront cost: " + C.formatMoney(upfront),
      "Break-even: " + (Number.isFinite(breakEven) ? C.formatNumber(breakEven, 1) + " months" : "n/a"),
      "Current remaining interest (est.): " + C.formatMoney(Math.max(0, currentInterest)),
      "New loan total interest: " + C.formatMoney(newSched.totalInterest),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function loan(form) {
    var amount = C.requireFinite(form, "amount", "Loan amount", { gt: 0 });
    var rate = C.requireFinite(form, "rate", "Interest rate", { min: 0, max: 50 });
    var years = C.requireFinite(form, "termYears", "Term (years)", { min: 0, max: 50 });
    var extraMonths = C.parseNumber(form.elements.termMonths.value) || 0;
    if (amount == null || rate == null || years == null) return null;
    var months = Math.round(years * 12 + extraMonths);
    if (months <= 0) {
      C.setFieldError(form.elements.termYears, "Term must be at least 1 month.");
      return null;
    }
    var extra = C.parseNumber(form.elements.extraPayment.value) || 0;
    var pi = C.payment(amount, rate, months);
    var sched = C.amortize(amount, rate, months, extra);
    var payoff = C.formatDate(C.addMonths(new Date(), sched.months));
    var savedMonths = months - sched.months;
    var scheduledTotal = pi * months;
    var savedInterest = Math.max(0, scheduledTotal - amount - sched.totalInterest);

    var html =
      resultHero("Monthly payment", C.formatMoney(pi), extra ? "Plus extra principal of " + C.formatMoney(extra) : "Standard amortization") +
      stats([
        ["Total interest", C.formatMoney(sched.totalInterest)],
        ["Total paid", C.formatMoney(sched.totalPaid)],
        ["Payoff date", payoff],
        ["Payments", String(sched.months)],
        extra ? ["Time saved", savedMonths + " months"] : ["Interest share", C.formatPercent((sched.totalInterest / sched.totalPaid) * 100)],
        extra ? ["Interest saved vs schedule", C.formatMoney(savedInterest)] : ["Final payment", C.formatMoney(sched.rows[sched.rows.length - 1].payment)],
      ]) +
      tableHtml(
        ["Month", "Payment", "Principal", "Interest", "Balance"],
        sched.rows.map(function (r) {
          return [
            String(r.n),
            C.formatMoney(r.payment),
            C.formatMoney(r.principal),
            C.formatMoney(r.interest),
            C.formatMoney(r.balance),
          ];
        })
      );

    var copy = [
      "Loan results",
      "Amount: " + C.formatMoney(amount),
      "Rate: " + C.formatPercent(rate),
      "Scheduled monthly: " + C.formatMoney(pi),
      "Total interest: " + C.formatMoney(sched.totalInterest),
      "Payoff: " + payoff + " after " + sched.months + " payments",
    ].join("\n");
    return { html: html, copy: copy };
  }

  function compound(form) {
    var principal = C.requireFinite(form, "principal", "Starting amount", { min: 0 });
    var rate = C.requireFinite(form, "rate", "Annual rate", { min: 0, max: 100 });
    var years = C.requireFinite(form, "years", "Years", { gt: 0, max: 100 });
    if (principal == null || rate == null || years == null) return null;
    var contrib = C.parseNumber(form.elements.contribution.value) || 0;
    var freqMap = { annually: 1, quarterly: 4, monthly: 12, weekly: 52, daily: 365 };
    var n = freqMap[form.elements.compounding.value] || 12;
    var cFreq = freqMap[form.elements.contributionFreq.value] || 12;
    var periods = Math.round(years * n);
    var r = rate / 100 / n;
    var contribPerCompound = contrib * (cFreq / n);
    var balance = principal;
    var yearRows = [];
    var startYear = 0;
    var totalContrib = 0;
    for (var p = 1; p <= periods; p++) {
      balance = balance * (1 + r) + contribPerCompound;
      totalContrib += contribPerCompound;
      if (p % n === 0 || p === periods) {
        var yr = Math.ceil(p / n);
        if (yr !== startYear) {
          yearRows.push([String(yr), C.formatMoney(balance)]);
          startYear = yr;
        }
      }
    }
    var interest = balance - principal - totalContrib;
    var shown = yearRows.length > 12
      ? yearRows.filter(function (row, i) {
          return i < 5 || i >= yearRows.length - 5 || (i + 1) % 5 === 0;
        })
      : yearRows;

    var html =
      resultHero("Future value", C.formatMoney(balance), "After " + C.formatNumber(years, 1) + " years") +
      stats([
        ["Starting principal", C.formatMoney(principal)],
        ["Total contributions", C.formatMoney(totalContrib)],
        ["Interest earned", C.formatMoney(interest)],
        ["Compounding", escapeHtml(form.elements.compounding.options[form.elements.compounding.selectedIndex].text)],
      ]) +
      (shown.length
        ? tableHtml(
            ["Year", "Balance"],
            shown
          )
        : "");

    var copy = [
      "Compound interest",
      "Start: " + C.formatMoney(principal),
      "Rate: " + C.formatPercent(rate) + " compounded " + form.elements.compounding.value,
      "Years: " + years,
      "Contributions: " + C.formatMoney(contrib) + " / " + form.elements.contributionFreq.value,
      "Future value: " + C.formatMoney(balance),
      "Interest earned: " + C.formatMoney(interest),
    ].join("\n");
    return { html: html, copy: copy };
  }

  function tip(form) {
    var bill = C.requireFinite(form, "bill", "Bill amount", { gt: 0 });
    var pct = C.requireFinite(form, "tipPercent", "Tip percent", { min: 0, max: 100 });
    var people = C.requireFinite(form, "people", "Number of people", { min: 1, max: 100 });
    if (bill == null || pct == null || people == null) return null;
    people = Math.floor(people);
    var tax = C.parseNumber(form.elements.tax.value) || 0;
    var tipOn = form.elements.tipOn.value === "pre" ? Math.max(0, bill - tax) : bill;
    var tipAmt = tipOn * (pct / 100);
    var total = bill + tipAmt;
    var per = total / people;
    var tipEach = tipAmt / people;

    var html =
      resultHero("Total with tip", C.formatMoney(total), C.formatPercent(pct) + " of " + C.formatMoney(tipOn)) +
      stats([
        ["Tip amount", C.formatMoney(tipAmt)],
        ["Per person", C.formatMoney(per)],
        ["Tip each", C.formatMoney(tipEach)],
        ["Bill before tip", C.formatMoney(bill)],
      ]);

    var copy = [
      "Tip calculator",
      "Bill: " + C.formatMoney(bill),
      "Tip: " + C.formatPercent(pct) + " = " + C.formatMoney(tipAmt),
      "Total: " + C.formatMoney(total),
      "Split " + people + " ways: " + C.formatMoney(per) + " each",
    ].join("\n");
    return { html: html, copy: copy };
  }

  function toMetricHeightCm(form, unit) {
    if (unit === "metric") {
      return C.requireFinite(form, "heightCm", "Height", { gt: 0, max: 300 });
    }
    var ft = C.parseNumber(form.elements.heightFt.value);
    var inch = C.parseNumber(form.elements.heightIn.value);
    if (!Number.isFinite(ft)) ft = 0;
    if (!Number.isFinite(inch)) inch = 0;
    var inches = ft * 12 + inch;
    if (inches <= 0) {
      C.setFieldError(form.elements.heightFt, "Enter a height greater than 0.");
      return null;
    }
    if (inches > 108) {
      C.setFieldError(form.elements.heightFt, "Height looks too large. Check feet and inches.");
      return null;
    }
    return inches * 2.54;
  }

  function toMetricWeightKg(form, unit) {
    if (unit === "metric") {
      return C.requireFinite(form, "weightKg", "Weight", { gt: 0, max: 500 });
    }
    var lb = C.requireFinite(form, "weightLb", "Weight", { gt: 0, max: 1100 });
    return lb == null ? null : lb * 0.45359237;
  }

  function bmiCategory(bmi) {
    if (bmi < 18.5) return { label: "Underweight", cls: "badge-info" };
    if (bmi < 25) return { label: "Healthy weight", cls: "badge-ok" };
    if (bmi < 30) return { label: "Overweight", cls: "badge-warn" };
    if (bmi < 35) return { label: "Obesity class I", cls: "badge-danger" };
    if (bmi < 40) return { label: "Obesity class II", cls: "badge-danger" };
    return { label: "Obesity class III", cls: "badge-danger" };
  }

  function bmi(form) {
    var unit = (form.querySelector("[name='unit']:checked") || {}).value || "us";
    var cm = toMetricHeightCm(form, unit);
    var kg = toMetricWeightKg(form, unit);
    if (cm == null || kg == null) return null;
    var m = cm / 100;
    var bmiVal = kg / (m * m);
    var cat = bmiCategory(bmiVal);
    var low = 18.5 * m * m;
    var high = 24.9 * m * m;
    var healthy =
      unit === "metric"
        ? C.formatNumber(low, 1) + "–" + C.formatNumber(high, 1) + " kg"
        : C.formatNumber(low / 0.45359237, 0) + "–" + C.formatNumber(high / 0.45359237, 0) + " lb";

    var html =
      resultHero(
        "BMI",
        C.formatNumber(bmiVal, 1),
        '<span class="badge ' + cat.cls + '">' + cat.label + "</span>"
      ) +
      stats([
        ["Height", C.formatNumber(cm, 1) + " cm"],
        ["Weight", C.formatNumber(kg, 1) + " kg"],
        ["Healthy BMI range", "18.5 – 24.9"],
        ["Weight for healthy BMI", healthy],
      ]);

    var copy = [
      "BMI results",
      "BMI: " + C.formatNumber(bmiVal, 1) + " (" + cat.label + ")",
      "Height: " + C.formatNumber(cm, 1) + " cm",
      "Weight: " + C.formatNumber(kg, 1) + " kg",
      "Healthy weight estimate: " + healthy,
    ].join("\n");
    return { html: html, copy: copy };
  }

  function bodyFat(form) {
    var sex = (form.querySelector("[name='sex']:checked") || {}).value || "male";
    var unit = (form.querySelector("[name='unit']:checked") || {}).value || "us";
    var height = C.requireFinite(form, "height", "Height", { gt: 0 });
    var neck = C.requireFinite(form, "neck", "Neck", { gt: 0 });
    var waist = C.requireFinite(form, "waist", "Waist", { gt: 0 });
    if (height == null || neck == null || waist == null) return null;
    var hip = 0;
    if (sex === "female") {
      hip = C.requireFinite(form, "hip", "Hip", { gt: 0 });
      if (hip == null) return null;
    }
    var hIn = unit === "metric" ? height / 2.54 : height;
    var nIn = unit === "metric" ? neck / 2.54 : neck;
    var wIn = unit === "metric" ? waist / 2.54 : waist;
    var hipIn = unit === "metric" ? hip / 2.54 : hip;
    var bf;
    if (sex === "male") {
      if (wIn - nIn <= 0) {
        C.setFieldError(form.elements.waist, "Waist must be larger than neck for this formula.");
        return null;
      }
      bf =
        495 /
          (1.0324 -
            0.19077 * Math.log(wIn - nIn) / Math.LN10 +
            0.15456 * Math.log(hIn) / Math.LN10) -
        450;
    } else {
      if (wIn + hipIn - nIn <= 0) {
        C.setFieldError(form.elements.waist, "Waist + hip must be larger than neck.");
        return null;
      }
      bf =
        495 /
          (1.29579 -
            0.35004 * Math.log(wIn + hipIn - nIn) / Math.LN10 +
            0.221 * Math.log(hIn) / Math.LN10) -
        450;
    }
    if (!Number.isFinite(bf) || bf < 2 || bf > 75) {
      C.showFormError(form, "Those measurements produce an out-of-range estimate. Check the tape measurements.");
      return null;
    }

    var cat;
    if (sex === "male") {
      cat = bf < 6 ? "Essential" : bf < 14 ? "Athletic" : bf < 18 ? "Fitness" : bf < 25 ? "Average" : "Above average";
    } else {
      cat = bf < 14 ? "Essential" : bf < 21 ? "Athletic" : bf < 25 ? "Fitness" : bf < 32 ? "Average" : "Above average";
    }

    var html =
      resultHero(
        "Estimated body fat",
        C.formatNumber(bf, 1) + "%",
        '<span class="badge badge-info">' + cat + "</span> · U.S. Navy method"
      ) +
      stats([
        ["Method", "U.S. Navy circumference"],
        ["Sex", sex === "male" ? "Male" : "Female"],
        ["Category (general)", cat],
        ["Lean mass (est.)", "Not computed from weight — add BMI/TDEE tools"],
      ]);

    var copy = [
      "Body-fat estimate (U.S. Navy)",
      "Result: " + C.formatNumber(bf, 1) + "% (" + cat + ")",
      "This is an estimate only, not a medical measurement.",
    ].join("\n");
    return { html: html, copy: copy };
  }

  function tdee(form) {
    var sex = (form.querySelector("[name='sex']:checked") || {}).value || "female";
    var unit = (form.querySelector("[name='unit']:checked") || {}).value || "us";
    var age = C.requireFinite(form, "age", "Age", { min: 15, max: 100 });
    var cm = toMetricHeightCm(form, unit);
    var kg = toMetricWeightKg(form, unit);
    if (age == null || cm == null || kg == null) return null;
    var activity = C.parseNumber(form.elements.activity.value);
    if (!Number.isFinite(activity)) activity = 1.2;
    var bmr = 10 * kg + 6.25 * cm - 5 * age + (sex === "male" ? 5 : -161);
    var tdeeVal = bmr * activity;
    var lose = tdeeVal - 500;
    var slow = tdeeVal - 250;
    var gain = tdeeVal + 250;
    var protein = 1.6 * kg;
    var fat = (tdeeVal * 0.25) / 9;
    var carbs = (tdeeVal - protein * 4 - fat * 9) / 4;
    var floor = sex === "male" ? 1500 : 1200;

    var html =
      resultHero("Maintenance calories (TDEE)", C.formatNumber(tdeeVal, 0) + " kcal/day", "Mifflin–St Jeor × activity factor") +
      stats([
        ["BMR", C.formatNumber(bmr, 0) + " kcal"],
        ["Mild cut (−250)", C.formatNumber(Math.max(slow, floor), 0) + " kcal"],
        ["Standard cut (−500)", C.formatNumber(Math.max(lose, floor), 0) + " kcal"],
        ["Lean gain (+250)", C.formatNumber(gain, 0) + " kcal"],
        ["Protein target", C.formatNumber(protein, 0) + " g (~1.6 g/kg)"],
        ["Example fat / carbs", C.formatNumber(fat, 0) + " g / " + C.formatNumber(carbs, 0) + " g"],
      ]) +
      (lose < floor
        ? '<p class="callout warn">A 500-calorie deficit would fall below a common minimum intake. Use a smaller deficit and talk with a clinician before aggressive cuts.</p>'
        : "");

    var copy = [
      "TDEE results (Mifflin–St Jeor)",
      "BMR: " + C.formatNumber(bmr, 0) + " kcal",
      "TDEE: " + C.formatNumber(tdeeVal, 0) + " kcal",
      "Cut −500: " + C.formatNumber(Math.max(lose, floor), 0) + " kcal",
      "Gain +250: " + C.formatNumber(gain, 0) + " kcal",
      "Protein ~ " + C.formatNumber(protein, 0) + " g",
    ].join("\n");
    return { html: html, copy: copy };
  }

  function paint(form) {
    var mode = (form.querySelector("[name='mode']:checked") || {}).value || "room";
    var coats = C.requireFinite(form, "coats", "Coats", { min: 1, max: 6 });
    var coverage = C.requireFinite(form, "coverage", "Coverage per gallon", { gt: 0 });
    if (coats == null || coverage == null) return null;
    var area;
    if (mode === "area") {
      area = C.requireFinite(form, "area", "Wall area", { gt: 0 });
      if (area == null) return null;
    } else {
      var length = C.requireFinite(form, "length", "Length", { gt: 0 });
      var width = C.requireFinite(form, "width", "Width", { gt: 0 });
      var height = C.requireFinite(form, "height", "Height", { gt: 0 });
      if (length == null || width == null || height == null) return null;
      var doors = C.parseNumber(form.elements.doors.value) || 0;
      var windows = C.parseNumber(form.elements.windows.value) || 0;
      var ceiling = !!(form.elements.includeCeiling && form.elements.includeCeiling.checked);
      area = 2 * (length + width) * height;
      if (ceiling) area += length * width;
      area -= doors * 21 + windows * 15;
      if (area <= 0) {
        C.showFormError(form, "Openings subtract more area than the walls. Check door and window counts.");
        return null;
      }
    }
    var paintable = area * coats;
    var gallonsExact = paintable / coverage;
    var gallons = Math.ceil(gallonsExact * 10) / 10;
    var gallonsRound = Math.ceil(gallonsExact);
    var quarts = Math.ceil(gallonsExact * 4);

    var html =
      resultHero("Paint needed", C.formatNumber(gallonsRound, 0) + " gal", C.formatNumber(gallonsExact, 2) + " gallons before rounding") +
      stats([
        ["Surface to cover", C.formatNumber(area, 1) + " sq ft"],
        ["Including coats", C.formatNumber(paintable, 1) + " sq ft"],
        ["Buy (rounded up)", C.formatNumber(gallonsRound, 0) + " gallons"],
        ["Or quarts (small jobs)", String(quarts) + " qt"],
      ]) +
      '<p class="hint">Doors are treated as 21 sq ft and windows as 15 sq ft when using room dimensions.</p>';

    var copy = [
      "Paint estimator",
      "Area: " + C.formatNumber(area, 1) + " sq ft × " + coats + " coats",
      "Coverage: " + coverage + " sq ft/gal",
      "Paint: " + C.formatNumber(gallonsExact, 2) + " gal (buy " + gallonsRound + ")",
    ].join("\n");
    return { html: html, copy: copy };
  }

  function flooring(form) {
    var length = C.requireFinite(form, "length", "Length", { gt: 0 });
    var width = C.requireFinite(form, "width", "Width", { gt: 0 });
    var waste = C.requireFinite(form, "waste", "Waste percent", { min: 0, max: 40 });
    if (length == null || width == null || waste == null) return null;
    var rooms = C.parseNumber(form.elements.rooms.value);
    if (!Number.isFinite(rooms) || rooms < 1) rooms = 1;
    var price = C.parseNumber(form.elements.price.value);
    var box = C.parseNumber(form.elements.boxCoverage.value);
    var area = length * width * rooms;
    var needed = area * (1 + waste / 100);
    var boxes = Number.isFinite(box) && box > 0 ? Math.ceil(needed / box) : null;
    var cost = Number.isFinite(price) && price >= 0 ? needed * price : null;
    var boxCost = boxes && Number.isFinite(price) && Number.isFinite(box) ? boxes * box * price : cost;

    var html =
      resultHero("Material to order", C.formatNumber(needed, 1) + " sq ft", "Includes " + C.formatPercent(waste, 0) + " waste") +
      stats([
        ["Room area", C.formatNumber(area, 1) + " sq ft"],
        ["Waste allowance", C.formatNumber(needed - area, 1) + " sq ft"],
        ["Boxes needed", boxes == null ? "Enter coverage/box" : String(boxes)],
        ["Estimated material cost", cost == null ? "Enter a price" : C.formatMoney(boxCost)],
      ]);

    var copy = [
      "Flooring estimator",
      "Area: " + C.formatNumber(area, 1) + " sq ft",
      "With waste: " + C.formatNumber(needed, 1) + " sq ft",
      boxes != null ? "Boxes: " + boxes : "",
      cost != null ? "Est. cost: " + C.formatMoney(boxCost) : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { html: html, copy: copy };
  }

  function concrete(form) {
    var length = C.requireFinite(form, "length", "Length", { gt: 0 });
    var width = C.requireFinite(form, "width", "Width", { gt: 0 });
    var depth = C.requireFinite(form, "depth", "Thickness", { gt: 0 });
    var waste = C.requireFinite(form, "waste", "Waste percent", { min: 0, max: 30 });
    if (length == null || width == null || depth == null || waste == null) return null;
    var depthUnit = form.elements.depthUnit.value;
    var lenUnit = form.elements.lengthUnit.value;
    function toFeet(v, unit) {
      if (unit === "ft") return v;
      if (unit === "in") return v / 12;
      if (unit === "m") return v * 3.280839895;
      if (unit === "cm") return v / 30.48;
      return v;
    }
    var lft = toFeet(length, lenUnit);
    var wft = toFeet(width, lenUnit);
    var dft = toFeet(depth, depthUnit);
    var cuft = lft * wft * dft * (1 + waste / 100);
    var cuyd = cuft / 27;
    var bags80 = Math.ceil(cuft / 0.6);
    var bags60 = Math.ceil(cuft / 0.45);
    var bags40 = Math.ceil(cuft / 0.3);
    var orderYd = Math.ceil(cuyd * 4) / 4;

    var html =
      resultHero("Concrete volume", C.formatNumber(cuyd, 2) + " cu yd", "Order about " + C.formatNumber(orderYd, 2) + " cu yd after rounding") +
      stats([
        ["Cubic feet", C.formatNumber(cuft, 2) + " ft³"],
        ["80 lb bags (~0.60 ft³)", String(bags80)],
        ["60 lb bags (~0.45 ft³)", String(bags60)],
        ["40 lb bags (~0.30 ft³)", String(bags40)],
      ]) +
      '<p class="hint">Bag yields are typical; check the bag. Ready-mix is usually ordered in cubic yards, often rounded to the next ¼ yard.</p>';

    var copy = [
      "Concrete estimator",
      "Volume: " + C.formatNumber(cuft, 2) + " ft³ / " + C.formatNumber(cuyd, 2) + " yd³",
      "Suggested order: " + C.formatNumber(orderYd, 2) + " yd³",
      "80 lb bags: " + bags80,
      "60 lb bags: " + bags60,
    ].join("\n");
    return { html: html, copy: copy };
  }

  function tile(form) {
    var roomL = C.requireFinite(form, "roomLength", "Room length", { gt: 0 });
    var roomW = C.requireFinite(form, "roomWidth", "Room width", { gt: 0 });
    var tileL = C.requireFinite(form, "tileLength", "Tile length", { gt: 0 });
    var tileW = C.requireFinite(form, "tileWidth", "Tile width", { gt: 0 });
    var grout = C.requireFinite(form, "grout", "Grout gap", { min: 0 });
    var waste = C.requireFinite(form, "waste", "Waste percent", { min: 0, max: 40 });
    if (roomL == null || roomW == null || tileL == null || tileW == null || grout == null || waste == null)
      return null;
    var roomUnit = form.elements.roomUnit.value;
    var tileUnit = form.elements.tileUnit.value;
    function toIn(v, unit) {
      if (unit === "in") return v;
      if (unit === "ft") return v * 12;
      if (unit === "cm") return v / 2.54;
      if (unit === "mm") return v / 25.4;
      return v;
    }
    var rL = toIn(roomL, roomUnit);
    var rW = toIn(roomW, roomUnit);
    var tL = toIn(tileL, tileUnit);
    var tW = toIn(tileW, tileUnit);
    var g = toIn(grout, form.elements.groutUnit.value);
    var pitchL = tL + g;
    var pitchW = tW + g;
    if (pitchL <= 0 || pitchW <= 0) return null;
    var nL = Math.ceil((rL + g) / pitchL);
    var nW = Math.ceil((rW + g) / pitchW);
    var tiles = nL * nW;
    var withWaste = Math.ceil(tiles * (1 + waste / 100));
    var perBox = C.parseNumber(form.elements.tilesPerBox.value);
    var boxes = Number.isFinite(perBox) && perBox > 0 ? Math.ceil(withWaste / perBox) : null;
    var price = C.parseNumber(form.elements.pricePerBox.value);
    var cost = boxes && Number.isFinite(price) ? boxes * price : null;
    var areaFt = (rL * rW) / 144;

    var html =
      resultHero("Tiles to buy", String(withWaste), nL + " × " + nW + " layout, plus waste") +
      stats([
        ["Exact layout count", String(tiles)],
        ["Room area", C.formatNumber(areaFt, 2) + " sq ft"],
        ["Boxes", boxes == null ? "Enter tiles/box" : String(boxes)],
        ["Estimated cost", cost == null ? "Enter price/box" : C.formatMoney(cost)],
      ]);

    var copy = [
      "Tile estimator",
      "Layout: " + nL + " × " + nW + " = " + tiles + " tiles",
      "With waste: " + withWaste,
      boxes != null ? "Boxes: " + boxes : "",
      cost != null ? "Cost: " + C.formatMoney(cost) : "",
    ]
      .filter(Boolean)
      .join("\n");
    return { html: html, copy: copy };
  }

  function percentage(form) {
    var mode = (form.querySelector("[name='mode']:checked") || {}).value || "of";
    var html;
    var copy;
    if (mode === "of") {
      var pct = C.requireFinite(form, "pct", "Percentage", {});
      var of = C.requireFinite(form, "of", "Number", {});
      if (pct == null || of == null) return null;
      var val = (pct / 100) * of;
      html = resultHero("Result", C.formatNumber(val, 6), C.formatPercent(pct) + " of " + C.formatNumber(of, 6));
      copy = C.formatPercent(pct) + " of " + of + " = " + val;
    } else if (mode === "is") {
      var part = C.requireFinite(form, "part", "Part", {});
      var whole = C.requireFinite(form, "whole", "Whole", { gt: 0 });
      if (part == null || whole == null) return null;
      var p = (part / whole) * 100;
      html = resultHero("Result", C.formatPercent(p, 4), C.formatNumber(part, 6) + " is this percent of " + C.formatNumber(whole, 6));
      copy = part + " is " + p + "% of " + whole;
    } else if (mode === "change") {
      var from = C.requireFinite(form, "from", "Starting value", {});
      var to = C.requireFinite(form, "to", "New value", {});
      if (from == null || to == null) return null;
      if (from === 0) {
        C.setFieldError(form.elements.from, "Starting value cannot be 0 for percent change.");
        return null;
      }
      var ch = ((to - from) / Math.abs(from)) * 100;
      html =
        resultHero("Percent change", C.formatPercent(ch, 4), (ch >= 0 ? "Increase" : "Decrease") + " of " + C.formatNumber(Math.abs(to - from), 6)) +
        stats([
          ["From", C.formatNumber(from, 6)],
          ["To", C.formatNumber(to, 6)],
          ["Difference", C.formatNumber(to - from, 6)],
          ["Direction", ch >= 0 ? "Increase" : "Decrease"],
        ]);
      copy = "Change from " + from + " to " + to + " = " + ch + "%";
    } else if (mode === "increase") {
      var base = C.requireFinite(form, "base", "Number", {});
      var inc = C.requireFinite(form, "inc", "Percent", {});
      if (base == null || inc == null) return null;
      var up = base * (1 + inc / 100);
      html = resultHero("Increased value", C.formatNumber(up, 6), C.formatNumber(base, 6) + " + " + C.formatPercent(inc));
      copy = base + " increased by " + inc + "% = " + up;
    } else {
      var base2 = C.requireFinite(form, "base2", "Number", {});
      var dec = C.requireFinite(form, "dec", "Percent", {});
      if (base2 == null || dec == null) return null;
      var down = base2 * (1 - dec / 100);
      html = resultHero("Decreased value", C.formatNumber(down, 6), C.formatNumber(base2, 6) + " − " + C.formatPercent(dec));
      copy = base2 + " decreased by " + dec + "% = " + down;
    }
    return { html: html, copy: copy };
  }

  function overrideFee(form, name, fallback) {
    var el = C.getControl ? C.getControl(form, name) : form.querySelector('[name="' + name + '"]');
    if (!el || !String(el.value).trim()) return fallback;
    var n = C.parseNumber(el.value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function feeOverride(form, name) {
    var el = C.getControl ? C.getControl(form, name) : form.querySelector('[name="' + name + '"]');
    if (!el || !String(el.value).trim()) return null;
    var n = C.parseNumber(el.value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }

  function selectValue(form, name, fallback) {
    var el = C.getControl ? C.getControl(form, name) : form.querySelector('[name="' + name + '"]');
    var v = el && String(el.value).trim();
    return v || fallback;
  }

  function trrBasePayout(price, category) {
    if (category === "handbags") {
      if (price >= 7500) return 80;
      if (price >= 5000) return 75;
      if (price >= 1500) return 70;
      if (price >= 750) return 65;
      if (price >= 300) return 60;
      if (price >= 200) return 55;
      if (price >= 150) return 45;
      if (price >= 100) return 30;
      return 20;
    }
    if (category === "jewelry") {
      if (price >= 750) return 70;
      if (price >= 300) return 65;
      if (price >= 200) return 55;
      if (price >= 150) return 45;
      if (price >= 100) return 30;
      return 20;
    }
    if (category === "watches") {
      if (price >= 7500) return 85;
      if (price >= 5000) return 80;
      if (price >= 2000) return 75;
      if (price >= 500) return 70;
      if (price >= 300) return 60;
      if (price >= 200) return 55;
      if (price >= 150) return 45;
      if (price >= 100) return 30;
      return 20;
    }
    if (category === "sneakers") {
      if (price >= 1500) return 85;
      if (price >= 500) return 75;
      if (price >= 300) return 65;
      if (price >= 200) return 55;
      if (price >= 150) return 45;
      if (price >= 100) return 30;
      return 20;
    }
    if (price >= 5000) return 70;
    if (price >= 750) return 65;
    if (price >= 300) return 60;
    if (price >= 200) return 55;
    if (price >= 150) return 45;
    if (price >= 100) return 30;
    return 20;
  }

  function trrLoyaltyBonus(status) {
    if (status === "influencer") return 1;
    if (status === "tastemaker") return 2;
    if (status === "vip") return 5;
    return 0;
  }

  var ITEM_LABELS = {
    clothing: "clothing, shoes & accessories",
    handbags: "handbags",
    jewelry: "branded fine jewelry",
    watches: "watches",
    sneakers: "men's sneakers & collectibles",
    coins: "coins & money",
    cards: "trading cards & TCG",
    other: "other merchandise",
  };

  function itemTypeLabel(type) {
    return ITEM_LABELS[type] || ITEM_LABELS.clothing;
  }

  function isLuxuryItem(type) {
    return type === "clothing" || type === "handbags" || type === "jewelry" || type === "watches" || type === "sneakers";
  }

  function trrBandEdges(category) {
    if (category === "handbags") return [0, 100, 150, 200, 300, 750, 1500, 5000, 7500];
    if (category === "jewelry") return [0, 100, 150, 200, 300, 750];
    if (category === "watches") return [0, 100, 150, 200, 300, 500, 2000, 5000, 7500];
    if (category === "sneakers") return [0, 100, 150, 200, 300, 500, 1500];
    return [0, 100, 150, 200, 300, 750, 5000];
  }

  function roundUpCent(n) {
    return Math.ceil(n * 100 - 1e-8) / 100;
  }

  function ebaySchedule(gross, itemType) {
    var perOrder = gross <= 10 ? 0.3 : 0.4;
    function mostCategories() {
      var variable = gross <= 7500 ? gross * 0.136 : 7500 * 0.136 + (gross - 7500) * 0.0235;
      return {
        variable: variable,
        fixed: perOrder,
        pctLabel: "13.6%",
        note: "13.6% of item + shipping" + (gross > 7500 ? " (2.35% above $7,500)" : ""),
      };
    }
    if (itemType === "sneakers") {
      if (gross >= 150) {
        return {
          variable: gross * 0.08,
          fixed: 0,
          pctLabel: "8%",
          note: "8% athletic shoes $150+ (no per-order fee)",
        };
      }
      var under = mostCategories();
      under.note = "13.6% athletic shoes under $150";
      return under;
    }
    if (itemType === "handbags") {
      var bagPct = gross > 2000 ? 9 : 15;
      return {
        variable: gross * (bagPct / 100),
        fixed: perOrder,
        pctLabel: bagPct + "%",
        note: bagPct + "% women's handbags (15% at $2,000 or less, 9% above)",
      };
    }
    if (itemType === "jewelry") {
      var jewPct = gross > 5000 ? 9 : 15;
      return {
        variable: gross * (jewPct / 100),
        fixed: perOrder,
        pctLabel: jewPct + "%",
        note: jewPct + "% jewelry (15% at $5,000 or less, 9% above)",
      };
    }
    if (itemType === "watches") {
      var watchVar;
      if (gross <= 1000) watchVar = gross * 0.15;
      else if (gross <= 7500) watchVar = 1000 * 0.15 + (gross - 1000) * 0.065;
      else watchVar = 1000 * 0.15 + 6500 * 0.065 + (gross - 7500) * 0.03;
      return {
        variable: watchVar,
        fixed: perOrder,
        pctLabel: "tiered",
        note: "15% to $1,000, 6.5% to $7,500, then 3%",
      };
    }
    if (itemType === "coins" || itemType === "cards") {
      var collectPct = 13.25;
      var collectVar =
        gross <= 7500 ? gross * (collectPct / 100) : 7500 * (collectPct / 100) + (gross - 7500) * 0.0235;
      return {
        variable: collectVar,
        fixed: perOrder,
        pctLabel: "13.25%",
        note: "13.25% " + (itemType === "coins" ? "coins" : "trading cards") + " to $7,500, then 2.35%",
      };
    }
    return mostCategories();
  }

  function whatnotCommission(price, itemType) {
    if (itemType === "coins") {
      return { fee: Math.min(price, 1500) * 0.04, note: "4% Coins & Money on first $1,500 (0% above)" };
    }
    if (itemType === "cards") {
      return { fee: Math.min(price, 1500) * 0.08, note: "8% TCG/sports/comics on first $1,500 (0% above)" };
    }
    return { fee: price * 0.08, note: "8% commission on item" };
  }

  function marketplace(form) {
    var mode = (form.querySelector("[name='mode']:checked") || {}).value || "net";
    var qty = C.requireFinite(form, "quantity", "Quantity", { min: 1, max: 9999 });
    if (qty == null) return null;
    qty = Math.floor(qty);
    var price = null;
    var target = null;
    if (mode === "list") {
      price = C.requireFinite(form, "salePrice", "Sale price", { gt: 0 });
      if (price == null) return null;
    } else {
      mode = "net";
      target = C.requireFinite(form, "netWant", "Amount you want to be paid", { gt: 0 });
      if (target == null) return null;
    }
    var shipCharge = C.parseNumber((C.getControl(form, "shippingCharged") || {}).value) || 0;
    var shipCost = C.parseNumber((C.getControl(form, "shippingCost") || {}).value) || 0;
    var itemCost = C.parseNumber((C.getControl(form, "itemCost") || {}).value) || 0;
    var platform = selectValue(form, "platform", "all");
    var promo = C.parseNumber((C.getControl(form, "ebayPromo") || {}).value) || 0;
    if (shipCharge < 0 || shipCost < 0 || itemCost < 0 || promo < 0) {
      C.showFormError(form, "Shipping, cost, and promoted rate cannot be negative.");
      return null;
    }

    var itemType = selectValue(form, "itemType", "clothing");
    var luxury = isLuxuryItem(itemType);
    var ebayPctOverride = feeOverride(form, "ebayPct");
    var ebayFixedOverride = feeOverride(form, "ebayFixed");
    var poshPct = overrideFee(form, "poshPct", 20);
    var mercariPct = overrideFee(form, "mercariPct", 10);
    var vintedPct = overrideFee(form, "vintedPct", 0);
    var fpOverride = feeOverride(form, "fashionphilePct");
    var whatnotPctOverride = feeOverride(form, "whatnotPct");
    var whatnotPay = overrideFee(form, "whatnotPay", 2.9);
    var whatnotFixed = overrideFee(form, "whatnotFixed", 0.3);
    var trrStatus = selectValue(form, "trrStatus", "trendsetter");
    var trrStatusName = { trendsetter: "Trendsetter", influencer: "Influencer", tastemaker: "Tastemaker", vip: "VIP" }[
      trrStatus
    ] || "Trendsetter";
    var trrPctOverride = feeOverride(form, "trrPct");
    var promoRate = promo / 100;

    if ((platform === "trr" || platform === "fashionphile") && !luxury) {
      var venue = platform === "trr" ? "The RealReal" : "Fashionphile";
      return {
        html:
          '<p class="placeholder-result">' +
          escapeHtml(venue) +
          " is for luxury clothing, bags, jewelry, watches, and sneakers. Choose one of those item types.</p>",
        copy: "",
      };
    }

    var NAMES = {
      ebay: "eBay",
      poshmark: "Poshmark",
      vinted: "Vinted",
      fashionphile: "Fashionphile",
      trr: "The RealReal",
      mercari: "Mercari",
      whatnot: "Whatnot",
    };

    function quote(id, ask) {
      var gross = ask + shipCharge;
      var proceeds = id === "vinted" ? ask : gross;
      var fee = 0;
      var note = "";
      var keepRate = null;
      var consignment = id === "fashionphile" || id === "trr";
      if (id === "ebay") {
        var sched = ebaySchedule(gross, itemType);
        var variable = ebayPctOverride != null ? gross * (ebayPctOverride / 100) : sched.variable;
        var fixed = ebayFixedOverride != null ? ebayFixedOverride : sched.fixed;
        fee = variable + fixed + gross * promoRate;
        note = ebayPctOverride != null ? ebayPctOverride + "% of the price and shipping" : sched.note;
        if (fixed) note += " + $" + C.formatNumber(fixed, 2);
        if (promo) note += " + " + promo + "% promoted";
      } else if (id === "poshmark") {
        fee = ask < 15 ? 2.95 : ask * (poshPct / 100);
        note = ask < 15 ? "$2.95 fee" : poshPct + "% fee";
      } else if (id === "vinted") {
        fee = ask * (vintedPct / 100);
        note = vintedPct ? vintedPct + "% seller fee" : "No seller fee. The buyer pays about 5% + $0.70.";
        if (shipCharge > 0) note += " Buyer shipping is not part of your payout.";
      } else if (id === "mercari") {
        fee = gross * (mercariPct / 100);
        note = mercariPct + "% fee";
      } else if (id === "whatnot") {
        var wn = whatnotCommission(ask, itemType);
        var comm = whatnotPctOverride != null ? ask * (whatnotPctOverride / 100) : wn.fee;
        fee = comm + gross * (whatnotPay / 100) + whatnotFixed;
        note =
          (whatnotPctOverride != null ? whatnotPctOverride + "%" : wn.note.replace(" commission on item", "").replace(" on first $1,500 (0% above)", " on the first $1,500")) +
          " + " +
          whatnotPay +
          "% + $" +
          C.formatNumber(whatnotFixed, 2);
      } else if (id === "fashionphile") {
        if (fpOverride != null) {
          fee = ask * (fpOverride / 100);
          note = fpOverride + "% of the sale";
        } else if (ask <= 3000) {
          fee = ask * 0.3;
          note = "30% of the sale";
        } else {
          fee = 3000 * 0.3 + (ask - 3000) * 0.15;
          note = "30% on the first $3,000, then 15%";
        }
      } else if (id === "trr") {
        if (trrPctOverride != null) {
          fee = ask * (trrPctOverride / 100);
          keepRate = 100 - trrPctOverride;
          note = "You keep " + keepRate + "%";
        } else {
          var trrPayout = trrBasePayout(ask, itemType);
          if (ask >= 200) trrPayout += trrLoyaltyBonus(trrStatus);
          keepRate = trrPayout;
          fee = ask * ((100 - trrPayout) / 100);
          note = "You keep " + trrPayout + "% as " + trrStatusName;
        }
      }
      return {
        id: id,
        name: NAMES[id],
        fee: fee,
        note: note,
        keepRate: keepRate,
        consignment: consignment,
        proceeds: proceeds,
        net: proceeds - fee - shipCost,
      };
    }

    function priceInRegion(ask, region) {
      if (!(ask > 0) || !Number.isFinite(ask)) return false;
      var above = region.minIncl ? ask + 1e-9 >= region.min : ask > region.min + 1e-6;
      if (!above) return false;
      if (region.max == null) return true;
      return region.maxIncl ? ask <= region.max + 1e-9 : ask < region.max - 1e-6;
    }

    function regionRaws(regions) {
      var raws = [];
      regions.forEach(function (region) {
        if (!(region.a > 1e-8)) return;
        var needed = (target - region.b) / region.a;
        if (priceInRegion(needed, region)) raws.push(needed);
        var edge = region.minIncl ? region.min : region.min + 0.01;
        if (priceInRegion(edge, region) && region.a * edge + region.b + 1e-6 >= target) raws.push(edge);
        if (region.min < 0.01 && priceInRegion(0.01, region) && region.a * 0.01 + region.b + 1e-6 >= target) raws.push(0.01);
      });
      return raws;
    }

    function ebayRegion(rate, extra, fixed, g0, g1, g0Incl, g1Incl) {
      var a = 1 - rate - promoRate;
      return {
        a: a,
        b: shipCharge * a - extra - fixed - shipCost,
        min: g0 - shipCharge,
        max: g1 == null ? null : g1 - shipCharge,
        minIncl: g0Incl,
        maxIncl: g1Incl,
      };
    }

    function ebayRegions() {
      var low = ebayFixedOverride != null ? ebayFixedOverride : 0.3;
      var high = ebayFixedOverride != null ? ebayFixedOverride : 0.4;
      if (ebayPctOverride != null) {
        var rate = ebayPctOverride / 100;
        if (ebayFixedOverride != null) return [ebayRegion(rate, 0, ebayFixedOverride, 0, null, false, false)];
        return [ebayRegion(rate, 0, 0.3, 0, 10, false, true), ebayRegion(rate, 0, 0.4, 10, null, false, false)];
      }
      if (itemType === "sneakers") {
        var sneakerFixed = ebayFixedOverride != null ? ebayFixedOverride : 0;
        if (ebayFixedOverride != null) {
          return [ebayRegion(0.136, 0, ebayFixedOverride, 0, 150, false, false), ebayRegion(0.08, 0, sneakerFixed, 150, null, true, false)];
        }
        return [
          ebayRegion(0.136, 0, 0.3, 0, 10, false, true),
          ebayRegion(0.136, 0, 0.4, 10, 150, false, false),
          ebayRegion(0.08, 0, 0, 150, null, true, false),
        ];
      }
      if (itemType === "handbags" || itemType === "jewelry") {
        var cut = itemType === "handbags" ? 2000 : 5000;
        if (ebayFixedOverride != null) {
          return [ebayRegion(0.15, 0, ebayFixedOverride, 0, cut, false, true), ebayRegion(0.09, 0, ebayFixedOverride, cut, null, false, false)];
        }
        return [
          ebayRegion(0.15, 0, 0.3, 0, 10, false, true),
          ebayRegion(0.15, 0, 0.4, 10, cut, false, true),
          ebayRegion(0.09, 0, 0.4, cut, null, false, false),
        ];
      }
      if (itemType === "watches") {
        var watch = ebayFixedOverride != null
          ? [ebayRegion(0.15, 0, ebayFixedOverride, 0, 1000, false, true)]
          : [ebayRegion(0.15, 0, 0.3, 0, 10, false, true), ebayRegion(0.15, 0, 0.4, 10, 1000, false, true)];
        watch.push(ebayRegion(0.065, 85, high, 1000, 7500, false, true));
        watch.push(ebayRegion(0.03, 347.5, high, 7500, null, false, false));
        return watch;
      }
      if (itemType === "coins" || itemType === "cards") {
        if (ebayFixedOverride != null) {
          return [ebayRegion(0.1325, 0, ebayFixedOverride, 0, 7500, false, true), ebayRegion(0.0235, 817.5, ebayFixedOverride, 7500, null, false, false)];
        }
        return [
          ebayRegion(0.1325, 0, 0.3, 0, 10, false, true),
          ebayRegion(0.1325, 0, 0.4, 10, 7500, false, true),
          ebayRegion(0.0235, 817.5, 0.4, 7500, null, false, false),
        ];
      }
      if (ebayFixedOverride != null) {
        return [ebayRegion(0.136, 0, ebayFixedOverride, 0, 7500, false, true), ebayRegion(0.0235, 843.75, ebayFixedOverride, 7500, null, false, false)];
      }
      return [
        ebayRegion(0.136, 0, low, 0, 10, false, true),
        ebayRegion(0.136, 0, high, 10, 7500, false, true),
        ebayRegion(0.0235, 843.75, high, 7500, null, false, false),
      ];
    }

    function solveRegions(id, regions) {
      var best = null;
      regionRaws(regions).forEach(function (raw) {
        var ask = roundUpCent(raw);
        if (!(ask > 0)) return;
        var guard = 0;
        var q = quote(id, ask);
        while (q.net + 1e-4 < target && guard < 300) {
          ask = roundUpCent(ask + 0.01);
          q = quote(id, ask);
          guard += 1;
        }
        if (q.net + 1e-4 < target) return;
        if (!best || ask < best.price) {
          best = { price: ask, fee: q.fee, net: q.net, note: q.note, keepRate: q.keepRate, consignment: q.consignment };
        }
      });
      return best;
    }

    function regionsFor(id) {
      if (id === "vinted") {
        return [{ a: 1 - vintedPct / 100, b: -shipCost, min: 0, max: null, minIncl: false, maxIncl: false }];
      }
      if (id === "mercari") {
        var mercA = 1 - mercariPct / 100;
        return [{ a: mercA, b: shipCharge * mercA - shipCost, min: 0, max: null, minIncl: false, maxIncl: false }];
      }
      if (id === "poshmark") {
        return [
          { a: 1, b: shipCharge - 2.95 - shipCost, min: 0, max: 15, minIncl: false, maxIncl: false },
          { a: 1 - poshPct / 100, b: shipCharge - shipCost, min: 15, max: null, minIncl: true, maxIncl: false },
        ];
      }
      if (id === "ebay") return ebayRegions();
      if (id === "whatnot") {
        var pay = whatnotPay / 100;
        var capped = whatnotPctOverride == null && (itemType === "coins" || itemType === "cards");
        var comm = (whatnotPctOverride != null ? whatnotPctOverride : itemType === "coins" ? 4 : 8) / 100;
        var linear = {
          a: 1 - comm - pay,
          b: shipCharge * (1 - pay) - whatnotFixed - shipCost,
          min: 0,
          max: capped ? 1500 : null,
          minIncl: false,
          maxIncl: capped,
        };
        if (!capped) return [linear];
        return [
          linear,
          {
            a: 1 - pay,
            b: shipCharge * (1 - pay) - 1500 * comm - whatnotFixed - shipCost,
            min: 1500,
            max: null,
            minIncl: false,
            maxIncl: false,
          },
        ];
      }
      if (id === "fashionphile") {
        if (fpOverride != null) {
          return [{ a: 1 - fpOverride / 100, b: shipCharge - shipCost, min: 0, max: null, minIncl: false, maxIncl: false }];
        }
        return [
          { a: 0.7, b: shipCharge - shipCost, min: 0, max: 3000, minIncl: false, maxIncl: true },
          { a: 0.85, b: shipCharge - 450 - shipCost, min: 3000, max: null, minIncl: false, maxIncl: false },
        ];
      }
      if (trrPctOverride != null) {
        return [{ a: 1 - trrPctOverride / 100, b: shipCharge - shipCost, min: 0, max: null, minIncl: false, maxIncl: false }];
      }
      var edges = trrBandEdges(itemType);
      return edges.map(function (edge, i) {
        var next = i + 1 < edges.length ? edges[i + 1] : null;
        var keep = trrBasePayout(edge, itemType);
        if (edge >= 200) keep += trrLoyaltyBonus(trrStatus);
        return {
          a: keep / 100,
          b: shipCharge - shipCost,
          min: edge,
          max: next,
          minIncl: true,
          maxIncl: false,
        };
      });
    }

    var ids = ["ebay", "poshmark", "vinted"];
    if (luxury) ids.push("fashionphile", "trr");
    ids.push("mercari", "whatnot");
    if (platform !== "all") {
      ids = ids.filter(function (id) {
        return id === platform;
      });
    }
    if (!ids.length) {
      return {
        html: '<p class="placeholder-result">No payout estimate for this platform and item type.</p>',
        copy: "",
      };
    }

    var rows = ids.map(function (id) {
      if (mode === "list") {
        var listed = quote(id, price);
        return {
          id: id,
          name: listed.name,
          price: price,
          fee: listed.fee,
          net: listed.net,
          note: listed.note,
          keepRate: listed.keepRate,
          consignment: listed.consignment,
          proceeds: listed.proceeds,
          ok: true,
        };
      }
      var solved = solveRegions(id, regionsFor(id));
      if (!solved) {
        return {
          id: id,
          name: NAMES[id],
          price: NaN,
          fee: NaN,
          net: NaN,
          note: "These rates cannot reach that amount.",
          keepRate: null,
          consignment: id === "fashionphile" || id === "trr",
          proceeds: 0,
          ok: false,
        };
      }
      var note = solved.note;
      if (solved.net > target + 0.05) note += " You get paid more than you asked because the fee drops at this price.";
      return {
        id: id,
        name: NAMES[id],
        price: solved.price,
        fee: solved.fee,
        net: solved.net,
        note: note,
        keepRate: solved.keepRate,
        consignment: solved.consignment,
        proceeds: quote(id, solved.price).proceeds,
        ok: true,
      };
    });

    rows.forEach(function (r) {
      r.payoutEach = r.net;
      r.payout = r.ok ? r.net * qty : NaN;
      r.profit = r.ok ? (r.net - itemCost) * qty : NaN;
      r.keep =
        r.keepRate != null
          ? r.keepRate
          : r.proceeds > 0
            ? ((r.proceeds - r.fee) / r.proceeds) * 100
            : 0;
    });
    rows.sort(function (a, b) {
      if (a.ok !== b.ok) return a.ok ? -1 : 1;
      if (mode === "net") return a.price - b.price;
      return b.payout - a.payout;
    });
    var solvedCount = rows.filter(function (r) {
      return r.ok;
    }).length;
    if (!solvedCount) {
      return {
        html: '<p class="placeholder-result">No platform can reach that amount with these rates.</p>',
        copy: "",
      };
    }
    var best = rows[0];
    var rankClasses = rows.map(function (r, i) {
      if (!r.ok) return "";
      return payoutRankClass(i, solvedCount);
    });
    var bestMark = mode === "net" ? "Lowest" : "Best net";
    var worstMark = mode === "net" ? "Highest" : "Highest fees";
    var headers = mode === "net"
      ? ["Platform", "List it for", "Fees", "You get paid"]
      : ["Platform", "Est. fees (each)", "You net (each)", "Total payout", "You keep"];
    var table = tableHtml(
      headers,
      rows.map(function (r, i) {
        var mark = "";
        if (r.ok && i === 0) mark = ' <span class="badge badge-ok">' + bestMark + "</span>";
        else if (r.ok && solvedCount > 1 && i === solvedCount - 1) mark = ' <span class="badge badge-danger">' + worstMark + "</span>";
        var nameCell = escapeHtml(r.name) + mark + (r.note ? '<div class="hint">' + escapeHtml(r.note) + "</div>" : "");
        if (!r.ok) {
          var blanks = [nameCell, "—", "—", "—"];
          if (mode !== "net") blanks.push("—");
          return blanks;
        }
        if (mode === "net") {
          return [
            nameCell,
            C.formatMoney(r.price) + (r.consignment ? '<div class="hint">Needs to sell for</div>' : ""),
            C.formatMoney(r.fee),
            C.formatMoney(r.net),
          ];
        }
        return [nameCell, C.formatMoney(r.fee), C.formatMoney(r.net), C.formatMoney(r.payout), C.formatPercent(r.keep, 1)];
      }),
      1,
      rankClasses,
      "table-wrap--rank"
    );

    var showTrr = rows.some(function (r) {
      return r.id === "trr";
    });
    var heroSub = mode === "net"
      ? "on " + escapeHtml(best.name) + " to get paid " + C.formatMoney(best.net) + (qty > 1 ? " each" : "")
      : escapeHtml(best.name) + " · " + C.formatMoney(best.net) + " each after typical fees";
    var statRows = [
      ["Category", itemTypeLabel(itemType)],
      [mode === "net" ? "You want to get paid" : "Sale (each)", C.formatMoney(mode === "net" ? target : price)],
    ];
    if (qty > 1) statRows.push(["Quantity", String(qty)]);
    if (shipCost > 0) statRows.push(["Postage you pay", C.formatMoney(shipCost)]);
    if (shipCharge > 0) statRows.push(["Buyer shipping", C.formatMoney(shipCharge)]);
    if (showTrr && trrStatus !== "trendsetter") statRows.push(["The RealReal status", trrStatusName]);
    var profitName = "";
    var profitValue = 0;
    if (itemCost) {
      var profitRows = rows.filter(function (r) {
        return r.ok;
      });
      profitRows.sort(function (a, b) {
        return b.profit - a.profit;
      });
      profitName = profitRows[0].name;
      profitValue = profitRows[0].profit;
    }

    var html =
      resultHero(mode === "net" ? (best.consignment ? "Needs to sell for" : "List it for") : "Highest estimated payout", mode === "net" ? C.formatMoney(best.price) : C.formatMoney(best.payout), heroSub) +
      stats(statRows) +
      rankLegend(mode === "net" ? "Lowest list price" : "Lowest fees", mode === "net" ? "Highest list price" : "Highest fees") +
      table +
      (itemCost
        ? '<p class="hint">Profit uses your item cost of ' +
          C.formatMoney(itemCost) +
          " each. Best profit: " +
          escapeHtml(profitName) +
          " " +
          C.formatMoney(profitValue) +
          ".</p>"
        : "") +
      '<p class="hint">' +
      (mode === "net"
        ? "List prices are rounded up to the next cent so you get paid at least what you typed." +
          (rows.some(function (r) { return r.consignment; })
            ? " Fashionphile and The RealReal show the price the item needs to sell for."
            : "") +
          (rows.some(function (r) { return r.id === "vinted"; })
            ? " On Vinted the buyer pays the fee."
            : "")
        : "Buyer shipping is included in eBay, Mercari, and Whatnot fees and is treated as money you receive on every platform except Vinted." +
          (rows.some(function (r) { return r.id === "vinted"; }) ? " Vinted US charges sellers no commission." : "") +
          (showTrr ? " The RealReal share is for the status under More options." : "")) +
      "</p>";

    var copy = [
      "Marketplace payout comparison",
      "Mode: " + (mode === "net" ? "target payout" : "sale price"),
      "Item: " + itemTypeLabel(itemType),
      (mode === "net" ? "Want: " : "Price: ") + C.formatMoney(mode === "net" ? target : price) + " × " + qty,
    ]
      .concat(
        rows.map(function (r) {
          if (!r.ok) return r.name + ": cannot reach that amount";
          if (mode === "net") {
            return (
              r.name +
              ": " +
              (r.consignment ? "needs to sell for " : "list at ") +
              C.formatMoney(r.price) +
              ", fees " +
              C.formatMoney(r.fee) +
              ", net " +
              C.formatMoney(r.net) +
              (r.note ? " (" + r.note + ")" : "")
            );
          }
          return r.name + ": net " + C.formatMoney(r.payout) + " (fees " + C.formatMoney(r.fee * qty) + (r.note ? "; " + r.note : "") + ")";
        })
      )
      .join("\n");
    return { html: html, copy: copy };
  }

  function tickets(form) {
    var mode = (form.querySelector("[name='mode']:checked") || {}).value || "list";
    var qty = C.requireFinite(form, "quantity", "Quantity", { min: 1, max: 200 });
    if (qty == null) return null;
    qty = Math.floor(qty);
    var paid = C.parseNumber((C.getControl(form, "paid") || {}).value) || 0;
    var shPct = overrideFee(form, "stubhubPct", 15);
    var tmPct = overrideFee(form, "tmPct", 10);
    var sgPct = overrideFee(form, "seatgeekPct", 12);
    var shBuyer = overrideFee(form, "stubhubBuyerPct", 22);
    var tmBuyer = overrideFee(form, "tmBuyerPct", 18);
    var sgBuyer = overrideFee(form, "seatgeekBuyerPct", 15);

    var list;
    if (mode === "net") {
      var netWant = C.requireFinite(form, "netWant", "Target net per ticket", { gt: 0 });
      if (netWant == null) return null;
      list = netWant;
    } else {
      list = C.requireFinite(form, "listPrice", "List price per ticket", { gt: 0 });
      if (list == null) return null;
    }

    function row(name, sellerPct, buyerPct) {
      var listPrice;
      var netEach;
      if (mode === "net") {
        netEach = list;
        listPrice = sellerPct >= 100 ? NaN : netEach / (1 - sellerPct / 100);
      } else {
        listPrice = list;
        netEach = listPrice * (1 - sellerPct / 100);
      }
      var buyerPays = listPrice * (1 + buyerPct / 100);
      return {
        name: name,
        sellerPct: sellerPct,
        feeEach: listPrice - netEach,
        listPrice: listPrice,
        netEach: netEach,
        netTotal: netEach * qty,
        buyerPays: buyerPays,
        profit: (netEach - paid) * qty,
      };
    }

    var rows = [
      row("StubHub", shPct, shBuyer),
      row("Ticketmaster Resale", tmPct, tmBuyer),
      row("SeatGeek", sgPct, sgBuyer),
    ].sort(function (a, b) {
      return mode === "net" ? a.listPrice - b.listPrice : b.netEach - a.netEach;
    });
    var best = rows[0];
    var badge = mode === "net" ? "Lowest list" : "Best net";

    var rankClasses = rows.map(function (_r, i) {
      return payoutRankClass(i, rows.length);
    });
    var table = tableHtml(
      ["Platform", "Seller fee", mode === "net" ? "List at" : "You net (each)", "Total payout", "Buyer may pay (est.)"],
      rows.map(function (r, i) {
        var mark = "";
        if (i === 0) mark = ' <span class="badge badge-ok">' + badge + "</span>";
        else if (i === rows.length - 1) mark = ' <span class="badge badge-danger">Highest fees</span>';
        return [
          escapeHtml(r.name) + mark,
          C.formatPercent(r.sellerPct, 1),
          mode === "net" ? C.formatMoney(r.listPrice) : C.formatMoney(r.netEach),
          C.formatMoney(r.netTotal),
          C.formatMoney(r.buyerPays),
        ];
      }),
      1,
      rankClasses,
      "table-wrap--rank"
    );

    var heroLabel = mode === "net" ? "List on the cheapest-fee venue at" : "Highest estimated payout";
    var heroVal = mode === "net" ? C.formatMoney(rows.slice().sort(function (a, b) {
      return a.listPrice - b.listPrice;
    })[0].listPrice) : C.formatMoney(best.netTotal);
    var cheapestList = rows.slice().sort(function (a, b) {
      return a.listPrice - b.listPrice;
    })[0];

    var html =
      resultHero(
        heroLabel,
        mode === "net" ? C.formatMoney(cheapestList.listPrice) + " / ticket" : heroVal,
        mode === "net"
          ? "To net " + C.formatMoney(list) + " each, list at " + C.formatMoney(cheapestList.listPrice) + " on " + cheapestList.name
          : escapeHtml(best.name) + " · " + C.formatMoney(best.netEach) + " per ticket"
      ) +
      stats([
        ["Tickets", String(qty)],
        [mode === "net" ? "Target net each" : "Your list price", C.formatMoney(list)],
        ["Original paid (each)", paid ? C.formatMoney(paid) : "Not entered"],
        ["Best total net", C.formatMoney(best.netTotal)],
      ]) +
      rankLegend() +
      table +
      (paid
        ? '<p class="hint">Versus what you paid: ' +
          rows
            .map(function (r) {
              return r.name + " " + C.formatMoney(r.profit);
            })
            .join(" · ") +
          ".</p>"
        : "") +
      '<p class="hint">Buyer-facing totals are estimates. StubHub and Ticketmaster set event-specific seller and buyer fees that can move with demand. Confirm the fee shown in the listing tool before you post.</p>';

    var copy = ["Ticket resale comparison", (mode === "net" ? "Target net: " : "List: ") + C.formatMoney(list) + " × " + qty]
      .concat(
        rows.map(function (r) {
          return r.name + ": list " + C.formatMoney(r.listPrice) + " → net " + C.formatMoney(r.netTotal);
        })
      )
      .join("\n");
    return { html: html, copy: copy };
  }

  var registry = {
    mortgage: mortgage,
    refinance: refinance,
    loan: loan,
    compound: compound,
    tip: tip,
    bmi: bmi,
    bodyfat: bodyFat,
    tdee: tdee,
    paint: paint,
    flooring: flooring,
    concrete: concrete,
    tile: tile,
    percentage: percentage,
    marketplace: marketplace,
    tickets: tickets,
  };

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("[data-calc]");
    if (!form) return;
    var name = form.getAttribute("data-calc");
    var fn = registry[name];
    if (!fn) return;

    form.addEventListener("change", function (e) {
      if (e.target && (e.target.name === "unit" || e.target.name === "mode" || e.target.name === "sex" || e.target.name === "itemType" || e.target.name === "platform")) {
        syncToggles(form);
      }
    });
    form.addEventListener("click", function (e) {
      if (e.target && e.target.closest && e.target.closest(".seg")) syncToggles(form);
    });

    bindCalc(form, fn);

    if (name === "mortgage") {
      var priceEl = form.elements.homePrice;
      var downEl = form.elements.downPayment;
      var pctEl = form.elements.downPercent;
      var syncing = false;
      function fromDown() {
        if (syncing || !pctEl) return;
        var price = C.parseNumber(priceEl.value);
        var down = C.parseNumber(downEl.value);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(down)) return;
        syncing = true;
        pctEl.value = ((down / price) * 100).toFixed(2);
        syncing = false;
      }
      function fromPct() {
        if (syncing || !pctEl) return;
        var price = C.parseNumber(priceEl.value);
        var pct = C.parseNumber(pctEl.value);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(pct)) return;
        syncing = true;
        downEl.value = ((price * pct) / 100).toFixed(2);
        syncing = false;
      }
      if (priceEl && downEl && pctEl) {
        downEl.addEventListener("input", fromDown);
        priceEl.addEventListener("input", fromDown);
        pctEl.addEventListener("input", fromPct);
      }
    }
  });
})();
