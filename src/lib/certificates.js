
// src/lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * Certificado estilo original, sin cabecera.
 * - Logo con tamaño fijo (rápido y sin cálculos).
 * - Datos ordenados y QR optimizado.
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
    const pageW = doc.internal.pageSize.getWidth();   // ~595 pt
    const pageH = doc.internal.pageSize.getHeight();  // ~842 pt
    const M = 40;       // margen exterior
    const LINE = 20;    // altura de línea base

    // ===== 1) Logo ARRIBA-DERECHA (tamaño fijo, sin cálculos) =====
    // Ajusta estos dos si lo quieres un poco más pequeño/grande.
    const LOGO_W = 100;   // pt (~35 mm)
    const LOGO_H = 45;    // pt (~16 mm)
    const logoX = pageW - M - LOGO_W;
    const logoY = M;

    if (logoUrl) {
        try {
            const dataUrl = await toDataUrl(logoUrl); // carga rápida del PNG
            doc.addImage(dataUrl, 'PNG', logoX, logoY, LOGO_W, LOGO_H);
        } catch {
            /* si falla el logo, seguimos sin él */
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
    doc.text(title, M, M + 30); // bien separado del logo

    // ===== 3) Datos (espaciado limpio, sin montarse) =====
    doc.setFont('helvetica', 'normal');   // ← CORRECTO (no duplicar llamadas)
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);

    let y = M + 70; // base bajo título
    doc.text(`${lang === 'es' ? 'Nombre' : 'Name'}: ${name}`, M, y); y += LINE;
    doc.text(`${lang === 'es' ? 'Documento' : 'ID'}: ${idDoc}`, M, y); y += LINE;
    doc.text(`${lang === 'es' ? 'Empresa' : 'Company'}: ${company}`, M, y); y += LINE;
    doc.text(`${lang === 'es' ? 'Tipo' : 'Type'}: ${type}`, M, y);

    // Columna derecha (fechas e ID), como tenías
    doc.text(`${lang === 'es' ? 'Emitido' : 'Issued'}: ${issueDate}`, pageW / 2, M + 70);
    doc.text(`${lang === 'es' ? 'Caducidad' : 'Expiry'}: ${expiryDate}`, pageW / 2, M + 90);
    doc.text(`ID: ${certId}`, pageW / 2, M + 110);

    // ===== 4) QR + URL (rápido) =====
    const qrY = y + 20;
    const QR_SIZE = 150; // pt (~53 mm)
    const qr = await QRCode.toDataURL(verifyUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 4 // más rápido que 5/6 (y suficiente nitidez)
    });
    doc.addImage(qr, 'PNG', M, qrY, QR_SIZE, QR_SIZE);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(51, 65, 85);
    doc.text(lang === 'es' ? 'Verificación:' : 'Verification:', M + QR_SIZE + 16, qrY + 2);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(51, 65, 85);
    doc.text(
        doc.splitTextToSize(verifyUrl, pageW - (M + QR_SIZE + 16) - M),
        M + QR_SIZE + 16,
        qrY + 18
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

/* === Helper simple para cargar el PNG del/* === Helper simple para cargar el PNG del logo === */
async function toDataUrl(url) {
    const res = await fetch(url, { cache: 'no-store' });
    const blob = await res.blob();
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
    });
}