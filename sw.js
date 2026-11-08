// Guarda a aplicação no dispositivo para abrir sem rede. Os dados ficam na cache do Firestore.
const CACHE = "obra-2026.11.08";
const FILES = ["./", "index.html", "styles.css", "app.js", "engine.js", "store.js", "firebase.js", "config.js", "seed.json", "versao.json", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  const proprio = u.origin === location.origin;
  const fontes = u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com";
  if (!proprio && !fontes) return; // Firestore e Auth tratam da sua própria rede
  // Rede primeiro (para receber atualizações), cache se não houver rede
  e.respondWith(fetch(e.request).then((r) => {
    const copia = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copia));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match("index.html"))));
});
