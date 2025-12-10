
// src/components/PolicyGate.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * Props:
 *  - title: string
 *  - url: string (PDF o PPT/PPTX)
 *  - mustScroll: boolean (default true)
 *  - mustAcknowledge: boolean (default true)
 *  - labels: { openDoc, mustRead, ackLabel, scrollHint, toastReady, toastNeedScroll, toastNeedAck }
 *  - onStatusChange: (ok: boolean) => void  // ok = scrolledToEnd && ack
 *  - isKiosk?: boolean
 *
 * Render de visor compatible:
 *  - PDF → Google Viewer
 *  - PPT/PPTX → Office Viewer
 */
export default function PolicyGate({
    title,
    url,
    mustScroll = true,
    mustAcknowledge = true,
    labels = {},
    onStatusChange,
    isKiosk = false
}) {
    const [scrolledToEnd, setScrolledToEnd] = useState(!mustScroll);
    const [ack, setAck] = useState(!mustAcknowledge);
    const [opened, setOpened] = useState(false);

    const containerRef = useRef(null);

    // URL del visor (evita bloqueos X-Frame-Options/CSP)
    const [effectiveUrl, setEffectiveUrl] = useState(url || '');

    useEffect(() => {
        if (!url) return setEffectiveUrl('');
        const lower = url.toLowerCase();
        const isPdf = lower.endsWith('.pdf');
        const isOffice = lower.endsWith('.ppt') || lower.endsWith('.pptx');

        if (isPdf) {
            setEffectiveUrl(
                `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(url)}`
            );
            return;
        }
        if (isOffice) {
            setEffectiveUrl(
                `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
            );
            return;
        }
        setEffectiveUrl(url);
    }, [url]);

    // Habilitación: SOLO scroll final + aceptación
    useEffect(() => {
        const ok = scrolledToEnd && ack;
        onStatusChange?.(ok);
    }, [scrolledToEnd, ack, onStatusChange]);

    // Detectar scroll hasta el final en el contenedor
    const onScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
        if (atBottom) setScrolledToEnd(true);
    };

    // Toast dinámico
    const ok = scrolledToEnd && ack;
    const toast = (() => {
        if (!scrolledToEnd) {
            return {
                color: '#ef4444',
                bg: '#fee2e2',
                text: labels.toastNeedScroll || 'Desplázate hasta el final del documento para continuar.'
            };
        }
        if (mustAcknowledge && !ack) {
            return {
                color: '#b45309',
                bg: '#fef3c7',
                text: labels.toastNeedAck || 'Marca la casilla de aceptación para continuar.'
            };
        }
        return {
            color: '#166534',
            bg: '#ecfdf5',
            text: labels.toastReady || 'Política leída y aceptada. Puedes continuar.'
        };
    })();

    return (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>

            {/* Abrir en pestaña nueva (opcional) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                        window.open(url, '_blank', 'noopener,noreferrer');
                        setOpened(true);
                    }}
                >
                    {labels.openDoc || 'Abrir documento'}
                </button>
                {!opened && (
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                        {labels.mustRead || 'Debes revisar el documento completo.'}
                    </span>
                )}
            </div>

            {/* Visor embebido + scroll requerido */}
            {effectiveUrl && (
                <>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                        {labels.scrollHint ||
                            'Desplázate hasta el final del documento para habilitar la aceptación.'}
                    </div>
                    <div
                        ref={containerRef}
                        onScroll={onScroll}
                        style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            height: isKiosk ? '60vh' : 420,
                            overflow: 'auto',
                            background: '#fff'
                        }}
                    >
                        <iframe
                            title={title}
                            src={effectiveUrl}
                            style={{ width: '100%', height: isKiosk ? '60vh' : 800, border: 0 }}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                    </div>
                </>
            )}

            {/* Aceptación */}
            {mustAcknowledge && (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                        type="checkbox"
                        checked={ack}
                        onChange={(e) => setAck(e.target.checked)}
                    />
                    <span>{labels.ackLabel || 'He leído y acepto la Política.'}</span>
                </label>
            )}

            {/* Estado informativo */}
            <div style={{ fontSize: 13, color: '#64748b' }}>
                {`Documento abierto: ${opened ? 'sí' : 'no'} · scroll final: ${scrolledToEnd ? 'sí' : 'no'
                    } · aceptación: ${ack ? 'sí' : 'no'}`}
            </div>

            {/* Toast */}
            <div
                role="status"
                aria-live="polite"
                style={{
                    marginTop: 8,
                    border: `1px solid ${toast.color}66`,
                    background: toast.bg,
                    color: toast.color,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                }}
            >
                <span aria-hidden="true" style={{ fontWeight: 700 }}>
                    {ok ? '✓' : (!scrolledToEnd ? '⚠' : '!')}
                </span>
                <span style={{ fontSize: 14 }}>{toast.text}</span>
            </div>
        </section>
    );
}
