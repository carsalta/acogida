
// src/lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * Certificado estilo original (sin cabecera).
 * - Logo proporcional arriba-derecha (dentro de 110×50 pt).
 * - Datos en dos columnas como tu versión inicial.
 * - QR optimizado para rapidez.
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
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });

    // Dimensiones y márgenes
    const pageW = doc.internal.pageSize.getWidth();   // ~595 pt
    const pageH = doc.internal.pageSize.getHeight();  // ~842 pt
    const M = 40;                                     // margen exterior

    // ===== 1) Logo arriba-derecha (proporcional, SIN deformar) =====
    const LOGO_MAX_W = 110;   // ancho máx. en pt (~39 mm)
    const LOGO_MAX_H = 50;    // alto máx. en pt (~18 mm)
    const logoX = pageW - M - LOGO_MAX_W;
    const logoY = M;

    if (logoUrl) {
        try {
            const dataUrl = await toDataUrl(logoUrl);
            const { wPt, hPt } = await scaledPtSize(dataUrl, LOGO_MAX_W, LOGO_MAX_H);
            doc.addImage(dataUrl, 'PNG', logoX, logoY, wPt, hPt);
        } catch {
            /* si falla, continuamos sin logo */
        }
    }

    // ===== 2) Título (como el original) =====
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
    doc.setTextColor(17, 24, 39);
    doc.text(title, M, M + 30);

    // ===== 3) Datos (layout original) =====
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);

    const baseY = M + 70; // separación limpia bajo el título
    doc.text(`${lang === 'es' ? 'Nombre' : 'Name'}: ${name}`, M, baseY);
    doc.text(`${lang === 'es' ? 'Documento' : 'ID'}: ${idDoc}`, M, baseY + 20);
    doc.text(`${lang === 'es' ? 'Empresa' : 'Company'}: ${company}`, M, baseY + 40);
    doc.text(`${lang === 'es' ? 'Tipo' : 'Type'}: ${type}`, M, baseY + 60);

    doc.text(`${lang === 'es' ? 'Emitido' : 'Issued'}: ${issueDate}`, pageW / 2, baseY);
    doc.text(`${lang === 'es' ? 'Caducidad' : 'Expiry'}: ${expiryDate}`, pageW / 2, baseY + 20);
    doc.text(`ID: ${certId}`, pageW / 2, baseY + 40);

    // ===== 4) QR + enlace =====
    const QR_Y = baseY + 80;
    const QR_SIZE = 150; // pt (~53 mm)
    const qr = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 4 // más rápido que 5/6, nitidez suficiente
    });
    doc.addImage(qr, 'PNG', M, QR_Y, QR_SIZE, QR_SIZE);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85);
    doc.text(
        doc.splitTextToSize(verifyUrl, pageW - (M + QR_SIZE + 16) - M),
        M + QR_SIZE + 16,
        QR_Y + 18
    );

    // ===== 5) Pie =====
    doc.setDrawColor(200);
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

/** Devuelve tamaño en pt manteniendo proporción dentro de [maxWpt, maxHpt] */
function scaledPtSize(dataUrl, maxWpt, maxHpt) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            // jsPDF usa 72 dpi -> 1 px ≈ 0.75 pt
            const px2pt = 0.75;
            const wPt = img.width * px2pt;
            const hPt = img.height * px2pt;
            const scale = Math.min(maxWpt / wPt, maxHpt / hPt, 1);
            resolve({ wPt: wPt * scale, hPt: hPt * scale });
        };
        img.src = dataUrl;
    });
}