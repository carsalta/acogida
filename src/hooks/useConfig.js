// src/hooks/useConfig.js
import { useEffect, useState, useCallback, useRef } from 'react';
const LS_KEY = 'appConfigOverrides';

// Convierte textos/numéricos a boolean real
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

// Profundiza y elimina claves vacías ('' | null | undefined)
function stripEmpty(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(stripEmpty);
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (v === '' || v === null || typeof v === 'undefined') continue;
        out[k] = typeof v === 'object' ? stripEmpty(v) : v;
    }
    return out;
}

// 👇 NUEVO: coerción a URL string
function toUrl(v) {
    if (typeof v === 'string') return v;
    return v?.youtube || v?.mp4 || v?.url || '';
}
function coerceLangMap(obj = {}) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) out[k] = toUrl(v);
    return out;
}

// Merge profundo con política: base + override(no vacío)
// ⚠️ Protege los campos sensibles de admin para que NUNCA los pise un override local.
function mergeCfg(base = {}, ov = {}) {
    const out = { ...base, ...ov };

    // brand
    out.brand = { ...(base?.brand || {}), ...(ov?.brand || {}) };

    // admin (protección de credenciales)
    const bAdmin = base?.admin || {};
    const oAdmin = ov?.admin || {};
    out.admin = { ...bAdmin, ...oAdmin };
    if (bAdmin.method) out.admin.method = bAdmin.method;
    if (bAdmin.algo) out.admin.algo = bAdmin.algo;
    if (bAdmin.codeHash) out.admin.codeHash = bAdmin.codeHash;

    // --- videos (global) ---  ✅ aplanar por idioma
    const baseVideos = base?.videos || {};
    const ovVideos = ov?.videos || {};
    out.videos = {};
    for (const key of new Set([...Object.keys(baseVideos), ...Object.keys(ovVideos)])) {
        const b = baseVideos[key] || {};
        const o = ovVideos[key] || {};
        out.videos[key] = coerceLangMap({ ...b, ...stripEmpty(o) });
    }

    // --- sites (brand + videos por sitio) ---  ✅ aplanar por idioma
    const baseSites = base?.sites || {};
    const ovSites = ov?.sites || {};
    out.sites = {};
    for (const site of new Set([...Object.keys(baseSites), ...Object.keys(ovSites)])) {
        const bS = baseSites[site] || {};
        const oS = ovSites[site] || {};
        const bV = bS.videos || {};
        const oV = oS.videos || {};
        const mergedVideos = {};
        for (const key of new Set([...Object.keys(bV), ...Object.keys(oV)])) {
            mergedVideos[key] = coerceLangMap({ ...(bV[key] || {}), ...stripEmpty(oV[key] || {}) });
        }
        out.sites[site] = {
            ...bS,
            ...oS,
            brand: { ...(bS.brand || {}), ...(oS.brand || {}) },
            videos: mergedVideos
        };
    }
    return out;
}

// Normaliza flags a booleanos y aplica defaults seguros
function normalize(cfg) {
    if (!cfg) return cfg;
    return {
        // defaults
        defaultLang: 'es',
        enabledLangs: ['es', 'en'],
        allowSeek: false,
        allowSubtitles: true,
        videos: {},
        sites: {},
        ...cfg,
        // flags normalizados
        allowSeek: toBool(cfg.allowSeek),
        allowSubtitles: toBool(cfg.allowSubtitles)
    };
}

// Carga base/config.json respetando BASE_URL (GitHub Pages)
async function loadBaseConfig() {
    const base = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
    const url = `${new URL('config.json', base).toString()}?v=${Date.now()}`; // cache-buster
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Config HTTP ${res.status}`);
    return res.json();
}

function readOverridesRaw() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

// Si la versión base cambia o el override no tiene versión y la base sí, invalida overrides
function resolveOverridesForBase(base, raw) {
    if (!raw) return {};
    // Soporta formato antiguo (sin __baseVersion)
    const hasWrapper = Object.prototype.hasOwnProperty.call(raw, '__baseVersion');
    const __baseVersion = hasWrapper ? raw.__baseVersion : null;
    const data = hasWrapper ? raw.data : raw;
    const bver = base?.version ?? null;
    // ⚠️ Regla: si la base tiene version y el override no la tiene o no coincide, limpiar.
    if (bver && __baseVersion !== bver) {
        localStorage.removeItem(LS_KEY);
        return {};
    }
    return stripEmpty(data ?? {});
}

export function useConfig() {
    const [cfg, setCfg] = useState(null);
    const baseRef = useRef(null); // para saber la versión al guardar
    const reload = useCallback(async () => {
        try {
            const base = await loadBaseConfig();
            baseRef.current = base;
            const raw = readOverridesRaw();
            const ov = resolveOverridesForBase(base, raw);
            setCfg(normalize(mergeCfg(base, ov)));
        } catch {
            // fallback mínimo si falla el fetch
            setCfg(normalize({}));
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    // Reaccionar a cambios del Admin (misma pestaña o distinta)
    useEffect(() => {
        const onStorage = (e) => {
            if (e && e.key && e.key !== LS_KEY) return;
            const raw = readOverridesRaw();
            const ov = resolveOverridesForBase(baseRef.current ?? {}, raw);
            // ⚠️ Recalcular SIEMPRE desde la base actual, no desde prev
            setCfg(() => normalize(mergeCfg(baseRef.current ?? {}, ov)));
        };
        const onCustom = () => onStorage({ key: LS_KEY });
        window.addEventListener('storage', onStorage);
        window.addEventListener('config:changed', onCustom);
        return () => {
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('config:changed', onCustom);
        };
    }, []);

    // Guarda overrides y actualiza estado (normalizando) + versionado
    const saveOverrides = (over) => {
        // ⚠️ No persistir NUNCA admin.* en overrides
        const { admin: _ignoredAdmin, ...rest } = over || {};
        // asegura booleanos y limpia vacíos
        const safe = stripEmpty({
            ...rest,
            ...(over?.hasOwnProperty('allowSeek') ? { allowSeek: toBool(over.allowSeek) } : {}),
            ...(over?.hasOwnProperty('allowSubtitles') ? { allowSubtitles: toBool(over.allowSubtitles) } : {})
        });
        const wrapped = {
            __baseVersion: baseRef.current?.version ?? null,
            data: safe
        };
        localStorage.setItem(LS_KEY, JSON.stringify(wrapped));
        window.dispatchEvent(new Event('config:changed'));
        setCfg((cur) => normalize(mergeCfg(cur ?? {}, safe)));
    };

    const resetOverrides = () => {
        localStorage.removeItem(LS_KEY);
        window.dispatchEvent(new Event('config:changed'));
        reload();
    };

    return { cfg, saveOverrides, resetOverrides, reload };
}
