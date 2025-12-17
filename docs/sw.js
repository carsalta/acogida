
self.addEventListener('fetch', (event) => {
    const req = event.request;
    const url = new URL(req.url);

    // Sólo GET; no interceptamos POST/PUT...
    if (req.method !== 'GET') return;

    const isSameOrigin = url.origin === location.origin;
    const isNavigation = req.mode === 'navigate';
    const isIndexHtml = isSameOrigin && url.pathname.endsWith('/index.html');
    const hasSearch = !!url.search; // ?id=..., ?v=...

    // Endpoints externos o que NO queremos cachear
    const isExternalApi =
        !isSameOrigin ||
        /(^|\.)youtube\.com$|(^|\.)youtu\.be$|script\.google\.com$/i.test(url.hostname);

    const isDynamicJson =
        isSameOrigin && /\/(config\.json|overrides\.json)$/i.test(url.pathname);

    // ==== 1) Navegaciones e index.html -> NETWORK-FIRST ====
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
                    caches.match(req).then((r) => r || caches.match('./index.html'))
                )
        );
        return; // cerramos el caso de navegación
    }

    // ==== 2) Externos / dinámicos -> NETWORK-ONLY (sin cache) ====
    if (isExternalApi || isDynamicJson || hasSearch) {
        event.respondWith(
            fetch(req).catch(() => caches.match(req)) // si falla, intenta caché (puede no existir)
        );
        return;
    }

    // ==== 3) Estáticos same-origin -> STALE-WHILE-REVALIDATE ====
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

                // stale-while-revalidate: si hay caché, la devuel        // stale-while-revalidate: si hay caché, la devuelvo inmediata y revalido en segundo plano
                return cached || networkFetch;
            })
        );
    }