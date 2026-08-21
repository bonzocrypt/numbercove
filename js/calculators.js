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

  function rankLegend() {
    return (
      '<p class="rank-legend" aria-hidden="true">' +
      '<span class="rank-swatch rank-swatch--best">Lowest fees</span>' +
      '<span class="rank-swatch rank-swatch--mid">Typical</span>' +
      '<span class="rank-swatch rank-swatch--worst">Highest fees</span>' +
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

  function marketplace(form) {
    var price = C.requireFinite(form, "salePrice", "Sale price", { gt: 0 });
    var qty = C.requireFinite(form, "quantity", "Quantity", { min: 1, max: 9999 });
    if (price == null || qty == null) return null;
    qty = Math.floor(qty);
    var shipCharge = C.parseNumber((C.getControl(form, "shippingCharged") || {}).value) || 0;
    var shipCost = C.parseNumber((C.getControl(form, "shippingCost") || {}).value) || 0;
    var itemCost = C.parseNumber((C.getControl(form, "itemCost") || {}).value) || 0;
    var promo = C.parseNumber((C.getControl(form, "ebayPromo") || {}).value) || 0;
    if (shipCharge < 0 || shipCost < 0 || itemCost < 0) {
      C.showFormError(form, "Shipping and cost cannot be negative.");
      return null;
    }

    var grossEach = price + shipCharge;
    var ebayPct = overrideFee(form, "ebayPct", 13.6);
    var ebayFixed = overrideFee(form, "ebayFixed", 0.4);
    var poshPct = overrideFee(form, "poshPct", 20);
    var mercariPct = overrideFee(form, "mercariPct", 10);
    var depopPct = overrideFee(form, "depopPct", 3.3);
    var depopFixed = overrideFee(form, "depopFixed", 0.45);
    var fpPct = overrideFee(form, "fashionphilePct", 20);
    var etsyTx = overrideFee(form, "etsyTx", 6.5);
    var etsyPay = overrideFee(form, "etsyPay", 3);
    var etsyFixed = overrideFee(form, "etsyFixed", 0.25);

    function trrRate(p) {
      if (p < 150) return 55;
      if (p < 500) return 40;
      if (p < 1500) return 30;
      if (p < 3000) return 25;
      return 20;
    }
    var trrPct = overrideFee(form, "trrPct", trrRate(price));

    function poshFee(p) {
      if (p < 15) return 2.95;
      return p * (poshPct / 100);
    }

    var rows = [
      {
        name: "eBay",
        fee: grossEach * (ebayPct / 100) + ebayFixed + grossEach * (promo / 100),
        note: ebayPct + "% of item + shipping + $" + C.formatNumber(ebayFixed, 2) + (promo ? " + " + promo + "% promoted" : ""),
      },
      {
        name: "Poshmark",
        fee: poshFee(price),
        note: price < 15 ? "$2.95 flat under $15" : poshPct + "% at $15+",
      },
      {
        name: "Fashionphile",
        fee: price * (fpPct / 100),
        note: fpPct + "% consignment (typical luxury; buyout offers differ)",
      },
      {
        name: "The RealReal",
        fee: price * (trrPct / 100),
        note: trrPct + "% consignment tier for this price",
      },
      {
        name: "Mercari",
        fee: price * (mercariPct / 100),
        note: mercariPct + "% selling fee",
      },
      {
        name: "Depop",
        fee: price * (depopPct / 100) + depopFixed,
        note: depopPct + "% + $" + C.formatNumber(depopFixed, 2) + " (typical U.S. processing)",
      },
      {
        name: "Etsy",
        fee: grossEach * ((etsyTx + etsyPay) / 100) + etsyFixed,
        note: etsyTx + "% transaction + " + etsyPay + "% + $" + C.formatNumber(etsyFixed, 2) + " processing",
      },
    ];

    rows.forEach(function (r) {
      r.payoutEach = price + shipCharge - r.fee - shipCost;
      r.payout = r.payoutEach * qty;
      r.profit = (r.payoutEach - itemCost) * qty;
      r.keep = grossEach > 0 ? (r.payoutEach / grossEach) * 100 : 0;
    });
    rows.sort(function (a, b) {
      return b.payout - a.payout;
    });
    var best = rows[0];

    var rankClasses = rows.map(function (_r, i) {
      return payoutRankClass(i, rows.length);
    });
    var table = tableHtml(
      ["Platform", "Est. fees (each)", "You net (each)", "Total payout", "You keep"],
      rows.map(function (r, i) {
        var mark = "";
        if (i === 0) mark = ' <span class="badge badge-ok">Best net</span>';
        else if (i === rows.length - 1) mark = ' <span class="badge badge-danger">Highest fees</span>';
        return [
          escapeHtml(r.name) + mark,
          C.formatMoney(r.fee),
          C.formatMoney(r.payoutEach),
          C.formatMoney(r.payout),
          C.formatPercent(r.keep, 1),
        ];
      }),
      1,
      rankClasses,
      "table-wrap--rank"
    );

    var html =
      resultHero(
        "Highest estimated payout",
        C.formatMoney(best.payout),
        escapeHtml(best.name) + " · " + C.formatMoney(best.payoutEach) + " each after typical fees"
      ) +
      stats([
        ["Sale (each)", C.formatMoney(price)],
        ["Quantity", String(qty)],
        ["Gross (each)", C.formatMoney(grossEach)],
        ["Your shipping cost (each)", C.formatMoney(shipCost)],
      ]) +
      rankLegend() +
      table +
      (itemCost
        ? '<p class="hint">Profit uses your item cost of ' +
          C.formatMoney(itemCost) +
          " each. Best profit: " +
          rows
            .slice()
            .sort(function (a, b) {
              return b.profit - a.profit;
            })[0].name +
          " " +
          C.formatMoney(
            rows.slice().sort(function (a, b) {
              return b.profit - a.profit;
            })[0].profit
          ) +
          ".</p>"
        : "") +
      '<p class="hint">Shipping charged to the buyer is included in eBay and Etsy fee bases. Poshmark, Mercari, Depop, Fashionphile, and The RealReal fees here apply to the item price.</p>';

    var copy = ["Marketplace payout comparison", "Price: " + C.formatMoney(price) + " × " + qty]
      .concat(
        rows.map(function (r) {
          return r.name + ": net " + C.formatMoney(r.payout) + " (fees " + C.formatMoney(r.fee * qty) + ")";
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
      if (e.target && (e.target.name === "unit" || e.target.name === "mode" || e.target.name === "sex")) {
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
