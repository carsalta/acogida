
// src/components/PolicyGate.jsx
import React, { useEffect, useRef, useState } from 'react';

/**
 * Props:
 *  - title: string (cabecera)
 *  - url: string (PDF o PPTX)
 *  - mustScroll: boolean
 *  - mustAcknowledge: boolean
 *  - labels: { openDoc, mustRead, ackLabel, scrollHint }
 *  - onStatusChange: (isReadAndAck: boolean) => void
 *  - isKiosk?: boolean (opcional)
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

  useEffect(() => {
    onStatusChange?.(scrolledToEnd && ack && opened);
  }, [scrolledToEnd, ack, opened, onStatusChange]);

  const onScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight;
    if (atBottom) setScrolledToEnd(true);
  };

  const isPdf = url?.toLowerCase().endsWith('.pdf');
  const isOffice = url?.toLowerCase().endsWith('.ppt') || url?.toLowerCase().endsWith('.pptx');

  return (
    <section className="card" style={{display: 'grid', gap: 12}}>
      <h3 style={{fontSize: 18, fontWeight: 600}}>{title}</h3>

      {/* Botón para abrir en pestaña nueva (útil si es PPTX) */}
      <div style={{display:'flex',gap:8, alignItems:'center'}}>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => { window.open(url, '_blank', 'noopener,noreferrer'); setOpened(true); }}
        >
          {labels.openDoc || 'Abrir documento'}
        </button>
        {!opened && (
          <span style={{fontSize: 13, color:'#64748b'}}>
            {labels.mustRead || 'Debes revisar el documento completo.'}
          </span>
        )}
      </div>

      {/* Incrustado en la propia página si es PDF */}
      {isPdf && (
        <>
          <div style={{fontSize: 13, color:'#64748b'}}>
            {labels.scrollHint || 'Desplázate hasta el final del documento para habilitar la aceptación.'}
          </div>
          <div
            ref={containerRef}
            onScroll={onScroll}
            style={{
              border: '1px solid #e2e8f0', borderRadius: 8,
              height: isKiosk ? '60vh' : 420, overflow: 'auto'
            }}
          >
            <iframe
              title={title}
              src={url}
              style={{width:'100%', height: isKiosk ? '60vh' : 800, border:0}}
            />
          </div>
        </>
      )}

      {/* Checkbox de aceptación */}
      {mustAcknowledge && (
        <label style={{display:'flex', gap:8, alignItems:'center'}}>
          <input
            type="checkbox"
            checked={ack}
            onChange={(e) => setAck(e.target.checked)}
          />
          <span>{labels.ackLabel || 'He leído y acepto la Política.'}</span>
        </label>
      )}

      {/* Estado */}
      <div style={{fontSize: 13, color: '#64748b'}}>
        {`Documento abierto: ${opened ? 'sí' : 'no'} · scroll final: ${scrolledToEnd ? 'sí' : 'no'} · aceptación: ${ack ? 'sí' : 'no'}`}
      </div>
    </section>
  );
}
