// src/lib/admin.js

// Clave donde guardamos la sesión de admin en localStorage
const ADMIN_SESSION_KEY = 'admin:session';
// TTL de la sesión: 8h (ajústalo si quieres)
const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/** ¿Hay sesión de admin activa? */
export function isAdmin() {
    try {
        const raw = localStorage.getItem(ADMIN_SESSION_KEY);
        if (!raw) return false;
        const obj = JSON.parse(raw);
        if (!obj || obj.v !== 1) return false;
        if (obj.exp && Date.now() > obj.exp) {
            localStorage.removeItem(ADMIN_SESSION_KEY);
            return false;
        }
        return true;
    } catch {
        return false;
    }
}

/** Cerrar sesión de admin. */
export function signOutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
}

/** Persistir sesión de admin con TTL. */
function persistAdminSession(ttlMs = ADMIN_SESSION_TTL_MS) {
    const exp = ttlMs > 0 ? Date.now() + ttlMs : null;
    const data = { v: 1, exp };
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data));
}

/** Normaliza nombres de algoritmo a los que acepta Web Crypto. */
function normalizeAlgo(a) {
    let s = String(a || 'SHA-256').trim().toUpperCase().replace(/_/g, '-');
    // Aceptar variantes sin guion
    if (s === 'SHA256') s = 'SHA-256';
    if (s === 'SHA1') s = 'SHA-1';
    if (s === 'SHA384') s = 'SHA-384';
    if (s === 'SHA512') s = 'SHA-512';
    return s;
}

/**
 * Pedir código y validarlo contra cfg.admin (hash SHA-256 o password plano legacy).
 * Si valida, persiste sesión y devuelve true.
 *
 * Uso recomendado:
 *   const ok = await ensureAdmin(cfg);
 */
export async function ensureAdmin(cfg) {
    // Si ya hay sesión activa, no pedimos código de nuevo
    if (isAdmin()) return true;

    const admin = cfg?.admin || {};
    const input = window.prompt('Código de administrador:');
    if (input == null) return false;

    // Validación por hash
    if ((admin.method || '').toLowerCase() === 'hash') {
        const algo = normalizeAlgo(admin.algo || 'SHA-256');
        const codeHash = (admin.codeHash || '').trim().toLowerCase();
        if (!codeHash) return false;

        try {
            const enc = new TextEncoder();
            const digest = await crypto.subtle.digest(algo, enc.encode(input));
            const hex = [...new Uint8Array(digest)]
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            const ok = hex === codeHash;
            if (ok) persistAdminSession();
            return ok;
        } catch (e) {
            console.error('ensureAdmin hash error', e);
            return false;
        }
    }

    // Fallback legacy con password plano (por compatibilidad)
    if (admin.password) {
        const ok = (input === admin.password);
        if (ok) persistAdminSession();
        return ok;
    }

    return false;
}