/* NumberCove chart library: responsive SVG line charts with hover readouts,
   and HTML bar charts. Colors come from CSS tokens (--nc-1..4) so light and
   dark themes are handled in styles.css. No dependencies. */
(function (root) {
  "use strict";

  var seq = 0;
  var registry = {};
  var bound = false;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function f1(v) {
    return (Math.round(v * 10) / 10).toString();
  }

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
    for (var v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }

  function axisMoney(v) {
    if (!Number.isFinite(v)) return "";
    var a = Math.abs(v);
    var body;
    if (a >= 1e6) body = (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
    else if (a >= 1e4) body = (a / 1e3).toFixed(0) + "k";
    else if (a >= 1e3) body = (a / 1e3).toFixed(1) + "k";
    else if (a >= 100 || a === Math.round(a)) body = a.toFixed(0);
    else body = a.toFixed(2);
    return (v < -1e-9 ? "-" : "") + "$" + body;
  }

  /* Line chart.
     spec: { xs, series: [{ name, ys, dashed, step, area }], width, height,
       xFormat, yFormat, tipX, tipY, yAxis, includeZero, yMin, yMax,
       markers: [{ x, label, tone }], refLines: [{ y, label }],
       points: [{ x, y, tone, label }], bands: [{ x0, x1, label }],
       fills: [{ above: i, below: j, tone }], xTicks, ariaLabel, caption, tip(i) } */
  function line(spec) {
    var id = "ncc" + (++seq);
    var W = Math.max(280, Math.round(spec.width || 640));
    var H = spec.height || (W < 480 ? 240 : 300);
    var showEnd = spec.endLabels !== false && spec.series.length > 1 && W >= 520;
    var padL = spec.yAxis === false ? 12 : 60;
    var longest = 0;
    spec.series.forEach(function (sr) { longest = Math.max(longest, String(sr.name).length); });
    var padR = showEnd ? Math.min(Math.round(W * 0.3), longest * 6.4 + 18) : 16;
    var maxChars = Math.floor((padR - 18) / 6.4);
    var padB = 34;
    var xs = spec.xs;
    var xMin = spec.xMin != null ? spec.xMin : xs[0];
    var xMax = spec.xMax != null ? spec.xMax : xs[xs.length - 1];
    var all = [];
    spec.series.forEach(function (sr) {
      sr.ys.forEach(function (y) { if (Number.isFinite(y)) all.push(y); });
    });
    if (spec.includeZero !== false) all.push(0);
    (spec.refLines || []).forEach(function (r) { all.push(r.y); });
    (spec.points || []).forEach(function (pt) { if (Number.isFinite(pt.y)) all.push(pt.y); });
    var yMin = Math.min.apply(null, all);
    var yMax = Math.max.apply(null, all);
    var span = yMax - yMin || Math.abs(yMax) || 1;
    if (spec.yMin != null) yMin = spec.yMin;
    else if (!(spec.includeZero !== false && yMin === 0)) yMin -= span * 0.06;
    if (spec.yMax != null) yMax = spec.yMax;
    else yMax += span * 0.08;
    var yTicks = spec.yAxis === false ? [] : niceTicks(yMin, yMax, W < 480 ? 4 : 5);
    if (yTicks.length) {
      if (spec.yMin == null) yMin = Math.min(yMin, yTicks[0]);
      if (spec.yMax == null) yMax = Math.max(yMax, yTicks[yTicks.length - 1]);
    }
    var pw = W - padL - padR;
    function sx(x) { return padL + (xMax > xMin ? (x - xMin) / (xMax - xMin) : 0.5) * pw; }
    var xFormat = spec.xFormat || function (v) { return String(v); };
    var yFormat = spec.yFormat || axisMoney;
    var xTicks = spec.xTicks || niceTicks(xMin, xMax, W < 480 ? 4 : 7).filter(function (t) {
      return t >= xMin - 1e-9 && t <= xMax + 1e-9;
    });

    var rowEnds = [];
    var markers = (spec.markers || []).filter(function (m) { return m.x >= xMin && m.x <= xMax; })
      .sort(function (a, b) { return a.x - b.x; }).map(function (m) {
        var mx = sx(m.x);
        var wdt = String(m.label || "").length * 6.3 + 10;
        var anchorEnd = mx + wdt > W - padR + (showEnd ? 0 : 10);
        var left = anchorEnd ? mx - wdt : mx;
        var row = 0;
        while (rowEnds[row] != null && left < rowEnds[row]) row += 1;
        rowEnds[row] = left + wdt;
        return { mx: mx, label: m.label, tone: m.tone || "", row: row, end: anchorEnd };
      });
    var padT = 18 + rowEnds.length * 14;
    var ph = H - padT - padB;
    function sy(y) { return padT + (1 - (y - yMin) / (yMax - yMin)) * ph; }
    function clampY(y) { return Math.max(padT, Math.min(H - padB, sy(y))); }

    var out = '<svg viewBox="0 0 ' + W + " " + H + '" width="' + W + '" height="' + H + '" aria-hidden="true">';
    (spec.bands || []).forEach(function (b) {
      var x0 = sx(Math.max(b.x0, xMin));
      var x1 = sx(Math.min(b.x1, xMax));
      if (x1 <= x0) return;
      out += '<rect class="ncv-band ' + (b.tone || "") + '" x="' + f1(x0) + '" y="' + padT + '" width="' + f1(x1 - x0) + '" height="' + ph + '"/>';
      if (b.label) out += '<text class="ncv-bandlabel" x="' + f1(x0 + 6) + '" y="' + (padT + 14) + '">' + esc(b.label) + "</text>";
    });
    yTicks.forEach(function (t) {
      if (t < yMin - 1e-9 || t > yMax + 1e-9) return;
      out += '<line class="ncv-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(t)) + '" y2="' + f1(sy(t)) + '"/>';
      out += '<text class="ncv-axis" x="' + (padL - 8) + '" y="' + f1(sy(t) + 4) + '" text-anchor="end">' + esc(yFormat(t)) + "</text>";
    });
    xTicks.forEach(function (t) {
      out += '<text class="ncv-axis" x="' + f1(sx(t)) + '" y="' + (H - padB + 20) + '" text-anchor="middle">' + esc(xFormat(t)) + "</text>";
    });
    if (spec.xLabel) out += '<text class="ncv-axis ncv-xlabel" x="' + (W - padR) + '" y="' + (H - 2) + '" text-anchor="end">' + esc(spec.xLabel) + "</text>";

    (spec.fills || []).forEach(function (fl) {
      var a = spec.series[fl.above].ys;
      var b = spec.series[fl.below].ys;
      var top = [];
      var bottom = [];
      for (var i = 0; i < xs.length; i += 1) {
        top.push(f1(sx(xs[i])) + "," + f1(sy(a[i])));
        bottom.unshift(f1(sx(xs[i])) + "," + f1(sy(b[i])));
      }
      out += '<polygon class="ncv-fill ' + (fl.tone || "s1") + '" points="' + top.concat(bottom).join(" ") + '"/>';
    });
    spec.series.forEach(function (sr, k) {
      if (!sr.area) return;
      var pts = xs.map(function (x, i) { return f1(sx(x)) + "," + f1(sy(sr.ys[i])); });
      var base = f1(sy(Math.max(yMin, Math.min(yMax, 0))));
      out += '<polygon class="ncv-area s' + (k + 1) + '" points="' + f1(sx(xs[0])) + "," + base + " " + pts.join(" ") + " " + f1(sx(xs[xs.length - 1])) + "," + base + '"/>';
    });
    if (spec.includeZero !== false && 0 > yMin && 0 < yMax && spec.yAxis !== false) {
      out += '<line class="ncv-zero" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(0)) + '" y2="' + f1(sy(0)) + '"/>';
    }
    (spec.refLines || []).forEach(function (r) {
      out += '<line class="ncv-ref" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + f1(sy(r.y)) + '" y2="' + f1(sy(r.y)) + '"/>';
      if (r.label) out += '<text class="ncv-mlabel" x="' + (padL + 6) + '" y="' + f1(sy(r.y) - 5) + '">' + esc(r.label) + "</text>";
    });
    markers.forEach(function (m) {
      var ty = padT - 6 - (rowEnds.length - 1 - m.row) * 14;
      out += '<line class="ncv-marker ' + m.tone + '" x1="' + f1(m.mx) + '" x2="' + f1(m.mx) + '" y1="' + (ty + 4) + '" y2="' + (H - padB) + '"/>';
      out += '<text class="ncv-mlabel" x="' + f1(m.end ? m.mx - 4 : m.mx + 4) + '" y="' + ty + '"' + (m.end ? ' text-anchor="end"' : "") + ">" + esc(m.label) + "</text>";
    });
    for (var k = spec.series.length - 1; k >= 0; k -= 1) {
      var sr = spec.series[k];
      var d = "";
      sr.ys.forEach(function (y, i) {
        if (!Number.isFinite(y)) return;
        var X = f1(sx(xs[i]));
        var Y = f1(sy(y));
        if (!d) d = "M" + X + " " + Y;
        else if (sr.step) d += " H" + X + " V" + Y;
        else d += " L" + X + " " + Y;
      });
      out += '<path class="ncv-line s' + (sr.slot || k + 1) + (sr.dashed ? " dashed" : "") + '" d="' + d + '"/>';
    }
    (spec.points || []).forEach(function (pt) {
      if (!(pt.x >= xMin && pt.x <= xMax) || !Number.isFinite(pt.y)) return;
      var cx = sx(pt.x);
      var cy = sy(pt.y);
      out += '<circle class="ncv-point ' + (pt.tone || "") + '" cx="' + f1(cx) + '" cy="' + f1(cy) + '" r="' + (pt.r || 5.5) + '"/>';
      if (pt.label) {
        var right = cx + pt.label.length * 6.3 + 14 < W - padR;
        out += '<text class="ncv-plabel" x="' + f1(right ? cx + 9 : cx - 9) + '" y="' + f1(cy - 9) + '"' + (right ? "" : ' text-anchor="end"') + ">" + esc(pt.label) + "</text>";
      }
    });
    if (showEnd) {
      var ends = spec.series.map(function (sr, k2) {
        var last = sr.ys.length - 1;
        while (last > 0 && !Number.isFinite(sr.ys[last])) last -= 1;
        return { y: clampY(sr.ys[last]), name: sr.name };
      }).sort(function (a, b) { return a.y - b.y; });
      for (var e = 1; e < ends.length; e += 1) if (ends[e].y - ends[e - 1].y < 15) ends[e].y = ends[e - 1].y + 15;
      ends.forEach(function (en) {
        var nm = en.name.length > maxChars ? en.name.slice(0, Math.max(3, maxChars - 1)) + "…" : en.name;
        out += '<text class="ncv-endlabel" x="' + (W - padR + 8) + '" y="' + f1(en.y + 4) + '">' + esc(nm) + "</text>";
      });
    }
    out += '<line class="ncv-cross" x1="0" x2="0" y1="' + padT + '" y2="' + (H - padB) + '" visibility="hidden"/>';
    spec.series.forEach(function (sr, k3) {
      out += '<circle class="ncv-hover s' + (sr.slot || k3 + 1) + '" r="4.5" visibility="hidden"/>';
    });
    out += '<rect class="ncv-hit" x="' + padL + '" y="' + padT + '" width="' + pw + '" height="' + ph + '"/></svg>';

    var legend = spec.series.length > 1 ? '<div class="ncv-legend">' + spec.series.map(function (sr, k4) {
      return '<span><i class="ncv-sw s' + (sr.slot || k4 + 1) + (sr.dashed ? " dashed" : "") + '"></i>' + esc(sr.name) + "</span>";
    }).join("") + "</div>" : "";
    var tipY = spec.tipY || spec.yFormat || function (v) { return axisMoney(v); };
    registry[id] = {
      xs: xs, ys: spec.series.map(function (sr) { return sr.ys; }), sx: sx, sy: sy, W: W,
      tip: spec.tip || function (i) {
        return "<strong>" + esc((spec.tipX || xFormat)(xs[i])) + "</strong>" + spec.series.map(function (sr, k5) {
          return Number.isFinite(sr.ys[i]) ? '<span class="ncv-tip-row"><i class="ncv-sw s' + (sr.slot || k5 + 1) + '"></i>' + esc(sr.name) + " <b>" + esc(tipY(sr.ys[i])) + "</b></span>" : "";
        }).join("");
      },
    };
    bind();
    return '<figure class="ncv" id="' + id + '" role="img" aria-label="' + esc(spec.ariaLabel || "Chart") + '">' +
      (spec.title ? '<figcaption class="ncv-title">' + esc(spec.title) + "</figcaption>" : "") + legend +
      '<div class="ncv-plot">' + out + '<div class="ncv-tip" hidden></div></div>' +
      (spec.caption ? '<p class="ncv-caption">' + spec.caption + "</p>" : "") + "</figure>";
  }

  /* Horizontal bars (HTML). spec: { rows: [{ label, value, sub, tone, values: [] }],
     series: [names], format, max, ariaLabel, title, caption, highlight } */
  function bars(spec) {
    var multi = spec.series && spec.series.length > 1;
    var vals = [];
    spec.rows.forEach(function (r) { (multi ? r.values : [r.value]).forEach(function (v) { if (Number.isFinite(v)) vals.push(Math.abs(v)); }); });
    var max = spec.max || Math.max.apply(null, vals.concat([1e-9]));
    var fmt = spec.format || axisMoney;
    var legend = multi ? '<div class="ncv-legend">' + spec.series.map(function (n, k) { return '<span><i class="ncv-sw s' + (k + 1) + '"></i>' + esc(n) + "</span>"; }).join("") + "</div>" : "";
    var rows = spec.rows.map(function (r, i) {
      var list = multi ? r.values : [r.value];
      return '<div class="ncb-row' + (spec.highlight === i || r.highlight ? " is-hl" : "") + '"><div class="ncb-label">' + esc(r.label) + (r.sub ? "<small>" + esc(r.sub) + "</small>" : "") + "</div>" +
        '<div class="ncb-tracks">' + list.map(function (v, k) {
          var pct = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.abs(v) / max * 100)) : 0;
          var tone = multi ? "s" + (k + 1) : (r.tone && isNaN(+r.tone) ? r.tone : "s" + (r.tone || 1));
          return '<div class="ncb-track"><span class="ncb-bar ' + tone + (v < 0 ? " neg" : "") + '" style="width:' + pct.toFixed(2) + '%"></span><span class="ncb-val">' + esc(Number.isFinite(v) ? fmt(v) : "—") + "</span></div>";
        }).join("") + "</div></div>";
    }).join("");
    return '<figure class="ncv ncb" role="img" aria-label="' + esc(spec.ariaLabel || "Bar chart") + '">' + (spec.title ? '<figcaption class="ncv-title">' + esc(spec.title) + "</figcaption>" : "") + legend +
      '<div class="ncb-body">' + rows + "</div>" + (spec.caption ? '<p class="ncv-caption">' + spec.caption + "</p>" : "") + "</figure>";
  }

  function hover(evt) {
    var fig = evt.target && evt.target.closest ? evt.target.closest(".ncv") : null;
    if (!fig || !registry[fig.id]) return;
    var st = registry[fig.id];
    var svg = fig.querySelector("svg");
    var tip = fig.querySelector(".ncv-tip");
    var rect = svg.getBoundingClientRect();
    if (!rect.width) return;
    var scale = st.W / rect.width;
    var px = (evt.clientX - rect.left) * scale;
    var best = 0;
    var bestD = Infinity;
    for (var i = 0; i < st.xs.length; i += 1) {
      var dd = Math.abs(st.sx(st.xs[i]) - px);
      if (dd < bestD) { bestD = dd; best = i; }
    }
    var x = st.sx(st.xs[best]);
    var cross = svg.querySelector(".ncv-cross");
    cross.setAttribute("x1", x);
    cross.setAttribute("x2", x);
    cross.setAttribute("visibility", "visible");
    Array.prototype.forEach.call(svg.querySelectorAll(".ncv-hover"), function (dot, k) {
      var y = st.ys[k][best];
      if (!Number.isFinite(y)) { dot.setAttribute("visibility", "hidden"); return; }
      dot.setAttribute("cx", x);
      dot.setAttribute("cy", st.sy(y));
      dot.setAttribute("visibility", "visible");
    });
    tip.innerHTML = st.tip(best);
    tip.hidden = false;
    var left = x / scale + 14;
    var tw = tip.offsetWidth || 220;
    if (left + tw > rect.width) left = x / scale - tw - 14;
    tip.style.left = Math.max(0, left) + "px";
  }

  function leave(evt) {
    var fig = evt.target && evt.target.closest ? evt.target.closest(".ncv") : null;
    if (!fig || (evt.relatedTarget && fig.contains(evt.relatedTarget))) return;
    var tip = fig.querySelector(".ncv-tip");
    if (tip) tip.hidden = true;
    Array.prototype.forEach.call(fig.querySelectorAll(".ncv-cross, .ncv-hover"), function (n) { n.setAttribute("visibility", "hidden"); });
  }

  function bind() {
    if (bound || typeof document === "undefined") return;
    bound = true;
    document.addEventListener("pointermove", hover);
    document.addEventListener("pointerout", leave);
  }

  function reset() {
    registry = {};
  }

  var api = { line: line, bars: bars, niceTicks: niceTicks, axisMoney: axisMoney, reset: reset };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NCCharts = api;
})(typeof window !== "undefined" ? window : this);
