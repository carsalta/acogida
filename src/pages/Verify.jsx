
// src/pages/Verify.jsx
import React, { useEffect, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { checkRemote } from '../lib/registry.remote';

/**
 * Componente de verificación de certificados por QR/URL.
 * - Admite parámetros ?id=<certId> y ?certId=<certId>
 * - Usa months de config (fallback 36) para la lógica de validez remota
 * - Muestra fechas localizadas y días restantes/caducado
 */
export default function Verify({ c }) {
    const { cfg } = useConfig();
    const [status, setStatus] = useState({ loading: true, error: null, data: null });

    // Idioma UI para formatear fechas (es/en/fr/de/pt...)
    const uiLang = (navigator.language || 'es').slice(0, 2);

    useEffect(() => {
        const p = new URLSearchParams(location.search);
        const certId = p.get('id') || p.get('certId') || ''; // el QR usa ?id=<certId>
        const months = cfg?.registry?.months ?? 36;           // 3 años por defecto
        const apiBase = cfg?.registry?.apiBase;
        const apiKey = cfg?.registry?.apiKey;

        (async () => {
            try {
                if (!apiBase) {
                    setStatus({ loading: false, error: 'Falta apiBase en config.json', data: null });
                    return;
                }
                if (!certId) {
                    setStatus({ loading: false, error: c?.verifyPage?.notfound || 'No encontrado', data: null });
                    return;
                }
                // Lookup remoto por certId (Sheets/DB según tu backend)
                const r = await checkRemote({ apiBase, months, certId, apiKey });
                setStatus({ loading: false, error: null, data: r });
            } catch (err) {
                setStatus({ loading: false, error: err.message, data: null });
            }
        })();
    }, [cfg, c]);

    if (status.loading) {
        return <div className="card">Cargando…</div>;
    }

    if (status.error) {
        return (
            <div className="card" style={{ borderColor: '#ef4444', background: '#fee2e2' }}>
                <p className="text-xl">Error</p>
                <p>{status.error}</p>
                <a className="btn" style={{ marginTop: 12 }} href={location.pathname}>
                    {c?.newStart || 'Nuevo intento'}
                </a>
            </div>
        );
    }

    const r = status.data;
    if (!r?.found) {
        return (
            <div className="card" style={{ borderColor: '#ef4444', background: '#fee2e2' }}>
                <p className="text-xl">{c?.verifyPage?.notfound || 'No encontrado'}</p>
                <a className="btn" style={{ marginTop: 12 }} href={location.pathname}>
                    {c?.newStart || 'Nuevo intento'}
                </a>
            </div>
        );
    }

    const rec = r.record;
    const valid = !!r.isValid;

    // Helpers de formato y contador
    const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(uiLang) : '—');
    const daysLeft =
        rec?.expiryISO ? Math.ceil((new Date(rec.expiryISO).getTime() - Date.now()) / 86400000) : null;
    const vigenciaText =
        typeof daysLeft === 'number'
            ? daysLeft >= 0
                ? `· ${daysLeft} día${daysLeft === 1 ? '' : 's'} restantes`
                : `· ${Math.abs(daysLeft)} día${Math.abs(daysLeft) === 1 ? '' : 's'} caducado`
            : '';

    return (
        <div
            className="card"
            style={{
                borderColor: valid ? '#22c55e' : '#ef4444',
                background: valid ? '#ecfdf5' : '#fee2e2'
            }}
        >
            <p style={{ color: '#64748b' }}>{c?.verifyPage?.checking || 'Comprobando…'}</p>

            <p className={valid ? 'text-green-700 text-xl' : 'text-amber-700 text-xl'}>
                {valid ? (c?.verifyPage?.valid || '✓ Certificado válido') : (c?.verifyPage?.expired || '⚠ Certificado caducado')}
            </p>

            <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                <span><strong>DNI:</strong> {rec?.dni || '—'}</span>
                <span><strong>Email:</strong> {rec?.email || '—'}</span>
                <span><strong>Nombre:</strong> {rec?.name || '—'}</span>
                <span><strong>Empresa:</strong> {rec?.company || '—'}</span>
                <span><strong>Sitio:</strong> {rec?.site || '—'}</span>
                <span><strong>Tipo:</strong> {rec?.type || '—'}</span>
                <span><strong>Emitido:</strong> {fmt(rec?.issueISO)}</span>
                <span><strong>Caducidad:</strong> {fmt(rec?.expiryISO)} {vigenciaText}</span>
                <span><strong>CertId:</strong> {rec?.certId || '—'}</span>
            </div>

            <a className="btn" style={{ marginTop: 12 }} href={location.pathname}>
                {c?.newStart || 'Nuevo intento'}
            </a>
        </div>
    );
}