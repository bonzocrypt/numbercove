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

  /* ---------- Navigation: desktop mega menu and mobile drawer ---------- */

  function metaContent(name) {
    var m = document.querySelector('meta[name="' + name + '"]');
    return m ? m.getAttribute("content") : null;
  }

  /* ---------- Installable web app ---------- */

  function initPwa() {
    var DISMISS_KEY = "numbercove-install-dismissed";
    var DISMISS_DAYS = 30;
    var deferredPrompt = null;
    var promo = null;
    var uiReady = false;
    var autoTimer = 0;

    function track(name, details) {
      window.dataLayer = window.dataLayer || [];
      var payload = details || {};
      payload.event = name;
      window.dataLayer.push(payload);
    }

    function installed() {
      return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    }

    function isIos() {
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    }

    function recentlyDismissed() {
      try {
        var value = Number(localStorage.getItem(DISMISS_KEY));
        return value && Date.now() - value < DISMISS_DAYS * 86400000;
      } catch (e) {
        return false;
      }
    }

    function rememberDismissal() {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch (e) {
        /* ignore */
      }
    }

    function showOpeners() {
      if (!uiReady || installed()) return;
      if (!deferredPrompt && !isIos()) return;
      $$('[data-install-open]').forEach(function (button) { button.hidden = false; });
    }

    function hideOpeners() {
      $$('[data-install-open]').forEach(function (button) { button.hidden = true; });
    }

    function pageIsBusy() {
      return !!$(".nc-peek:not([hidden]), .search-dialog:not([hidden]), .nc-drawer:not([hidden])");
    }

    function closePromo(reason) {
      if (!promo || promo.hidden) return;
      promo.hidden = true;
      if (reason === "dismissed") {
        rememberDismissal();
        track("nc_pwa_install_dismissed", { nc_platform: isIos() ? "ios" : "browser" });
      }
    }

    function makePromo() {
      if (promo) return promo;
      promo = document.createElement("aside");
      promo.className = "install-promo";
      promo.hidden = true;
      promo.setAttribute("role", "dialog");
      promo.setAttribute("aria-modal", "false");
      promo.setAttribute("aria-labelledby", "install-promo-title");
      promo.innerHTML =
        '<button type="button" class="install-promo-close" data-install-close aria-label="Not now">&times;</button>' +
        '<img class="install-promo-icon" src="/icons/icon-192.png" width="56" height="56" alt="">' +
        '<div class="install-promo-copy"><p class="install-promo-kicker">Free web app</p>' +
        '<h2 id="install-promo-title">Keep NumberCove handy</h2>' +
        '<p data-install-message>Install it for one-tap access to every calculator—no app store or account.</p></div>' +
        '<div class="install-promo-actions"><button type="button" class="btn btn-primary" data-install-confirm>Install app</button>' +
        '<button type="button" class="btn btn-ghost" data-install-close>Not now</button></div>';
      document.body.appendChild(promo);

      $$('[data-install-close]', promo).forEach(function (button) {
        button.addEventListener("click", function () { closePromo("dismissed"); });
      });
      $("[data-install-confirm]", promo).addEventListener("click", function () {
        if (isIos() && !deferredPrompt) {
          track("nc_pwa_ios_instructions", { nc_platform: "ios" });
          closePromo();
          return;
        }
        if (!deferredPrompt) return;
        track("nc_pwa_install_clicked", { nc_platform: "browser" });
        var prompt = deferredPrompt;
        deferredPrompt = null;
        prompt.prompt();
        prompt.userChoice.then(function (choice) {
          track(choice.outcome === "accepted" ? "nc_pwa_install_accepted" : "nc_pwa_install_dismissed", { nc_platform: "browser" });
          if (choice.outcome === "dismissed") rememberDismissal();
          closePromo();
          showOpeners();
        });
      });
      return promo;
    }

    function openPromo(source) {
      if (installed() || (!deferredPrompt && !isIos())) return;
      var card = makePromo();
      var ios = isIos() && !deferredPrompt;
      $("#install-promo-title", card).textContent = ios ? "Add NumberCove to your Home Screen" : "Keep NumberCove handy";
      $("[data-install-message]", card).textContent = ios
        ? "In Safari, tap the Share button, then choose Add to Home Screen. NumberCove will open like an app."
        : "Install it for one-tap access to every calculator—no app store or account.";
      $("[data-install-confirm]", card).textContent = ios ? "Got it" : "Install app";
      card.hidden = false;
      track("nc_pwa_promo_shown", { nc_platform: ios ? "ios" : "browser", nc_source: source || "automatic" });
    }

    function schedulePromo(delay) {
      clearTimeout(autoTimer);
      if (installed() || recentlyDismissed() || !window.matchMedia("(max-width: 899px)").matches) return;
      autoTimer = window.setTimeout(function tryShow() {
        if (pageIsBusy()) {
          autoTimer = window.setTimeout(tryShow, 5000);
          return;
        }
        openPromo("automatic");
      }, delay);
    }

    function prepareUi() {
      uiReady = true;
      showOpeners();
      $$('[data-install-open]').forEach(function (button) {
        button.addEventListener("click", function () {
          var drawerClose = $("[data-drawer-close]");
          if (drawerClose) drawerClose.click();
          window.setTimeout(function () { openPromo("menu"); }, 100);
        });
      });
      if (isIos() && !installed()) schedulePromo(30000);
    }

    window.addEventListener("beforeinstallprompt", function (event) {
      event.preventDefault();
      deferredPrompt = event;
      showOpeners();
      schedulePromo(8000);
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      closePromo();
      hideOpeners();
      track("nc_pwa_installed", { nc_platform: isIos() ? "ios" : "browser" });
    });

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", prepareUi, { once: true });
    else prepareUi();

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () { /* progressive enhancement */ });
      });
    }
  }

  function samePage(href) {
    try {
      var a = new URL(href, window.location.href);
      var here = window.location.pathname.replace(/index\.html$/, "");
      return a.pathname.replace(/index\.html$/, "") === here;
    } catch (e) {
      return false;
    }
  }

  function initNav() {
    var triggers = $$("[data-mega]");
    var openId = null;
    var hoverTimer = 0;

    function panelFor(t) {
      return document.getElementById(t.getAttribute("aria-controls"));
    }

    function closeMega() {
      triggers.forEach(function (t) {
        t.setAttribute("aria-expanded", "false");
        var p = panelFor(t);
        if (p) p.hidden = true;
      });
      openId = null;
      document.documentElement.classList.remove("mega-open");
    }

    function openMega(t) {
      if (openId === t.getAttribute("data-mega")) return;
      closeMega();
      t.setAttribute("aria-expanded", "true");
      var p = panelFor(t);
      if (p) p.hidden = false;
      openId = t.getAttribute("data-mega");
      document.documentElement.classList.add("mega-open");
    }

    triggers.forEach(function (t) {
      var item = t.parentNode;
      t.addEventListener("click", function (e) {
        e.preventDefault();
        if (openId === t.getAttribute("data-mega")) closeMega();
        else openMega(t);
      });
      item.addEventListener("pointerenter", function (e) {
        if (e.pointerType !== "mouse") return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(function () { openMega(t); }, openId ? 40 : 140);
      });
      item.addEventListener("pointerleave", function (e) {
        if (e.pointerType !== "mouse") return;
        clearTimeout(hoverTimer);
        hoverTimer = setTimeout(closeMega, 240);
      });
      t.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          openMega(t);
          var first = panelFor(t) && panelFor(t).querySelector("a");
          if (first) first.focus();
        }
      });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && openId) {
        var t = $('[data-mega="' + openId + '"]');
        closeMega();
        if (t) t.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (openId && !e.target.closest(".mega-item")) closeMega();
    });
    document.addEventListener("focusin", function (e) {
      if (openId && !e.target.closest(".mega-item")) closeMega();
    });

    $$(".mega-panel a, .nc-drawer a").forEach(function (a) {
      if (samePage(a.getAttribute("href"))) {
        a.setAttribute("aria-current", "page");
        var det = a.closest("details");
        if (det) det.open = true;
      }
    });

    var drawer = $("#nc-drawer");
    var openBtn = $("[data-drawer-open]");
    function setDrawer(on) {
      if (!drawer) return;
      drawer.hidden = !on;
      document.documentElement.classList.toggle("drawer-open", on);
      if (openBtn) openBtn.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) {
        var c = drawer.querySelector("[data-drawer-close]");
        if (c) c.focus();
      } else if (openBtn) {
        openBtn.focus();
      }
    }
    if (openBtn) openBtn.addEventListener("click", function () { setDrawer(true); });
    $$("[data-drawer-close]").forEach(function (b) {
      b.addEventListener("click", function () { setDrawer(false); });
    });
    if (drawer) {
      drawer.addEventListener("keydown", function (e) {
        if (e.key === "Escape") setDrawer(false);
      });
      drawer.addEventListener("click", function (e) {
        if (e.target.closest("[data-search-open]")) {
          drawer.hidden = true;
          document.documentElement.classList.remove("drawer-open");
        }
      });
    }
    window.addEventListener("resize", function () {
      if (drawer && !drawer.hidden && window.innerWidth >= 1080) setDrawer(false);
    });
  }

  /* ---------- Search palette ---------- */

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function subsequence(term, text) {
    var i = 0;
    for (var j = 0; j < text.length && i < term.length; j += 1) if (text[j] === term[i]) i += 1;
    return i === term.length;
  }

  function scoreItem(item, terms, fuzzy) {
    var title = item.t.toLowerCase();
    var question = (item.q || "").toLowerCase();
    var hay = item.k + " " + (item.d || "").toLowerCase() + " " + (item.c || "").toLowerCase() + " " + (item.s || "").toLowerCase();
    var total = 0;
    for (var n = 0; n < terms.length; n += 1) {
      var term = terms[n];
      var alt = term.length > 3 && /s$/.test(term) ? term.slice(0, -1) : term;
      var word = new RegExp("(^|[^a-z0-9])" + escapeRe(alt));
      var s = 0;
      if (title.indexOf(alt) === 0) s = 14;
      else if (word.test(title)) s = 10;
      else if (title.indexOf(alt) !== -1) s = 7;
      else if (word.test(question)) s = 6;
      else if (word.test(hay)) s = 4;
      else if (hay.indexOf(alt) !== -1) s = 2;
      else if (fuzzy && alt.length > 3 && subsequence(alt, title)) s = 1;
      else return 0;
      total += s;
    }
    return total - (item.h ? 2 : 0);
  }

  function highlight(text, terms) {
    var out = escapeHtml(text);
    terms.forEach(function (t) {
      if (t.length < 2) return;
      out = out.replace(new RegExp("(" + escapeRe(escapeHtml(t)) + ")", "ig"), "<mark>$1</mark>");
    });
    return out;
  }

  function initSearch() {
    var root = metaContent("nc-root") || "";
    if (root === "./") root = "";
    var indexSrc = metaContent("nc-search") || root + "js/search-index.js";
    var dialog = null;
    var input = null;
    var list = null;
    var results = [];
    var active = 0;
    var lastFocus = null;
    var waiting = [];
    var loading = false;

    function load(cb) {
      if (window.NC_SEARCH) return cb();
      waiting.push(cb);
      if (loading) return;
      loading = true;
      var s = document.createElement("script");
      s.src = indexSrc;
      s.onload = function () {
        var w = waiting;
        waiting = [];
        w.forEach(function (f) { f(); });
      };
      s.onerror = function () {
        loading = false;
        if (list) list.innerHTML = '<p class="search-empty-msg">Search is unavailable right now.</p>';
      };
      document.head.appendChild(s);
    }

    function iconSvg(inner) {
      return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + "</svg>";
    }

    function row(item, terms, idx) {
      var title = item.q && terms.length && scoreItem({ t: item.q, k: "", d: "" }, terms) > 0 ? item.q : item.t;
      return '<a class="search-item" role="option" id="sr-' + idx + '" href="' + root + item.u + '" aria-selected="' + (idx === active ? "true" : "false") + '">' +
        '<span class="search-item-icon pill-' + (item.p || "finance") + '">' + iconSvg(item.i || "") + "</span>" +
        '<span class="search-item-body"><span class="search-item-title">' + highlight(title, terms) + "</span>" +
        '<span class="search-item-meta">' + escapeHtml(item.h ? item.c : item.c + " · " + item.s) + (item.d ? " — " + escapeHtml(item.d) : "") + "</span></span>" +
        '<span class="search-item-go" aria-hidden="true">' + iconSvg('<path d="M5 12h14M13 6l6 6-6 6"/>') + "</span></a>";
    }

    function render() {
      var data = window.NC_SEARCH;
      if (!data || !list) return;
      var q = input.value.trim().toLowerCase();
      var terms = q.split(/\s+/).filter(Boolean);
      var html = "";
      results = [];
      if (!terms.length) {
        var pop = data.popular.map(function (u) {
          return data.tools.filter(function (t) { return t.u === u; })[0];
        }).filter(Boolean);
        results = pop.concat(data.hubs.filter(function (h) { return h.c === "Category" || h.c === "Collection"; }));
        html += '<p class="search-group">Popular calculators</p>' + pop.map(function (it, i) { return row(it, [], i); }).join("");
        html += '<p class="search-group">Browse topics</p>' + results.slice(pop.length).map(function (it, i) { return row(it, [], i + pop.length); }).join("");
      } else {
        var rank = function (list, max, fuzzy) {
          return list.map(function (it) { return { it: it, s: scoreItem(it, terms, fuzzy) }; })
            .filter(function (r) { return r.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, max).map(function (r) { return r.it; });
        };
        var tools = rank(data.tools, 8, false);
        var hubs = rank(data.hubs, 3, false);
        if (!tools.length && !hubs.length) {
          tools = rank(data.tools, 8, true);
          hubs = rank(data.hubs, 3, true);
        }
        results = tools.concat(hubs);
        if (!results.length) {
          html = '<p class="search-empty-msg">No calculators match “' + escapeHtml(input.value.trim()) + '”. Try a broader word such as “fees”, “loan”, or “paint”.</p>';
        } else {
          if (tools.length) html += '<p class="search-group">Calculators</p>' + tools.map(function (it, i) { return row(it, terms, i); }).join("");
          if (hubs.length) html += '<p class="search-group">Topics</p>' + hubs.map(function (it, i) { return row(it, terms, i + tools.length); }).join("");
        }
      }
      if (active >= results.length) active = 0;
      list.innerHTML = html;
      syncActive();
    }

    function syncActive() {
      $$(".search-item", list).forEach(function (el, i) {
        el.setAttribute("aria-selected", i === active ? "true" : "false");
        if (i === active) {
          input.setAttribute("aria-activedescendant", el.id);
          el.scrollIntoView({ block: "nearest" });
        }
      });
    }

    function build() {
      dialog = document.createElement("div");
      dialog.className = "search-dialog";
      dialog.hidden = true;
      dialog.innerHTML = '<div class="search-backdrop" data-search-close></div>' +
        '<div class="search-panel" role="dialog" aria-modal="true" aria-label="Search calculators">' +
        '<div class="search-field">' + iconSvg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>') +
        '<input type="search" role="combobox" aria-expanded="true" aria-controls="search-results" aria-autocomplete="list" autocomplete="off" spellcheck="false" placeholder="Search calculators, e.g. eBay fees, covered call, paint" aria-label="Search calculators">' +
        '<button type="button" class="search-esc" data-search-close>Esc</button></div>' +
        '<div class="search-results" id="search-results" role="listbox"></div>' +
        '<div class="search-foot"><span><kbd>↑</kbd><kbd>↓</kbd> move</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span></div></div>';
      document.body.appendChild(dialog);
      input = dialog.querySelector("input");
      list = dialog.querySelector(".search-results");
      input.addEventListener("input", function () {
        active = 0;
        load(render);
      });
      input.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          active = Math.min(results.length - 1, active + 1);
          syncActive();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          active = Math.max(0, active - 1);
          syncActive();
        } else if (e.key === "Enter") {
          var el = list.querySelectorAll(".search-item")[active];
          if (el) {
            e.preventDefault();
            window.location.href = el.href;
          }
        }
      });
      list.addEventListener("pointermove", function (e) {
        var el = e.target.closest(".search-item");
        if (!el) return;
        var idx = $$(".search-item", list).indexOf(el);
        if (idx !== -1 && idx !== active) {
          active = idx;
          syncActive();
        }
      });
      dialog.addEventListener("click", function (e) {
        if (e.target.closest("[data-search-close]")) closeSearch();
      });
      dialog.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          e.preventDefault();
          closeSearch();
        } else if (e.key === "Tab") {
          var f = $$("input, button, a", dialog).filter(function (n) { return n.offsetParent !== null; });
          if (!f.length) return;
          if (e.shiftKey && document.activeElement === f[0]) {
            e.preventDefault();
            f[f.length - 1].focus();
          } else if (!e.shiftKey && document.activeElement === f[f.length - 1]) {
            e.preventDefault();
            f[0].focus();
          }
        }
      });
    }

    function openSearch(initial) {
      if (!dialog) build();
      lastFocus = document.activeElement;
      dialog.hidden = false;
      document.documentElement.classList.add("search-open");
      if (initial != null) input.value = initial;
      active = 0;
      input.focus();
      input.select();
      load(render);
    }

    function closeSearch() {
      if (!dialog) return;
      dialog.hidden = true;
      document.documentElement.classList.remove("search-open");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-search-open]");
      if (t) {
        e.preventDefault();
        openSearch();
      }
    });
    document.addEventListener("keydown", function (e) {
      var tag = (e.target.tagName || "").toLowerCase();
      var typing = tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable;
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        openSearch();
      } else if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        openSearch();
      }
    });
    $$("[data-search-open]").forEach(function (b) {
      b.addEventListener("pointerenter", function () { load(function () {}); }, { once: true });
    });
    try {
      var q = new URLSearchParams(window.location.search).get("q");
      if (q && document.body.classList.contains("home")) openSearch(q);
    } catch (e) {
      /* URLSearchParams unavailable */
    }
  }

  function initTypewriter() {
    var el = $("[data-typewriter]");
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var words = el.getAttribute("data-typewriter").split("|");
    var w = 0;
    var c = 0;
    var deleting = false;
    function tick() {
      var word = words[w];
      c += deleting ? -1 : 1;
      el.textContent = "Try “" + word.slice(0, c) + (c < word.length || deleting ? "" : "") + "”";
      var delay = deleting ? 35 : 75;
      if (!deleting && c === word.length) {
        deleting = true;
        delay = 1600;
      } else if (deleting && c === 0) {
        deleting = false;
        w = (w + 1) % words.length;
        delay = 300;
      }
      setTimeout(tick, delay);
    }
    setTimeout(tick, 900);
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

  initPwa();
  initTheme();
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initSearch();
    initTypewriter();
    setYear();
  });
})();
