(function () {
  "use strict";

  var C = window.Calculate;
  if (!C) return;

  var LENGTH_TO_M = {
    nm: 1e-9,
    um: 1e-6,
    mm: 0.001,
    cm: 0.01,
    m: 1,
    km: 1000,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
    nmi: 1852,
  };

  var WEIGHT_TO_G = {
    mg: 0.001,
    g: 1,
    kg: 1000,
    t: 1e6,
    oz: 28.349523125,
    lb: 453.59237,
    st: 6350.29318,
    ton: 907184.74,
  };

  var VOLUME_TO_L = {
    ml: 0.001,
    l: 1,
    m3: 1000,
    tsp: 0.00492892159375,
    tbsp: 0.01478676478125,
    floz: 0.0295735295625,
    cup: 0.2365882365,
    pt: 0.473176473,
    qt: 0.946352946,
    gal: 3.785411784,
    galuk: 4.54609,
    in3: 0.016387064,
    ft3: 28.316846592,
    yd3: 764.554857984,
  };

  var AREA_TO_M2 = {
    mm2: 1e-6,
    cm2: 0.0001,
    m2: 1,
    ha: 10000,
    km2: 1e6,
    in2: 0.00064516,
    ft2: 0.09290304,
    yd2: 0.83612736,
    ac: 4046.8564224,
    mi2: 2589988.110336,
  };

  function convertLinear(value, from, to, table) {
    return (value * table[from]) / table[to];
  }

  function convertTemp(value, from, to) {
    var c;
    if (from === "c") c = value;
    else if (from === "f") c = ((value - 32) * 5) / 9;
    else if (from === "k") c = value - 273.15;
    else if (from === "r") c = ((value - 491.67) * 5) / 9;
    else return NaN;

    if (to === "c") return c;
    if (to === "f") return (c * 9) / 5 + 32;
    if (to === "k") return c + 273.15;
    if (to === "r") return (c + 273.15) * 9 / 5;
    return NaN;
  }

  function bindConverter(form, opts) {
    var results = document.getElementById("results");
    var copyBtn = document.getElementById("copy-results");
    var resetBtn = document.getElementById("reset-calc");
    var copyText = "";

    function run() {
      C.clearErrors(form);
      var value = C.requireFinite(form, "value", "Value");
      if (value == null) {
        results.innerHTML = '<p class="placeholder-result">Enter a value to convert.</p>';
        copyText = "";
        return;
      }
      var from = form.elements.from.value;
      var to = form.elements.to.value;
      var out;
      if (opts.kind === "temperature") {
        if (from === "k" && value < 0) {
          C.setFieldError(form.elements.value, "Kelvin cannot be below 0.");
          return;
        }
        if (from === "r" && value < 0) {
          C.setFieldError(form.elements.value, "Rankine cannot be below 0.");
          return;
        }
        out = convertTemp(value, from, to);
        if (to === "k" && out < 0) {
          C.showFormError(form, "Result is below absolute zero. Check the input.");
        }
      } else {
        out = convertLinear(value, from, to, opts.table);
      }
      var fromLabel = form.elements.from.options[form.elements.from.selectedIndex].text;
      var toLabel = form.elements.to.options[form.elements.to.selectedIndex].text;
      var digits = opts.kind === "temperature" ? 4 : 8;
      var pretty = formatSmart(out, digits);

      var extras = [];
      if (opts.kind === "temperature") {
        extras = [
          ["Celsius", formatSmart(convertTemp(value, from, "c"), 4) + " °C"],
          ["Fahrenheit", formatSmart(convertTemp(value, from, "f"), 4) + " °F"],
          ["Kelvin", formatSmart(convertTemp(value, from, "k"), 4) + " K"],
          ["Rankine", formatSmart(convertTemp(value, from, "r"), 4) + " °R"],
        ];
      } else {
        var common = opts.common || Object.keys(opts.table).slice(0, 8);
        extras = common.map(function (unit) {
          var label = optionLabel(form.elements.to, unit) || unit;
          return [label, formatSmart(convertLinear(value, from, unit, opts.table), 8)];
        });
      }

      results.innerHTML =
        '<div class="result-hero">' +
        '<p class="label">Converted value</p>' +
        '<p class="value">' +
        pretty +
        "</p>" +
        '<p class="sub">' +
        C.formatNumber(value, 6) +
        " " +
        escapeHtml(fromLabel) +
        " = " +
        pretty +
        " " +
        escapeHtml(toLabel) +
        "</p>" +
        "</div>" +
        '<div class="stat-grid">' +
        extras
          .map(function (row) {
            return (
              '<div class="stat"><span class="label">' +
              escapeHtml(row[0]) +
              '</span><span class="value">' +
              row[1] +
              "</span></div>"
            );
          })
          .join("") +
        "</div>";

      copyText =
        C.formatNumber(value, 6) +
        " " +
        fromLabel +
        " = " +
        pretty +
        " " +
        toLabel;
    }

    form.addEventListener("input", run);
    form.addEventListener("change", run);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run();
    });
    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        C.copyText(copyText);
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        form.reset();
        C.clearErrors(form);
        run();
      });
    }
    var swap = document.getElementById("swap-units");
    if (swap) {
      swap.addEventListener("click", function () {
        var from = form.elements.from.value;
        form.elements.from.value = form.elements.to.value;
        form.elements.to.value = from;
        run();
      });
    }
    run();
  }

  function optionLabel(select, value) {
    for (var i = 0; i < select.options.length; i++) {
      if (select.options[i].value === value) return select.options[i].text;
    }
    return value;
  }

  function formatSmart(n, maxDigits) {
    if (!Number.isFinite(n)) return "—";
    var abs = Math.abs(n);
    if (abs !== 0 && (abs >= 1e7 || abs < 1e-4)) {
      return n.toExponential(6);
    }
    var digits = abs >= 100 ? 4 : maxDigits;
    var s = n.toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
    return s;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var form = document.querySelector("[data-converter]");
    if (!form) return;
    var kind = form.getAttribute("data-converter");
    if (kind === "length") {
      bindConverter(form, {
        kind: "length",
        table: LENGTH_TO_M,
        common: ["mm", "cm", "m", "km", "in", "ft", "yd", "mi"],
      });
    } else if (kind === "weight") {
      bindConverter(form, {
        kind: "weight",
        table: WEIGHT_TO_G,
        common: ["mg", "g", "kg", "t", "oz", "lb", "st", "ton"],
      });
    } else if (kind === "volume") {
      bindConverter(form, {
        kind: "volume",
        table: VOLUME_TO_L,
        common: ["ml", "l", "tsp", "tbsp", "cup", "pt", "qt", "gal", "ft3", "m3"],
      });
    } else if (kind === "area") {
      bindConverter(form, {
        kind: "area",
        table: AREA_TO_M2,
        common: ["cm2", "m2", "ha", "km2", "in2", "ft2", "yd2", "ac"],
      });
    } else if (kind === "temperature") {
      bindConverter(form, { kind: "temperature" });
    }
  });
})();
