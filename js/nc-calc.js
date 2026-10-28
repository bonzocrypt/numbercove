/* NumberCove calculator runtime.
   A calculator is a plain definition object:
     { id, inputs: [...], compute(values) -> result, render(result, values, h) -> view }
   Inputs (also used by build/calc-page.js to generate the static form):
     { name, label, type: "number"|"select"|"segment"|"toggle"|"list"|"group",
       value, prefix, suffix, min, max, step, hint, optional, integer, slider: { min, max, step },
       options: [[value, label]], showIf: { field: value | [values] }, span: 2,
       fields: [...] (group), title, advanced, open (group),
       columns: [{ name, label, type, prefix, suffix, value, placeholder, optional }], rows: [...], maxRows, addLabel (list) }
   View: { verdict: { tone, title, body }, stats: [[label, value, note]], side: [html], wide: [{ title, html, note }], copy } */
(function (root) {
  "use strict";

  var ICONS = {
    good: '<path d="M5 12l4 4L19 6"/>',
    warn: '<path d="M12 8v5M12 16.5h.01"/><path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    bad: '<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function svg(inner) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
  }

  /* ---------- Formatting helpers (shared with Node tests) ---------- */

  var nfCache = {};
  function nf(min, max, style) {
    var key = min + "|" + max + "|" + (style || "");
    if (!nfCache[key]) {
      var o = { minimumFractionDigits: min, maximumFractionDigits: max };
      if (style === "currency") { o.style = "currency"; o.currency = "USD"; }
      nfCache[key] = new Intl.NumberFormat("en-US", o);
    }
    return nfCache[key];
  }

  function clean(v, d) {
    var f = Math.pow(10, d);
    return Math.round(v * f) / f || 0;
  }

  var fmt = {
    money: function (v, d) {
      if (!Number.isFinite(v)) return "—";
      d = d == null ? (Math.abs(v) >= 1000 || Math.abs(v - Math.round(v)) < 0.005 ? 0 : 2) : d;
      return nf(d, d, "currency").format(clean(v, d));
    },
    money2: function (v) { return fmt.money(v, 2); },
    signed: function (v, d) {
      if (!Number.isFinite(v)) return "—";
      d = d == null ? (Math.abs(v) >= 1000 ? 0 : 2) : d;
      var c = clean(v, d);
      return (c > 0 ? "+" : "") + nf(d, d, "currency").format(c);
    },
    num: function (v, d) {
      if (!Number.isFinite(v)) return "—";
      d = d == null ? 0 : d;
      return nf(d, d).format(clean(v, d));
    },
    pct: function (v, d) {
      if (!Number.isFinite(v)) return "—";
      d = d == null ? 1 : d;
      return nf(d, d).format(clean(v, d)) + "%";
    },
    months: function (m) {
      if (!Number.isFinite(m)) return "—";
      m = Math.round(m);
      var y = Math.floor(m / 12);
      var r = m % 12;
      if (!y) return r + " month" + (r === 1 ? "" : "s");
      return y + " yr" + (y === 1 ? "" : "s") + (r ? " " + r + " mo" : "");
    },
    years: function (y, d) {
      if (!Number.isFinite(y)) return "—";
      return fmt.num(y, d == null ? 1 : d) + " year" + (Math.abs(y - 1) < 1e-9 ? "" : "s");
    },
  };

  /* ---------- Input model ---------- */

  function flatFields(inputs, inherited) {
    var out = [];
    inputs.forEach(function (f) {
      if (f.type === "group") {
        var cond = f.showIf || inherited ? Object.assign({}, inherited || {}, f.showIf || {}) : null;
        out = out.concat(flatFields(f.fields, cond));
      } else if (inherited) {
        out.push(Object.assign({}, f, { showIf: Object.assign({}, inherited, f.showIf || {}) }));
      } else {
        out.push(f);
      }
    });
    return out;
  }

  function parseNum(s) {
    if (s == null) return NaN;
    var t = String(s).replace(/[,$\s%]/g, "");
    if (!t) return NaN;
    var n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  }

  function isVisible(field, raw) {
    if (!field.showIf) return true;
    return Object.keys(field.showIf).every(function (k) {
      var want = field.showIf[k];
      var have = raw[k];
      return Array.isArray(want) ? want.indexOf(have) !== -1 : String(have) === String(want);
    });
  }

  function validateNumber(f, raw, label) {
    var n = parseNum(raw);
    var name = (label || f.label || f.name).toLowerCase();
    if (!Number.isFinite(n)) {
      if (String(raw == null ? "" : raw).trim() === "" && f.optional) return { value: null };
      return { error: String(raw == null ? "" : raw).trim() === "" ? "Enter " + name + "." : "Enter a number." };
    }
    if (f.min != null && n < f.min) return { error: "Must be at least " + fmt.num(f.min, f.min % 1 ? 2 : 0) + "." };
    if (f.max != null && n > f.max) return { error: "Must be at most " + fmt.num(f.max, f.max % 1 ? 2 : 0) + "." };
    if (f.integer && Math.round(n) !== n) return { error: "Use a whole number." };
    return { value: n };
  }

  /* ---------- Runtime (browser) ---------- */

  function boot(def) {
    var C = root.Calculate;
    var form = document.querySelector('[data-nc-calc="' + def.id + '"]');
    if (!form || !C) return;
    var results = document.getElementById("nc-results");
    var analysis = document.getElementById("nc-analysis");
    var fields = flatFields(def.inputs);
    var byName = {};
    fields.forEach(function (f) { byName[f.name] = f; });
    var copyText = "";
    var timer = 0;
    var urlTimer = 0;
    var lastWidth = 0;

    function control(name) {
      return form.querySelector('[name="' + name + '"]');
    }

    function rawValue(f) {
      if (f.type === "segment") {
        var c = form.querySelector('[name="' + f.name + '"]:checked');
        return c ? c.value : String(f.value);
      }
      if (f.type === "toggle") {
        var t = control(f.name);
        return t ? t.checked : !!f.value;
      }
      if (f.type === "list") return listRows(f);
      var el = control(f.name);
      return el ? el.value : "";
    }

    function setRaw(f, v) {
      if (f.type === "segment") {
        Array.prototype.forEach.call(form.querySelectorAll('[name="' + f.name + '"]'), function (r) { r.checked = String(r.value) === String(v); });
      } else if (f.type === "toggle") {
        var t = control(f.name);
        if (t) t.checked = v === true || v === "1" || v === "true";
      } else if (f.type === "list") {
        renderList(f, v);
      } else {
        var el = control(f.name);
        if (el) el.value = v;
      }
    }

    /* Lists: rows of small inputs, rendered by the runtime. */
    function listHost(f) {
      return form.querySelector('[data-list="' + f.name + '"] .nc-list-rows');
    }

    function listRows(f) {
      var host = listHost(f);
      if (!host) return [];
      return Array.prototype.map.call(host.querySelectorAll(".nc-list-row"), function (row) {
        var o = {};
        f.columns.forEach(function (col) {
          var el = row.querySelector('[data-col="' + col.name + '"]');
          o[col.name] = el ? (el.type === "checkbox" ? el.checked : el.value) : "";
        });
        return o;
      });
    }

    function renderList(f, rows) {
      var host = listHost(f);
      if (!host) return;
      host.innerHTML = rows.map(function (r, i) { return listRowHtml(f, r, i); }).join("");
      var add = form.querySelector('[data-list="' + f.name + '"] [data-list-add]');
      if (add) add.disabled = rows.length >= (f.maxRows || 12);
    }

    form.addEventListener("click", function (e) {
      var add = e.target.closest("[data-list-add]");
      var rm = e.target.closest("[data-list-remove]");
      if (add) {
        var f = byName[add.closest("[data-list]").getAttribute("data-list")];
        var rows = listRows(f);
        var blank = {};
        f.columns.forEach(function (c) { blank[c.name] = c.value != null ? c.value : ""; });
        rows.push(blank);
        renderList(f, rows);
        var last = listHost(f).querySelector(".nc-list-row:last-child input, .nc-list-row:last-child select");
        if (last) last.focus();
        schedule();
      } else if (rm) {
        var f2 = byName[rm.closest("[data-list]").getAttribute("data-list")];
        var rows2 = listRows(f2);
        rows2.splice(+rm.getAttribute("data-list-remove"), 1);
        renderList(f2, rows2);
        schedule();
      }
    });

    function readAll() {
      var raw = {};
      fields.forEach(function (f) { raw[f.name] = rawValue(f); });
      var values = {};
      var errors = 0;
      fields.forEach(function (f) {
        var wrap = form.querySelector('[data-field="' + f.name + '"]');
        var visible = isVisible(f, raw);
        if (wrap) wrap.classList.toggle("mode-hidden", !visible);
        if (!visible) { values[f.name] = null; return; }
        if (f.type === "number") {
          var r = validateNumber(f, raw[f.name]);
          if (r.error) { C.setFieldError(control(f.name), r.error); errors += 1; }
          values[f.name] = r.value;
        } else if (f.type === "list") {
          var host = listHost(f);
          values[f.name] = raw[f.name].map(function (row, i) {
            var o = {};
            f.columns.forEach(function (col) {
              if (col.type === "number") {
                var rr = validateNumber({ optional: col.optional, min: col.min, max: col.max, label: col.label }, row[col.name]);
                if (rr.error) {
                  var el = host.querySelectorAll(".nc-list-row")[i].querySelector('[data-col="' + col.name + '"]');
                  el.setAttribute("aria-invalid", "true");
                  el.classList.add("is-invalid");
                  errors += 1;
                }
                o[col.name] = rr.value;
              } else {
                o[col.name] = row[col.name];
              }
            });
            return o;
          });
        } else if (f.type === "toggle") {
          values[f.name] = !!raw[f.name];
        } else {
          values[f.name] = raw[f.name];
        }
      });
      Array.prototype.forEach.call(form.querySelectorAll("[data-group-show]"), function (g) {
        g.classList.toggle("mode-hidden", !isVisible({ showIf: JSON.parse(g.getAttribute("data-group-show")) }, raw));
      });
      return { values: values, raw: raw, errors: errors };
    }

    function syncRanges() {
      Array.prototype.forEach.call(form.querySelectorAll("input[type=range][data-range-for]"), function (range) {
        var target = control(range.getAttribute("data-range-for"));
        var v = parseNum(target && target.value);
        if (Number.isFinite(v) && document.activeElement !== range) range.value = String(v);
      });
    }

    function verdictHtml(v) {
      if (!v) return "";
      var tone = v.tone || "info";
      return '<div class="verdict verdict--' + tone + '" role="status"><span class="verdict-icon">' + svg(ICONS[tone] || ICONS.info) + "</span><div>" +
        '<p class="verdict-label">' + esc(v.label || "The answer") + '</p><p class="verdict-title">' + v.title + "</p>" + (v.body ? '<p class="verdict-body">' + v.body + "</p>" : "") + "</div></div>";
    }

    function statsHtml(stats) {
      if (!stats || !stats.length) return "";
      return '<div class="stat-grid">' + stats.map(function (s) {
        return '<div class="stat' + (s[3] ? " stat--" + s[3] : "") + '"><span class="label">' + esc(s[0]) + '</span><span class="value">' + s[1] + "</span>" + (s[2] ? '<span class="stat-note">' + s[2] + "</span>" : "") + "</div>";
      }).join("") + "</div>";
    }

    function syncUnits(raw) {
      fields.forEach(function (f) {
        if (!f.suffixBy && !f.prefixBy) return;
        var by = f.suffixBy || f.prefixBy;
        var txt = by.map[raw[by.field]];
        var all = form.querySelectorAll('[data-field="' + f.name + '"] .affix');
        var affix = f.suffixBy ? all[all.length - 1] : all[0];
        if (affix && txt != null) affix.textContent = txt;
      });
    }

    function run() {
      C.clearErrors(form);
      Array.prototype.forEach.call(form.querySelectorAll(".is-invalid"), function (el) { el.classList.remove("is-invalid"); el.removeAttribute("aria-invalid"); });
      var r = readAll();
      syncRanges();
      syncUnits(r.raw);
      if (r.errors) {
        C.showFormError(form, "Check the highlighted field" + (r.errors > 1 ? "s" : "") + ".");
        return;
      }
      var result;
      try {
        result = def.compute(r.values);
      } catch (err) {
        C.showFormError(form, err && err.userMessage ? err.userMessage : "These inputs could not be calculated. Check the values and try again.");
        if (!(err && err.userMessage) && root.console) root.console.error(err);
        return;
      }
      if (root.NCCharts) root.NCCharts.reset();
      /* Measure the analysis column even before its first reveal, so charts are
         drawn at the width they'll be shown (a hidden element reports 0). */
      var wasHidden = analysis && analysis.hidden;
      if (wasHidden) analysis.hidden = false;
      lastWidth = analysis ? analysis.clientWidth : 0;
      if (wasHidden) analysis.hidden = true;
      var h = {
        fmt: fmt,
        esc: esc,
        sideWidth: Math.max(280, (results.clientWidth || 420) - 4),
        wideWidth: Math.max(280, lastWidth ? lastWidth - 48 : 760),
        line: function (spec) { return root.NCCharts.line(spec); },
        bars: function (spec) { return root.NCCharts.bars(spec); },
        table: table,
      };
      var view = def.render(result, r.values, h);
      results.innerHTML = verdictHtml(view.verdict) + statsHtml(view.stats) + (view.side || []).join("");
      updatePeek(view, result, r.values);
      if (analysis) {
        analysis.innerHTML = (view.wide || []).map(function (s) {
          return '<section class="panel nc-wide"><div class="nc-wide-head"><h2>' + esc(s.title) + "</h2>" + (s.note ? "<p>" + s.note + "</p>" : "") + "</div>" + s.html + "</section>";
        }).join("");
        analysis.hidden = !(view.wide && view.wide.length);
      }
      copyText = view.copy || "";
      queueUrl(r.raw);
    }

    function schedule() {
      clearTimeout(timer);
      timer = setTimeout(run, 60);
    }

    /* Mobile answer balloon (phones only; on desktop the results sit beside the form).
       teaser: calculators that define teaser() slide up the default case as a hook
               about 1.5s after load, with a "Try your numbers" button.
       live:   once the visitor changes an input, it shows their answer while the
               results panel is off screen.
       Calculators without a teaser show nothing until the visitor changes an input.
       Closing it hides it for the rest of the visit to that calculator.
       Each step is pushed to the GTM dataLayer so the hooks can be measured. */
    var peek = null;
    var peekMode = "none";
    var resultsVisible = true;
    var touched = false;
    var teaserTried = false;
    var teaserReady = false;
    var teaserLogged = false;
    var dismissed = false;
    var closeKey = "nc-balloon-closed:" + def.id;
    var sharedLink = false;
    try { dismissed = root.sessionStorage.getItem(closeKey) === "1"; } catch (e) { /* storage blocked */ }
    try {
      var qp = new URLSearchParams(location.search);
      sharedLink = fields.some(function (f) { return qp.has(f.name); });
    } catch (e) { /* ignore */ }

    function track(name, extra) {
      try {
        root.dataLayer = root.dataLayer || [];
        root.dataLayer.push(Object.assign({ event: name, nc_calc: def.id }, extra || {}));
      } catch (e) { /* ignore */ }
    }

    function peekShouldShow() {
      if (peekMode === "none" || dismissed || resultsVisible || root.innerWidth >= 900) return false;
      return peekMode === "live" || teaserReady;
    }

    function refreshPeek() {
      if (!peek) return;
      var show = peekShouldShow();
      peek.hidden = !show;
      if (show && peekMode === "teaser" && !teaserLogged) {
        teaserLogged = true;
        track("nc_teaser_shown");
      }
    }

    var CLOSE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

    function ensurePeek() {
      if (peek) return;
      peek = document.createElement("aside");
      peek.className = "nc-peek";
      peek.hidden = true;
      peek.setAttribute("aria-label", "Quick answer");
      peek.addEventListener("click", function (e) {
        if (e.target.closest(".nc-peek-close")) {
          track("nc_balloon_closed", { nc_mode: peekMode });
          dismissed = true;
          try { root.sessionStorage.setItem(closeKey, "1"); } catch (err) { /* storage blocked */ }
          refreshPeek();
        } else if (e.target.closest("[data-peek-try]")) {
          tryYourNumbers();
        } else if (e.target.closest("[data-peek-go]")) {
          var panel = results.closest(".results-panel") || results;
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      document.body.appendChild(peek);
      if ("IntersectionObserver" in root) {
        new IntersectionObserver(function (entries) {
          resultsVisible = entries[0].isIntersecting;
          refreshPeek();
        }).observe(results.closest(".results-panel") || results);
      }
    }

    /* Put the cursor in the first visible field, ready to type over the default. */
    function tryYourNumbers() {
      track("nc_teaser_try");
      teaserTried = true;
      peekMode = "none";
      refreshPeek();
      var el = form.querySelector('[data-field]:not(.mode-hidden) input[inputmode], [data-field]:not(.mode-hidden) select, [data-field]:not(.mode-hidden) input[type="radio"]:checked');
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
      if (el.select && el.tagName === "INPUT" && el.type !== "radio") el.select();
      var wrap = el.closest("[data-field]") || el;
      wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function markTouched(e) {
      if (touched || !e || e.isTrusted === false) return;
      touched = true;
      track("nc_first_input", { nc_after_teaser: peekMode === "teaser" || teaserTried });
    }

    function updatePeek(view, result, values) {
      ensurePeek();
      if (touched) {
        var v = view.verdict;
        if (!v) { peekMode = "none"; refreshPeek(); return; }
        peekMode = "live";
        peek.className = "nc-peek nc-peek--live nc-peek--" + (v.tone || "info");
        peek.innerHTML = '<button type="button" class="nc-peek-main" data-peek-go><span class="nc-peek-text">' + v.title + '</span><span class="nc-peek-go">See details ↓</span></button>' +
          '<button type="button" class="nc-peek-close" aria-label="Close">' + CLOSE_ICON + "</button>";
      } else if (peekMode === "none" && !teaserTried && !sharedLink && !dismissed && typeof def.teaser === "function") {
        var t = null;
        try { t = def.teaser(result, values, fmt); } catch (err) { t = null; }
        if (!t) return;
        var tone = t.tone || "info";
        peekMode = "teaser";
        peek.className = "nc-peek nc-peek--teaser nc-peek--" + tone;
        peek.innerHTML = '<span class="nc-peek-icon">' + svg(ICONS[tone] || ICONS.info) + '</span><div class="nc-peek-body">' +
          (t.label ? '<p class="nc-peek-label">' + esc(t.label) + "</p>" : "") +
          '<p class="nc-peek-text">' + esc(t.title) + "</p>" +
          (t.body ? '<p class="nc-peek-sub">' + esc(t.body) + "</p>" : "") +
          '<button type="button" class="nc-peek-try" data-peek-try>Try your numbers <span aria-hidden="true">→</span></button></div>' +
          '<button type="button" class="nc-peek-close" aria-label="Close">' + CLOSE_ICON + "</button>";
        setTimeout(function () { teaserReady = true; refreshPeek(); }, 1500);
      }
      refreshPeek();
    }

    /* URL state: only values that differ from the defaults. */
    function encodeList(f, rows) {
      return rows.map(function (row) { return f.columns.map(function (c) { return String(row[c.name] == null ? "" : row[c.name]).replace(/[~|]/g, ""); }).join("~"); }).join("|");
    }

    function queueUrl(raw) {
      clearTimeout(urlTimer);
      urlTimer = setTimeout(function () {
        try {
          var p = new URLSearchParams();
          fields.forEach(function (f) {
            var v = raw[f.name];
            if (f.type === "list") {
              var enc = encodeList(f, v);
              if (enc !== encodeList(f, f.rows || [])) p.set(f.name, enc);
            } else if (f.type === "toggle") {
              if (!!v !== !!f.value) p.set(f.name, v ? "1" : "0");
            } else if (String(v) !== String(f.value == null ? "" : f.value)) {
              p.set(f.name, v);
            }
          });
          var qs = p.toString();
          history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
        } catch (e) {
          /* history unavailable (file:// or sandbox) */
        }
      }, 350);
    }

    function hydrate() {
      try {
        var p = new URLSearchParams(location.search);
        fields.forEach(function (f) {
          if (!p.has(f.name)) return;
          var v = p.get(f.name);
          if (f.type === "list") {
            var rows = v ? v.split("|").map(function (line) {
              var parts = line.split("~");
              var o = {};
              f.columns.forEach(function (c, i) { o[c.name] = parts[i] != null ? parts[i] : ""; });
              return o;
            }) : [];
            setRaw(f, rows.slice(0, f.maxRows || 12));
          } else {
            setRaw(f, v);
          }
        });
      } catch (e) {
        /* ignore */
      }
    }

    function resetAll() {
      fields.forEach(function (f) { setRaw(f, f.type === "list" ? (f.rows || []) : (f.value == null ? "" : f.value)); });
      schedule();
    }

    Array.prototype.forEach.call(form.querySelectorAll("input[type=range][data-range-for]"), function (range) {
      range.addEventListener("input", function () {
        var target = control(range.getAttribute("data-range-for"));
        if (target) target.value = range.value;
      });
    });
    /* A select can preset other fields: { sets: { optionValue: { field: value } } }. */
    form.addEventListener("change", function (e) {
      var f = e.target && e.target.name ? byName[e.target.name] : null;
      if (!f || !f.sets) return;
      var preset = f.sets[e.target.value];
      if (!preset) return;
      Object.keys(preset).forEach(function (k) { if (byName[k]) setRaw(byName[k], preset[k]); });
      syncRanges();
    });
    form.addEventListener("input", function (e) { markTouched(e); schedule(); });
    form.addEventListener("change", function (e) { markTouched(e); schedule(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      run();
    });
    var resetBtn = document.getElementById("nc-reset");
    if (resetBtn) resetBtn.addEventListener("click", resetAll);
    var copyBtn = document.getElementById("nc-copy");
    if (copyBtn) copyBtn.addEventListener("click", function () { C.copyText(copyText); });
    var linkBtn = document.getElementById("nc-link");
    if (linkBtn) linkBtn.addEventListener("click", function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { C.toast("Link copied. It reopens with your numbers."); }, function () { C.copyText(url); });
      } else {
        C.copyText(url);
      }
    });
    root.addEventListener("resize", function () {
      clearTimeout(boot.rt);
      boot.rt = setTimeout(function () {
        refreshPeek();
        if (analysis && analysis.clientWidth !== lastWidth) run();
      }, 160);
    });
    fields.forEach(function (f) { if (f.type === "list") renderList(f, f.rows || []); });
    hydrate();
    run();
  }

  function table(headers, rows, opts) {
    opts = opts || {};
    return '<div class="table-wrap"><table' + (opts.cls ? ' class="' + opts.cls + '"' : "") + "><thead><tr>" + headers.map(function (h, i) {
      return "<th" + (i ? ' class="num"' : "") + ">" + esc(h) + "</th>";
    }).join("") + "</tr></thead><tbody>" + rows.map(function (r) {
      var cls = r.cls ? ' class="' + r.cls + '"' : "";
      var cells = r.cells || r;
      return "<tr" + cls + ">" + cells.map(function (c, i) { return "<td" + (i ? ' class="num"' : "") + ">" + c + "</td>"; }).join("") + "</tr>";
    }).join("") + "</tbody></table></div>";
  }

  /* Shared by the runtime and by build/calc-page.js for the static first render. */
  function listRowHtml(f, r, i) {
    return '<div class="nc-list-row">' + f.columns.map(function (c) {
      var v = r[c.name] == null ? "" : r[c.name];
      var input;
      if (c.type === "select") {
        input = '<select data-col="' + c.name + '" aria-label="' + esc(c.label) + " " + (i + 1) + '">' + c.options.map(function (o) {
          return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
        }).join("") + "</select>";
      } else if (c.type === "toggle") {
        input = '<label class="nc-check"><input type="checkbox" data-col="' + c.name + '"' + (v === true || v === "true" || v === "1" ? " checked" : "") + "> " + esc(c.label) + "</label>";
      } else {
        var attrs = 'data-col="' + c.name + '" value="' + esc(v) + '" aria-label="' + esc(c.label) + " " + (i + 1) + '"' + (c.placeholder ? ' placeholder="' + esc(c.placeholder) + '"' : "") + (c.type === "number" ? ' inputmode="decimal"' : "");
        input = '<input type="text" ' + attrs + ">";
        if (c.prefix) input = '<span class="input-affix prefix"><span class="affix">' + esc(c.prefix) + "</span>" + input + "</span>";
        else if (c.suffix) input = '<span class="input-affix">' + input + '<span class="affix">' + esc(c.suffix) + "</span></span>";
      }
      return '<div class="nc-cell nc-cell--' + (c.type || "text") + '"' + (c.width ? ' style="flex:' + c.width + '"' : "") + ">" + input + "</div>";
    }).join("") + '<button type="button" class="btn btn-ghost nc-list-remove" data-list-remove="' + i + '" aria-label="Remove row ' + (i + 1) + '">✕</button></div>';
  }

  var api = {
    defs: {},
    fmt: fmt,
    esc: esc,
    flatFields: flatFields,
    listRowHtml: listRowHtml,
    validateNumber: validateNumber,
    define: function (def) {
      api.defs[def.id] = def;
      if (typeof document === "undefined") return;
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { boot(def); });
      else boot(def);
    },
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.NC = api;
})(typeof window !== "undefined" ? window : this);
