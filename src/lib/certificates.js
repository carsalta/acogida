
// lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * buildCertificate(options)
 * Mantiene la misma API y añade parámetros opcionales para coherencia visual.
 * - lang, name, idDoc, company, type ('contrata'|'visita'), certId, issueDate, expiryDate, verifyUrl
 * - logoUrl?: string
 * - brandName?: string (opcional)
 * - brandPrimary?: string (hex, opcional; por defecto '#0ea5e9')
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
    brandPrimary = '#0ea5e9',
}) {
    // A4 vertical en puntos, con compresión activada
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

    // Dimensiones de página y márgenes
    const pageW = doc.internal.pageSize.getWidth();   // ~595pt
    const pageH = doc.internal.pageSize.getHeight();  // ~842pt
    const M = 40;                                     // margen exterior
    const LINE = 18;                                  // altura de línea base

    // --------------------------
    // 1) Barra superior de marca
    // --------------------------
    setFillColorHex(doc, brandPrimary);
    doc.rect(0, 0, pageW, 16, 'F');

    // --------------------------
    // 2) Cabecera (título + logo proporcional)
    // --------------------------
    const titleES = type === 'contrata'
        ? 'Certificado · Video Acogida Contratas'
        : 'Certificado · Video Acogida Visitas';
    const titleEN = type === 'contrata'
        ? 'Certificate · Safety Induction Contractors'
        : 'Certificate · Safety Induction Visitors';
    const title = lang === 'es' ? titleES : titleEN;

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(17, 24, 39); // slate-900
    doc.text(title, M, M + 8);

    // Logo a la derecha, manteniendo proporción y peso ligero (JPEG)
    const LOGO_MAX_W = 120;   // ancho máximo del logo en pt (~42mm)
    const LOGO_MAX_H = 56;    // alto máximo en pt
    const logoX = pageW - M - LOGO_MAX_W;
    const logoY = M - 6;      // lo subimos ligeramente para equilibrar con el título

    if (logoUrl) {
        try {
            const rawDataUrl = await loadAsDataUrl(logoUrl);
            const jpegDataUrl = await toJpeg(rawDataUrl, 0.88, 1500); // calidad y tamaño tope en px
            const { wPt, hPt } = await getImagePtSize(jpegDataUrl, LOGO_MAX_W, LOGO_MAX_H);
            doc.addImage(jpegDataUrl, 'JPEG', logoX, logoY, wPt, hPt);
        } catch {
            // si falla, continuamos sin logo
        }
    }

    // Separador fino bajo cabecera
    drawHr(doc, M, pageW - M, M + 28, '#e2e8f0'); // slate-200

    // --------------------------------
    // 3) Bloque de datos (2 columnas)
    // --------------------------------
    const leftX = M;
    const rightX = pageW / 2 + 8;
    let baseY = M + 48;

    const rows = [
        ['Nombre', name],
        ['Documento', idDoc],
        ['Empresa', company],
        ['Tipo', type],
        ['Emitido', issueDate],
        ['Caducidad', expiryDate],
        ['ID', certId],
    ];

    // Etiqueta (seminegrita) + valor
    const LABEL = (x, y, s) => { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(51, 65, 85); doc.text(s + ':', x, y); }; // slate-700
    const VALUE = (x, y, s) => { doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(15, 23, 42); doc.text(String(s ?? '—'), x, y); }; // slate-900

    // 4 a la izquierda, resto a la derecha
    rows.slice(0, 4).forEach(([label, value], i) => {
        const y = baseY + i * LINE;
        LABEL(leftX, y, lang === 'es' ? label : translateLabel(label));
        VALUE(leftX + 90, y, value);
    });
    rows.slice(4).forEach(([label, value], i) => {
        const y = baseY + i * LINE;
        LABEL(rightX, y, lang === 'es' ? label : translateLabel(label));
        VALUE(rightX + 90, y, value);
    });

    // --------------------------------
    // 4) QR optimizado + URL
    // --------------------------------
    const qrY = baseY + 4 * LINE + 24;
    const QR_SIZE = 170; // pt (~60mm) — buena lectura en móvil sin disparar tamaño
    const qrPng = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'M', // robusto y ligero
        margin: 1,
        scale: 6,                  // base para una buena nitidez
        color: { dark: '#000000', light: '#ffffff' }
    });
    const qrJpeg = await toJpeg(qrPng, 0.82);
    doc.addImage(qrJpeg, 'JPEG', M, qrY, QR_SIZE, QR_SIZE);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
    doc.text(lang === 'es' ? 'Verificación:' : 'Verification:', M + QR_SIZE + 16, qrY + 2);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(verifyUrl, pageW - (M + QR_SIZE + 16) - M), M + QR_SIZE + 16, qrY + LINE);

    // --------------------------------
    // 5) Pie de página
    // --------------------------------
    drawHr(doc, M, pageW - M, pageH - M - 24, '#e2e8f0');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100, 116, 139); // slate-500
    doc.text(
        lang === 'es'
            ? 'Escanea el QR o visita el enlace para verificar el estado'
            : 'Scan the QR or visit the link to verify status',
        M, pageH - M - 8
    );

    logEvent('cert_issued', { type, brand: brandName });
    return doc.output('blob');
}

/* ============================== helpers ============================== */

/** Convierte un color hex a RGB y establece fillColor en jsPDF */
function setFillColorHex(doc, hex) {
    const [r, g, b] = hexToRgb(hex);
    doc.setFillColor(r, g, b);
}

/** Dibuja una línea horizontal fina */
function drawHr(doc, x1, x2, y, hex = '#e5e7eb') {
    const [r, g, b] = hexToRgb(hex);
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.6);
    doc.line(x1, y, x2, y);
}

/** Hex → [r,g,b] */
function hexToRgb(h) {
    const s = h.replace('#', '');
    if (s.length === 3) return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

/** Carga una URL a dataURL */
async function loadAsDataUrl(url) {
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}

/** Convierte una dataURL (PNG/JPEG/SVG*) a JPEG con calidad y ancho máximo (px) */
function toJpeg(dataUrl, quality = 0.85, maxW = 1500) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const scale = img.width > maxW ? maxW / img.width : 1;
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = dataUrl;
    });
}

/** Calcula tamaño (pt) manteniendo proporciones y respetando máximos */
function getImagePtSize(dataUrl, maxWpt, maxHpt) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // Asumimos 72 dpi → 1 px ≈ 0.75 pt (jsPDF usa 72dpi por defecto)
            const px2pt = 0.75;
            const wPt = img.width * px2pt;
            const hPt = img.height * px2pt;
            const scale = Math.min(maxWpt / wPt, maxHpt / hPt, 1);
            resolve({ wPt: wPt * scale, hPt: hPt * scale });
        };
        img.src = dataUrl;
    });
}

/** Traducciones básicas de etiquetas */
function translateLabel(lblEs) {
    switch (lblEs) {
        case 'Nombre': return 'Name';
        case 'Documento': return 'ID';
        case 'Empresa': return 'Company';
        case 'Tipo': return 'Type';
        case 'Emitido': return 'Issued';
        case 'Caducidad': return 'Expiry';
        case 'ID': return 'ID';
        default: return lblEs;
    }
}