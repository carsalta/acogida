
// src/lib/registry.remote.js

/**
 * Consulta (GET) al Web App de Google Apps Script.
 * - Si se pasa certId -> busca por certId
 * - Si no -> dni/email normalizados en servidor
 * - months controla fallback si no hay expiryISO en el registro
 * - apiKey se envía en query (el servidor la exige si la tiene configurada)
 */
export async function checkRemote({ apiBase, months, dni, email, certId, apiKey }) {
    if (!apiBase) throw new Error('checkRemote: missing apiBase');

    const url = new URL(apiBase);
    if (certId) url.searchParams.set('certId', certId);
    else {
        url.searchParams.set('dni', dni ?? '');
        url.searchParams.set('email', email ?? '');
    }
    url.searchParams.set('months', (months ?? 36).toString());
    if (apiKey) url.searchParams.set('apiKey', apiKey);

    const res = await fetch(url.toString(), {
        method: 'GET',      // simple request -> sin preflight
        cache: 'no-store'
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`checkRemote failed: ${res.status} ${text}`);
    }
    return await res.json(); // { found, isValid, monthsElapsed, record }
}

/**
 * Inserción/actualización (POST) en Google Apps Script.
 * - Body como text/plain con JSON para evitar preflight CORS
 * - apiKey en el cuerpo
 */
export async function upsertRemote({ apiBase, payload }) {
    if (!apiBase) throw new Error('upsertRemote: missing apiBase');
    if (!payload) throw new Error('upsertRemote: missing payload');

    const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // evita OPTIONS
        body: JSON.stringify(payload),
        cache: 'no-store'
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`upsertRemote failed: ${res.status} ${text}`);
    }
    return await res.json(); // { ok, rowUpdated }
}