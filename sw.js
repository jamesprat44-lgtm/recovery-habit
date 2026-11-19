/* Recovery Habit – service worker
 * Offline cache (cache-first pre app shell) + zobrazovanie notifikácií.
 */
const CACHE = "recovery-habit-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./app.css",
  "./app.js",
  "./manifest.webmanifest",
  "./icon-96.png",
  "./icon-192.png",
  "./icon-512.png",
  "./maskable-512.png",
  "./apple-touch-icon.png",
  "./icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isAppShell = req.mode === "navigate" || /\.(?:html|css|js|webmanifest)$/.test(url.pathname);
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req, { ignoreSearch: true });
      if (isAppShell) {
        try {
          const fresh = await fetch(req, { cache: "no-store" });
          if (fresh && fresh.ok) {
            await cache.put(req, fresh.clone());
            return fresh;
          }
        } catch {}
        return cached || cache.match("./index.html");
      }
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) await cache.put(req, fresh.clone());
        return fresh;
      } catch {
        return cache.match("./index.html");
      }
    }),
  );
});

/* Správa z aplikácie: zobraz notifikáciu (funguje aj na iOS po pridaní na plochu). */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type === "notify") {
    self.registration.showNotification(data.title || "Recovery Habit", {
      body: data.body || "",
      icon: "./icon-192.png",
      badge: "./icon-96.png",
      tag: data.tag || undefined,
      data: { url: data.url || "./index.html" },
    });
  }
});

/* Web Push (pripravené na budúcu serverovú časť). */
self.addEventListener("push", (event) => {
  let payload = { title: "Recovery Habit", body: "Nezabudni na svoje predsavzatie." };
  try {
    if (event.data) payload = Object.assign(payload, event.data.json());
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "./icon-192.png",
      badge: "./icon-96.png",
      data: { url: payload.url || "./index.html" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "./index.html";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
