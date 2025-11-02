
import React, { useState } from 'react';
import baseES from '../data/content.es.json';
import baseEN from '../data/content.en.json';
import baseFR from '../data/content.fr.json';
import baseDE from '../data/content.de.json';
import basePT from '../data/content.pt.json';
import { useConfig } from '../hooks/useConfig';
import { getEnabledLangs, LANG_LABEL } from '../lib/langs';

function readOverrides(){ try{ const raw=localStorage.getItem('contentOverrides'); return raw? JSON.parse(raw):{}; }catch{ return {}; } }
function saveOverrides(ov){ localStorage.setItem('contentOverrides', JSON.stringify(ov)); }
const BASE = { es: baseES, en: baseEN, fr: baseFR, de: baseDE, pt: basePT };

export default function QuestionsEditor(){
  const initial = readOverrides();
  const { cfg } = useConfig();
  const enabledLangs = getEnabledLangs(cfg);
  const [lang, setLang] = useState(enabledLangs[0] || 'es');
  const [data, setData] = useState(()=> ({ es: initial.es||baseES, en: initial.en||baseEN, fr: initial.fr||baseFR, de: initial.de||baseDE, pt: initial.pt||basePT }));
  const block = (data[lang].questions || { visita: [], contrata: [] });
  const setQuestions = (type, items) => setData(d => ({ ...d, [lang]: { ...d[lang], questions: { ...d[lang].questions, [type]: items } } }));
  const addQ = (type) => { const items=[...(block[type]||[])]; const nid=(type==='visita'?'v':'c')+String(Date.now()).slice(-5); items.push({ id:nid, text:'Nueva pregunta', options:['Opción 1','Opción 2'], correct:0 }); setQuestions(type, items); };
  const delQ = (type, idx) => { const items=[...(block[type]||[])]; items.splice(idx,1); setQuestions(type, items); };
  const move = (type, idx, dir) => { const items=[...(block[type]||[])]; const j=idx+dir; if(j<0||j>=items.length) return; const t=items[idx]; items[idx]=items[j]; items[j]=t; setQuestions(type, items); };
  const setField = (type, idx, patch) => { const items=[...(block[type]||[])]; items[idx]={ ...items[idx], ...patch }; setQuestions(type, items); };
  const addOpt = (type, idx) => { const items=[...(block[type]||[])]; const q={...items[idx]}; q.options=[...(q.options||[]), 'Nueva opción']; items[idx]=q; setQuestions(type, items); };
  const delOpt = (type, qidx, oidx) => { const items=[...(block[type]||[])]; const q={...items[qidx]}; q.options=[...q.options]; q.options.splice(oidx,1); if(q.correct>=q.options.length) q.correct=Math.max(0, q.options.length-1); items[qidx]=q; setQuestions(type, items); };
  const setOpt = (type, qidx, oidx, val) => { const items=[...(block[type]||[])]; const q={...items[qidx]}; const opts=[...q.options]; opts[oidx]=val; q.options=opts; items[qidx]=q; setQuestions(type, items); };
  const persist = () => { const current=readOverrides(); const next={ ...current, [lang]: data[lang] }; saveOverrides(next); alert('Guardado en overrides. Recarga para ver cambios.'); };
  const download = () => { const blob=new Blob([JSON.stringify(data[lang], null, 2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`content.${lang}.json`; a.click(); URL.revokeObjectURL(a.href); };
  return (
    <div style={{display:'grid',gap:12}}>
      <div style={{display:'flex',alignItems:'center',gap:12}}>
        <div className="font-semibold">Idioma</div>
        <select className="border rounded" style={{padding:'4px 8px'}} value={lang} onChange={e=>setLang(e.target.value)}>
          {enabledLangs.map(k => <option key={k} value={k}>{LANG_LABEL[k]}</option>)}
        </select>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button className="btn btn-outline" onClick={download}>Descargar JSON</button>
          <button className="btn" onClick={persist}>Guardar overrides</button>
        </div>
      </div>
      {['visita','contrata'].map(type => (
        <div key={type} style={{borderTop:'1px solid #e2e8f0', paddingTop:12, marginTop:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <h4 className="font-semibold" style={{textTransform:'uppercase'}}>{type}</h4>
            <button className="btn" onClick={()=>addQ(type)}>Añadir pregunta</button>
          </div>
          <div style={{display:'grid',gap:12,marginTop:8}}>
            {(block[type]||[]).map((q, idx) => (
              <div key={q.id} style={{padding:12,border:'1px solid #e2e8f0',borderRadius:8}}>
                <input className="border rounded" style={{padding:'4px 8px',width:'100%'}} value={q.text} onChange={e=>setField(type, idx, { text: e.target.value })} />
                <div style={{display:'grid',gap:8,marginTop:8}}>
                  {(q.options||[]).map((opt, oidx) => (
                    <div key={oidx} style={{display:'flex',alignItems:'center',gap:8}}>
                      <input type="radio" name={`${type}_${idx}_correct`} checked={q.correct===oidx} onChange={()=>setField(type, idx, { correct: oidx })} />
                      <input className="border rounded" style={{padding:'4px 8px',width:'100%'}} value={opt} onChange={e=>setOpt(type, idx, oidx, e.target.value)} />
                      <button className="btn btn-outline" onClick={()=>delOpt(type, idx, oidx)}>Eliminar opción</button>
                    </div>
                  ))}
                  <button className="btn btn-outline" onClick={()=>addOpt(type, idx)}>Añadir opción</button>
                </div>
                <div style={{display:'flex',gap:8, marginTop:8}}>
                  <button className="btn btn-outline" onClick={()=>move(type, idx, -1)}>↑</button>
                  <button className="btn btn-outline" onClick={()=>move(type, idx, +1)}>↓</button>
                  <button className="btn btn-outline" onClick={()=>delQ(type, idx)}>Eliminar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
