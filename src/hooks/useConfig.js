
import { useEffect, useState } from 'react';

const LS_KEY = 'appConfigOverrides'; // overrides locales (solo navegador)

function safeReadLocalOverrides() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem(LS_KEY);
            return raw ? JSON.parse(raw) : {};
        }
    } catch {
        /* ignore */
    }
    return {};
}

function safeWriteLocalOverrides(over) {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(LS_KEY, JSON.stringify(over));
        }
    } catch {
        /* ignore */
    }
}

function safeClearLocalOverrides() {
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.removeItem(LS_KEY);
        }
    } catch {
        /* ignore */
    }
}

/** Inyecta ENV de Vite en la config resultante */
function injectEnv(cfg) {
    const REG_BASE = import.meta.env.VITE_REGISTRY_API_BASE;
    const REG_KEY = import.meta.env.VITE_REGISTRY_API_KEY;

    const out = { ...cfg };
    out.registry = {
        ...(cfg?.registry ?? {}),
        apiBase: REG_BASE || cfg?.registry?.apiBase || '',
        apiKey: REG_KEY || cfg?.registry?.apiKey || ''
    };
    return out;
}

export function useConfig() {
    const [cfg, setCfg] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                // 1) base config
                const rBase = await fetch(import.meta.env.BASE_URL + 'config.json', { cache: 'no-store' });
                const base = await rBase.json();

                // 2) overrides compartidos (docs/overrides.json en producción)
                let shared = {};
                try {
                    const rShared = await fetch(import.meta.env.BASE_URL + 'overrides.json', { cache: 'no-store' });
                    if (rShared.ok) shared = await rShared.json();
                } catch {
                    /* si no existe, seguimos con shared = {} */
                }

                // 3) overrides locales (solo navegador)
                const local = safeReadLocalOverrides();

                // 4) merge: base <- shared <- local
                const merged = mergeCfg(mergeCfg(base, shared), local);

                // 5) inyección ENV (apiBase/apiKey) sin tocar config.json
                setCfg(injectEnv(merged));
            } catch {
                // fallback minimo funcional (tambien con ENV inyectadas)
                setCfg(injectEnv({
                    defaultLang: 'es',
                    enabledLangs: ['es', 'en'],
                    allowSeek: false,
                    allowSubtitles: true,
                    videos: {},
                    sites: {}
                }));
            }
        };
        load();
    }, []);

    const saveOverrides = (over) => {
        safeWriteLocalOverrides(over);
        setCfg((c) => injectEnv(mergeCfg(c || {}, over)));
    };

    const resetOverrides = () => {
        safeClearLocalOverrides();
        if (typeof window !== 'undefined') window.location.reload();
    };

    return { cfg, saveOverrides, resetOverrides };
}

function mergeCfg(a, b) {
    const out = { ...a, ...b };
    out.brand = { ...(a?.brand || {}), ...(b?.brand || {}) };
    out.videos = { ...(a?.videos || {}), ...(b?.videos || {}) };
    out.questions = { ...(a?.questions || {}), ...(b?.questions || {}) };

    out.sites = {};
    const aSites = a?.sites || {};
    const bSites = b?.sites || {};
    for (const k of new Set([...Object.keys(aSites), ...Object.keys(bSites)])) {
        out.sites[k] = {
            ...(aSites[k] || {}),
            ...(bSites[k] || {}),
            brand: { ...(aSites[k]?.brand || {}), ...(bSites[k]?.brand || {}) },
            videos: { ...(aSites[k]?.videos || {}), ...(bSites[k]?.videos || {}) },
            questions: { ...(aSites[k]?.questions || {}), ...(bSites[k]?.questions || {}) }
        };
    }
    return out;
}
