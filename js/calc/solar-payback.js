/* Solar payback: savings, payback, lifetime return, cost per kWh, and whether
   waiting for cheaper or better panels pays. State averages for rates and output. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var money0 = function (x) { return fmt.money(x, 0); };

  /* [name, residential ¢/kWh (EIA Electric Power Monthly, June 2026),
     annual kWh per kW DC (NREL PVWatts v8, largest city, 20° tilt, south, 14% losses)] */
  var STATES = {
    AL: ["Alabama", 16.4, 1367], AK: ["Alaska", 28.2, 922], AZ: ["Arizona", 15.2, 1755], AR: ["Arkansas", 14.1, 1373],
    CA: ["California", 34.7, 1677], CO: ["Colorado", 17.1, 1595], CT: ["Connecticut", 24.3, 1291], DE: ["Delaware", 19.3, 1364],
    DC: ["District of Columbia", 24.4, 1391], FL: ["Florida", 15.1, 1455], GA: ["Georgia", 16.4, 1420], HI: ["Hawaii", 52.7, 1622],
    ID: ["Idaho", 14.4, 1468], IL: ["Illinois", 19.9, 1308], IN: ["Indiana", 17.5, 1332], IA: ["Iowa", 15.9, 1367],
    KS: ["Kansas", 15.7, 1526], KY: ["Kentucky", 14.3, 1343], LA: ["Louisiana", 13.5, 1479], ME: ["Maine", 29.6, 1319],
    MD: ["Maryland", 21.8, 1392], MA: ["Massachusetts", 29.6, 1302], MI: ["Michigan", 23.0, 1291], MN: ["Minnesota", 17.5, 1333],
    MS: ["Mississippi", 14.9, 1414], MO: ["Missouri", 16.2, 1433], MT: ["Montana", 15.1, 1344], NE: ["Nebraska", 13.3, 1423],
    NV: ["Nevada", 13.1, 1753], NH: ["New Hampshire", 27.0, 1258], NJ: ["New Jersey", 24.9, 1305], NM: ["New Mexico", 15.1, 1779],
    NY: ["New York", 29.5, 1291], NC: ["North Carolina", 14.7, 1416], ND: ["North Dakota", 14.1, 1294], OH: ["Ohio", 19.2, 1296],
    OK: ["Oklahoma", 14.3, 1542], OR: ["Oregon", 16.3, 1121], PA: ["Pennsylvania", 21.7, 1356], RI: ["Rhode Island", 29.2, 1294],
    SC: ["South Carolina", 15.6, 1454], SD: ["South Dakota", 15.4, 1409], TN: ["Tennessee", 14.1, 1338], TX: ["Texas", 15.9, 1421],
    UT: ["Utah", 13.4, 1484], VT: ["Vermont", 24.4, 1222], VA: ["Virginia", 17.2, 1427], WA: ["Washington", 14.9, 1088],
    WV: ["West Virginia", 15.4, 1219], WI: ["Wisconsin", 19.6, 1334], WY: ["Wyoming", 15.2, 1533],
  };

  /* Yearly cash flows for a system installed `wait` years from now (index 0 = today). */
  function flows(v, wait) {
    wait = wait || 0;
    var st = STATES[v.state] || STATES.TX;
    var kw = v.kw;
    var cost = kw * 1000 * v.costPerW * Math.pow(1 - (v.priceDecline || 0) / 100, wait) - (v.incentives || 0);
    var prod0 = (v.production != null ? v.production : kw * st[2]) * Math.pow(1 + (v.effGain || 0) / 100, wait);
    var rate0 = v.rate;
    var esc = (v.rateEsc || 0) / 100;
    var deg = (v.degradation || 0) / 100;
    var life = Math.max(1, Math.round(v.life));
    var selfShare = v.metering === "net" ? 1 : (v.selfUse || 0) / 100;
    var out = [];
    for (var t = 0; t <= wait + life; t += 1) out.push(0);
    out[wait] -= cost;
    var rows = [];
    for (var y = 1; y <= life; y += 1) {
      var yr = wait + y;
      var prod = prod0 * Math.pow(1 - deg, y - 1);
      var rate = rate0 * Math.pow(1 + esc, yr - 1);
      var usage = v.usage || Infinity;
      /* Production above your usage is always credited at the export rate. */
      var offset = Math.min(prod, usage);
      var surplus = prod - offset;
      var valueSelf = offset * selfShare * rate;
      var valueExport = (offset * (1 - selfShare) + surplus) * v.exportRate;
      var saving = valueSelf + valueExport;
      var upkeep = (v.upkeep || 0) + (y === Math.round(v.inverterYear) ? v.inverterCost || 0 : 0);
      out[yr] += saving - upkeep;
      rows.push({ y: yr, prod: prod, rate: rate, saving: saving, upkeep: upkeep });
    }
    return { cost: cost, prod0: prod0, flows: out, rows: rows, life: life, wait: wait };
  }

  function npv(cf, r) {
    return cf.reduce(function (s, c, t) { return s + c / Math.pow(1 + r, t); }, 0);
  }

  function irr(cf) {
    var lo = -0.99;
    var hi = 1;
    if (npv(cf, lo) * npv(cf, hi) > 0) return null;
    for (var i = 0; i < 200; i += 1) {
      var mid = (lo + hi) / 2;
      if (npv(cf, lo) * npv(cf, mid) <= 0) hi = mid; else lo = mid;
    }
    return (lo + hi) / 2;
  }

  function compute(v) {
    var st = STATES[v.state] || STATES.TX;
    var f = flows(v, 0);
    var cum = [];
    var run = 0;
    var payback = null;
    f.flows.forEach(function (c, t) {
      var prev = run;
      run += c;
      if (payback == null && t > 0 && prev < 0 && run >= 0) payback = t - 1 + -prev / c;
      cum.push({ y: t, v: run });
    });
    var r = (v.discount || 0) / 100;
    var lifetimeKwh = f.rows.reduce(function (s, x) { return s + x.prod; }, 0);
    var totalUpkeep = f.rows.reduce(function (s, x) { return s + x.upkeep; }, 0);
    var waits = [0, 1, 2, 3, 4, 5].map(function (w) {
      var fw = flows(v, w);
      /* Same window from today for every option: waiting trades the savings you
         give up now for a cheaper, better system later. Valuing each over its own
         full life would credit waiting with extra years at the end. */
      return { wait: w, npv: npv(fw.flows.slice(0, f.life + 1), r), cost: fw.cost, prod: fw.prod0 };
    });
    var bestWait = waits.reduce(function (b, x) { return x.npv > b.npv ? x : b; }, waits[0]);
    return {
      v: v, st: st, f: f, cum: cum, payback: payback, net: run, npv: npv(f.flows, r), irr: irr(f.flows),
      lcoe: (f.cost + totalUpkeep) / lifetimeKwh, lifetimeKwh: lifetimeKwh, firstYear: f.rows[0].saving, waits: waits, bestWait: bestWait,
      coverage: v.usage ? f.prod0 / v.usage * 100 : null,
    };
  }

  function render(res, v, h) {
    var good = res.npv > 0;
    var wait = res.bestWait;
    var waitGain = wait.npv - res.waits[0].npv;
    var waitMatters = wait.wait > 0 && waitGain > Math.max(500, 0.03 * res.f.cost);
    var waitNote = !waitMatters && wait.wait > 0
      ? " Waiting for cheaper or better panels is close to a wash (within " + money0(waitGain) + "), so there's little reason to hold off."
      : wait.wait === 0
      ? " Waiting for cheaper or better panels doesn't pay under your assumptions: every year you wait gives up about " + money0(res.firstYear) + " in savings."
      : " Waiting " + wait.wait + " year" + (wait.wait === 1 ? "" : "s") + " comes out " + money0(wait.npv - res.waits[0].npv) + " ahead in today's dollars: your solar return is below what the money earns elsewhere plus how fast prices are falling.";
    var verdict = good
      ? { tone: "good", title: "Solar pays for itself in about " + (res.payback != null ? fmt.num(res.payback, 1) : "—") + " years and nets " + money0(res.net) + " over " + res.f.life + " years.", body: "That's like earning " + (res.irr != null ? fmt.pct(res.irr * 100, 1) : "—") + " a year on " + money0(res.f.cost) + ". Your solar power costs " + fmt.money(res.lcoe, 3) + "/kWh versus " + fmt.money(v.rate, 3) + " from the utility." + waitNote }
      : { tone: "warn", title: res.net > 0 ? "Solar breaks even, but returns less than your " + fmt.pct(v.discount, 0) + " alternative." : "At these numbers, solar doesn't pay back within " + res.f.life + " years.", body: "Solar power would cost " + fmt.money(res.lcoe, 3) + "/kWh versus your " + fmt.money(v.rate, 3) + " rate" + (v.metering !== "net" ? ", and exports earn only " + fmt.money(v.exportRate, 3) : "") + "." + (res.irr != null ? " Return: " + fmt.pct(res.irr * 100, 1) + " a year." : "") + waitNote };
    var stats = [
      ["System cost", money0(res.f.cost), fmt.num(v.kw, 1) + " kW × " + fmt.money(v.costPerW, 2) + "/W" + (v.incentives ? " − incentives" : "")],
      ["First-year savings", money0(res.firstYear), fmt.num(res.f.prod0, 0) + " kWh" + (res.coverage != null ? " · covers " + fmt.pct(Math.min(999, res.coverage), 0) + " of your use" : "")],
      ["Payback", res.payback != null ? fmt.num(res.payback, 1) + " years" : "Not within " + res.f.life, "With rates rising " + fmt.pct(v.rateEsc, 1) + " a year", good ? "good" : "bad"],
      [res.f.life + "-year net savings", money0(res.net), "After the system and upkeep"],
      ["Return (IRR)", res.irr != null ? fmt.pct(res.irr * 100, 1) : "—", "Compare with " + fmt.pct(v.discount, 1) + " elsewhere", "hl"],
      ["Your solar cost per kWh", fmt.money(res.lcoe, 3), "Cost + upkeep ÷ lifetime kWh (undiscounted)"],
      ["Best time to install", !waitMatters ? "Now" : "In " + wait.wait + " year" + (wait.wait === 1 ? "" : "s"), waitMatters ? money0(waitGain) + " more than installing now" : wait.wait ? "Waiting gains under " + money0(Math.max(500, 0.03 * res.f.cost)) : "Waiting costs you savings"],
    ];
    var pb = res.payback;
    var chart = h.line({
      width: h.wideWidth, xs: res.cum.map(function (c) { return c.y; }),
      series: [{ name: "Cumulative savings minus cost", ys: res.cum.map(function (c) { return c.v; }), area: true }],
      refLines: [{ y: 0 }],
      points: pb != null ? [{ x: pb, y: 0, tone: "cross", label: "Payback " + fmt.num(pb, 1) + " yrs" }] : [],
      markers: v.inverterCost && v.inverterYear <= res.f.life ? [{ x: Math.round(v.inverterYear), label: "Inverter" }] : [],
      xFormat: function (y) { return "Yr " + y; }, tipX: function (y) { return "Year " + y; },
      xTicks: res.cum.map(function (c) { return c.y; }).filter(function (y) { return y % 5 === 0; }),
      ariaLabel: "Cumulative solar savings minus system cost by year",
      caption: "Starts below zero at the system's cost and climbs with each year's bill savings, which grow as utility rates rise and shrink slightly as panels degrade.",
    });
    var waitBars = h.bars({
      rows: res.waits.map(function (w) {
        return { label: w.wait === 0 ? "Install now" : "Wait " + w.wait + " yr" + (w.wait === 1 ? "" : "s"), sub: money0(w.cost) + (w.wait ? " · " + fmt.num(w.prod, 0) + " kWh/yr" : ""), value: w.npv, tone: w.wait === (waitMatters ? wait.wait : 0) ? "good" : "muted", highlight: w.wait === 0 };
      }),
      format: function (n) { return money0(n); },
      ariaLabel: "Present value of installing now versus waiting",
    });
    var notes = [
      "The federal residential clean energy credit (25D) ended for systems paid for after December 31, 2025. Check your state, utility, and DSIRE for remaining incentives.",
      "Net metering rules matter as much as sunshine. If your utility credits exports below retail, size the system to your daytime use or consider a battery.",
      "Get production estimates for your actual roof from NREL's PVWatts or your installer; shade and orientation can change output by 20% or more.",
      "Replace an old roof first if it has less than about 10 years left; removing and reinstalling panels later is costly.",
    ];
    return {
      verdict: verdict, stats: stats, side: [],
      wide: [
        { title: "Cumulative savings over " + res.f.life + " years", html: chart },
        { title: "Install now or wait for better options?", note: "Value today at " + fmt.pct(v.discount, 1) + " over the same " + res.f.life + " years from now. Prices fall " + fmt.pct(v.priceDecline, 1) + " and output per kW rises " + fmt.pct(v.effGain, 1) + " a year.", html: waitBars },
        { title: "Before you sign", html: '<ul class="nc-recs">' + notes.map(function (n) { return "<li>" + h.esc(n) + "</li>"; }).join("") + "</ul>" },
      ],
      copy: ["Solar payback (NumberCove)", res.st[0] + ", " + fmt.num(v.kw, 1) + " kW, " + money0(res.f.cost), "First-year savings: " + money0(res.firstYear), "Payback: " + (pb != null ? fmt.num(pb, 1) + " years" : "—"), res.f.life + "-year net: " + money0(res.net) + "; IRR " + (res.irr != null ? fmt.pct(res.irr * 100, 1) : "—"), "Best time to install: " + (waitMatters ? "in " + wait.wait + " years" : "now")].join("\n"),
    };
  }

  var stateKeys = Object.keys(STATES).sort(function (a, b) { return STATES[a][0] < STATES[b][0] ? -1 : 1; });

  return {
    id: "solar-payback",
    inputs: [
      { name: "state", label: "State", type: "select", value: "TX", options: stateKeys.map(function (k) { return [k, STATES[k][0]]; }), hint: "Fills in the state's average rate; output uses its typical sun",
        sets: stateKeys.reduce(function (o, k) { o[k] = { rate: Math.round(STATES[k][1] * 10) / 1000 }; return o; }, {}) },
      { name: "kw", label: "System size", type: "number", value: 7, min: 0.5, max: 100, suffix: "kW", slider: { min: 2, max: 20, step: 0.5 } },
      { name: "costPerW", label: "Installed price per watt", type: "number", value: 2.75, min: 0.5, max: 10, prefix: "$", suffix: "/W", hint: "Quote ÷ watts; typical $2.50–$3.50", slider: { min: 1.5, max: 4.5, step: 0.05 } },
      { name: "rate", label: "Your electricity price", type: "number", value: 0.159, min: 0.01, max: 2, prefix: "$", suffix: "/kWh", hint: "From your bill: total ÷ kWh" },
      { name: "usage", label: "Electricity you use per year", type: "number", value: 10800, min: 0, max: 1000000, suffix: "kWh", hint: "U.S. home average is about 10,800" },
      { name: "production", label: "Expected production", type: "number", optional: true, min: 0, max: 1000000, suffix: "kWh/yr", placeholder: "State average", hint: "From your quote or PVWatts; blank uses your state's average" },
      { name: "metering", label: "Utility credits exports", type: "segment", value: "net", options: [["net", "At retail (net metering)"], ["reduced", "Below retail"]] },
      { name: "selfUse", label: "Solar you use as it's made", type: "number", value: 40, min: 0, max: 100, suffix: "%", showIf: { metering: "reduced" }, hint: "The rest is exported" },
      { name: "exportRate", label: "Export credit", type: "number", value: 0.06, min: 0, max: 1, prefix: "$", suffix: "/kWh", hint: "Also applies to production above your yearly use" },
      {
        type: "group", title: "Waiting for better options", advanced: true, open: true, hint: "Prices and panel efficiency improve over time. These set how fast.",
        fields: [
          { name: "priceDecline", label: "Installed price drop per year", type: "number", value: 2, min: -10, max: 30, suffix: "%" },
          { name: "effGain", label: "More output per kW each year", type: "number", value: 0.5, min: 0, max: 10, suffix: "%", hint: "Better panels and inverters" },
        ],
      },
      {
        type: "group", title: "Long-term assumptions", advanced: true,
        fields: [
          { name: "incentives", label: "Rebates and incentives", type: "number", value: 0, min: 0, max: 1000000, prefix: "$", hint: "State or utility; federal 25D ended after 2025" },
          { name: "rateEsc", label: "Electricity price rise per year", type: "number", value: 3, min: -5, max: 15, suffix: "%" },
          { name: "degradation", label: "Panel output loss per year", type: "number", value: 0.5, min: 0, max: 3, suffix: "%" },
          { name: "life", label: "Years to count", type: "number", value: 25, min: 5, max: 40, integer: true },
          { name: "upkeep", label: "Upkeep per year", type: "number", value: 0, min: 0, max: 10000, prefix: "$" },
          { name: "inverterCost", label: "Inverter replacement", type: "number", value: 1500, min: 0, max: 50000, prefix: "$", hint: "0 for microinverters under warranty" },
          { name: "inverterYear", label: "Inverter replaced in year", type: "number", value: 13, min: 1, max: 40, integer: true },
          { name: "discount", label: "Return you'd earn elsewhere", type: "number", value: 5, min: 0, max: 20, suffix: "%" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { STATES: STATES, flows: flows, npv: npv, irr: irr },
  };
});
