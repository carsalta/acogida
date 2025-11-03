import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useConfig } from '../hooks/useConfig';
import { isAdmin, signOutAdmin } from '../lib/admin';
import Section from '../components/Section';
import Dashboard from './Dashboard';
import QuestionsEditor from './QuestionsEditor';
import { ALL_LANGS, LANG_LABEL, getEnabledLangs } from '../lib/langs';

// Convierte cualquier formato a una URL string usable
const toUrl = (v) => {
    if (typeof v === 'string') return v;
    return v?.youtube || v?.mp4 || v?.url || '';
};

export default function Admin() {
    if (!isAdmin()) return <div style={{ padding: 24 }}>No autorizado</div>;

    const { cfg, saveOverrides, resetOverrides } = useConfig();
    const [qrImg, setQrImg] = useState({});
    const [site, setSite] = useState('');

    const sites = useMemo(() => Object.keys(cfg?.sites || {}), [cfg]);
    const enabledLangs = useMemo(() => getEnabledLangs(cfg), [cfg]);

    useEffect(() => { if (cfg && !site) setSite(sites[0] || ''); }, [cfg, sites, site]);

    const currentVideos = useMemo(() => {
        if (!cfg) return {};
        return site ? (cfg.sites?.[site]?.videos || {}) : (cfg.videos || {});
    }, [cfg, site]);

    if (!cfg) return <div style={{ padding: 24 }}>Cargando…</div>;

    const toggle = (k) => saveOverrides({ ...cfg, [k]: !(cfg?.[k] ?? false) });

    const setVideoPath = (type, lang, path) => {
        const next = { ...(cfg || {}) };
        if (site && next.sites?.[site]) {
            next.sites = {
                ...next.sites,
                [site]: {
                    ...(next.sites[site] || {}),
                    videos: {
                        ...(next.sites[site]?.videos || {}),
                        [type]: { ...(next.sites[site]?.videos?.[type] || {}), [lang]: path }
                    }
                }
            };
        } else {
            next.videos = {
                ...(next.videos || {}),
                [type]: { ...(next.videos?.[type] || {}), [lang]: path }
            };
        }
        saveOverrides(next);
    };

    const downloadCfg = () => {
        const blob = new Blob([JSON.stringify(cfg || {}, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'config.json';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const activeBrand = site ? (cfg?.sites?.[site]?.brand || {}) : (cfg?.brand || {});
    const setBrandField = (key, val) => {
        const next = { ...(cfg || {}) };
        if (site && next.sites?.[site]) {
            next.sites = {
                ...next.sites,
                [site]: { ...(next.sites[site] || {}), brand: { ...(next.sites[site]?.brand || {}), [key]: val } }
            };
        } else {
            next.brand = { ...(next.brand || {}), [key]: val };
        }
        saveOverrides(next);
    };

    const mailEnabled = !!cfg?.mail?.enabled;
    const mailApiBase = cfg?.mail?.apiBase || '';
    const mailApiKey = cfg?.mail?.apiKey || '';
    const mailCC = (cfg?.mail?.cc || []).join(', ');

    const onToggleLang = (lang, checked) => {
        const cur = getEnabledLangs(cfg);
        const next = checked ? Array.from(new Set([...cur, lang])) : cur.filter(l => l !== lang);
        const safe = next.length ? next : ['es', 'en'];
        const dl = safe.includes(cfg?.defaultLang) ? cfg?.defaultLang : safe[0];
        saveOverrides({ ...(cfg || {}), enabledLangs: safe, defaultLang: dl });
    };
    const onChangeDefaultLang = (lang) => {
        const safe = getEnabledLangs(cfg);
        if (!safe.includes(lang)) return;
        saveOverrides({ ...(cfg || {}), defaultLang: lang });
    };

    const base = location.origin + location.pathname;

    return (
        <div style={{ padding: 24, display: 'grid', gap: 24 }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontWeight: 700, fontSize: 18 }}>Panel Admin</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-outline" onClick={() => resetOverrides()}>Reset overrides</button>
                    <button className="btn btn-outline" onClick={signOutAdmin}>Salir</button>
                </div>
            </header>

            <Section id="dash" title="Estadísticas" defaultOpen={true}><Dashboard /></Section>

            <Section id="flags" title="Ajustes / Feature flags" defaultOpen={true}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="checkbox" checked={!!cfg.allowSeek} onChange={() => toggle('allowSeek')} />
                    Permitir adelantar (seek)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <input type="checkbox" checked={!!cfg.allowSubtitles} onChange={() => toggle('allowSubtitles')} />
                    Habilitar subtítulos
                </label>
            </Section>

            <Section id="langs" title="Idiomas (habilitar y por defecto)" defaultOpen={true}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Habilitados</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {ALL_LANGS.map(l => (
                                <label key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <input
                                        type="checkbox"
                                        checked={enabledLangs.includes(l)}
                                        onChange={e => onToggleLang(l, e.target.checked)}
                                    />
                                    {LANG_LABEL[l]}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Idioma por defecto</div>
                        <select className="border rounded" style={{ padding: '4px 8px' }} value={cfg.defaultLang} onChange={e => onChangeDefaultLang(e.target.value)}>
                            {enabledLangs.map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
                        </select>
                    </div>
                </div>
            </Section>

            <Section id="site" title="Sitio / Planta" defaultOpen={false}>
                {sites.length > 0 ? (
                    <select className="border rounded" style={{ padding: '4px 8px' }} value={site} onChange={e => setSite(e.target.value)}>
                        {sites.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                ) : (
                    <p style={{ fontSize: 14, color: '#64748b' }}>No hay sitios definidos. Se usarán rutas globales.</p>
                )}
            </Section>

            <Section id="branding" title={`Branding (${site || 'global'})`} defaultOpen={false}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>Nombre (brand.name)</span>
                        <input className="border rounded" style={{ padding: '4px 8px' }} placeholder="Mi Organización o Nombre de Planta" defaultValue={activeBrand?.name || ''} onBlur={(e) => setBrandField('name', e.target.value.trim())} />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>Color primario (brand.primary)</span>
                        <input type="color" className="border rounded" style={{ height: 40, width: 100, padding: 4 }} defaultValue={activeBrand?.primary || '#0ea5e9'} onBlur={(e) => setBrandField('primary', e.target.value)} />
                    </label>
                    <label style={{ display: 'grid', gap: 4, gridColumn: '1 / span 2' }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>Logo URL (brand.logo)</span>
                        <input className="border rounded" style={{ padding: '4px 8px' }} placeholder="brand/logo.png o https://..." defaultValue={activeBrand?.logo || ''} onBlur={(e) => setBrandField('logo', e.target.value.trim())} />
                        <p style={{ fontSize: 12, color: '#64748b' }}>Sube el archivo a <code>public/brand/</code> y referencia con <code>brand/tu-logo.png</code> (sin barra inicial), o usa un enlace público.</p>
                    </label>
                    {activeBrand?.logo && (
                        <div style={{ gridColumn: '1 / span 2' }}>
                            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Previsualización</div>
                            <img
                                src={activeBrand.logo.startsWith('http') ? activeBrand.logo : (import.meta.env.BASE_URL + activeBrand.logo.replace(/^\//, ''))}
                                alt="preview-logo"
                                style={{ height: 48, width: 'auto', border: '1px solid #e2e8f0', borderRadius: 6, objectFit: 'contain' }}
                            />
                        </div>
                    )}
                </div>
            </Section>

            <Section
                id="videos"
                title={`Vídeos por idioma (${site || 'global'})`}
                defaultOpen={true}
                right={<button className="btn btn-outline" onClick={downloadCfg}>Descargar config.json</button>}
            >
                {['visita', 'contrata'].map(type => (
                    <div key={type} style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12, marginTop: 8 }}>
                        <h4 className="font-semibold" style={{ textTransform: 'uppercase' }}>{type}</h4>
                        {enabledLangs.map(lang => {
                            const current = currentVideos?.[type]?.[lang];
                            const shown = toUrl(current);
                            return (
                                <div key={lang} style={{ display: 'grid', gap: 8, gridTemplateColumns: '80px 1fr', alignItems: 'center', marginTop: 8 }}>
                                    <label className="w-16" style={{ textTransform: 'uppercase' }}>{LANG_LABEL[lang]}</label>
                                    <input
                                        className="border rounded"
                                        style={{ padding: '4px 8px' }}
                                        placeholder={`videos/${lang}/${type}.mp4`}
                                        defaultValue={shown}
                                        onBlur={(e) => setVideoPath(type, lang, e.target.value.trim())}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}
            </Section>

            <Section id="questions" title="Editor de preguntas" defaultOpen={false}>
                <QuestionsEditor />
            </Section>

            <Section id="mail" title="Correo (M365 Graph vía API)" defaultOpen={false}>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>Habilitado</span>
                        <input
                            type="checkbox"
                            defaultChecked={mailEnabled}
                            onChange={(e) => saveOverrides({ ...(cfg || {}), mail: { ...(cfg?.mail || {}), enabled: e.target.checked } })}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>API Base (Azure Function)</span>
                        <input
                            className="border rounded"
                            style={{ padding: '4px 8px' }}
                            placeholder="https://<tu-funcion>.azurewebsites.net/api"
                            defaultValue={mailApiBase}
                            onBlur={(e) => saveOverrides({ ...(cfg || {}), mail: { ...(cfg?.mail || {}), apiBase: e.target.value.trim() } })}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>API Key (X-API-KEY)</span>
                        <input
                            className="border rounded"
                            style={{ padding: '4px 8px' }}
                            placeholder="clave secreta"
                            defaultValue={mailApiKey}
                            onBlur={(e) => saveOverrides({ ...(cfg || {}), mail: { ...(cfg?.mail || {}), apiKey: e.target.value.trim() } })}
                        />
                    </label>
                    <label style={{ display: 'grid', gap: 4 }}>
                        <span style={{ fontSize: 14, color: '#334155' }}>CC (separar por coma)</span>
                        <input
                            className="border rounded"
                            style={{ padding: '4px 8px' }}
                            placeholder="rrhh@empresa.com, prevencion@empresa.com"
                            defaultValue={mailCC}
                            onBlur={(e) => saveOverrides({ ...(cfg || {}), mail: { ...(cfg?.mail || {}), cc: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })}
                        />
                    </label>
                </div>
            </Section>

            <Section id="share" title="Compartir (enlaces + QR)" defaultOpen={false}>
                <p style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>
                    Genera enlaces por tipo e idioma habilitado. Si hay site, añade <code>?site=...</code>.
                </p>
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
                    {['visita', 'contrata'].flatMap(type =>
                        enabledLangs.map(lang => {
                            const url = `${base}?lang=${lang}&type=${type}` + (site ? `&site=${encodeURIComponent(site)}` : '');
                            const k = `${type}_${lang}_${site || 'global'}`;
                            const title = `${type.toUpperCase()} · ${LANG_LABEL[lang]} ${site ? `· ${site}` : ''}`;
                            return (
                                <div style={{ padding: 12, border: '1px solid #e2e8f0', borderRadius: 8 }} key={k}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{title}</div>
                                            <a style={{ color: '#0369a1', textDecoration: 'underline', wordBreak: 'break-all' }} href={url} target="_blank" rel="noreferrer">{url}</a>
                                        </div>
                                        <button
                                            className="btn"
                                            onClick={async () => {
                                                const data = await QRCode.toDataURL(url, { margin: 1, scale: 6 });
                                                setQrImg(m => ({ ...m, [k]: data }));
                                            }}
                                        >
                                            Generar QR
                                        </button>
                                    </div>
                                    {qrImg[k] && <img alt={`qr-${k}`} src={qrImg[k]} style={{ marginTop: 8, height: 160, width: 160 }} />}
                                </div>
                            );
                        })
                    )}
                </div>
            </Section>
        </div>
    );
}