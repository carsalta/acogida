
/* Service Worker para acogida (GitHub Pages / local)
   - Network-first para HTML y assets (JS/CSS) => siempre cogemos lo último si hay red
   - Limpieza automática de cachés antiguos por versión
   - Broadcast al activar nueva versión para recargar las páginas controladas
*/

/** 💡 Cambia la versión en cada publicación (o inyecta con tu plugin si prefieres) */
const VERSION = '2025-12-18-01';
const CACHE = `acogida-cache-${VERSION}`;

const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, '/');
const INDEX = `${BASE}index.html`;

/** Precarga mínima (root + index) para fallback */
const PRECACHE = [BASE, INDEX];

/* ===== Install: precache e iniciar inmediatamente ===== */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE)
            .then((c) => c.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

/* ===== Activate: limpia cachés viejos y toma control ===== */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))
            ))
            .then(() => self.clients.claim())
            .then(async () => {
                // 🔔 Avisa a todas las páginas: hay una nueva versión -> recarga
                const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
                for (const client of clients) {
                    client.postMessage({ type: 'NEW_VERSION', version: VERSION });
                }
            })
    );
});

/* ===== Fetch: estrategias ===== */
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    if (req.method !== 'GET') return;

    const isSameOrigin = url.origin === self.location.origin;
    const isNavigation = req.mode === 'navigate' || req.destination === 'document';
    const isIndexHtml = isSameOrigin && (
        url.pathname === BASE || url.pathname === INDEX || /\/index\.html$/.test(url.pathname)
    );

    const isExternalApi =
        !isSameOrigin ||
        /(youtube\.com|youtu\.be|script\.google\.com)$/i.test(url.hostname);

    const isDynamicJson =
        isSameOrigin && /\/(config\.json|overrides\.json)$/i.test(url.pathname);

    const hasSearch = !!url.search; // ?id=..., ?v=...

    /* ---- 1) Navegación / index.html -> NETWORK-FIRST ---- */
    if (isNavigation || isIndexHtml) {
        event.respondWith(
            fetch(new Request(req, { cache: 'reload' }))   // fuerza revalidación del index
                .then((res) => {
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, clone));
                    return res;
                })
                .catch(() => caches.match(req).then((r) => r || caches.match(INDEX)))
        );
        return;
    }

    /* ---- 2) Externos / dinámicos / con query -> NETWORK-ONLY ---- */
    if (isExternalApi || isDynamicJson || hasSearch) {
        event.respondWith(fetch(req).catch(() => caches.match(req)));
        return;
    }

    /* ---- 3) Assets JS/CSS same-origin -> NETWORK-FIRST + fallback ---- */
    const isScript = req.destination === 'script';
    const isStyle = req.destination === 'style';
    if (isSameOrigin && (isScript || isStyle)) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    if (res.ok && res.type === 'basic') {
                        const clone = res.clone();
                        caches.open(CACHE).then((c) => c.put(req, clone));
                    }
                    return res;
                })
                .catch(() => caches.match(req)) // sin red: usa caché si existe
        );
        return;
    }

    /* ---- 4) Imágenes / fuentes -> STALE-WHILE-REVALIDATE ---- */
    const isImage = req.destination === 'image';
    const isFont = req.destination === 'font';
    if (isSameOrigin && (isImage || isFont)) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const networkFetch = fetch(req)
                    .then((res) => {
                        if (res.ok && res.type === 'basic') {
                            const clone = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, clone));
                        }
                        return res;
                    })
                    .catch(() => cached);
                return cached || networkFetch;
            })
        );
        return;
    }

    /* ---- 5) Default -> NETWORK-FIRST suave ---- */
    event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* ===== Mensajes desde las páginas (opcional) ===== */
self.addEventListener('message', (event) => {
    // Si una página pide "SKIP_WAITING", activamos inmediata (útil si no quieres esperar al ciclo normal)
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
