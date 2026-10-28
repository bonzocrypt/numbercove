/* Generates a complete calculator page from:
     js/calc/<id>.js   runtime definition (inputs, compute, render)
     build/pages/<id>.js page content (title, lede, method, sources, FAQs)
   The form is rendered statically so crawlers and no-JS readers see every input,
   the method, sources, and FAQs. */
"use strict";

var path = require("path");
var NC = require("../js/nc-calc.js");

function fieldHtml(f, x) {
  var esc = x.esc;
  var wrapAttrs = ' data-field="' + f.name + '"' + (f.span === 2 ? ' class="field span-2"' : ' class="field"');
  var opt = f.optional ? ' <span class="optional-tag">optional</span>' : "";
  var hint = f.hint ? '<span class="hint">' + f.hint + "</span>" : "";
  if (f.type === "group") {
    var inner = '<div class="form-grid two">' + f.fields.map(function (g) { return fieldHtml(g, x); }).join("") + "</div>";
    var show = f.showIf ? ' data-group-show="' + esc(JSON.stringify(f.showIf)) + '"' : "";
    if (f.advanced) return '<details class="advanced nc-group"' + (f.open ? " open" : "") + show + "><summary>" + esc(f.title) + "</summary>" + (f.hint ? '<p class="hint">' + f.hint + "</p>" : "") + inner + "</details>";
    return '<fieldset class="nc-group"' + show + "><legend>" + esc(f.title) + "</legend>" + (f.hint ? '<p class="hint">' + f.hint + "</p>" : "") + inner + "</fieldset>";
  }
  if (f.type === "segment") {
    return '<fieldset class="choice-group' + (f.span === 2 ? " span-2" : "") + '" data-field="' + f.name + '"><legend>' + esc(f.label) + "</legend>" + hint + '<div class="seg">' +
      f.options.map(function (o) {
        return '<label><input type="radio" name="' + f.name + '" value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.value) ? " checked" : "") + "> " + esc(o[1]) + "</label>";
      }).join("") + "</div></fieldset>";
  }
  if (f.type === "select") {
    return "<label" + wrapAttrs + "><span>" + esc(f.label) + opt + "</span>" + hint + '<select name="' + f.name + '">' + f.options.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(f.value) ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + '</select><span class="field-error"></span></label>';
  }
  if (f.type === "toggle") {
    return '<label class="field nc-toggle' + (f.span === 2 ? " span-2" : "") + '" data-field="' + f.name + '"><input type="checkbox" name="' + f.name + '"' + (f.value ? " checked" : "") + "><span><strong>" + esc(f.label) + "</strong>" + hint + "</span></label>";
  }
  if (f.type === "list") {
    return '<div class="nc-list span-2" data-field="' + f.name + '" data-list="' + f.name + '"><div class="nc-list-title"><span>' + esc(f.label) + "</span>" + hint + "</div>" +
      '<div class="nc-list-head">' + f.columns.map(function (c) { return '<span class="nc-cell nc-cell--' + (c.type || "text") + '"' + (c.width ? ' style="flex:' + c.width + '"' : "") + ">" + esc(c.label) + "</span>"; }).join("") + '<span class="nc-list-spacer"></span></div>' +
      '<div class="nc-list-rows">' + (f.rows || []).map(function (r, i) { return NC.listRowHtml(f, r, i); }).join("") + "</div>" +
      '<button type="button" class="btn btn-ghost nc-list-add" data-list-add>+ ' + esc(f.addLabel || "Add row") + "</button></div>";
  }
  var input = '<input name="' + f.name + '" inputmode="decimal" value="' + esc(f.value == null ? "" : f.value) + '"' + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "") + ">";
  if (f.prefix && f.suffix) input = '<span class="input-affix prefix both"><span class="affix">' + esc(f.prefix) + "</span>" + input + '<span class="affix suf">' + esc(f.suffix) + "</span></span>";
  else if (f.prefix) input = '<span class="input-affix prefix"><span class="affix">' + esc(f.prefix) + "</span>" + input + "</span>";
  else if (f.suffix) input = '<span class="input-affix">' + input + '<span class="affix">' + esc(f.suffix) + "</span></span>";
  var slider = f.slider ? '<input type="range" class="scenario-range" data-range-for="' + f.name + '" min="' + f.slider.min + '" max="' + f.slider.max + '" step="' + (f.slider.step || "any") + '" value="' + esc(f.value) + '" aria-label="' + esc(f.label) + ' slider">' : "";
  return "<label" + wrapAttrs + "><span>" + esc(f.label) + opt + "</span>" + hint + input + slider + '<span class="field-error"></span></label>';
}

function render(page, tool, x) {
  var esc = x.esc;
  var def = require(path.join(x.root, "js", "calc", page.id + ".js"));
  var p = "../";
  var crumbs = x.toolCrumbs(tool);
  var site = x.site;
  var webApp = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    url: tool.url,
    description: page.description,
    applicationCategory: page.appCategory || "FinanceApplication",
    operatingSystem: "Any (web browser)",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    dateModified: tool.updated,
  };
  if (x.hasByline(tool)) webApp.author = x.authorLd();
  var ld = [webApp, x.breadcrumbLd(crumbs)];
  if (page.faqs && page.faqs.length) ld.push(x.faqLd(page.faqs, tool.url + "#faq"));

  var form = '<form class="panel nc-form" data-nc-calc="' + page.id + '" id="calc-form" novalidate>' +
    "<h2>" + esc(page.formTitle || "Your numbers") + "</h2>" +
    (page.formHint ? '<p class="hint">' + page.formHint + "</p>" : "") +
    '<div class="form-grid two">' + def.inputs.map(function (f) {
      return f.type === "group" ? "</div>" + fieldHtml(f, x) + '<div class="form-grid two">' : fieldHtml(f, x);
    }).join("") + "</div>" +
    '<p class="form-error" role="alert"></p>' +
    '<div class="actions"><button class="btn btn-primary" type="submit">' + esc(page.submit || "Update results") + '</button>' +
    '<button class="btn btn-secondary" type="button" id="nc-reset">Reset</button>' +
    '<button class="btn btn-ghost" type="button" id="nc-copy">Copy results</button>' +
    '<button class="btn btn-ghost" type="button" id="nc-link">Copy link</button></div></form>';
  form = form.replace(/<div class="form-grid two"><\/div>/g, "");

  var method = (page.method || []).map(function (s) {
    return "<h3>" + esc(s.h) + "</h3>" + s.html;
  }).join("");
  var sources = page.sources && page.sources.length ? '<section class="nc-sources" id="sources"><h2>Sources</h2><ol>' + page.sources.map(function (s) {
    return '<li><a href="' + esc(s.url) + '" rel="noopener noreferrer">' + esc(s.name) + "</a>" + (s.note ? " · " + esc(s.note) : "") + "</li>";
  }).join("") + '</ol><p class="hint">Last reviewed ' + esc(tool.updated) + ". Rules, rates, and prices change; check the source for your exact situation.</p></section>" : "";
  var faq = page.faqs && page.faqs.length ? '<section class="hub-faq" id="faq" aria-labelledby="faq-title"><h2 id="faq-title">Common questions</h2>' + page.faqs.map(function (f) {
    return "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>";
  }).join("") + "</section>" : "";

  var main = '    <div class="wrap">\n      <!-- nc:breadcrumb -->' + x.breadcrumb(p, crumbs) + "<!-- /nc:breadcrumb -->\n" +
    '      <header class="page-header nc-page-header"><p class="kicker">' + esc(tool.cat.name) + " · " + esc(tool.sub.name) + "</p><h1>" + esc(page.h1) + '</h1><p class="lede">' + page.lede + "</p>" +
    (x.hasByline(tool) ? "<!-- nc:byline -->" + x.byline(p, tool) + "<!-- /nc:byline -->" : "") + "</header>\n" +
    '      <div class="calc-layout nc-layout">' + form +
    '<section class="panel results-panel nc-results-panel" aria-live="polite"><h2>' + esc(page.resultTitle || "Result") + '</h2><div id="nc-results"><p class="placeholder-result">Enter your numbers to see the answer.</p></div></section></div>\n' +
    '      <div id="nc-analysis" class="nc-analysis" hidden></div>\n' +
    '      <section class="how nc-method" id="method"><h2>How this calculator works</h2><div class="prose">' + method + "</div></section>\n" +
    "      " + sources + "\n      " + faq + "\n" +
    '      <p class="disclaimer">' + (page.disclaimer || "Planning estimate only. Not financial, tax, or legal advice. Verify the numbers that matter with the provider, plan document, or professional responsible for them.") + "</p>\n" +
    "      <!-- nc:related -->" + x.related(p, tool) + "<!-- /nc:related -->\n    </div>";

  return x.shell({
    root: p, title: page.seoTitle, description: page.description, canonical: tool.url, activeCat: tool.cat.id, main: main, ads: true,
    ld: ld.concat(x.hasByline(tool) ? [{ "@context": "https://schema.org", "@type": "WebPage", "@id": tool.url + "#webpage", url: tool.url, name: tool.name, dateModified: tool.updated, author: x.authorLd(), publisher: { "@type": "Organization", name: "NumberCove", url: x.ORIGIN + "/" } }] : []),
    scripts: ["js/nc-charts.js", "js/nc-calc.js", "js/calc/" + page.id + ".js"],
  });
}

module.exports = { render: render, fieldHtml: fieldHtml };
