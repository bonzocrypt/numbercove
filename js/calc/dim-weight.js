/* Dimensional weight and packaging optimizer. */
(function (root, factory) {
  var NC = typeof module !== "undefined" && module.exports ? require("../nc-calc.js") : root.NC;
  var def = factory(NC);
  if (typeof module !== "undefined" && module.exports) module.exports = def;
  else NC.define(def);
})(typeof window !== "undefined" ? window : this, function (NC) {
  "use strict";

  var fmt = NC.fmt;
  var CUBIC_FOOT = 1728;
  var CARRIERS = [
    { id: "upsDaily", name: "UPS Daily Rates", short: "UPS daily", divisor: 139, threshold: 0 },
    { id: "upsRetail", name: "UPS Retail Rates", short: "UPS retail", divisor: 166, threshold: 0 },
    { id: "fedex", name: "FedEx", short: "FedEx", divisor: 139, threshold: 0 },
    { id: "usps", name: "USPS", short: "USPS", divisor: 139, threshold: CUBIC_FOOT },
  ];

  function up(x) {
    return Math.ceil(x - 1e-9);
  }

  function billOf(dims, actualLb, c) {
    var L = up(dims[0]);
    var W = up(dims[1]);
    var H = up(dims[2]);
    var vol = L * W * H;
    var dimExempt = c.threshold && vol <= c.threshold;
    var dim = dimExempt ? 0 : up(vol / c.divisor);
    var act = Math.max(1, up(actualLb));
    return { L: L, W: W, H: H, vol: vol, dim: dim, act: act, bill: Math.max(dim, act), exempt: !!dimExempt, byDim: dim > act };
  }

  /* Smallest single-side cut that brings volume to maxVol or below, without
     going under the minimum size for that side. */
  function bestCut(rounded, maxVol, mins) {
    var best = null;
    for (var i = 0; i < 3; i += 1) {
      var other = 1;
      for (var j = 0; j < 3; j += 1) if (j !== i) other *= rounded[j];
      var allowed = Math.floor(maxVol / other + 1e-9);
      if (allowed >= rounded[i]) return { side: i, to: rounded[i], cut: 0 };
      if (allowed < Math.max(1, mins[i])) continue;
      var cut = rounded[i] - allowed;
      if (!best || cut < best.cut) best = { side: i, to: allowed, cut: cut };
    }
    return best;
  }

  function surcharges(r, weight) {
    var sides = [r.L, r.W, r.H].sort(function (a, b) { return b - a; });
    var girth = sides[0] + 2 * (sides[1] + sides[2]);
    var flags = [];
    if (sides[0] > 96 || girth > 130 || r.vol > 17280 || weight > 110) flags.push({ tone: "bad", text: "UPS and FedEx large-package rules apply (longest side over 96 in, length plus girth over 130 in, volume over 17,280 in³, or over 110 lb). Expect a large surcharge and a minimum billable weight." });
    else if (sides[0] > 48 || sides[1] > 30 || girth > 105) flags.push({ tone: "warn", text: "Additional handling likely at UPS and FedEx: longest side over 48 in, second-longest over 30 in, or length plus girth over 105 in. UPS applies a 40 lb minimum billable weight to these." });
    if (weight > 50) flags.push({ tone: "warn", text: "Over 50 lb triggers an additional handling surcharge at UPS and FedEx for domestic packages." });
    if (girth > 130 || weight > 70) flags.push({ tone: "bad", text: "USPS: over 70 lb or more than 130 in length plus girth is not mailable and triggers a $200 oversize fee." });
    if (r.vol > CUBIC_FOOT || sides[0] > 22) flags.push({ tone: "info", text: "USPS requires accurate dimensions for parcels over 1 cubic foot or longer than 22 in. Missing or wrong dimensions can add a $3 noncompliance fee." });
    return { flags: flags, girth: girth, longest: sides[0], second: sides[1] };
  }

  var SIDE_NAMES = ["length", "width", "height"];

  function compute(v) {
    var metric = v.units === "metric";
    var toIn = metric ? 1 / 2.54 : 1;
    var toLb = metric ? 2.2046226218 : 1;
    var dims = [v.length * toIn, v.width * toIn, v.height * toIn];
    var weight = v.weight * toLb;
    var pad = (v.padding || 0) * toIn;
    var hasItem = v.itemLength != null && v.itemWidth != null && v.itemHeight != null;
    var item = hasItem ? [v.itemLength * toIn, v.itemWidth * toIn, v.itemHeight * toIn] : null;
    var mins = item ? item.map(function (d) { return up(d + 2 * pad); }) : [1, 1, 1];

    var carriers = CARRIERS.slice();
    if (v.customDivisor) carriers.push({ id: "custom", name: "Your rate (÷" + v.customDivisor + ")", short: "Custom", divisor: v.customDivisor, threshold: 0 });
    var rows = carriers.map(function (c) { return { c: c, r: billOf(dims, weight, c) }; });
    var base = rows[0].r;
    var rounded = [base.L, base.W, base.H];

    var tips = [];
    rows.forEach(function (row) {
      var c = row.c;
      var r = row.r;
      if (!r.byDim) return;
      var toActual = bestCut(rounded, c.threshold ? Math.max(c.threshold, c.divisor * r.act) : c.divisor * r.act, mins);
      var next = bestCut(rounded, c.divisor * (r.bill - 1), mins);
      row.toActual = toActual;
      row.next = next;
    });

    var fitBox = null;
    if (item) {
      var fitDims = mins.slice();
      fitBox = { dims: fitDims, rows: carriers.map(function (c) { return { c: c, r: billOf(fitDims, weight, c) }; }) };
    }

    var usps = rows.filter(function (x) { return x.c.id === "usps"; })[0];
    var uspsCubic = null;
    if (usps.r.byDim || usps.r.vol > CUBIC_FOOT) {
      uspsCubic = bestCut(rounded, CUBIC_FOOT, mins);
    }
    var smallHeavy = weight <= 20 && base.vol <= 0.5 * CUBIC_FOOT && Math.max(base.L, base.W, base.H) <= 22;

    var trimSide = { length: 0, width: 1, height: 2 }[v.trimSide] || 0;
    var curve = [];
    var minSide = Math.max(1, Math.min(mins[trimSide], Math.ceil(rounded[trimSide] * 0.4)));
    for (var s = rounded[trimSide]; s >= minSide && curve.length < 80; s -= 1) {
      var d = rounded.slice();
      d[trimSide] = s;
      curve.push({ side: s, bills: carriers.map(function (c) { return billOf(d, weight, c).bill; }), vol: d[0] * d[1] * d[2] });
    }
    curve.reverse();

    var worst = rows.reduce(function (m, x) { return x.r.bill > m.r.bill ? x : m; }, rows[0]);
    var air = rows.map(function (x) { return x.r.bill - x.r.act; });
    var sur = surcharges(base, weight);
    var cost = v.costPerLb;

    return {
      v: v, metric: metric, dims: dims, weight: weight, rounded: rounded, rows: rows, carriers: carriers,
      fitBox: fitBox, item: item, mins: mins, uspsCubic: uspsCubic, smallHeavy: smallHeavy, curve: curve, trimSide: trimSide,
      worst: worst, air: air, sur: sur, cost: cost, base: base,
    };
  }

  function dimsText(d) {
    return d[0] + " × " + d[1] + " × " + d[2] + " in";
  }

  function render(res, v, h) {
    var rows = res.rows;
    var byDimRows = rows.filter(function (x) { return x.r.byDim; });
    var act = res.base.act;
    var verdict;
    if (!byDimRows.length) {
      verdict = { tone: "good", title: "You're billed on actual weight: " + act + " lb everywhere.", body: "This box is small enough that no carrier charges for its size. Box size isn't costing you anything here." };
    } else {
      var worst = res.worst;
      verdict = {
        tone: worst.r.bill >= act * 1.5 ? "bad" : "warn",
        title: "You'll pay for " + worst.r.bill + " lb at " + worst.c.short + ", not " + act + " lb.",
        body: byDimRows.length + " of " + rows.length + " rate types bill this box by size. " + (res.fitBox ? "A tighter box cuts that to " + res.fitBox.rows[0].r.bill + " lb at UPS daily rates." : "Shrinking the box is the fastest way to cut the cost."),
      };
    }

    var stats = [
      ["Actual weight (rounded)", act + " lb", res.metric ? fmt.num(res.weight, 2) + " lb entered" : ""],
      ["Box after rounding up", dimsText(res.rounded), fmt.num(res.base.vol, 0) + " in³ · " + fmt.num(res.base.vol / CUBIC_FOOT, 2) + " ft³"],
    ];
    rows.slice(0, 4).forEach(function (x) {
      stats.push([x.c.name + " billable", x.r.bill + " lb", x.r.exempt ? "Under 1 ft³: size ignored" : (x.r.byDim ? "Size-based (" + x.r.dim + " lb dim)" : "Actual weight governs"), x.r.byDim ? "bad" : "good"]);
    });

    var barRows = rows.map(function (x) {
      return { label: x.c.name, sub: "÷" + x.c.divisor + (x.c.threshold ? ", over 1 ft³ only" : ""), values: [x.r.act, x.r.bill] };
    });
    var side = [h.bars({ title: "Billable weight vs actual weight", series: ["Actual", "Billable"], rows: barRows, format: function (n) { return n + " lb"; }, ariaLabel: "Billable weight by carrier compared with actual weight" })];

    /* Recommendations */
    var recs = [];
    if (res.fitBox) {
      var fb = res.fitBox;
      var save = rows[0].r.bill - fb.rows[0].r.bill;
      recs.push("<li><strong>Use the smallest box that fits: " + dimsText(fb.dims) + ".</strong> That is your item plus " + fmt.num(v.padding || 0, 1) + (res.metric ? " cm" : " in") + " of padding on every side. Billable weight becomes " +
        fb.rows.map(function (x) { return x.c.short + " " + x.r.bill + " lb"; }).join(", ") + (save > 0 ? " (" + save + " lb less at UPS daily)" : "") + ".</li>");
    }
    rows.forEach(function (x) {
      if (!x.r.byDim) return;
      var n = x.next;
      var a = x.toActual;
      if (n && n.cut > 0) {
        recs.push("<li><strong>" + x.c.short + ":</strong> cut the " + SIDE_NAMES[n.side] + " from " + res.rounded[n.side] + " to " + n.to + " in to drop from " + x.r.bill + " to " + (x.r.bill - 1) + " lb" +
          (a && a.cut > 0 && (a.side !== n.side || a.to !== n.to) ? "; cutting it to " + a.to + " in" + (a.side !== n.side ? " (" + SIDE_NAMES[a.side] + ")" : "") + " bills actual weight (" + act + " lb)" : "") + ".</li>");
      } else if (!n) {
        recs.push("<li><strong>" + x.c.short + ":</strong> no single side can shrink enough without going below your item size. Consider a different box shape or a soft mailer.</li>");
      }
    });
    if (res.uspsCubic && res.uspsCubic.cut > 0) {
      recs.push("<li><strong>Get under 1 cubic foot for USPS.</strong> USPS ignores size on parcels of 1,728 in³ or less. Cutting the " + SIDE_NAMES[res.uspsCubic.side] + " to " + res.uspsCubic.to + " in gets you there, billed at " + act + " lb.</li>");
    }
    if (!res.uspsCubic && res.item && rows[3].r.vol > CUBIC_FOOT) {
      var minVol = res.mins[0] * res.mins[1] * res.mins[2];
      if (minVol > CUBIC_FOOT) recs.push("<li><strong>USPS will bill this by size.</strong> Your item plus padding needs at least " + fmt.num(minVol, 0) + " in³, above the 1,728 in³ line where USPS starts charging for size. Less padding or a different item orientation is the only way under it.</li>");
    }
    if (res.smallHeavy) {
      recs.push("<li><strong>Price USPS Cubic.</strong> At 20 lb or less, under ½ cubic foot, and no side over 22 in, Priority Mail Cubic and Ground Advantage Cubic price by size tier instead of weight, which often wins for small, heavy items.</li>");
    }
    if (res.base.act <= 5 && byDimRows.length) {
      recs.push("<li><strong>Soft goods? Use a poly mailer.</strong> A mailer that conforms to the item has far less volume than a rigid box, and soft packs under ½ ft³ qualify for cubic tiers.</li>");
    }
    recs.push("<li><strong>Compare rate types.</strong> UPS counter (retail) rates divide by 166, so the same box bills fewer pounds there than at daily rates, though the per-pound price is usually higher. Check both.</li>");

    var flagHtml = res.sur.flags.map(function (f) { return '<li class="callout' + (f.tone === "bad" || f.tone === "warn" ? " warn" : "") + '">' + h.esc(f.text) + "</li>"; }).join("");
    side.push('<h3>How to pay less</h3><ol class="nc-recs">' + recs.join("") + "</ol>" + (flagHtml ? '<h3>Size and surcharge checks</h3><ul class="notice-list">' + flagHtml + "</ul>" : ""));

    var curve = res.curve;
    var wide = [];
    if (curve.length > 1) {
      var series = [];
      res.carriers.forEach(function (c, k) {
        var ys = curve.map(function (p) { return p.bills[k]; });
        var same = series.filter(function (sr) { return sr.ys.join() === ys.join(); })[0];
        if (same) same.names.push(c.short);
        else if (series.length < 4) series.push({ names: [c.short], ys: ys, step: true });
      });
      series.forEach(function (sr) { sr.name = sr.names.join(", "); });
      var xs = curve.map(function (p) { return p.side; });
      var span = xs[xs.length - 1] - xs[0];
      var every = span > 24 ? 4 : span > 12 ? 2 : 1;
      var ticks = xs.filter(function (x) { return (x - xs[0]) % every === 0; });
      wide.push({
        title: "Billable weight as you shrink the " + SIDE_NAMES[res.trimSide],
        note: "Other sides held at " + res.rounded.filter(function (_, i) { return i !== res.trimSide; }).join(" × ") + " in",
        html: h.line({
          width: h.wideWidth,
          xs: xs,
          xTicks: ticks,
          series: series,
          bands: res.item && res.mins[res.trimSide] > xs[0] ? [{ x0: xs[0], x1: res.mins[res.trimSide], label: "Too small for the item", tone: "bad" }] : [],
          xFormat: function (x) { return x + " in"; },
          yFormat: function (y) { return y + " lb"; },
          tipY: function (y) { return y + " lb"; },
          includeZero: false,
          refLines: [{ y: res.base.act, label: "Actual weight " + res.base.act + " lb" }],
          markers: [{ x: res.rounded[res.trimSide], label: "Your box" }].concat(res.item ? [{ x: res.mins[res.trimSide], label: "Smallest that fits", tone: "good" }] : []),
          ariaLabel: "Billable weight by carrier as the box side gets shorter",
          caption: "Each step down is a pound you stop paying for. USPS drops to actual weight once the box is 1 cubic foot or smaller. Hover to read each carrier at any size.",
        }),
      });
    }
    var tableRows = rows.map(function (x) {
      var extra = x.r.bill - x.r.act;
      return [h.esc(x.c.name), "÷" + x.c.divisor, x.r.exempt ? "Exempt" : x.r.dim + " lb", x.r.act + " lb", "<strong>" + x.r.bill + " lb</strong>", extra > 0 ? "+" + extra + " lb" + (res.cost ? " · " + fmt.money(extra * res.cost, 2) : "") : "None"];
    });
    wide.push({ title: "Carrier comparison", note: "Dimensions rounded up to whole inches, then volume ÷ divisor, rounded up to a whole pound", html: h.table(["Rate type", "Divisor", "Dim weight", "Actual", "Billable", "Paying for air"], tableRows) });

    var copy = ["Dimensional weight check (NumberCove)", "Box: " + dimsText(res.rounded) + ", actual " + act + " lb"].concat(rows.map(function (x) {
      return x.c.name + ": billable " + x.r.bill + " lb" + (x.r.byDim ? " (size-based)" : "");
    })).concat(res.fitBox ? ["Smallest box that fits: " + dimsText(res.fitBox.dims)] : []).join("\n");

    return { verdict: verdict, stats: stats, side: side, wide: wide, copy: copy };
  }

  return {
    id: "dim-weight",
    inputs: [
      { name: "units", label: "Units", type: "segment", options: [["imperial", "Inches & pounds"], ["metric", "Centimeters & kilograms"]], value: "imperial", span: 2 },
      { name: "length", label: "Box length", type: "number", value: 18, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
      { name: "width", label: "Box width", type: "number", value: 14, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
      { name: "height", label: "Box height", type: "number", value: 12, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
      { name: "weight", label: "Actual weight, packed", type: "number", value: 9, min: 0.01, max: 2000, suffix: "lb", suffixBy: { field: "units", map: { imperial: "lb", metric: "kg" } } },
      {
        type: "group", title: "Optimize the box (optional)", advanced: true, open: true,
        hint: "Enter the item's own size and the padding you need, and the calculator finds the smallest box and the cut that drops you a pound.",
        fields: [
          { name: "itemLength", label: "Item length", type: "number", value: 14, optional: true, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
          { name: "itemWidth", label: "Item width", type: "number", value: 10, optional: true, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
          { name: "itemHeight", label: "Item height", type: "number", value: 8, optional: true, min: 0.1, max: 400, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
          { name: "padding", label: "Padding per side", type: "number", value: 1, min: 0, max: 20, suffix: "in", suffixBy: { field: "units", map: { imperial: "in", metric: "cm" } } },
          { name: "trimSide", label: "Side to shrink on the chart", type: "select", options: [["height", "Height"], ["width", "Width"], ["length", "Length"]], value: "height" },
        ],
      },
      {
        type: "group", title: "Your rates (optional)", advanced: true,
        fields: [
          { name: "customDivisor", label: "Negotiated divisor", type: "number", optional: true, min: 100, max: 400, integer: true, hint: "If your contract uses a different divisor, such as 166 or 194" },
          { name: "costPerLb", label: "Approximate cost per billable pound", type: "number", optional: true, min: 0, max: 100, prefix: "$", hint: "Turns extra pounds into dollars" },
        ],
      },
    ],
    compute: compute,
    render: render,
    _test: { billOf: billOf, bestCut: bestCut, CARRIERS: CARRIERS },
  };
});
