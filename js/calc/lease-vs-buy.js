/* Lease vs buy a car: lease payment from money factor and residual, loan
   payment, net cost over the lease term, and buy-and-keep vs back-to-back leases. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };

  function leasePayment(v) {
    var adjCap = v.price + (v.acqFee || 0) - (v.leaseDown || 0);
    var residual = v.msrp * v.residualPct / 100;
    var dep = (adjCap - residual) / v.term;
    var rent = (adjCap + residual) * v.mf;
    var base = dep + rent;
    var tax = base * (v.taxRate || 0) / 100;
    return { adjCap: adjCap, residual: residual, dep: dep, rent: rent, base: base, tax: tax, payment: base + tax };
  }

  function loanPayment(principal, apr, n) {
    var r = apr / 100 / 12;
    if (n <= 0) return 0;
    if (r === 0) return principal / n;
    return principal * r / (1 - Math.pow(1 + r, -n));
  }

  function balanceAfter(principal, apr, n, k) {
    var r = apr / 100 / 12;
    if (k >= n) return 0;
    if (r === 0) return principal * (1 - k / n);
    var pmt = loanPayment(principal, apr, n);
    return principal * Math.pow(1 + r, k) - pmt * (Math.pow(1 + r, k) - 1) / r;
  }

  function compute(v) {
    v = Object.assign({}, v, { term: +v.term, loanTerm: +v.loanTerm });
    var L = leasePayment(v);
    var excess = Math.max(0, v.milesDriven - v.milesAllowed) * v.term / 12 * (v.overage || 0);
    var leaseUpfront = (v.leaseDown || 0) * (1 + (v.taxRate || 0) / 100);
    var leaseTotal = leaseUpfront + L.payment * v.term + (v.dispFee || 0) + excess;
    var taxedPrice = v.price * (1 + (v.taxRate || 0) / 100);
    var loan = Math.max(0, taxedPrice - (v.buyDown || 0));
    var pmt = loanPayment(loan, v.apr, v.loanTerm);
    var T = v.term;
    var valueAtEnd = v.endValue != null ? v.endValue : L.residual;
    var bal = balanceAfter(loan, v.apr, v.loanTerm, T);
    var buyPaid = (v.buyDown || 0) + pmt * Math.min(T, v.loanTerm);
    var buyNet = buyPaid - (valueAtEnd - bal);
    /* Long horizon: value declines at the same yearly rate the end value implies. */
    var yrsT = T / 12;
    var decline = Math.pow(Math.max(0.01, valueAtEnd / v.price), 1 / yrsT);
    var horizon = Math.max(1, Math.round(v.keepYears));
    var warranty = v.warrantyYears || 0;
    var leasePerMonth = leaseTotal / T;
    var path = [];
    var buyCash = v.buyDown || 0;
    for (var y = 0; y <= horizon; y += 1) {
      if (y > 0) {
        buyCash += pmt * Math.max(0, Math.min(12 * y, v.loanTerm) - Math.min(12 * (y - 1), v.loanTerm));
        if (y > warranty) buyCash += v.repairs || 0;
      }
      var value = v.price * Math.pow(decline, y);
      var balY = balanceAfter(loan, v.apr, v.loanTerm, 12 * y);
      path.push({ y: y, buy: buyCash - (value - balY), lease: leasePerMonth * 12 * y, value: value, cash: buyCash });
    }
    var endH = path[horizon];
    return {
      v: v, L: L, excess: excess, leaseTotal: leaseTotal, leaseUpfront: leaseUpfront, loan: loan, pmt: pmt, bal: bal, valueAtEnd: valueAtEnd,
      buyPaid: buyPaid, buyNet: buyNet, path: path, horizon: horizon, endH: endH, apr: v.mf * 2400, leasePerMonth: leasePerMonth,
    };
  }

  function render(res, v, h) {
    v = res.v;
    var T = v.term;
    var leaseCheaper = res.leaseTotal < res.buyNet;
    var hLease = res.endH.lease;
    var hBuy = res.endH.buy;
    var verdict = {
      tone: hBuy <= hLease ? "good" : "info",
      title: hBuy <= hLease
        ? "Buying and keeping it " + res.horizon + " years saves about " + money0(hLease - hBuy) + " over leasing the whole time."
        : "Leasing costs about " + money0(hBuy - hLease) + " less over " + res.horizon + " years than buying and keeping.",
      body: "Over just the " + T + "-month lease term, " + (leaseCheaper ? "leasing is " + money0(res.buyNet - res.leaseTotal) + " cheaper" : "buying is " + money0(res.leaseTotal - res.buyNet) + " cheaper") + " once you count what the car is worth when you sell it. The lease's money factor works out to " + fmt.pct(res.apr, 2) + " APR" + (res.apr > v.apr + 0.25 ? ", higher than your " + fmt.pct(v.apr, 2) + " loan rate" : "") + ".",
    };
    var stats = [
      ["Lease payment", money0(res.L.payment) + "/mo", money0(res.L.dep) + " depreciation + " + money0(res.L.rent) + " rent charge + " + money0(res.L.tax) + " tax"],
      ["Loan payment", money0(res.pmt) + "/mo", fmt.pct(v.apr, 2) + " for " + v.loanTerm + " months on " + money0(res.loan)],
      ["Lease cost over " + T + " months", money0(res.leaseTotal), "Down + payments + disposition" + (res.excess ? " + " + money0(res.excess) + " extra miles" : ""), leaseCheaper ? "good" : ""],
      ["Buy cost over " + T + " months", money0(res.buyNet), "Paid " + money0(res.buyPaid) + ", minus " + money0(res.valueAtEnd - res.bal) + " equity", !leaseCheaper ? "good" : ""],
      ["Lease rate as APR", fmt.pct(res.apr, 2), "Money factor " + fmt.num(v.mf, 5) + " × 2,400", "hl"],
      ["Over " + res.horizon + " years", money0(hBuy) + " vs " + money0(hLease), "Buy and keep vs back-to-back leases", hBuy <= hLease ? "good" : ""],
    ];
    var xs = res.path.map(function (p) { return p.y; });
    var crossY = null;
    for (var i = 1; i < res.path.length; i += 1) {
      var a = res.path[i - 1];
      var b = res.path[i];
      if (a.buy > a.lease && b.buy <= b.lease) { crossY = i - 1 + (a.buy - a.lease) / ((a.buy - a.lease) - (b.buy - b.lease)); break; }
    }
    var chart = h.line({
      width: h.wideWidth, xs: xs,
      series: [
        { name: "Buy and keep (net of car's value)", ys: res.path.map(function (p) { return p.buy; }) },
        { name: "Keep leasing", ys: res.path.map(function (p) { return p.lease; }) },
      ],
      markers: [{ x: T / 12, label: "Lease ends" }].concat(v.warrantyYears && v.warrantyYears < res.horizon && v.warrantyYears !== T / 12 ? [{ x: v.warrantyYears, label: "Warranty ends" }] : []),
      points: crossY != null ? [{ x: crossY, y: interp(res.path, crossY), tone: "cross", label: "Buying ahead after " + fmt.num(crossY, 1) + " yrs" }] : [],
      xFormat: function (y) { return "Yr " + y; }, tipX: function (y) { return "Year " + y; },
      ariaLabel: "Net cost of buying and keeping versus leasing continuously",
      caption: "Buying's net cost is everything you've paid minus what you'd get selling the car (after paying off the loan). Leasing assumes each new lease costs the same. Owning gets cheaper per year once the loan is paid off.",
    });
    var bars = h.bars({
      series: ["Lease", "Buy"],
      rows: [
        { label: "Up front", values: [res.leaseUpfront, v.buyDown || 0] },
        { label: "Payments over " + T + " mo", values: [res.L.payment * T, res.pmt * Math.min(T, v.loanTerm)] },
        { label: "At the end", values: [(v.dispFee || 0) + res.excess, -(res.valueAtEnd - res.bal)] },
        { label: "Net cost", values: [res.leaseTotal, res.buyNet], highlight: true },
      ],
      format: function (n) { return money0(n); },
      ariaLabel: "Lease versus buy cost over the lease term",
    });
    var tips = [
      "Negotiate the price before mentioning a lease; the capitalized cost is negotiable just like a purchase price.",
      "Ask for the money factor and residual in writing. Dealers can mark up the money factor above the lender's buy rate.",
      "Lease mileage overages and wear charges can be large; pick an allowance above what you expect to drive.",
      "Gap coverage is usually built into leases; with a loan and a small down payment, you may need to buy it.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Net cost over " + res.horizon + " years", html: chart },
        { title: "Over the " + T + "-month lease term", html: bars },
        { title: "Before you sign", html: '<ul class="nc-recs">' + tips.map(function (t) { return "<li>" + h.esc(t) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Lease vs buy (NumberCove)", "Lease: " + money0(res.L.payment) + "/mo, " + money0(res.leaseTotal) + " over " + T + " months", "Buy: " + money0(res.pmt) + "/mo, net " + money0(res.buyNet) + " over " + T + " months", "Over " + res.horizon + " years: buy " + money0(hBuy) + " vs lease " + money0(hLease), "Lease APR equivalent: " + fmt.pct(res.apr, 2)].join("\n"),
    };
  }

  function interp(path, x) {
    var i = Math.floor(x);
    if (i >= path.length - 1) return path[path.length - 1].buy;
    return path[i].buy + (path[i + 1].buy - path[i].buy) * (x - i);
  }

  return {
    id: "lease-vs-buy",
    inputs: [
      { name: "msrp", label: "MSRP", type: "number", value: 40000, min: 1000, max: 1000000, prefix: "$", hint: "The residual is a % of MSRP" },
      { name: "price", label: "Negotiated price", type: "number", value: 38000, min: 1000, max: 1000000, prefix: "$" },
      { name: "term", label: "Lease term", type: "segment", value: 36, options: [[24, "24 mo"], [36, "36 mo"], [39, "39 mo"], [48, "48 mo"]] },
      { name: "residualPct", label: "Residual value", type: "number", value: 58, min: 10, max: 95, suffix: "% of MSRP", slider: { min: 35, max: 75, step: 1 } },
      { name: "mf", label: "Money factor", type: "number", value: 0.0025, min: 0, max: 0.02, hint: "× 2,400 = APR. 0.0025 ≈ 6%" },
      { name: "leaseDown", label: "Lease down payment", type: "number", value: 2000, min: 0, max: 100000, prefix: "$", hint: "Cap cost reduction" },
      { name: "buyDown", label: "Purchase down payment", type: "number", value: 4000, min: 0, max: 1000000, prefix: "$" },
      { name: "apr", label: "Loan APR", type: "number", value: 6.5, min: 0, max: 30, suffix: "%", slider: { min: 0, max: 15, step: 0.25 } },
      { name: "loanTerm", label: "Loan term", type: "segment", value: 60, options: [[36, "36"], [48, "48"], [60, "60"], [72, "72"], [84, "84 mo"]] },
      { name: "keepYears", label: "If you buy, years you'd keep it", type: "number", value: 8, min: 1, max: 15, integer: true, slider: { min: 2, max: 15, step: 1 } },
      {
        type: "group", title: "Fees, taxes, and miles", advanced: true,
        fields: [
          { name: "taxRate", label: "Sales tax", type: "number", value: 7, min: 0, max: 15, suffix: "%", hint: "Most states tax lease payments, not the whole price" },
          { name: "acqFee", label: "Lease acquisition fee", type: "number", value: 995, min: 0, max: 5000, prefix: "$" },
          { name: "dispFee", label: "Lease disposition fee", type: "number", value: 395, min: 0, max: 5000, prefix: "$" },
          { name: "milesAllowed", label: "Lease miles per year", type: "number", value: 12000, min: 5000, max: 30000 },
          { name: "milesDriven", label: "Miles you drive per year", type: "number", value: 12000, min: 0, max: 100000 },
          { name: "overage", label: "Overage charge", type: "number", value: 0.25, min: 0, max: 2, prefix: "$", suffix: "/mile" },
        ],
      },
      {
        type: "group", title: "Owning longer", advanced: true,
        fields: [
          { name: "endValue", label: "Car's value when the lease would end", type: "number", optional: true, min: 0, max: 1000000, prefix: "$", hint: "Blank uses the residual value" },
          { name: "warrantyYears", label: "Warranty years", type: "number", value: 3, min: 0, max: 10 },
          { name: "repairs", label: "Repairs per year after warranty", type: "number", value: 900, min: 0, max: 20000, prefix: "$" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { leasePayment: leasePayment, loanPayment: loanPayment, balanceAfter: balanceAfter },
  };
});
