
import React, { useEffect, useMemo, useState } from 'react';
import { useConfig } from '../hooks/useConfig';
import { checkRemote } from '../lib/registry.remote';

function daysLeft(expiryISO) {
    if (!expiryISO) return null;
    const end = new Date(expiryISO).getTime();
    const now = Date.now();
    return Math.ceil((end - now) / (1000 * 60 * 60 * 24));
}

export default function Verify({ c }) {
    const { cfg } = useConfig();

    // Lee ?id=... de la URL
    const id = useMemo(() => {
        try {
            const p = new URLSearchParams(window.location.search);
            return (p.get('id') || '').trim();
        } catch {
            return '';
        }
    }, []);

    // phase: 'idle' | 'loading' | 'ok' | 'error'
    const [state, setState] = useState({ phase: 'idle', data: null, error: '' });

    useEffect(() => {
        // 1) Aún no hay config -> esperamos (no mostramos error)
        if (!cfg) return;

        const apiBase = cfg.registry?.apiBase || '';
        const apiKey = cfg.registry?.apiKey || '';

        // 2) Ya hay config y sigue sin apiBase -> ahora sí, error
        if (!apiBase) {
            setState({ phase: 'error', data: null, error: 'Falta apiBase (configuración no inicializada)' });
            return;
        }

        // 3) Falta el parámetro id
        if (!id) {
            setState({ phase: 'error', data: null, error: 'Falta id en la URL (?id=...)' });
            return;
        }

        // 4) Consultamos sólo cuando cfg + id están listos
        let cancelled = false;
        setState({ phase: 'loading', data: null, error: '' });

        checkRemote({ apiBase, months: cfg?.registry?.months ?? 36, certId: id, apiKey })
            .then((res) => {
                if (cancelled) return;
                if (!res || res.error) {
                    setState({ phase: 'error', data: null, error: res?.error || 'Error desconocido en verificación' });
                    return;
                }
                if (!res.found) {
                    setState({ phase: 'error', data: null, error: 'No encontrado' });
                    return;
                }
                setState({ phase: 'ok', data: res, error: '' });
            })
            .catch((e) => {
                if (cancelled) return;
                setState({ phase: 'error', data: null, error: String(e?.message || e) });
            });

        return () => { cancelled = true; };
    }, [cfg, id]);

    // ====== Render ======

    // Aún cargando la config -> nada de errores
    if (!cfg) {
        return (
            <section className="card" style={{ background: '#eef2ff' }}>
                <p style={{ fontSize: 16, color: '#334155' }}>Cargando configuración…</p>
            </section>
        );
    }

    if (state.phase === 'error') {
        return (
            <section className="card" style={{ border: '1px solid #fecaca', background: '#fee2e2' }}>
                <p style={{ fontSize: 16, color: '#991b1b' }}>Error</p>
                <p style={{ color: '#7f1d1d' }}>{state.error}</p>
                <button
                    className="btn"
                    style={{ marginTop: 12 }}
                    onClick={() => window.location.replace(window.location.pathname)}
                >
                    Nuevo intento
                </button>
            </section>
        );
    }

    if (state.phase === 'loading' || state.phase === 'idle') {
        return (
            <section className="card" style={{ background: '#ecfeff', border: '1px solid #bae6fd' }}>
                <p style={{ fontSize: 16, color: '#0c4a6e' }}>Comprobando…</p>
            </section>
        );
    }

    // OK
    const rec = state.data?.record ?? {};
    const dleft = daysLeft(rec.expiryISO);
    const validBadge = state.data?.isValid ? '✓ Certificado válido' : '⚠ Certificado caducado';

    return (
        <section className="card" style={{ border: '1px solid #86efac', background: '#ecfdf5' }}>
            <p style={{ fontSize: 16, color: '#166534' }}>{validBadge}</p>
            <div style={{ display: 'grid', gap: 4, fontSize: 14, color: '#065f46' }}>
                <span><strong>DNI:</strong> {rec.dni || '—'}</span>
                <span><strong>Email:</strong> {rec.email || '—'}</span>
                <span><strong>Nombre:</strong> {rec.name || '—'}</span>
                <span><strong>Empresa:</strong> {rec.company || '—'}</span>
                <span><strong>Sitio:</strong> {rec.site || '—'}</span>
                <span><strong>Tipo:</strong> {rec.type || '—'}</span>
                <span><strong>Emitido:</strong> {rec.issueISO ? new Date(rec.issueISO).toLocaleDateString() : '—'}</span>
                <span>
                    <strong>Caducidad:</strong> {rec.expiryISO ? new Date(rec.expiryISO).toLocaleDateString() : '—'}
                    {typeof dleft === 'number' && <> · {dleft} días restantes</>}
        </span>
                <span><strong>CertId:</strong> {rec.certId || id}</span>
            </div>

            <button
                className="btn"
                style={{ marginTop: 12 }}
                onClick={() => window.location.replace(window.location.pathname)}
            >
                Nuevo intento
            </button>
        </section>
    );
}