
// src/App.jsx
import React, { useMemo, useState, useEffect } from 'react';
import Stepper from './components/Stepper';
import VideoGate from './components/VideoGate';
import Quiz from './components/Quiz';
import Verify from './pages/Verify';
import { getContent } from './i18n';
import { buildCertificate } from './lib/certificates';
import { v4 as uuidv4 } from 'uuid';
import { useConfig } from './hooks/useConfig';
import Admin from './admin/Admin';
import { ensureAdmin } from './lib/admin';
import { getEnabledLangs, LANG_LABEL } from './lib/langs';
import { checkRemote, upsertRemote } from './lib/registry.remote';
import { sendMail, blobToBase64 } from './lib/email';
import PolicyGate from './components/PolicyGate.jsx';

const stepsES = ["Datos", "Vídeo", "Test", "Certificado"];
const stepsEN = ["Details", "Video", "Test", "Certificate"];
const stepsFR = ["Données", "Vidéo", "Test", "Certificat"];
const stepsDE = ["Daten", "Video", "Test", "Zertifikat"];
const stepsPT = ["Dados", "Vídeo", "Teste", "Certificado"];

const fallbackVideos = {
    visita: { es: 'videos/es/visita.mp4', en: 'videos/en/visita.mp4', fr: 'videos/fr/visita.mp4', de: 'videos/de/visita.mp4', pt: 'videos/pt/visita.mp4', minutes: 6 },
    contrata: { es: 'videos/es/contrata.mp4', en: 'videos/en/contrata.mp4', fr: 'videos/fr/contrata.mp4', de: 'videos/de/contrata.mp4', pt: 'videos/pt/contrata.mp4', minutes: 15 }
};

function tracks(type, lang, langs) {
    if (!type) return [];
    return (langs ?? []).map(l => ({
        src: `${import.meta.env.BASE_URL}subtitles/${type}.${l}.vtt`,
        srclang: l,
        label: LANG_LABEL[l],
        default: lang === l
    }));
}
function abs(p) {
    if (!p) return '';
    if (p.startsWith('http') || p.startsWith('data:')) return p;
    return p.startsWith('/')
        ? (import.meta.env.BASE_URL + p.replace(/^\/,/, '').replace(/^\/+/, ''))
        : (import.meta.env.BASE_URL + p);
}

export default function App() {
    const { cfg } = useConfig();
    const [lang, setLang] = useState('es');
    const [route, setRoute] = useState('home');
    const [type, setType] = useState(null);
    const [participant, setParticipant] = useState(() => JSON.parse(localStorage.getItem('participant') || '{}'));
    const [site, setSite] = useState('');
    const [kiosk, setKiosk] = useState(false);
    const enabledLangs = React.useMemo(() => getEnabledLangs(cfg), [cfg]);

    // NUEVO: estado de la pasarela de política
    const [policyOk, setPolicyOk] = useState(false);

    // NUEVO: estado para aviso de exención (registro previo válido)
    const [existingRecord, setExistingRecord] = useState(null);

    useEffect(() => {
        const p = new URLSearchParams(location.search);
        if (p.get('lang')) setLang(p.get('lang'));
        if (p.get('id')) setRoute('verify');
        if (p.get('site')) setSite(p.get('site'));
        if (p.get('kiosk') === '1') {
            setKiosk(true);
            document.body.classList.add('kiosk');
            if (document.fullscreenEnabled) document.documentElement.requestFullscreen().catch(() => { });
        }
    }, []);

    useEffect(() => { if (cfg?.forceLang) setLang(cfg.forceLang); }, [cfg?.forceLang]);
    useEffect(() => {
        if (!site) {
            const first = Object.keys(cfg?.sites ?? {})[0] ?? '';
            setSite(first);
        }
    }, [cfg, site]);

    const c = useMemo(() => getContent(lang), [lang]);
    const steps = lang === 'es' ? stepsES : lang === 'en' ? stepsEN : lang === 'fr' ? stepsFR : lang === 'de' ? stepsDE : stepsPT;
    const current = route === 'home' ? 0 : route === 'form' ? 0 : route === 'video' ? 1 : route === 'quiz' ? 2 : 3;

    // BRANDING activo: site.brand > global.brand
    const brand = useMemo(() => (site && cfg?.sites?.[site]?.brand) ? cfg.sites[site].brand : (cfg?.brand ?? null), [cfg, site]);
    useEffect(() => { if (brand?.primary) { document.documentElement.style.setProperty('--brand', brand.primary); } }, [brand?.primary]);

    const startType = (t) => { setType(t); setRoute('form'); setExistingRecord(null); };

    // NUEVO: helper para descargar certificado (por exención)
    async function downloadExistingCertificate(record) {
        // Si el registro remoto ya tiene certId/fechas, lo respetamos; si no, generamos nuevo
        const id = record?.certId || uuidv4();
        const issue = record?.issueISO ? new Date(record.issueISO) : new Date();
        const expiry = record?.expiryISO ? new Date(record.expiryISO) : (() => {
            const m = type === 'contrata' ? 12 : 24;
            const d = new Date(issue);
            d.setMonth(d.getMonth() + m);
            return d;
        })();

        const verifyUrl = `${location.origin}${location.pathname}?id=${id}`;
        const blob = await buildCertificate({
            lang,
            name: participant?.name || record?.name || '',
            idDoc: participant?.idDoc || record?.dni || '',
            company: participant?.company || record?.company || '',
            type: type || record?.type || '',
            certId: id,
            issueDate: issue.toLocaleDateString(lang),
            expiryDate: expiry.toLocaleDateString(lang),
            verifyUrl
        });

        // Descarga directa
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `certificado-${id}.pdf`; a.click();
        URL.revokeObjectURL(url);

        // Envío por email (si está activado)
        try {
            if (cfg?.mail?.enabled) {
                const b64 = await blobToBase64(blob);
                const subj = (lang === 'es' ? 'Certificado de Inducción' :
                    (lang === 'pt' ? 'Certificado de Instruções de Segurança' :
                        (lang === 'fr' ? 'Certificat de Sécurité' :
                            (lang === 'de' ? 'Sicherheitszertifikat' : 'Induction Certificate'))));
                const html = `<p>${lang === 'es' ? 'Adjuntamos su certificado de inducción.' : 'Please find attached your induction certificate.'}</p>`;
                await sendMail({
                    apiBase: cfg?.mail?.apiBase,
                    apiKey: cfg?.mail?.apiKey,
                    to: (participant?.email || record?.email),
                    cc: cfg?.mail?.cc ?? [],
                    subject: subj,
                    html,
                    attachment: { name: `certificado-${id}.pdf`, mime: 'application/pdf', contentBase64: b64 }
                });
            }
        } catch (e) { console.error('sendMail (exemption) error', e); }

        setRoute('done');
    }

    const onFormSubmit = async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const data = {
            name: f.get('name')?.trim(),
            idDoc: f.get('idDoc')?.trim(),
            company: f.get('company')?.trim(),
            email: f.get('email')?.trim()
        };
        if (!data.name || !data.idDoc || !data.company || !data.email) {
            alert(lang === 'es' ? 'Completa todos los campos' : 'Fill all fields');
            return;
        }
        // NUEVO: exige política leída/aceptada
        const siteCfg = site ? cfg.sites?.[site] : null;
        const policyCfg = siteCfg?.policy ?? cfg?.policy;
        const policyUrl = policyCfg?.url;
        if (policyUrl && !policyOk) {
            alert(lang === 'es'
                ? 'Debes leer y aceptar la Política antes de continuar.'
                : 'You must read and acknowledge the Policy before continuing.'
            );
            return;
        }

        // Guardamos datos en estado y local
        setParticipant(data);
        localStorage.setItem('participant', JSON.stringify(data));

        // NUEVO: Chequeo remoto previo (exención)
        const validityMonths = cfg?.registry?.months ?? 36;
        const apiBase = cfg?.registry?.apiBase;
        const apiKey = cfg?.registry?.apiKey;

        try {
            if (apiBase) {
                const r = await checkRemote({
                    apiBase,
                    months: validityMonths,
                    dni: data.idDoc,
                    email: data.email,
                    apiKey
                });
                if (r?.found && r?.isValid) {
                    // Mostrar aviso de exención; guardamos el registro más reciente
                    setExistingRecord(r.record);
                    // No avanzamos al vídeo hasta que el usuario decida (descargar/continuar/cambiar)
                    return;
                }
            }
        } catch (err) {
            console.warn('Remote check failed, continue locally', err);
        }

        setRoute('video');
    };

    const onVideoFinished = () => setRoute('quiz');

    const onQuizPassed = async () => {
        const id = uuidv4();
        const issue = new Date();
        const months = type === 'contrata' ? 12 : 24;
        const expiry = new Date(issue); expiry.setMonth(expiry.getMonth() + months);
        const verifyUrl = `${location.origin}${location.pathname}?id=${id}`;
        const certs = JSON.parse(localStorage.getItem('certs') || '[]');
        certs.push({ id, expiry: expiry.toISOString() });
        localStorage.setItem('certs', JSON.stringify(certs));

        const blob = await buildCertificate({
            lang,
            name: participant.name,
            idDoc: participant.idDoc,
            company: participant.company,
            type,
            certId: id,
            issueDate: issue.toLocaleDateString(lang),
            expiryDate: expiry.toLocaleDateString(lang),
            verifyUrl
        });

        // Envío por email (si está activado)
        try {
            if (cfg?.mail?.enabled) {
                const b64 = await blobToBase64(blob);
                const subj = (lang === 'es' ? 'Certificado de Inducción' :
                    (lang === 'pt' ? 'Certificado de Instruções de Segurança' :
                        (lang === 'fr' ? 'Certificat de Sécurité' :
                            (lang === 'de' ? 'Sicherheitszertifikat' : 'Induction Certificate'))));
                const html = `<p>${lang === 'es' ? 'Adjuntamos su certificado de inducción.' : 'Please find attached your induction certificate.'}</p>`;
                await sendMail({
                    apiBase: cfg?.mail?.apiBase,
                    apiKey: cfg?.mail?.apiKey,
                    to: participant.email,
                    cc: cfg?.mail?.cc ?? [],
                    subject: subj,
                    html,
                    attachment: { name: `certificado-${id}.pdf`, mime: 'application/pdf', contentBase64: b64 }
                });
            }
        } catch (e) { console.error('sendMail error', e); }

        // NUEVO: Upsert remoto antes de finalizar
        try {
            if (cfg?.registry?.apiBase) {
                await upsertRemote({
                    apiBase: cfg.registry.apiBase,
                    payload: {
                        apiKey: cfg?.registry?.apiKey ?? '',
                        dni: participant.idDoc,
                        email: participant.email,
                        name: participant.name,
                        company: participant.company,
                        site,
                        type,
                        certId: id,
                        issueDate: issue.toISOString(),
                        expiryDate: expiry.toISOString()
                    }
                });
            }
        } catch (err) {
            console.error('upsertRemote error', err);
        }

        // Descarga del PDF generado
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `certificado-${id}.pdf`; a.click();
        URL.revokeObjectURL(url);

        setRoute('done');
    };

    if (!cfg) return <div style={{ padding: 24 }}>Cargando configuración…</div>;

    const siteCfg = site ? cfg.sites?.[site] : null;
    const srcCfg = type ? (siteCfg?.videos?.[type]?.[lang] ?? cfg?.videos?.[type]?.[lang]) : '';
    const srcFbk = type ? (fallbackVideos?.[type]?.[lang]) : '';
    const videoUrl = srcCfg ?? srcFbk ?? '';
    const subTracks = tracks(type, lang, enabledLangs);
    const brandLogo = brand?.logo ? (brand.logo.startsWith('http') ? brand.logo : abs(brand.logo)) : null;

    // NUEVO: datos de política (sitio > global), canalizados a PolicyGate
    const policyCfg = siteCfg?.policy ?? cfg?.policy;
    const policyTitle = policyCfg?.title?.[lang] ?? policyCfg?.title?.['es'] ?? c?.policy?.header ?? 'Política';
    const policyUrlAbs = policyCfg?.url ? abs(policyCfg.url) : '';

    if (route === 'verify') {
        return (
            <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 24 }}>
                <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    {brandLogo && (<img src={brandLogo} alt={brand?.name ?? 'Logo'} style={{ height: 32, width: 'auto', borderRadius: 4, objectFit: 'contain' }} />)}
                    <h1 style={{ fontSize: 24, fontWeight: 700 }}>{brand?.name ?? c.title ?? 'Inducción'}</h1>
                    <LangPicker lang={lang} setLang={setLang} langs={enabledLangs} />
                    <AdminBtn onClick={async () => { const ok = await ensureAdmin(); if (ok) setRoute('admin'); }} />
                </header>
                <Verify c={c} />
            </div>
        );
    }

    if (route === 'admin') return <div style={{ minHeight: '100vh', background: '#f1f5f9' }}><Admin /></div>;

    return (
        <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: 24 }}>
            <header style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                {brandLogo && (<img src={brandLogo} alt={brand?.name ?? 'Logo'} style={{ height: 32, width: 'auto', borderRadius: 4, objectFit: 'contain' }} />)}
                <h1 style={{ fontSize: 24, fontWeight: 700 }}>{brand?.name ?? c.title ?? 'Inducción'}</h1>
                <LangPicker lang={lang} setLang={setLang} langs={enabledLangs} />
                <SitePicker cfg={cfg} site={site} setSite={setSite} />
                <AdminBtn onClick={async () => { const ok = await ensureAdmin(); if (ok) setRoute('admin'); }} />
                {kiosk && document.fullscreenElement && (
                    <button
                        className="btn btn-outline"
                        style={{ marginLeft: 'auto' }}
                        onClick={() => { document.exitFullscreen?.(); location.replace(location.pathname); }}
                    >Salir kiosco</button>
                )}
            </header>

            <div style={{ marginTop: 16 }}><Stepper steps={steps} current={current} /></div>

            {route === 'home' && (
                <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr', marginTop: 24 }}>
                    <section className="card">
                        <span className="badge">{c.visitBadge}</span>
                        <h3 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>{c.visitTitle}</h3>
                        <p style={{ color: '#475569' }}>{c.visitDesc}</p>
                        <button className="btn" style={{ marginTop: 12 }} onClick={() => startType('visita')}>{c.visitBtn}</button>
                    </section>
                    <section className="card">
                        <span className="badge">{c.contractorBadge}</span>
                        <h3 style={{ fontSize: 20, fontWeight: 600, marginTop: 8 }}>{c.contractorTitle}</h3>
                        <p style={{ color: '#475569' }}>{c.contractorDesc}</p>
                        <button className="btn" style={{ marginTop: 12 }} onClick={() => startType('contrata')}>{c.contractorBtn}</button>
                    </section>
                </div>
            )}

            {route === 'form' && (
                <div style={{ marginTop: 24, display: 'grid', gap: 16 }}>
                    {/* NUEVO: Aviso de exención si hay registro válido */}
                    {existingRecord && (
                        <section className="card" style={{ border: '1px solid #22c55e55', background: '#ecfdf5' }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#166534', marginBottom: 8 }}>
                                {lang === 'es' ? 'Registro válido encontrado' : 'Valid record found'}
                            </h3>
                            <p style={{ color: '#065f46', marginBottom: 8 }}>
                                {lang === 'es'
                                    ? 'Hemos encontrado un registro vigente. Puedes descargar el certificado directamente o continuar igualmente.'
                                    : 'We found a valid record. You can download the certificate directly or continue anyway.'}
                            </p>
                            <div style={{ display: 'grid', gap: 6, fontSize: 14, color: '#047857' }}>
                                <span><strong>DNI:</strong> {existingRecord.dni || '—'}</span>
                                <span><strong>Email:</strong> {existingRecord.email || '—'}</span>
                                <span><strong>Nombre:</strong> {existingRecord.name || '—'}</span>
                                <span><strong>Empresa:</strong> {existingRecord.company || '—'}</span>
                                <span><strong>Emitido:</strong> {existingRecord.issueISO ? new Date(existingRecord.issueISO).toLocaleDateString(lang) : '—'}</span>
                                <span><strong>Caducidad:</strong> {existingRecord.expiryISO ? new Date(existingRecord.expiryISO).toLocaleDateString(lang) : '—'}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                                <button
                                    className="btn"
                                    onClick={() => downloadExistingCertificate(existingRecord)}
                                >
                                    {lang === 'es' ? 'Descargar certificado' : 'Download certificate'}
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setExistingRecord(null); setRoute('video'); }}
                                >
                                    {lang === 'es' ? 'Continuar igualmente' : 'Continue anyway'}
                                </button>
                                <button
                                    className="btn btn-outline"
                                    onClick={() => { setExistingRecord(null); /* deja al usuario editar campos */ }}
                                >
                                    {lang === 'es' ? 'Cambiar datos' : 'Change data'}
                                </button>
                            </div>
                        </section>
                    )}

                    <form className="card" style={{ display: 'grid', gap: 12 }} onSubmit={onFormSubmit}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#64748b' }}>
                            <button type="button" className="btn btn-outline" onClick={() => { setRoute('home'); setType(null); }}>
                                ← {lang === 'es' ? 'Volver' : 'Back'}
                            </button>
                            <span></span>
                            <span>{c.startVideo}</span>
                        </div>

                        <Field label={c.fields.name}><input name="name" defaultValue={participant?.name ?? ''} className="border rounded" style={{ padding: '8px 12px', width: '100%' }} required /></Field>
                        <Field label={c.fields.id}><input name="idDoc" defaultValue={participant?.idDoc ?? ''} className="border rounded" style={{ padding: '8px 12px', width: '100%' }} required /></Field>
                        <Field label={c.fields.company}><input name="company" defaultValue={participant?.company ?? ''} className="border rounded" style={{ padding: '8px 12px', width: '100%' }} required /></Field>
                        <Field label={c.fields.email}><input type="email" name="email" defaultValue={participant?.email ?? ''} className="border rounded" style={{ padding: '8px 12px', width: '100%' }} required /></Field>

                        {/* NUEVO: PASARELA DE POLÍTICA */}
                        {policyUrlAbs && (
                            <PolicyGate
                                title={policyTitle}
                                url={policyUrlAbs}
                                mustScroll={!!policyCfg?.mustScroll}
                                mustAcknowledge={!!policyCfg?.mustAcknowledge}
                                labels={c.policy}
                                isKiosk={kiosk}
                                onStatusChange={(ok) => setPolicyOk(ok)}
                            />
                        )}

                        {/* Botón bloqueado si no se ha leído/aceptado */}
                        <button className="btn" type="submit" disabled={policyUrlAbs ? !policyOk : false}>
                            {c.startVideo}
                        </button>
                    </form>
                </div>
            )}

            {route === 'video' && type && (
                <div className="card" style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{c.videoTitle?.[type]}</h3>
                    <p style={{ color: '#475569', marginBottom: 12 }}>{c.mustWatch}</p>
                    <VideoGate src={videoUrl} tracks={subTracks} allowSeek={!!cfg.allowSeek} allowSubtitles={!!cfg.allowSubtitles} onDone={onVideoFinished} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                        <button className="btn btn-outline" onClick={() => { setRoute('form'); }}>← {lang === 'es' ? 'Atrás' : 'Back'}</button>
                        <span style={{ fontSize: 14, color: '#64748b' }}>{(fallbackVideos?.[type]?.minutes ?? cfg?.videos?.[type]?.minutes ?? 0)} min</span>
                    </div>
                </div>
            )}

            {route === 'quiz' && (
                <div className="card" style={{ marginTop: 24 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>{c.quizTitle}</h3>
                    <Quiz
                        items={(c.questions?.[type] ?? [])}
                        checkLabel={c.checkBtn}
                        wrongLabel={c.wrong}
                        onPass={onQuizPassed}
                        onRetry={() => { setRoute('home'); setType(null); }}
                        retryLabel={c.finishAndRetry ?? (lang === 'es' ? 'Finalizar y nuevo intento' : 'Finish & New attempt')}
                    />
                </div>
            )}

            {route === 'done' && (
                <div className="card" style={{ marginTop: 24 }}>
                    <p style={{ fontSize: 18 }}>{c.done}</p>
                    <p style={{ color: '#475569' }}>{c.verifyHint}</p>
                    <button className="btn" style={{ marginTop: 12 }} onClick={() => { setRoute('home'); setType(null); }}>
                        {c.finish ?? (lang === 'es' ? 'Finalizar' : 'Finish')}
                    </button>
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <label style={{ display: 'grid', gap: 4 }}>
            <span style={{ fontSize: 14, color: '#334155' }}>{label}</span>
            {children}
        </label>
    );
}
function LangPicker({ lang, setLang, langs }) {
    return (
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="border rounded" style={{ padding: '4px 8px' }}>
            {langs.map(l => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
        </select>
    );
}
function SitePicker({ cfg, site, setSite }) {
    const sites = Object.keys(cfg?.sites ?? {});
    if (!sites.length) return null;
    return (
        <select value={site} onChange={(e) => setSite(e.target.value)} className="border rounded" style={{ padding: '4px 8px' }}>
            {sites.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
    );
}
function AdminBtn({ onClick }) {
    return <button className="btn" style={{ marginLeft: 'auto' }} onClick={onClick}>Admin</button>;
}