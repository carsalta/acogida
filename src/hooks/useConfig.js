import { useEffect, useState } from 'react';

const LS_KEY = 'appConfigOverrides'; // overrides locales (solo navegador)

export function useConfig() {
    const [cfg, setCfg] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                // 1) base config
                const rBase = await fetch(import.meta.env.BASE_URL + 'config.json', { cache: 'no-store' });
                const base = await rBase.json();

                // 2) overrides compartidos (versionados en Git): public/overrides.json (si existe)
                let shared = {};
                try {
                    const rShared = await fetch(import.meta.env.BASE_URL + 'overrides.json', { cache: 'no-store' });
                    if (rShared.ok) shared = await rShared.json();
                } catch (e) {
                    // Si no existe aún, seguimos con shared vacío
                }

                // 3) overrides locales (por navegador), para no romper tu flujo actual
                const local = JSON.parse(localStorage.getItem(LS_KEY) || '{}');

                // 4) merge en orden: base <- shared <- local
                setCfg(mergeCfg(mergeCfg(base, shared), local));
            } catch (e) {
                // fallback mínimo funcional
                setCfg({
                    defaultLang: 'es',
                    enabledLangs: ['es', 'en'],
                    allowSeek: false,
                    allowSubtitles: true,
                    videos: {},
                    sites: {}
                });
            }
        };
        load();
    }, []);

    // Guarda overrides en la capa local (para tu sesión).
    // Para que sea compartido, exporta y sube public/overrides.json (ver botón en Admin).
    const saveOverrides = (over) => {
        localStorage.setItem(LS_KEY, JSON.stringify(over));
        setCfg((c) => mergeCfg(c || {}, over));
    };

    const resetOverrides = () => {
        localStorage.removeItem(LS_KEY);
        location.reload();
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