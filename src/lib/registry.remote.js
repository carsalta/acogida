
// src/lib/registry.remote.js

/**
 * Chequeo remoto en Sheets.
 * - Si se pasa certId, busca por certId.
 * - Si no, busca por dni/email (normalizados en servidor).
 * - months controla el fallback si no hay expiryISO en el registro.
 */
export async function checkRemote({ apiBase, months, dni, email, certId, apiKey }) {
    const url = new URL(apiBase);

    if (certId) {
        url.searchParams.set('certId', certId);
    } else {
        url.searchParams.set('dni', dni || '');
        url.searchParams.set('email', email || '');
    }

    url.searchParams.set('months', (months ?? 36).toString());
    if (apiKey) url.searchParams.set('apiKey', apiKey); // en query; evitar headers custom

    const res = await fetch(url.toString(), {
        method: 'GET' // sin headers -> no preflight CORS
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`checkRemote failed: ${res.status} ${text}`);
    }

    return await res.json(); // { found, isValid, monthsElapsed, record }
}

/**
 * Inserción/actualización en Sheets.
 * - Enviar siempre body como text/plain (JSON string) para evitar preflight CORS.
 */
export async function upsertRemote({ apiBase, payload }) {
    const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // evita OPTIONS
        body: JSON.stringify(payload),
        cache: 'no-store' // opcional
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`upsertRemote failed: ${res.status} ${text}`);
    }

    return await res.json(); // { ok, rowUpdated }
}