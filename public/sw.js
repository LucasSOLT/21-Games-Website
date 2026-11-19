const CACHE_NAME = "21games-static-v2";

const ICON_PATHS = new Set([
  "/apple-touch-icon.png",
  "/favicon.ico",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
]);

function isStaticAsset(pathname) {
  if (pathname.startsWith("/_next/static/")) return true;
  if (ICON_PATHS.has(pathname) || pathname.startsWith("/icon-") || pathname.startsWith("/favicon.")) {
    return true;
  }
  if (/\.(?:woff2?|ttf|otf)$/i.test(pathname)) return true;
  return false;
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (!url.protocol.startsWith("http")) return;

  // Never intercept cross-origin requests (e.g. Supabase APIs, analytics) or /admin routes
  if (url.hostname.includes("supabase.co")) return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) return;

  // Cache-first for immutable Next static bundles, fonts, and brand icons
  if (isStaticAsset(url.pathname)) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response && response.ok && response.status === 200) {
          cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      })
    );
    return;
  }

  // Network-first for HTML navigation requests with offline cache fallback
  const accept = request.headers.get("accept") || "";
  if (request.mode === "navigate" || accept.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok && response.status === 200) {
            const copy = response.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, copy))
              .catch(() => {});
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const homeCached = await caches.match("/");
          if (homeCached) return homeCached;
          return Response.error();
        })
    );
  }
});
