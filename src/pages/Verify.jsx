
import React, { useMemo } from 'react';
export default function Verify({c}){
  const params=useMemo(()=> new URLSearchParams(location.search), []);
  const id=params.get('id'); if(!id) return <p>{c?.verifyPage?.notfound || 'No encontrado'}</p>;
  const certs=JSON.parse(localStorage.getItem('certs')||'[]'); const row=certs.find(x=>x.id===id);
  if(!row) return <div className="card"><p className="text-xl">{c?.verifyPage?.notfound || 'No encontrado'}</p></div>;
  const now=new Date(); const exp=new Date(row.expiry); const valid=exp>=now;
  return (
    <div className="card">
      <p style={{color:'#64748b'}}> {c?.verifyPage?.checking || 'Comprobando…'} </p>
      <p className={valid? 'text-green-700 text-xl':'text-amber-700 text-xl'}>
        {valid ? (c?.verifyPage?.valid || '✓ Certificado válido') : (c?.verifyPage?.expired || '⚠ Certificado caducado')}
      </p>
      <p style={{fontSize:14,color:'#64748b'}}>ID: {id}</p>
      <a className="btn" style={{marginTop:12}} href={location.pathname}>{c?.newStart || 'Nuevo intento'}</a>
    </div>
  );
}
