
// src/lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * Certificado profesional con:
 * - Cabecera corporativa
 * - Título dinámico (contrata/visita)
 * - Logo arriba a la derecha, manteniendo proporción
 * - Dos columnas (datos / verificación+QR)
 *
 * Parámetros esperados:
 *  - lang        : 'es' | 'en' | ...
 *  - name        : string
 *  - idDoc       : string
 *  - company     : string
 *  - type        : 'contrata' | 'visita'
 *  - certId      : string
 *  - issueDate   : string (localizado)
 *  - expiryDate  : string (localizado)
 *  - verifyUrl   : string
 *  - logoUrl?    : string (URL pública: import.meta.env.BASE_URL + 'brand/logo-global.png')
 *  - brandName?  : string (opcional, e.g. 'Danone Aldaia')
 *  - brandColor? : string (opcional, HEX. por defecto azul corporativo)
 */
export async function buildCertificate({
    lang,
    name,
    idDoc,
    company,
    type,
    certId,
    issueDate,
    expiryDate,
    verifyUrl,
    logoUrl,
    brandName = 'Danone',
    brandColor = '#005EB8' // azul corporativo (ajústalo si quieres)
}) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();   // ~595pt
    const pageH = doc.internal.pageSize.getHeight();  // ~842pt
    const M = 40;                                     // margen base

    // Helpers
    const setFont = (size, style = 'normal') => {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
    };
    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
    const scaleToFit = (nw, nh, maxW, maxH) => {
        const r = Math.min(maxW / nw, maxH / nh);
        return { w: Math.round(nw * r), h: Math.round(nh * r) };
    };

    // ====== 1) CABECERA ========================================================
    const headerH = 72; // altura de cabecera
    doc.setFillColor(brandColor);
    doc.rect(0, 0, pageW, headerH, 'F'); // franja superior

    // Título dinámico
    const titleES =
        type === 'contrata'
            ? 'Certificado Video Acogida Empresas Externas'
            : 'Certificado Video Acogida Visitas';
    const titleEN =
        type === 'contrata'
            ? 'Induction Certificate for External Companies'
            : 'Induction Certificate for Visitors';
    const title = lang === 'es' ? titleES : titleEN;

    // Título en blanco sobre cabecera
    setFont(18, 'bold');
    doc.setTextColor('#FFFFFF');
    doc.text(title, M, headerH / 2 + 6);

    // Submarca (opcional)
    setFont(10, 'normal');
    doc.setTextColor('#E6F2FF'); // texto tenue sobre azul
    doc.text(brandName, M, headerH - 14);

    // ====== 2) LOGO (derecha, manteniendo proporción) ==========================
    if (logoUrl) {
        try {
            const res = await fetch(`${logoUrl}?v=${Date.now()}`, { cache: 'no-store' });
            const blob = await res.blob();
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            // Obtener dimensiones reales para escalar sin distorsión
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = dataUrl;
            });
            // Tamaño máximo del logo
            const maxLogoW = 120;
            const maxLogoH = 50;
            const scaled = scaleToFit(img.naturalWidth || img.width, img.naturalHeight || img.height, maxLogoW, maxLogoH);
            const logoX = pageW - M - scaled.w;
            const logoY = clamp((headerH - scaled.h) / 2, 10, headerH - scaled.h - 10);
            doc.addImage(dataUrl, 'PNG', logoX, logoY, scaled.w, scaled.h);
        } catch (err) {
            console.warn('[buildCertificate] No se pudo cargar el logo:', logoUrl, err);
        }
    }

    // Línea separadora bajo cabecera
    doc.setDrawColor(brandColor);
    doc.setLineWidth(1);
    doc.line(M, headerH + 8, pageW - M, headerH + 8);

    // ====== 3) CONTENIDO (dos columnas) =======================================
    // Área de contenido
    const contentTop = headerH + 24;
    const contentW = pageW - M * 2;
    const colGap = 24;
    const colW = (contentW - colGap) / 2;

    // 3a) Columna izquierda: Datos
    const L = (es, en) => (lang === 'es' ? es : en);
    let y = contentTop;

    const label = (txt, yy) => {
        setFont(10, 'bold');
        doc.setTextColor('#0F172A'); // slate-900
        doc.text(txt, M, yy);
    };
    const val = (txt, yy) => {
        setFont(11, 'normal');
        doc.setTextColor('#334155'); // slate-700
        doc.text(txt || '—', M + 110, yy); // deja columna para label
    };
    const row = (lab, value, inc = 18) => {
        label(lab, y);
        val(value, y);
        y += inc;
    };

    // Bloque datos
    setFont(12, 'bold');
    doc.setTextColor('#0F172A');
    doc.text(L('Datos del participante', 'Participant details'), M, y);
    y += 10;

    doc.setDrawColor('#E2E8F0'); // slate-200
    doc.line(M, y, M + colW, y);
    y += 12;

    row(L('Nombre', 'Name'), name);
    row(L('Documento', 'ID'), idDoc);
    row(L('Empresa', 'Company'), company);
    row(L('Tipo', 'Type'), type);
    row(L('Emitido', 'Issued'), issueDate);
    row(L('Caducidad', 'Expiry'), expiryDate);
    row('ID', certId);

    // 3b) Columna derecha: Verificación + QR
    const rightX = M + colW + colGap;
    let ry = contentTop;

    setFont(12, 'bold');
    doc.setTextColor('#0F172A');
    doc.text(L('Verificación', 'Verification'), rightX, ry);
    ry += 10;

    doc.setDrawColor('#E2E8F0');
    doc.line(rightX, ry, rightX + colW, ry);
    ry += 12;

    // QR
    const qrSize = 170;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, scale: 6 });
    doc.addImage(qr, 'PNG', rightX, ry, qrSize, qrSize);
    ry += qrSize + 10;

    // URL de verificación (envolviendo)
    setFont(10, 'normal');
    doc.setTextColor('#334155');
    doc.text(verifyUrl, rightX, ry, { maxWidth: colW });

    // ====== 4) PIE =============================================================
    // Línea superior del pie
    doc.setDrawColor('#CBD5E1'); // slate-300
    doc.setLineWidth(0.5);
    doc.line(M, pageH - 64, pageW - M, pageH - 64);

    // Aviso
    setFont(10, 'normal');
    doc.setTextColor('#64748B'); // slate-500
    doc.text(
        L('Escanea el QR o visita el enlace para verificar el estado', 'Scan the QR or visit the link to verify status'),
        M,
        pageH - 48
    );

    // Marca y fecha de emisión (pie)
    setFont(9, 'italic');
    doc.setTextColor('#94A3B8'); // slate-400
    doc.text(`${brandName} · ${issueDate}`, M, pageH - 30);

    // Evento  // Evento
    logEvent('cert_issued', { type });

    // ====== 5) SALIDA ==========================================================
    return doc.output('blob');

}
