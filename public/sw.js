/* BKNY service worker
 * - Sayfa gezinmeleri: önce ağ, başarısızsa önbellekteki son sürüm (çevrimdışı açılış).
 * - Statik dosyalar (/_next/static, yazı tipleri, simgeler): önbellekten, arka planda tazelenir.
 * - /api/* ve Supabase istekleri ASLA önbelleklenmez (kişisel veri service worker'da tutulmaz).
 * - Web Push bildirimleri.
 */
const VERSION = "bkn-v5";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const SHELL = ["/", "/diary", "/add", "/water", "/drinks", "/activity", "/body", "/wellbeing", "/stats", "/profile", "/assistant", "/supplements", "/coach", "/rings", "/performance", "/fasting", "/plan", "/recipes", "/cycle", "/letter", "/challenges", "/eating-out", "/dietitian", "/sharing", "/login"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(url.pathname, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(url.pathname)) || (await caches.match("/")) || Response.error()),
    );
    return;
  }

  // RSC (istemci gezinme) istekleri önbelleklenmez; çevrimdışıyken hata döner ve
  // Next.js tam sayfa gezinmeye düşer, o da yukarıdaki sayfa önbelleğinden karşılanır.
  if (url.searchParams.has("_rsc") || req.headers.get("RSC")) return;

  const isAsset = url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/fonts/") || url.pathname === "/manifest.webmanifest";
  if (isAsset) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => hit || Response.error());
        return hit || network;
      }),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = { title: "BKNY", body: "", url: "/", tag: "bkn" };
  try {
    data = { ...data, ...event.data.json() };
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-72.png",
      tag: data.tag || "bkn",
      renotify: true,
      silent: false,
      vibrate: [200, 100, 200],
      timestamp: Date.now(),
      lang: "tr",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(target);
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
