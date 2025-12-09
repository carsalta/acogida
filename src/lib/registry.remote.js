
// src/lib/registry.remote.js

export async function checkRemote({ apiBase, months, dni, email, apiKey }) {
    const url = new URL(apiBase);
    url.searchParams.set('dni', dni || '');
    url.searchParams.set('email', email || '');
    url.searchParams.set('months', (months ?? 36).toString());
    // Evitar headers custom: apiKey va en la query
    if (apiKey) url.searchParams.set('apiKey', apiKey);

    const res = await fetch(url.toString(), {
        method: 'GET' // sin headers -> no preflight
    });

    if (!res.ok) {
        // Propaga información útil del error (si la hay)
        const text = await res.text().catch(() => '');
        throw new Error(`checkRemote failed: ${res.status} ${text}`);
    }

    return await res.json(); // {found,isValid,monthsElapsed,record}
}

export async function upsertRemote({ apiBase, payload }) {
    // Evitar preflight: usar text/plain y sin headers custom
    const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        cache: 'no-store' // opcional
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`upsertRemote failed: ${res.status} ${text}`);
    }

    return await res.json(); // {ok,rowUpdated}
}