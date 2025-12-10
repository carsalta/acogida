
// src/pages/Verify.jsx
import React, { useEffect, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { checkRemote } from '../lib/registry.remote';

export default function Verify({ c }) {
    const { cfg } = useConfig();
    const [status, setStatus] = useState({ loading: true, error: null, data: null });

    useEffect(() => {
        const p = new URLSearchParams(location.search);
        const certId = p.get('id') || p.get('certId') || '';   // el QR usa ?id=<certId>
        const months = cfg?.registry?.months ?? 36;
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
                const r = await checkRemote({ apiBase, months, certId, apiKey }); // <-- lookup por certId en Sheets
                setStatus({ loading: false, error: null, data: r });
            } catch (err) {
                setStatus({ loading: false, error: err.message, data: null });
            }
        })();
    }, [cfg, c]);

    if (status.loading) return <div className="card">Cargando…</div>;
    if (status.error) return (
        <div className="card" style={{ borderColor: '#ef4444', background: '#fee2e2' }}>
            <p className="text-xl">Error</p>
            <p>{status.error}</p>
            <a className="btn" style={{ marginTop: 12 }} href={location.pathname}>
                {c?.newStart || 'Nuevo intento'}
            </a>
        </div>
    );

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

    return (
        <div className="card" style={{ borderColor: valid ? '#22c55e' : '#ef4444', background: valid ? '#ecfdf5' : '#fee2e2' }}>
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
                <span><strong>Emitido:</strong> {rec?.issueISO ? new Date(rec.issueISO).toLocaleDateString() : '—'}</span>
                <span><strong>Caducidad:</strong> {rec?.expiryISO ? new Date(rec.expiryISO).toLocaleDateString() : '—'}</span>
                <span><strong>CertId:</strong> {rec?.certId || '—'}</span>
            </div>

            <a className="btn" style={{ marginTop: 12 }} href={location.pathname}>
                {c?.newStart || 'Nuevo intento'}
            </a>
        </div>
    );
}
