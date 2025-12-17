
import React, { useEffect, useState } from 'react';
export default function Section({ id, title, defaultOpen=false, children, right=null }){
  const KEY = `admin:section:${id}`;
  const [open, setOpen] = useState(() => {
    try { const raw = localStorage.getItem(KEY); if (raw!=null) return raw==='1'; } catch {}
    return !!defaultOpen;
  });
  useEffect(()=>{ try{ localStorage.setItem(KEY, open?'1':'0'); }catch{} }, [open]);
  return (
    <section className="card">
      <header className="flex items-center justify-between" style={{cursor:'pointer'}} onClick={()=>setOpen(o=>!o)}>
        <h3 className="font-semibold">{title}</h3>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {right}
          <button className="btn-outline" type="button">{open ? '−' : '+'}</button>
        </div>
      </header>
      {open && <div style={{marginTop:12}}>{children}</div>}
    </section>
  );
}
