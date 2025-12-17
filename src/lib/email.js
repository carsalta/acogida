
export async function sendMail({ apiBase, apiKey, to, cc=[], bcc=[], subject, html, attachment }){
  const url = (apiBase || '').replace(/\/$/, '') + '/sendMail';
  const res = await fetch(url || (import.meta.env.BASE_URL + 'api/sendMail'), {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(apiKey? { 'X-API-KEY': apiKey } : {}) },
    body: JSON.stringify({ to, cc, bcc, subject, html, attachment })
  });
  if (!res.ok){ const t = await res.text().catch(()=>res.statusText); throw new Error('sendMail failed: '+t); }
  return await res.json().catch(()=>({ ok:true }));
}
export async function blobToBase64(blob){ const buf=await blob.arrayBuffer(); let binary=''; const bytes=new Uint8Array(buf); const chunk=0x8000; for(let i=0;i<bytes.length;i+=chunk){ binary += String.fromCharCode.apply(null, bytes.subarray(i,i+chunk)); } return btoa(binary); }
