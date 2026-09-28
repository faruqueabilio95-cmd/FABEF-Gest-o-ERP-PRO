const CACHE_NAME = "fabef-erp-v9-9-buttons-fixed-20260928-1415";
const APP_SHELL = ["./", "./index.html"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => {})));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
  if (event.data === "LIMPAR_CACHE") {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))));
  }
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const isAppJs = url.pathname.endsWith("/app.js") || url.pathname.endsWith("/src/app.js");

  if (isAppJs) {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match(req)));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(fetch(req, { cache: "no-store" }).catch(() => caches.match("./index.html")));
  }
});
