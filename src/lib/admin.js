// src/lib/admin.js
export async function ensureAdmin(cfg) {
    const admin = cfg?.admin || {};
    const input = window.prompt('Código de administrador:');
    if (input == null) return false;

    // Método por hash
    if ((admin.method || '').toLowerCase() === 'hash') {
        const algo = (admin.algo || 'SHA-256').toUpperCase(); // 'sha256' -> 'SHA-256'
        try {
            const enc = new TextEncoder();
            const digest = await crypto.subtle.digest(algo, enc.encode(input));
            const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
            return hex === (admin.codeHash || '').toLowerCase();
        } catch (e) {
            console.error('ensureAdmin hash error', e);
            return false;
        }
    }

    // Fallback (legacy) con password plano
    if (admin.password) {
        return input === admin.password;
    }

    return false;
}