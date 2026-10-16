/*
 * Umpire offline support: keeps the umpire pages and the app's static files on
 * the phone so the scoring page reopens with no signal. Scores themselves live
 * in localStorage and sync through /api/umpire/... (never cached here).
 */
const VERSION = "umpire-v1";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

const isAsset = (url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/");
const isUmpirePage = (url) => url.origin === self.location.origin && url.pathname.startsWith("/umpire/");

async function cacheFirst(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGES);
  const key = new URL(request.url);
  key.search = "";
  try {
    const res = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NETWORK_TIMEOUT_MS)),
    ]);
    // don't keep redirects (e.g. a match that isn't started yet bounces to the hub)
    if (res.ok && !res.redirected) cache.put(key.toString(), res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(key.toString());
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (isAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate" && isUmpirePage(url)) {
    event.respondWith(networkFirstPage(request));
  }
});

// the page tells us what it loaded before this worker took control
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "precache" || !Array.isArray(data.urls)) return;
  event.waitUntil(
    (async () => {
      const assets = await caches.open(ASSETS);
      const pages = await caches.open(PAGES);
      for (const raw of data.urls.slice(0, 300)) {
        try {
          const url = new URL(raw, self.location.origin);
          if (isAsset(url)) {
            if (!(await assets.match(url.toString()))) {
              const res = await fetch(url.toString());
              if (res.ok) await assets.put(url.toString(), res);
            }
          } else if (isUmpirePage(url)) {
            url.search = "";
            const res = await fetch(url.toString(), { credentials: "include" });
            if (res.ok && !res.redirected) await pages.put(url.toString(), res);
          }
        } catch {
          // offline right now — the next visit fills the gaps
        }
      }
    })()
  );
});
