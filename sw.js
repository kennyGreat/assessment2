// Vortexedge Assessment — offline-enabled service worker
const CACHE_NAME = "ve-assessment-v2";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js",
  "https://fonts.googleapis.com/css2?family=Zilla+Slab:wght@400;600;700&family=Work+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((c) =>
      // cache what we can; ignore any single failure so install still succeeds
      Promise.allSettled(SHELL_FILES.map((f) => c.add(f)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Never cache Supabase API traffic (auth / inserts / rpc) — always live.
  if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/rest/")) return;
  if (url.hostname.endsWith("supabase.co") && url.pathname.includes("/auth/")) return;

  // Cache-first for fonts + CDN libs (so the app looks & works right offline).
  const isStatic =
    url.origin === self.location.origin ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com") ||
    url.hostname.includes("cdn.jsdelivr.net");

  if (!isStatic) return; // anything else: straight to network

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const net = fetch(event.request)
        .then((res) => {
          if (res && (res.status === 200 || res.type === "opaque")) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached || caches.match("./index.html"));
      return cached || net;
    })
  );
});
