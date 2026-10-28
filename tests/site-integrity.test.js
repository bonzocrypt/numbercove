"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");

var root = path.resolve(__dirname, "..");
var htmlFiles = [];

function walk(dir) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (entry) {
    var full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== ".git" && entry.name !== "tests") walk(full);
    } else if (/\.html$/i.test(entry.name)) {
      htmlFiles.push(full);
    }
  });
}

walk(root);

htmlFiles.forEach(function (file) {
  var html = fs.readFileSync(file, "utf8");
  var ids = {};
  var idPattern = /\sid=["']([^"']+)["']/gi;
  var match;
  while ((match = idPattern.exec(html))) {
    assert.ok(!ids[match[1]], path.relative(root, file) + " has duplicate id " + match[1]);
    ids[match[1]] = true;
  }

  var jsonPattern = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  while ((match = jsonPattern.exec(html))) {
    assert.doesNotThrow(function () { JSON.parse(match[1]); }, path.relative(root, file) + " has invalid JSON-LD");
  }

  var linkPattern = /\s(?:href|src)=["']([^"']+)["']/gi;
  while ((match = linkPattern.exec(html))) {
    var target = match[1];
    if (!target || /^(?:https?:|mailto:|tel:|data:|#)/i.test(target)) continue;
    target = target.split("?")[0].split("#")[0];
    if (!target) continue;
    var resolved = path.resolve(path.dirname(file), target);
    assert.ok(fs.existsSync(resolved), path.relative(root, file) + " links to missing file " + target);
  }
});

var tools = JSON.parse(fs.readFileSync(path.join(root, "tools.json"), "utf8"));
var toolIds = tools.tools.map(function (tool) { return tool.id; });
["covered-call-cash-secured-put", "expected-move", "options-roll-wheel"].forEach(function (id) {
  assert.ok(toolIds.indexOf(id) !== -1, "tools.json is missing " + id);
});

var sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
["covered-call-cash-secured-put.html", "expected-move.html", "options-roll-wheel.html"].forEach(function (name) {
  assert.ok(sitemap.indexOf(name) !== -1, "sitemap.xml is missing " + name);
});

var homepage = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert.ok(homepage.indexOf('"numberOfItems": ' + tools.tools.length) !== -1, "homepage tool count should match tools.json (" + tools.tools.length + ")");
tools.tools.forEach(function (tool) {
  var rel = tool.url.replace("https://www.numbercove.com/", "");
  assert.ok(fs.existsSync(path.join(root, rel)), "tools.json lists a missing page: " + rel);
  assert.ok(sitemap.indexOf(tool.url) !== -1, "sitemap.xml is missing " + tool.url);
});

console.log("site integrity tests passed across " + htmlFiles.length + " HTML files");
