(function () {
  "use strict";

  var THEME_KEY = "calculate-theme";

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  function getStoredTheme() {
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (e) {
      return null;
    }
  }

  function storeTheme(theme) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (e) {
      /* ignore */
    }
  }

  function currentTheme() {
    return document.documentElement.getAttribute("data-theme") === "dark"
      ? "dark"
      : "light";
  }

  function applyTheme(theme) {
    if (theme === "dark") {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    $$("[data-theme-toggle]").forEach(function (btn) {
      btn.setAttribute(
        "aria-label",
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      );
      btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
    });
  }

  function initTheme() {
    var stored = getStoredTheme();
    if (stored === "dark" || stored === "light") {
      applyTheme(stored);
    } else if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      applyTheme("dark");
    } else {
      applyTheme("light");
    }

    document.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-theme-toggle]");
      if (!btn) return;
      var next = currentTheme() === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
    });
  }

  function initNav() {
    var nav = $("#site-nav");
    var toggle = $("[data-nav-toggle]");
    if (!nav || !toggle) return;

    toggle.addEventListener("click", function () {
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.setAttribute("aria-label", "Open menu");
      }
    });
  }

  function initSearch() {
    var input = $("#tool-search");
    if (!input) return;
    var cards = $$("[data-tool]");
    var empty = $("#search-empty");

    function filter() {
      var q = input.value.trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (card) {
        var hay = (card.getAttribute("data-tool") || "") + " " + (card.textContent || "");
        var match = !q || hay.toLowerCase().indexOf(q) !== -1;
        card.classList.toggle("is-hidden", !match);
        if (match) shown += 1;
      });
      $$(".card-grid").forEach(function (grid) {
        var any = grid.querySelectorAll(".tool-card:not(.is-hidden)").length > 0;
        grid.style.display = any ? "" : "none";
        var head = grid.previousElementSibling;
        if (head && head.classList.contains("section-head")) {
          head.style.display = any ? "" : "none";
        }
      });
      if (empty) empty.classList.toggle("is-visible", shown === 0);
    }

    input.addEventListener("input", filter);
  }

  function toast(message) {
    var el = $("#toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () {
      el.classList.remove("is-visible");
    }, 2200);
  }

  function parseNumber(value) {
    if (value == null) return NaN;
    var s = String(value).replace(/,/g, "").trim();
    if (!s) return NaN;
    var n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function getControl(form, name) {
    if (!form || !name) return null;
    var el = form.querySelector('[name="' + name + '"]');
    if (el) return el;
    el = form.elements[name];
    if (el && el.nodeType === 1) return el;
    return null;
  }

  function fieldValue(form, name) {
    var el = getControl(form, name);
    if (!el) return NaN;
    if (el.type === "checkbox") return el.checked;
    if (el.type === "radio") {
      var checked = form.querySelector('[name="' + name + '"]:checked');
      return checked ? checked.value : "";
    }
    return parseNumber(el.value);
  }

  function formatNumber(n, digits) {
    if (!Number.isFinite(n)) return "—";
    var d = digits == null ? 2 : digits;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function formatMoney(n) {
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString(undefined, {
      style: "currency",
      currency: "USD",
    });
  }

  function formatPercent(n, digits) {
    if (!Number.isFinite(n)) return "—";
    var d = digits == null ? 2 : digits;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + "%";
  }

  function clearErrors(form) {
    $$(".field", form).forEach(function (f) {
      f.classList.remove("is-invalid");
    });
    $$(".field-error", form).forEach(function (e) {
      e.textContent = "";
    });
    var box = $(".form-error", form);
    if (box) {
      box.textContent = "";
      box.classList.remove("is-visible");
    }
  }

  function setFieldError(input, message) {
    if (!input) return;
    var field = input.closest(".field");
    if (field) field.classList.add("is-invalid");
    input.setAttribute("aria-invalid", "true");
    var err =
      (field && field.querySelector(".field-error")) ||
      document.getElementById(input.id + "-error");
    if (err) err.textContent = message;
  }

  function showFormError(form, message) {
    var box = $(".form-error", form);
    if (!box) return;
    box.textContent = message;
    box.classList.add("is-visible");
  }

  function requireFinite(form, name, label, opts) {
    opts = opts || {};
    var el = getControl(form, name);
    var n = fieldValue(form, name);
    if (!Number.isFinite(n)) {
      setFieldError(el, "Enter " + (label || name) + ".");
      return null;
    }
    if (opts.min != null && n < opts.min) {
      setFieldError(el, (label || name) + " must be at least " + opts.min + ".");
      return null;
    }
    if (opts.max != null && n > opts.max) {
      setFieldError(el, (label || name) + " must be at most " + opts.max + ".");
      return null;
    }
    if (opts.gt != null && n <= opts.gt) {
      setFieldError(el, (label || name) + " must be greater than " + opts.gt + ".");
      return null;
    }
    if (el) el.setAttribute("aria-invalid", "false");
    return n;
  }

  function copyText(text) {
    if (!text) {
      toast("Nothing to copy yet.");
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          toast("Results copied.");
        },
        function () {
          fallbackCopy(text);
        }
      );
    } else {
      fallbackCopy(text);
    }
  }

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      toast("Results copied.");
    } catch (e) {
      toast("Copy failed.");
    }
    document.body.removeChild(ta);
  }

  function payment(principal, annualRatePct, months) {
    if (months <= 0) return NaN;
    if (principal === 0) return 0;
    var r = annualRatePct / 100 / 12;
    if (r === 0) return principal / months;
    var pow = Math.pow(1 + r, months);
    return (principal * r * pow) / (pow - 1);
  }

  function remainingBalance(principal, annualRatePct, months, paid) {
    var r = annualRatePct / 100 / 12;
    if (paid >= months) return 0;
    if (r === 0) return principal * (1 - paid / months);
    var powN = Math.pow(1 + r, months);
    var powK = Math.pow(1 + r, paid);
    return (principal * (powN - powK)) / (powN - 1);
  }

  function amortize(principal, annualRatePct, months, extra) {
    extra = extra || 0;
    var r = annualRatePct / 100 / 12;
    var scheduled = payment(principal, annualRatePct, months);
    var bal = principal;
    var totalInterest = 0;
    var totalPaid = 0;
    var rows = [];
    var i = 0;
    var max = months + 2;
    while (bal > 0.005 && i < max && i < 720) {
      i += 1;
      var interest = r === 0 ? 0 : bal * r;
      var prin = scheduled - interest + extra;
      if (prin > bal) prin = bal;
      var pay = prin + interest;
      bal = Math.max(0, bal - prin);
      totalInterest += interest;
      totalPaid += pay;
      if (i <= 12 || bal === 0) {
        rows.push({
          n: i,
          payment: pay,
          principal: prin,
          interest: interest,
          balance: bal,
        });
      }
    }
    return {
      scheduled: scheduled,
      months: i,
      totalInterest: totalInterest,
      totalPaid: totalPaid,
      rows: rows,
    };
  }

  function addMonths(date, months) {
    var d = new Date(date.getTime());
    d.setMonth(d.getMonth() + months);
    return d;
  }

  function formatDate(d) {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
    });
  }

  window.Calculate = {
    $,
    $$,
    toast: toast,
    parseNumber: parseNumber,
    getControl: getControl,
    fieldValue: fieldValue,
    formatNumber: formatNumber,
    formatMoney: formatMoney,
    formatPercent: formatPercent,
    clearErrors: clearErrors,
    setFieldError: setFieldError,
    showFormError: showFormError,
    requireFinite: requireFinite,
    copyText: copyText,
    payment: payment,
    remainingBalance: remainingBalance,
    amortize: amortize,
    addMonths: addMonths,
    formatDate: formatDate,
  };

  function setYear() {
    $$("[data-year]").forEach(function (el) {
      el.textContent = String(new Date().getFullYear());
    });
  }

  initTheme();
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initSearch();
    setYear();
  });
})();
