
/* Service Worker para acogida (GitHub Pages / local) */

/** Sube versión al cambiar lógica de caché */
const CACHE = 'acogida-cache-v2';

/** Deriva la base desde el scope de registro (p.ej., '/acogida/') */
const BASE = new URL(self.registration.scope).pathname.replace(/\/+$/, '/');

/** Fallback de index relativo a BASE */
const INDEX = `${BASE}index.html`;

/** Precarga mínima (raíz + index) */
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
    );
});

/* ===== Fetch: estrategias por tipo de petición ===== */
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Sólo GET; no interceptamos POST/PUT...
    if (req.method !== 'GET') return;

    const isSameOrigin = url.origin === self.location.origin;
    const isNavigation = req.mode === 'navigate' || req.destination === 'document';
    const isIndexHtml = isSameOrigin && (
        url.pathname === BASE || url.pathname === INDEX || /\/index\.html$/.test(url.pathname)
    );
    const hasSearch = !!url.search; // ?id=..., ?v=...

    // Endpoints externos o que NO queremos cachear
    const isExternalApi =
        !isSameOrigin ||
        /(youtube\.com|youtu\.be|script\.google\.com)$/i.test(url.hostname);

    // JSON dinámico (config y overrides) -> no cache persistente
    const isDynamicJson =
        isSameOrigin && /\/(config\.json|overrides\.json)$/i.test(url.pathname);

    /* ---- 1) Navegación / index.html -> NETWORK-FIRST ---- */
    if (isNavigation || isIndexHtml) {
        event.respondWith(
            fetch(req)
                .then((res) => {
                    // Guarda copia para fallback
                    const clone = res.clone();
                    caches.open(CACHE).then((c) => c.put(req, clone));
                    return res;
                })
                .catch(() =>
                    // Fallback si estamos offline
                    caches.match(req).then((r) => r || caches.match(INDEX))
                )
        );
        return;
    }

    /* ---- 2) Externos / dinámicos / con query -> NETWORK-ONLY ---- */
    if (isExternalApi || isDynamicJson || hasSearch) {
        event.respondWith(
            fetch(req).catch(() => caches.match(req)) // si falla, intenta caché (puede no existir)
        );
        return;
    }

    /* ---- 3) Assets estáticos same-origin -> STALE-WHILE-REVALIDATE ---- */
    // Sólo assets: script/style/image/font (no documentos/JSON)
    const isAsset = ['script', 'style', 'image', 'font'].includes(req.destination);

    if (isSameOrigin && isAsset) {
        event.respondWith(
            caches.match(req).then((cached) => {
                const networkFetch = fetch(req)
                    .then((res) => {
                        // Cachea sólo respuestas básicas same-origin correctas
                        if (res.ok && res.type === 'basic') {
                            const clone = res.clone();
                            caches.open(CACHE).then((c) => c.put(req, clone));
                        }
                        return res;
                    })
                    .catch(() => cached); // si fallo de red, devuelve caché si existe

                // stale-while-revalidate: si hay caché, la devuelvo inmediata y revalido en segundo plano
                return cached || networkFetch;
            })
        );
        return;
    }

    /* ---- 4) Default -> NETWORK-FIRST suave ---- */
    event.respondWith(
        fetch(req).catch(() => caches.match(req))
    );
});