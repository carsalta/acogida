
// src/components/PolicyGate.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';

/**
 * Props:
 *  - title: string
 *  - url: string (PDF, PPT/PPTX, DOC/DOCX) accesible por HTTPS
 *  - mustScroll: boolean (default true)
 *  - mustAcknowledge: boolean (default true)
 *  - labels: { openDoc, mustRead, ackLabel, scrollHint, toastReady, toastNeedScroll, toastNeedAck }
 *  - onStatusChange: (ok: boolean) => void  // ok = scrolledToEnd && ack
 *  - isKiosk?: boolean
 *  - forceDirectPdf?: boolean                // true = PDF directo (default true)
 */

export default function PolicyGate({
    title,
    url,
    mustScroll = true,
    mustAcknowledge = true,
    labels = {},
    onStatusChange,
    isKiosk = false,
    forceDirectPdf = true,
}) {
    const [scrolledToEnd, setScrolledToEnd] = useState(!mustScroll);
    const [ack, setAck] = useState(!mustAcknowledge);
    const [opened, setOpened] = useState(false);

    const [effectiveUrl, setEffectiveUrl] = useState(url || '');
    const [embedType, setEmbedType] = useState(''); // 'pdf' | 'office' | 'raw' | ''
    const [embedError, setEmbedError] = useState(null);
    const [iframeLoaded, setIframeLoaded] = useState(false);

    const containerRef = useRef(null);

    const lowerUrl = (url || '').toLowerCase();
    const isPdf = useMemo(() => lowerUrl.endsWith('.pdf'), [lowerUrl]);
    const isPpt = useMemo(() => lowerUrl.endsWith('.ppt') || lowerUrl.endsWith('.pptx'), [lowerUrl]);
    const isDoc = useMemo(() => lowerUrl.endsWith('.doc') || lowerUrl.endsWith('.docx'), [lowerUrl]);

    // Construcción de URL del visor (sin Google Viewer)
    useEffect(() => {
        setEmbedError(null);
        setIframeLoaded(false);

        if (!url) {
            setEffectiveUrl('');
            setEmbedType('');
            return;
        }

        // PDF → incrustación directa
        if (isPdf && forceDirectPdf) {
            const pdfUrl = `${url}#toolbar=1&navpanes=0&scrollbar=1`;
            setEffectiveUrl(pdfUrl);
            setEmbedType('pdf');
            return;
        }

        // Office formats (PPT/PPTX/DOC/DOCX) → Office Viewer
        if (isPpt || isDoc) {
            const officeUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
            setEffectiveUrl(officeUrl);
            setEmbedType('office');
            return;
        }

        // Fallback para otros tipos (imágenes/HTML)
        setEffectiveUrl(url);
        setEmbedType('raw');
    }, [url, isPdf, isPpt, isDoc, forceDirectPdf]);

    // Habilitar continuar únicamente con scroll+aceptación
    useEffect(() => {
        onStatusChange && onStatusChange(scrolledToEnd && ack);
    }, [scrolledToEnd, ack, onStatusChange]);

    // Detecta scroll hasta el final
    const onScroll = () => {
        const el = containerRef.current;
        if (!el) return;
        const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
        if (atBottom) setScrolledToEnd(true);
    };

    // Toast
    const ok = scrolledToEnd && ack;
    const toast = (() => {
        if (!scrolledToEnd) {
            return { color: '#ef4444', bg: '#fee2e2', text: labels.toastNeedScroll || 'Desplázate hasta el final del documento para continuar.' };
        }
        if (mustAcknowledge && !ack) {
            return { color: '#b45309', bg: '#fef3c7', text: labels.toastNeedAck || 'Marca la casilla de aceptación para continuar.' };
        }
        return { color: '#166534', bg: '#ecfdf5', text: labels.toastReady || 'Política leída y aceptada. Puedes continuar.' };
    })();

    // Alturas
    const viewHeight = isKiosk ? '60vh' : 420;
    const iframeHeight = isKiosk ? '60vh' : 800;

    // Render helpers (JS puro, sin tipos)
    const renderPdf = () => (
        <>
            {/* 1) visor nativo vía iframe (sin sandbox) */}
            <iframe
                title={title}
                src={effectiveUrl}
                style={{ width: '100%', height: iframeHeight, border: 0 }}
                onLoad={() => setIframeLoaded(true)}
                onError={(e) => setEmbedError((e && e.message) || 'pdf-iframe-error')}
            />
            {/* 2) Fallback: <object> */}
            {!iframeLoaded && (
                <object
                    data={url}
                    type="application/pdf"
                    width="100%"
                    height={iframeHeight}
                    aria-label={title}
                    onError={(e) => setEmbedError((e && e.message) || 'pdf-object-error')}
                >
                    <p style={{ padding: 12 }}>
                        No se puede incrustar el PDF. Usa el botón <strong>“Abrir documento”</strong>.
                    </p>
                </object>
            )}
        </>
    );

    const renderOffice = () => (
        <iframe
            title={title}
            src={effectiveUrl}
            style={{ width: '100%', height: iframeHeight, border: 0 }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onLoad={() => setIframeLoaded(true)}
            onError={(e) => setEmbedError((e && e.message) || 'office-iframe-error')}
        />
    );

    const renderRaw = () => (
        <iframe
            title={title}
            src={effectiveUrl}
            style={{ width: '100%', height: iframeHeight, border: 0 }}
            onLoad={() => setIframeLoaded(true)}
            onError={(e) => setEmbedError((e && e.message) || 'raw-iframe-error')}
        />
    );

    return (
        <section className="card" style={{ display: 'grid', gap: 12 }}>
            <h3 style={{ fontSize: 18, fontWeight: 600 }}>{title}</h3>

            {/* Abrir en pestaña nueva */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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

            {/* Visor embebido */}
            {effectiveUrl && (
                <>
                    <div style={{ fontSize: 13, color: '#64748b' }}>
                        {labels.scrollHint || 'Desplázate hasta el final del documento para habilitar la aceptación.'}
                    </div>

                    <div
                        ref={containerRef}
                        onScroll={onScroll}
                        style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: 8,
                            height: viewHeight,
                            overflow: 'auto',
                            background: '#fff',
                        }}
                    >
                        {embedType === 'pdf' && renderPdf()}
                        {embedType === 'office' && renderOffice()}
                        {embedType === 'raw' && renderRaw()}

                        {/* Mensaje si hubo error de incrustación */}
                        {embedError && (
                            <div style={{ padding: 16, color: '#334155' }}>
                                <strong>No se puede mostrar la vista previa embebida.</strong>
                                <div style={{ marginTop: 6 }}>
                                    Usa el botón <em>“Abrir documento”</em> para verlo en una pestaña nueva.
                                </div>
                                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                                    Tipo: {embedType || 'desconocido'} · Error: {String(embedError)}
                                </div>
                            </div>
                        )}
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

            {/* Estado */}
            <div style={{ fontSize: 13, color: '#64748b' }}>
                {`Documento abierto: ${opened ? 'sí' : 'no'} · visor cargado: ${iframeLoaded ? 'sí' : 'no'} · scroll final: ${scrolledToEnd ? 'sí' : 'no'} · aceptación: ${ack ? 'sí' : 'no'}`}
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
                    gap: 8,
                }}
            >
                <span aria-hidden="true" style={{ fontWeight: 700 }}>
                    {ok ? '✓' : !scrolledToEnd ? '⚠' : '!'}
                    {ok ? '✓' : !scrolledToEnd ? '⚠' : '!'}
                </span>
                <span style={{ fontSize: 14 }}>{toast.text}</span>
            </div>
        </section>
    );
}