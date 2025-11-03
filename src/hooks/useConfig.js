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

// Merge profundo con política: base + override(no vacío)
function mergeCfg(base = {}, ov = {}) {
    const out = { ...base, ...ov };

    // brand
    out.brand = { ...(base?.brand || {}), ...(ov?.brand || {}) };

    // videos (por módulo y por idioma)
    const baseVideos = base?.videos || {};
    const ovVideos = ov?.videos || {};
    out.videos = {};
    for (const key of new Set([...Object.keys(baseVideos), ...Object.keys(ovVideos)])) {
        const b = baseVideos[key] || {};
        const o = ovVideos[key] || {};
        out.videos[key] = { ...b, ...stripEmpty(o) }; // ⚠️ el override vacío NO pisa
    }

    // sites (brand + videos por sitio)
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
            mergedVideos[key] = { ...(bV[key] || {}), ...stripEmpty(oV[key] || {}) };
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

// Si la versión base cambia, invalida overrides
function resolveOverridesForBase(base, raw) {
    if (!raw) return {};
    // Soporta formato antiguo (sin __baseVersion)
    const { __baseVersion, data } = raw.__baseVersion ? raw : { __baseVersion: null, data: raw };
    const bver = base?.version || null;
    if (bver && __baseVersion && __baseVersion !== bver) {
        // versión incompatible: limpiamos overrides
        localStorage.removeItem(LS_KEY);
        return {};
    }
    return stripEmpty(data || {});
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
            const ov = resolveOverridesForBase(baseRef.current || {}, raw);
            setCfg((prev) => normalize(mergeCfg(prev || {}, ov)));
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
        // asegura booleanos y limpia vacíos
        const safe = stripEmpty({
            ...over,
            ...(over.hasOwnProperty('allowSeek') ? { allowSeek: toBool(over.allowSeek) } : {}),
            ...(over.hasOwnProperty('allowSubtitles') ? { allowSubtitles: toBool(over.allowSubtitles) } : {})
        });
        const wrapped = {
            __baseVersion: baseRef.current?.version || null,
            data: safe
        };
        localStorage.setItem(LS_KEY, JSON.stringify(wrapped));
        window.dispatchEvent(new Event('config:changed'));
        setCfg((cur) => normalize(mergeCfg(cur || {}, safe)));
    };

    const resetOverrides = () => {
        localStorage.removeItem(LS_KEY);
        window.dispatchEvent(new Event('config:changed'));
        reload();
    };

    return { cfg, saveOverrides, resetOverrides, reload };
}