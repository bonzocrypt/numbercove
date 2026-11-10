"use strict";

var CACHE_NAME = "numbercove-6a5746f613";
var CORE = [
  "/",
  "/index.html",
  "/css/styles.css?v=d8bbea24",
  "/js/app.js?v=6813dc97",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    return Promise.allSettled(CORE.map(function (url) { return cache.add(new Request(url, { cache: "reload" })); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf("numbercove-") === 0 && key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;
  var url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(function (response) {
      if (response.ok) caches.open(CACHE_NAME).then(function (cache) { cache.put(request, response.clone()); });
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) { return cached || caches.match("/index.html"); });
    }));
    return;
  }

  event.respondWith(caches.match(request).then(function (cached) {
    if (cached) return cached;
    return fetch(request).then(function (response) {
      if (response.ok && (url.pathname.indexOf("/css/") === 0 || url.pathname.indexOf("/js/") === 0 || url.pathname.indexOf("/icons/") === 0 || url.pathname === "/favicon.svg" || url.pathname === "/manifest.webmanifest")) {
        caches.open(CACHE_NAME).then(function (cache) { cache.put(request, response.clone()); });
      }
      return response;
    });
  }));
});
