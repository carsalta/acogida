
// src/hooks/useConfig.js
import { useEffect, useState, useCallback } from 'react';

const LS_KEY = 'appConfigOverrides';

// Convierte textos/numéricos a boolean real
const toBool = (v) => v === true || v === 'true' || v === 1 || v === '1';

// Fusión profunda para las claves que te importan
function mergeCfg(a = {}, b = {}) {
    const out = { ...a, ...b };

    out.brand = { ...(a?.brand || {}), ...(b?.brand || {}) };
    out.videos = { ...(a?.videos || {}), ...(b?.videos || {}) };

    // Sites con merges internos (brand/videos)
    const aSites = a?.sites || {};
    const bSites = b?.sites || {};
    out.sites = {};
    for (const k of new Set([...Object.keys(aSites), ...Object.keys(bSites)])) {
        out.sites[k] = {
            ...(aSites[k] || {}),
            ...(bSites[k] || {}),
            brand: { ...(aSites[k]?.brand || {}), ...(bSites[k]?.brand || {}) },
            videos: { ...(aSites[k]?.videos || {}), ...(bSites[k]?.videos || {}) }
        };
    }

    return out;
}

// Normaliza flags a booleanos y aplica defaults seguros
function normalize(cfg) {
    if (!cfg) return cfg;
    return {
        // defaults por si el fetch falla
        defaultLang: 'es',
        enabledLangs: ['es', 'en'],
        allowSeek: false,
        allowSubtitles: true,
        videos: {},
        sites: {},
        // mezcla real
        ...cfg,
        // ⚠️ flags normalizados (aunque vengan como "true"/"false" del Admin)
        allowSeek: toBool(cfg.allowSeek),
        allowSubtitles: toBool(cfg.allowSubtitles)
    };
}

// Carga base/config.json respetando BASE_URL (GitHub Pages)
async function loadBaseConfig() {
    const url = new URL('config.json', import.meta.env.BASE_URL).toString();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Config HTTP ${res.status}`);
    return res.json();
}

function readOverrides() {
    try {
        const raw = localStorage.getItem(LS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function useConfig() {
    const [cfg, setCfg] = useState(null);

    const reload = useCallback(async () => {
        try {
            const base = await loadBaseConfig();
            const ov = readOverrides();
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
            const ov = readOverrides();
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

    // Guarda overrides y actualiza estado (normalizando)
    const saveOverrides = (over) => {
        // 🔒 Asegura que los flags se guardan como booleanos reales
        const safe = {
            ...over,
            ...(over.hasOwnProperty('allowSeek') ? { allowSeek: toBool(over.allowSeek) } : {}),
            ...(over.hasOwnProperty('allowSubtitles') ? { allowSubtitles: toBool(over.allowSubtitles) } : {})
        };
        localStorage.setItem(LS_KEY, JSON.stringify(safe));
        // notifica (útil para Admin en misma pestaña)
        window.dispatchEvent(new Event('config:changed'));
        // actualiza estado con merge+normalize
        setCfg((cur) => normalize(mergeCfg(cur || {}, safe)));
    };

    const resetOverrides = () => {
        localStorage.removeItem(LS_KEY);
        window.dispatchEvent(new Event('config:changed'));
        // puedes recargar o re‑leer sin refrescar la página:
        reload();
    };

    return { cfg, saveOverrides, resetOverrides, reload };
}