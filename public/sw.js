/* Coach Jay service worker.
 * Its one job: receive clips shared from the phone's gallery (Web Share Target).
 * Android posts the shared file to /share; we park it in the Cache API and send
 * the coach to /coach/share, which uploads it straight to storage. No offline caching.
 */
const SHARE_CACHE = "cj-share";
const PENDING = "/share/pending";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname === "/share") {
    event.respondWith((async () => {
      try {
        const form = await event.request.formData();
        const file = form.get("video") || form.get("file") || [...form.values()].find((v) => v instanceof File);
        if (!(file instanceof File)) return Response.redirect("/coach/share?err=nofile", 303);
        const cache = await caches.open(SHARE_CACHE);
        await cache.put(PENDING, new Response(file, { headers: { "content-type": file.type || "video/mp4", "x-filename": encodeURIComponent(file.name || "shared.mp4"), "x-size": String(file.size) } }));
        return Response.redirect("/coach/share", 303);
      } catch (e) {
        return Response.redirect("/coach/share?err=" + encodeURIComponent(String(e && e.message || e)), 303);
      }
    })());
  }
});
