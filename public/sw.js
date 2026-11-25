/* Ribriz Travel service worker: offline wallet and trip pages, and Riya's push notifications.
 * Nothing personal is cached until the traveller is signed in to the app (/me); the
 * app clears these caches when they sign out. */
const PAGES = "ribriz-pages-v1";
const STATIC = "ribriz-static-v1";
const WALLET = "ribriz-wallet"; // documents the traveller chose to "Save offline"; never expired here
const KEEP = [PAGES, STATIC, WALLET];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (!KEEP.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline · Ribriz</title>
<style>body{font-family:system-ui,sans-serif;background:#f4f5fd;color:#0b1240;margin:0;padding:28px 18px}main{max-width:520px;margin:auto}h1{font-size:24px}a.d{display:block;padding:14px 16px;margin:8px 0;border-radius:14px;background:#fff;border:1px solid #dfe3fb;color:inherit;text-decoration:none;font-weight:600}small{color:#5b628a;font-weight:400}.b{display:inline-block;margin-top:14px;color:#0b4fc4;font-weight:700}</style></head>
<body><main><h1>You're offline</h1><p>No signal right now. Anything you saved offline is still here:</p><div id="docs"><p><small>Looking…</small></p></div>
<a class="b" href="/me">Try again</a></main>
<script>caches.open("${WALLET}").then(c=>c.match("/__wallet-index")).then(r=>r?r.json():{}).then(ix=>{const el=document.getElementById("docs");const ks=Object.keys(ix);el.innerHTML=ks.length?"":"<p><small>Nothing saved offline yet. Next time, tap “Save offline” in your wallet.</small></p>";for(const id of ks){const a=document.createElement("a");a.className="d";a.href="/api/docs/"+id+"?raw=1";a.textContent=ix[id].label+" ";const s=document.createElement("small");s.textContent=ix[id].trip||ix[id].fileName;a.appendChild(s);el.appendChild(a);}}).catch(()=>{});</script></body></html>`;

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // saved documents: from this device first
  if (url.pathname.startsWith("/api/docs/") && url.searchParams.get("raw")) {
    e.respondWith(caches.open(WALLET).then((c) => c.match(req, { ignoreVary: true })).then((hit) => hit || fetch(req)));
    return;
  }
  // build files never change once deployed
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(caches.open(STATIC).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  // app pages: fresh when online, the last copy when not
  if (req.mode === "navigate" && url.pathname.startsWith("/me")) {
    e.respondWith((async () => {
      const c = await caches.open(PAGES);
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) c.put(url.pathname, res.clone());
        return res;
      } catch {
        return (await c.match(url.pathname)) || (await c.match("/me/wallet")) || new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
    })());
  }
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "signed-out") e.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(WALLET)]));
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  // tell open app windows to refresh their data
  self.clients.matchAll({ type: "window" }).then((ws) => ws.forEach((w) => w.postMessage({ type: "pushed" })));
  e.waitUntil(self.registration.showNotification(d.title || "Ribriz Travel", {
    body: d.body || "",
    icon: "/icon.png",
    badge: "/badge.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/me" },
  }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || "/me", self.location.origin).href;
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const w of wins) if (new URL(w.url).origin === self.location.origin && "focus" in w) { await w.navigate(target).catch(() => {}); return w.focus(); }
    return self.clients.openWindow(target);
  })());
});
