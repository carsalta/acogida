
// src/lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * Certificado: una columna + logo proporcional arriba-derecha + estilo simple/moderno.
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
    logoUrl
}) {
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });

    // Página y espaciado
    const pageW = doc.internal.pageSize.getWidth();    // ~595 pt
    const pageH = doc.internal.pageSize.getHeight();   // ~842 pt
    const M = 40;                                  // margen exterior
    const LINE = 20;                                  // altura de línea

    // ===== 1) Logo arriba-derecha (PROPORCIONAL, sin deformar) =====
    // Marco máximo para el logo horizontal (ajusta si lo deseas).
    const LOGO_MAX_W = 110;  // pt (~39 mm)
    const LOGO_MAX_H = 50;   // pt (~18 mm)
    const logoX = pageW - M - LOGO_MAX_W;
    const logoY = M;

    if (logoUrl) {
        try {
            const dataUrl = await toDataUrl(logoUrl);
            const { wPt, hPt } = await scaledPtSize(dataUrl, LOGO_MAX_W, LOGO_MAX_H);
            doc.addImage(dataUrl, 'PNG', logoX, logoY, wPt, hPt);
        } catch { /* seguimos sin logo si falla */ }
    }

    // ===== 2) Título simple y limpio =====
    const titleES =
        type === 'contrata'
            ? 'Certificado Video Acogida Empresas Externas'
            : 'Certificado Video Acogida Visitas';
    const titleEN =
        type === 'contrata'
            ? 'Induction Certificate for External Companies'
            : 'Induction Certificate for Visitors';
    const title = lang === 'es' ? titleES : titleEN;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39); // slate-900
    doc.text(title, M, M + 30);

    // Regla fina bajo el título (toque moderno, sin recargar)
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.6);
    doc.line(M, M + 36, pageW - M, M + 36);

    // ===== 3) Datos en UNA columna =====
    let y = M + 60; // base bajo el título

    // Etiqueta (seminegrita) + valor en la MISMA línea
    const labelValue = (labelEs, labelEn, value) => {
        const label = (lang === 'es' ? labelEs : labelEn) + ': ';
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(51, 65, 85); // slate-700
        doc.text(label, M, y);
        const off = doc.getTextWidth(label);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(15, 23, 42); // slate-900
        doc.text(String(value ?? '—'), M + off, y);
        y += LINE;
    };

    labelValue('Nombre', 'Name', name);
    labelValue('Documento', 'ID', idDoc);
    labelValue('Empresa', 'Company', company);
    labelValue('Tipo', 'Type', type);
    labelValue('Emitido', 'Issued', issueDate);
    labelValue('Caducidad', 'Expiry', expiryDate);
    labelValue('ID', 'ID', certId);

    // ===== 4) QR + enlace =====
    const QR_SIZE = 150; // pt (~53 mm) buen equilibrio
    const qrY = y + 12;

    const qr = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 4
    });

    // ⚠️ Línea corregida (sin duplicado dentro de los parámetros)
    doc.addImage(qr, 'PNG', M, qrY, QR_SIZE, QR_SIZE);

    // URL de verificación a la derecha del QR
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(71, 85, 105); // slate-600
    doc.text(
        doc.splitTextToSize(verifyUrl, pageW - (M + QR_SIZE + 16) - M),
        M + QR_SIZE + 16,
        qrY + 18
    );

    // ===== 5) Pie (ligero) =====
    doc.setDrawColor(226, 232, 240);
    doc.line(M, pageH - 82, pageW - M, pageH - 82);
    doc.setTextColor(120);
    doc.setFontSize(10);
    doc.text(
        lang === 'es'
            ? 'Escanea el QR o visita el enlace para verificar el estado'
            : 'Scan the QR or visit the link to verify status',
        M, pageH - 64
    );

    logEvent('cert_issued', { type });
    return doc.output('blob');
}

/* =================== helpers =================== */

/** Carga una URL (misma-origen o pública) a dataURL */
async function toDataUrl(url) {
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}



/**
 * Devuelve tamaño en pt manteniendo proporción dentro de [maxWpt, maxHpt] (sin deformar)
 */
function scaledPtSize(dataUrl, maxWpt, maxHpt) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            // jsPDF ~72 dpi ⇒ 1 px ≈ 0.75 pt
            const px2pt = 0.75;
            // Usa naturalWidth/Height para evitar valores 0 en algunos navegadores
            const wPt = (img.naturalWidth || img.width) * px2pt;
            const hPt = (img.naturalHeight || img.height) * px2pt;

            // ÚNICA línea de escala (no dupliques "const scale"):
            const scale = Math.min(maxWpt / wPt, maxHpt / hPt, 1);

            resolve({
                wPt: Math.max(1, wPt * scale),
                hPt: Math.max(1, hPt * scale),
            });
        };
        img.onerror = () => reject(new Error('No se pudo cargar el logo'));
        img.src = dataUrl;
    });
}