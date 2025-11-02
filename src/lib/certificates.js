
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { logEvent } from './analytics';
export async function buildCertificate({ lang, name, idDoc, company, type, certId, issueDate, expiryDate, verifyUrl }){
  const doc=new jsPDF({unit:'pt', format:'a4'});
  doc.setFontSize(18); doc.text(lang==='es'?'Certificado de Inducción':'Induction Certificate',40,60);
  doc.setFontSize(12);
  doc.text(`${lang==='es'?'Nombre':'Name'}: ${name}`,40,100);
  doc.text(`${lang==='es'?'Documento':'ID'}: ${idDoc}`,40,120);
  doc.text(`${lang==='es'?'Empresa':'Company'}: ${company}`,40,140);
  doc.text(`${lang==='es'?'Tipo':'Type'}: ${type}`,40,160);
  doc.text(`${lang==='es'?'Emitido':'Issued'}: ${issueDate}`,40,180);
  doc.text(`${lang==='es'?'Caducidad':'Expiry'}: ${expiryDate}`,40,200);
  doc.text(`ID: ${certId}`,40,220);
  const qr=await QRCode.toDataURL(verifyUrl,{margin:1, scale:6});
  doc.addImage(qr,'PNG',40,240,150,150);
  doc.setFontSize(10); doc.text(verifyUrl,40,410,{maxWidth:500});
  doc.setDrawColor(200); doc.line(40,760,555,760); doc.setTextColor(120);
  doc.text(lang==='es'?'Escanea el QR o visita el enlace para verificar el estado':'Scan the QR or visit the link to verify status',40,780);
  logEvent('cert_issued', { type });
  return doc.output('blob');
}
