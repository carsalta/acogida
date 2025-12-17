
// src/lib/certificates.js
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';

/**
 * buildCertificate(options)
 * @param {object} options
 *  - lang, name, idDoc, company, type ('contrata'|'visita'),
 *    certId, issueDate, expiryDate, verifyUrl
 *  - logoUrl?: string  // URL pública (p.ej. BASE_URL + 'brand/logo-global.png')
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
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 40;

    // ===== 1) Logo arriba DERECHA (pequeño) =====
    const logoW = 100;
    const logoH = 45;
    const logoX = pageW - margin - logoW;
    const logoY = margin;

    if (logoUrl) {
        try {
            // Evita caché del SW/navegador
            const res = await fetch(`${logoUrl}?v=${Date.now()}`, { cache: 'no-store' });
            const blob = await res.blob();
            const dataUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
            doc.addImage(dataUrl, 'PNG', logoX, logoY, logoW, logoH);
            console.log('[buildCertificate] Logo añadido:', logoUrl);
        } catch (err) {
            console.warn('[buildCertificate] No se pudo cargar el logo:', logoUrl, err);
        }
    } else {
        console.warn('[buildCertificate] Sin logoUrl; se emitirá sin logo.');
    }

    // ===== 2) Título según el tipo =====
    const titleES =
        type === 'contrata'
            ? 'Certificado Video Acogida Empresas Externas'
            : 'Certificado Video Acogida Visitas';
    const titleEN =
        type === 'contrata'
            ? 'Induction Certificate for External Companies'
            : 'Induction Certificate for Visitors';
    const title = lang === 'es' ? titleES : titleEN;

    doc.setFontSize(18);
    // Lo dejamos arriba izquierda; el logo queda a la derecha
    doc.text(title, margin, 60);

    // ===== 3) Datos =====
    doc.setFontSize(12);
    const baseY = 100;
    doc.text(`${lang === 'es' ? 'Nombre' : 'Name'}: ${name}`, margin, baseY);
    doc.text(`${lang === 'es' ? 'Documento' : 'ID'}: ${idDoc}`, margin, baseY + 20);
    doc.text(`${lang === 'es' ? 'Empresa' : 'Company'}: ${company}`, margin, baseY + 40);
    doc.text(`${lang === 'es' ? 'Tipo' : 'Type'}: ${type}`, margin, baseY + 60);
    doc.text(`${lang === 'es' ? 'Emitido' : 'Issued'}: ${issueDate}`, margin, baseY + 80);
    doc.text(`${lang === 'es' ? 'Caducidad' : 'Expiry'}: ${expiryDate}`, margin, baseY + 100);
    doc.text(`ID: ${certId}`, margin, baseY + 120);

    // ===== 4) QR + enlace =====
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, scale: 6 });
    doc.addImage(qr, 'PNG', margin, baseY + 140, 150, 150);
    doc.setFontSize(10);
    doc.text(verifyUrl, margin, baseY + 310, { maxWidth: 500 });


    // ===== 5) Pie =====
    doc.setDrawColor(200);
    doc.line(margin, 760, pageW - margin, 760);
    doc.setTextColor(120);
    doc.text(
        lang === 'es'
            ? 'Escanea el QR o visita el enlace para verificar el estado'
            : 'Scan the QR or visit the link to verify status',
        margin,
        780
    );

    logEvent('cert_issued', { type });
}
