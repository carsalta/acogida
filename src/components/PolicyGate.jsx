
// src/components/PolicyGate.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * Props:
 *  - title: string
 *  - url: string (PDF o PPT/PPTX)
 *  - mustScroll: boolean (default true)
 *  - mustAcknowledge: boolean (default true)
 *  - labels: { openDoc, mustRead, ackLabel, scrollHint, toastReady, toastNeedScroll, toastNeedAck }
 *  - onStatusChange: (ok: boolean) => void
 *  - isKiosk?: boolean
 *
 * Lógica de habilitación:
 *  ok = scrolledToEnd && ack
 * (abrir en pestaña nueva es opcional; NO participa en la condición)
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

    // Notificación al padre: SOLO scroll final + aceptación
    useEffect(() => {
        const ok = scrolledToEnd && ack;
        onStatusChange?.(ok);
    }, [scrolledToEnd, ack, onStatusChange]);

    // Scroll detector
    const onScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
        if (atBottom) setScrolledToEnd(true);
    };

    const isPdf = url?.toLowerCase().endsWith('.pdf');
    const isOffice = url?.toLowerCase().endsWith('.ppt') || url?.toLowerCase().endsWith('.pptx');

    // ---- Toast computado ----
    const ok = scrolledToEnd && ack;
    const toast = (() => {
        if (!scrolledToEnd) {
            return {
                color: '#ef4444', bg: '#fee2e2',
                text: labels.toastNeedScroll || 'Desplázate hasta el final del documento para continuar.'
            };
        }
        if (mustAcknowledge && !ack) {
            return {
                color: '#b45309', bg: '#fef3c7',
                text: labels.toastNeedAck || 'Marca la casilla de aceptación para continuar.'
            };
        }
        return {
            color: '#166534', bg: '#ecfdf5',
            text: labels.toastReady || 'Política leída y aceptada. Puedes continuar.'
        };
    })();

    return (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>

            {/* Abrir documento en pestaña nueva (OPCIONAL) */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { window.open(url, '_blank', 'noopener,noreferrer'); setOpened(true); }}
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
            {(isPdf || isOffice) && (
                <>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                        {labels.scrollHint || 'Desplázate hasta el final del documento para habilitar la aceptación.'}
                    </div>
                    <div
                        ref={containerRef}
                        onScroll={onScroll}
                        style={{
                            border: '1px solid #e2e8f0', borderRadius: 8,
                            height: isKiosk ? '60vh' : 420,
                            overflow: 'auto',
                            background: '#fff'
                        }}
                    >
                        <iframe
                            title={title}
                            src={url}
                            style={{ width: '100%', height: isKiosk ? '60vh' : 800, border: 0 }}
                            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                        />
                    </div>
                </>
            )}

            {/* Checkbox de aceptación */}
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
                {`Documento abierto: ${opened ? 'sí' : 'no'} · scroll final: ${scrolledToEnd ? 'sí' : 'no'} · aceptación: ${ack ? 'sí' : 'no'}`}
            </div>

            {/* TOAST vivo (stick al bottom de la tarjeta) */}
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
                {/* Icono simple */}
                <span aria-hidden="true" style={{ fontWeight: 700 }}>
                    {ok ? '✓' : (scrolledToEnd ? '!' : '⚠')}
                </span>
                <span style={{ fontSize: 14 }}>{toast.text}</span>
            </div>
        </section>
    );
}
