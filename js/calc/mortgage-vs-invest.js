/* Pay off the mortgage early or invest the difference. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;

  function payment(P, annualPct, n) {
    var i = annualPct / 100 / 12;
    if (i === 0) return P / n;
    return P * i / (1 - Math.pow(1 + i, -n));
  }

  /* Month-by-month simulation of both strategies to the original payoff date. */
  function simulate(v, returnPct) {
    var n = Math.round(v.years * 12);
    var i = v.rate / 100 / 12;
    var M = payment(v.balance, v.rate, n);
    var ret = Math.pow(1 + Math.max(-99, returnPct - (v.taxDrag || 0)) / 100, 1 / 12) - 1;
    var tau = v.itemize ? (v.marginal || 0) / 100 : 0;
    var A = { bal: v.balance, inv: 0, interest: 0, payoffMonth: null };
    var B = { bal: v.balance, inv: 0, interest: 0 };
    var path = [{ m: 0, a: -v.balance, b: -v.balance }];
    for (var m = 1; m <= n; m += 1) {
      /* A: extra payments until the loan is gone, then invest everything. */
      A.inv *= 1 + ret;
      if (A.bal > 0.005) {
        var intA = A.bal * i;
        var payA = Math.min(A.bal + intA, M + v.extra);
        A.bal = A.bal + intA - payA;
        A.interest += intA;
        A.inv += intA * tau + (M + v.extra - payA);
        if (A.bal <= 0.005) { A.bal = 0; A.payoffMonth = m; }
      } else {
        A.inv += M + v.extra;
      }
      /* B: regular payments, invest the extra every month. */
      B.inv *= 1 + ret;
      if (B.bal > 0.005) {
        var intB = B.bal * i;
        var payB = Math.min(B.bal + intB, M);
        B.bal = B.bal + intB - payB;
        B.interest += intB;
        B.inv += intB * tau + (M - payB);
      } else {
        B.inv += M;
      }
      B.inv += v.extra;
      path.push({ m: m, a: A.inv - A.bal, b: B.inv - B.bal });
    }
    return { n: n, M: M, A: A, B: B, path: path, finalA: A.inv - A.bal, finalB: B.inv - B.bal };
  }

  function compute(v) {
    var s = simulate(v, v.returnPct);
    var lo = -5;
    var hi = 30;
    var be = null;
    var f = function (r) { var x = simulate(v, r); return x.finalB - x.finalA; };
    if (f(lo) < 0 && f(hi) > 0) {
      for (var k = 0; k < 60; k += 1) {
        var mid = (lo + hi) / 2;
        if (f(mid) > 0) hi = mid;
        else lo = mid;
      }
      be = (lo + hi) / 2;
    }
    var effRate = v.rate * (1 - (v.itemize ? (v.marginal || 0) / 100 : 0));
    return { v: v, s: s, breakEven: be, effRate: effRate, diff: s.finalB - s.finalA };
  }

  function render(res, v, h) {
    var s = res.s;
    var monthsSaved = s.A.payoffMonth ? s.n - s.A.payoffMonth : 0;
    var investWins = res.diff > 0;
    var verdict = {
      tone: investWins ? "info" : "good",
      title: investWins
        ? "Investing comes out " + fmt.money(res.diff) + " ahead, if you earn " + fmt.pct(v.returnPct, 1) + " a year."
        : "Paying off the mortgage comes out " + fmt.money(-res.diff) + " ahead.",
      body: (res.breakEven != null ? "The break-even is a " + fmt.pct(res.breakEven, 2) + " return" + (v.taxDrag ? " before " + fmt.pct(v.taxDrag, 1) + " tax drag" : "") + ". " : "") +
        "Extra payments are a guaranteed " + fmt.pct(res.effRate, 2) + " return" + (v.itemize ? " after the interest deduction" : "") + "; investing is not guaranteed. " +
        "Paying extra saves " + fmt.money(s.B.interest - s.A.interest) + " in interest and clears the loan " + fmt.months(monthsSaved) + " early.",
    };
    var stats = [
      ["Monthly payment", fmt.money(s.M, 2), "Principal and interest"],
      ["Paid off with extra payments", s.A.payoffMonth ? fmt.months(s.A.payoffMonth) : "—", fmt.months(monthsSaved) + " early"],
      ["Interest saved", fmt.money(s.B.interest - s.A.interest), "Versus the regular schedule"],
      ["Break-even investment return", res.breakEven != null ? fmt.pct(res.breakEven, 2) : "—", "Annual return; a " + fmt.pct(res.effRate, 2) + " mortgage compounds to " + fmt.pct((Math.pow(1 + res.effRate / 1200, 12) - 1) * 100, 2) + " a year", "hl"],
      ["Net worth: pay off early", fmt.money(s.finalA), "At the original payoff date"],
      ["Net worth: invest the extra", fmt.money(s.finalB), "At the original payoff date", investWins ? "good" : ""],
    ];
    var step = s.n > 240 ? 12 : 6;
    var pts = s.path.filter(function (p) { return p.m % step === 0 || p.m === s.n; });
    var chart = h.line({
      width: h.wideWidth,
      xs: pts.map(function (p) { return p.m; }),
      series: [
        { name: "Invest the extra", ys: pts.map(function (p) { return p.b; }) },
        { name: "Pay off early", ys: pts.map(function (p) { return p.a; }) },
      ],
      markers: s.A.payoffMonth ? [{ x: s.A.payoffMonth, label: "Mortgage gone", tone: "good" }] : [],
      xFormat: function (m) { return (m / 12) + " yr"; }, tipX: function (m) { return "Year " + fmt.num(m / 12, 1); },
      xTicks: pts.map(function (p) { return p.m; }).filter(function (m) { return m % (s.n > 240 ? 60 : 24) === 0; }),
      ariaLabel: "Net worth over time: paying off the mortgage early versus investing the extra",
      caption: "Net worth here is investments minus the remaining mortgage. Paying early builds equity first, then invests the whole payment once the loan is gone.",
    });
    var rates = [3, 4, 5, 6, 7, 8, 9, 10];
    var table = h.table(["Investment return", "Pay off early", "Invest the extra", "Difference"], rates.map(function (r) {
      var x = def._sim(v, r);
      var d = x.finalB - x.finalA;
      return { cls: Math.abs(r - v.returnPct) < 0.5 ? "row-hl" : "", cells: [fmt.pct(r, 0), fmt.money(x.finalA), fmt.money(x.finalB), (d >= 0 ? "Invest +" : "Pay off +") + fmt.money(Math.abs(d))] };
    }));
    var notes = [
      "Paying down a " + fmt.pct(v.rate, 2) + " mortgage is a guaranteed, risk-free return of that rate. Stock returns are higher on average but can be negative for years.",
      "Keep an emergency fund and capture any 401(k) match before prepaying. Home equity is hard to reach quickly; investments are not.",
      "The mortgage interest deduction only helps if you itemize. Most households take the standard deduction, which makes the after-tax mortgage rate the full rate.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Net worth over time", html: chart },
        { title: "At other investment returns", html: table },
        { title: "Beyond the math", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Pay off mortgage vs invest (NumberCove)", "Extra per month: " + fmt.money(v.extra), "Interest saved: " + fmt.money(s.B.interest - s.A.interest), "Net worth pay off early: " + fmt.money(s.finalA), "Net worth invest: " + fmt.money(s.finalB), "Break-even return: " + (res.breakEven != null ? fmt.pct(res.breakEven, 2) : "—")].join("\n"),
    };
  }

  var def = {
    id: "mortgage-vs-invest",
    inputs: [
      { name: "balance", label: "Mortgage balance", type: "number", value: 300000, min: 1, max: 100000000, prefix: "$" },
      { name: "rate", label: "Interest rate", type: "number", value: 6.5, min: 0, max: 30, suffix: "%", slider: { min: 2, max: 9, step: 0.125 } },
      { name: "years", label: "Years remaining", type: "number", value: 28, min: 1, max: 40 },
      { name: "extra", label: "Extra money each month", type: "number", value: 500, min: 0, max: 1000000, prefix: "$" },
      { name: "returnPct", label: "Expected investment return", type: "number", value: 7, min: -10, max: 30, suffix: "%/yr", slider: { min: 0, max: 12, step: 0.25 } },
      { name: "taxDrag", label: "Tax drag on investments", type: "number", value: 0, min: 0, max: 10, suffix: "%/yr", hint: "0 in a 401(k) or IRA; about 0.5–1.5 in a taxable account" },
      { name: "itemize", label: "I itemize and deduct mortgage interest", type: "toggle", value: false },
      { name: "marginal", label: "Marginal tax rate", type: "number", value: 24, min: 0, max: 60, suffix: "%", showIf: { itemize: true } },
    ],
    compute: compute,
    render: render,
    /* Mobile balloon on first load: the default case as a hook. */
    teaser: function (r, v, fmt) {
      if (!(r.diff > 0) || !(r.s.finalB > r.s.finalA)) return null;
      return { tone: "good", label: "A typical " + fmt.money(v.balance, 0) + " mortgage", title: "Investing " + fmt.money(v.extra, 0) + " a month beats prepaying by " + fmt.money(r.diff, 0) + ".", body: "At a " + fmt.pct(v.rate, 1) + " rate and a " + fmt.pct(v.returnPct, 0) + " return. Does it hold for your loan?" };
    },
  };
  def._sim = function (v, r) { return simulate(v, r); };
  def._test = { payment: payment, simulate: simulate };
  return def;
});
