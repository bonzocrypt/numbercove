(function () {
  "use strict";

  var C = window.Calculate;
  if (!C) return;
  var lastCopy = "";

  function row(label, amount, emphasis) {
    return (
      '<tr' + (emphasis ? ' class="rank-best"' : "") + "><td>" +
      label +
      '</td><td class="num">' +
      C.formatMoney(amount) +
      "</td></tr>"
    );
  }

  function stat(label, value) {
    return (
      '<div class="stat"><span class="label">' +
      label +
      '</span><span class="value">' +
      value +
      "</span></div>"
    );
  }

  function pct(value, digits) {
    return C.formatPercent(value, digits == null ? 2 : digits);
  }

  function multiple(value) {
    return Number.isFinite(value) ? C.formatNumber(value, 2) + "×" : "—";
  }

  function npv(rate, cashFlows) {
    return cashFlows.reduce(function (total, cashFlow, year) {
      return total + cashFlow / Math.pow(1 + rate, year);
    }, 0);
  }

  function irr(cashFlows) {
    var low = -0.9999;
    var high = 10;
    var lowValue = npv(low, cashFlows);
    var highValue = npv(high, cashFlows);
    if (!Number.isFinite(lowValue) || !Number.isFinite(highValue) || lowValue * highValue > 0) return NaN;
    for (var i = 0; i < 160; i += 1) {
      var mid = (low + high) / 2;
      var midValue = npv(mid, cashFlows);
      if (Math.abs(midValue) < 0.0001) return mid;
      if (lowValue * midValue <= 0) {
        high = mid;
      } else {
        low = mid;
        lowValue = midValue;
      }
    }
    return (low + high) / 2;
  }

  function read(form, name, label, options) {
    return C.requireFinite(form, name, label, options || { min: 0 });
  }

  function calculate(form) {
    C.clearErrors(form);

    var monthlyRent = read(form, "monthlyRent", "scheduled base rent", { min: 0 });
    var monthlyOtherIncome = read(form, "monthlyOtherIncome", "other income", { min: 0 });
    var vacancyRate = read(form, "vacancyRate", "vacancy and credit loss", { min: 0, max: 100 });
    var propertyTax = read(form, "propertyTax", "property taxes", { min: 0 });
    var insurance = read(form, "insurance", "property insurance", { min: 0 });
    var utilities = read(form, "utilities", "owner-paid utilities", { min: 0 });
    var repairs = read(form, "repairs", "repairs and maintenance", { min: 0 });
    var managementRate = read(form, "managementRate", "management fee", { min: 0, max: 100 });
    var admin = read(form, "admin", "administrative expenses", { min: 0 });
    var otherExpenses = read(form, "otherExpenses", "other operating expenses", { min: 0 });
    var capexReserve = read(form, "capexReserve", "capital reserve", { min: 0 });
    var purchasePrice = read(form, "purchasePrice", "purchase price", { gt: 0 });
    var downPaymentRate = read(form, "downPaymentRate", "down payment", { min: 0, max: 100 });
    var interestRate = read(form, "interestRate", "interest rate", { min: 0, max: 100 });
    var amortYears = read(form, "amortYears", "amortization period", { gt: 0, max: 60 });
    var loanTermYears = read(form, "loanTermYears", "loan term", { gt: 0, max: 60 });
    var closingCosts = read(form, "closingCosts", "closing and loan costs", { min: 0 });
    var initialCapex = read(form, "initialCapex", "initial repairs", { min: 0 });
    var targetCapRate = read(form, "targetCapRate", "target cap rate", { gt: 0, max: 100 });
    var holdYears = read(form, "holdYears", "holding period", { gt: 0, max: 50 });
    var noiGrowthRate = read(form, "noiGrowthRate", "NOI growth", { min: -100, max: 100 });
    var exitCapRate = read(form, "exitCapRate", "exit cap rate", { gt: 0, max: 100 });
    var sellingCostRate = read(form, "sellingCostRate", "selling costs", { min: 0, max: 100 });

    var values = [monthlyRent, monthlyOtherIncome, vacancyRate, propertyTax, insurance, utilities, repairs, managementRate, admin, otherExpenses, capexReserve, purchasePrice, downPaymentRate, interestRate, amortYears, loanTermYears, closingCosts, initialCapex, targetCapRate, holdYears, noiGrowthRate, exitCapRate, sellingCostRate];
    if (values.some(function (value) { return value == null; })) {
      C.showFormError(form, "Review the highlighted fields.");
      return;
    }

    holdYears = Math.max(1, Math.round(holdYears));
    amortYears = Math.max(1, Math.round(amortYears));
    loanTermYears = Math.max(1, Math.round(loanTermYears));

    var scheduledRent = monthlyRent * 12;
    var otherIncome = monthlyOtherIncome * 12;
    var grossPotentialIncome = scheduledRent + otherIncome;
    var vacancyLoss = grossPotentialIncome * vacancyRate / 100;
    var effectiveGrossIncome = grossPotentialIncome - vacancyLoss;
    var managementFee = effectiveGrossIncome * managementRate / 100;
    var operatingExpenses = propertyTax + insurance + utilities + repairs + managementFee + admin + otherExpenses;
    var noi = effectiveGrossIncome - operatingExpenses;

    var downPayment = purchasePrice * downPaymentRate / 100;
    var loanAmount = purchasePrice - downPayment;
    var monthlyDebtService = loanAmount > 0 ? C.payment(loanAmount, interestRate, amortYears * 12) : 0;
    var annualDebtService = monthlyDebtService * 12;
    var initialCash = downPayment + closingCosts + initialCapex;
    var preTaxCashFlow = noi - annualDebtService - capexReserve;
    var capRate = noi / purchasePrice * 100;
    var allInCost = purchasePrice + closingCosts + initialCapex;
    var unleveredReturn = noi / allInCost * 100;
    var cashOnCash = initialCash > 0 ? preTaxCashFlow / initialCash * 100 : NaN;
    var dscr = annualDebtService > 0 ? noi / annualDebtService : NaN;
    var debtYield = loanAmount > 0 ? noi / loanAmount * 100 : NaN;
    var ltv = purchasePrice > 0 ? loanAmount / purchasePrice * 100 : NaN;
    var grm = scheduledRent > 0 ? purchasePrice / scheduledRent : NaN;
    var breakEvenOccupancy = grossPotentialIncome > 0 ? (operatingExpenses + annualDebtService) / grossPotentialIncome * 100 : NaN;
    var valueAtTargetCap = noi / (targetCapRate / 100);
    var maturityMonths = Math.min(loanTermYears * 12, amortYears * 12);
    var maturityBalance = loanAmount > 0 ? C.remainingBalance(loanAmount, interestRate, amortYears * 12, maturityMonths) : 0;

    var firstYearAmortization = loanAmount > 0 ? C.amortize(loanAmount, interestRate, amortYears * 12, 0) : { rows: [] };
    var firstYearPrincipal = firstYearAmortization.rows.slice(0, 12).reduce(function (sum, item) { return sum + item.principal; }, 0);
    var leveragedYearOneRoi = initialCash > 0 ? (preTaxCashFlow + firstYearPrincipal) / initialCash * 100 : NaN;

    var growth = noiGrowthRate / 100;
    var cashFlows = [-initialCash];
    var cumulativeOperatingCashFlow = 0;
    for (var year = 1; year <= holdYears; year += 1) {
      var yearNoi = noi * Math.pow(1 + growth, year - 1);
      var yearReserve = capexReserve * Math.pow(1 + growth, year - 1);
      var yearCashFlow = yearNoi - annualDebtService - yearReserve;
      cumulativeOperatingCashFlow += yearCashFlow;
      cashFlows.push(yearCashFlow);
    }

    var forwardNoiAtExit = noi * Math.pow(1 + growth, holdYears);
    var projectedSalePrice = forwardNoiAtExit / (exitCapRate / 100);
    var monthsHeld = Math.min(holdYears * 12, amortYears * 12);
    var remainingLoan = loanAmount > 0 ? C.remainingBalance(loanAmount, interestRate, amortYears * 12, monthsHeld) : 0;
    var sellingCosts = projectedSalePrice * sellingCostRate / 100;
    var netSaleProceeds = projectedSalePrice - sellingCosts - remainingLoan;
    cashFlows[cashFlows.length - 1] += netSaleProceeds;
    var annualIrr = irr(cashFlows);
    var totalCashReturned = cumulativeOperatingCashFlow + netSaleProceeds;
    var equityMultiple = initialCash > 0 ? totalCashReturned / initialCash : NaN;
    var totalRoi = initialCash > 0 ? (totalCashReturned - initialCash) / initialCash * 100 : NaN;

    var html =
      '<div class="result-hero"><p class="label">Net operating income (NOI)</p><p class="value">' +
      C.formatMoney(noi) +
      '</p><p class="sub">' + pct(capRate) + ' cap rate at ' + C.formatMoney(purchasePrice) + '</p></div>' +
      '<div class="stat-grid">' +
      stat("Effective gross income", C.formatMoney(effectiveGrossIncome)) +
      stat("Operating expenses", C.formatMoney(operatingExpenses)) +
      stat("Price at target cap", C.formatMoney(valueAtTargetCap)) +
      stat("Unlevered return", pct(unleveredReturn)) +
      '</div>' +
      '<h3>APOD summary</h3><div class="table-wrap"><table><thead><tr><th>Annual property operating data</th><th class="num">Amount</th></tr></thead><tbody>' +
      row("Scheduled base rent", scheduledRent) +
      row("Other income", otherIncome) +
      row("Gross potential income", grossPotentialIncome) +
      row("Less vacancy &amp; credit loss", -vacancyLoss) +
      row("Effective gross income", effectiveGrossIncome, true) +
      row("Property taxes", -propertyTax) +
      row("Insurance", -insurance) +
      row("Utilities", -utilities) +
      row("Repairs &amp; maintenance", -repairs) +
      row("Management fee", -managementFee) +
      row("Administrative &amp; professional", -admin) +
      row("Other operating expenses", -otherExpenses) +
      row("Total operating expenses", -operatingExpenses) +
      row("Net operating income", noi, true) +
      row("Capital reserve (below NOI)", -capexReserve) +
      row("Annual debt service", -annualDebtService) +
      row("Pre-tax cash flow", preTaxCashFlow, true) +
      '</tbody></table></div>' +
      '<h3>Financing &amp; year-one returns</h3><div class="stat-grid">' +
      stat("Loan amount", C.formatMoney(loanAmount)) +
      stat("Initial cash invested", C.formatMoney(initialCash)) +
      stat("Monthly debt service", C.formatMoney(monthlyDebtService)) +
      stat("Balance at loan maturity", C.formatMoney(maturityBalance)) +
      stat("Pre-tax cash flow", C.formatMoney(preTaxCashFlow)) +
      stat("Cash-on-cash return", pct(cashOnCash)) +
      stat("Year-one leveraged ROI", pct(leveragedYearOneRoi)) +
      stat("DSCR", multiple(dscr)) +
      stat("Debt yield", pct(debtYield)) +
      stat("Loan-to-value", pct(ltv)) +
      stat("Break-even occupancy", pct(breakEvenOccupancy)) +
      stat("Gross rent multiplier", multiple(grm)) +
      stat("Year-one principal paid", C.formatMoney(firstYearPrincipal)) +
      '</div>' +
      '<h3>' + holdYears + '-year hold projection</h3><div class="stat-grid">' +
      stat("Projected sale price", C.formatMoney(projectedSalePrice)) +
      stat("Loan balance at sale", C.formatMoney(remainingLoan)) +
      stat("Net sale proceeds", C.formatMoney(netSaleProceeds)) +
      stat("Annual IRR", Number.isFinite(annualIrr) ? pct(annualIrr * 100) : "—") +
      stat("Equity multiple", multiple(equityMultiple)) +
      stat("Total ROI", pct(totalRoi)) +
      '</div><p class="hint">Exit value uses next-year NOI of ' + C.formatMoney(forwardNoiAtExit) + ' at a ' + pct(exitCapRate) + ' exit cap rate. IRR uses annual cash flows and does not include taxes.' + (holdYears > loanTermYears ? ' The holding period extends beyond the loan maturity; this projection assumes the debt can be refinanced or extended on comparable terms.' : '') + '</p>';

    document.getElementById("results").innerHTML = html;
    lastCopy = [
      "Commercial real estate evaluation",
      "NOI: " + C.formatMoney(noi),
      "Effective gross income: " + C.formatMoney(effectiveGrossIncome),
      "Operating expenses: " + C.formatMoney(operatingExpenses),
      "Cap rate: " + pct(capRate),
      "Price at target cap: " + C.formatMoney(valueAtTargetCap),
      "Annual debt service: " + C.formatMoney(annualDebtService),
      "Balance at loan maturity: " + C.formatMoney(maturityBalance),
      "Pre-tax cash flow: " + C.formatMoney(preTaxCashFlow),
      "Cash-on-cash return: " + pct(cashOnCash),
      "DSCR: " + multiple(dscr),
      "Debt yield: " + pct(debtYield),
      "Break-even occupancy: " + pct(breakEvenOccupancy),
      holdYears + "-year IRR: " + (Number.isFinite(annualIrr) ? pct(annualIrr * 100) : "—"),
      "Equity multiple: " + multiple(equityMultiple),
      "Projected sale price: " + C.formatMoney(projectedSalePrice)
    ].join("\n");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.getElementById("calc-form");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      calculate(form);
    });
    document.getElementById("reset-calc").addEventListener("click", function () {
      form.reset();
      calculate(form);
    });
    document.getElementById("copy-results").addEventListener("click", function () {
      C.copyText(lastCopy);
    });
    calculate(form);
  });
})();
