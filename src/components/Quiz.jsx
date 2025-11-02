
import React, { useState } from 'react';
import { logEvent } from '../lib/analytics';
export default function Quiz({ items=[], checkLabel='Comprobar y finalizar', wrongLabel='Respuesta incorrecta. Revisa y corrige.', onPass, onRetry, retryLabel='Finalizar y nuevo intento' }){
  const [answers,setAnswers]=useState({}); const [error,setError]=useState(null);
  const onSubmit=(e)=>{ e.preventDefault(); for(let q of items){ const a=answers[q.id]; if(a===undefined || Number(a)!==Number(q.correct)){ setError(wrongLabel); logEvent('quiz_fail',{}); return; } } setError(null); logEvent('quiz_pass',{}); onPass && onPass(); };
  return (
    <form style={{display:'grid',gap:20}} onSubmit={onSubmit}>
      {items.map((q,idx)=>(
        <fieldset key={q.id} className="card">
          <legend style={{fontWeight:600}}>{idx+1}. {q.text}</legend>
          <div style={{display:'grid',gap:8,marginTop:8}}>
            {q.options.map((opt,i)=>(
              <label key={i} style={{display:'flex',alignItems:'center',gap:8}}>
                <input type="radio" name={q.id} value={i} checked={String(answers[q.id])===String(i)} onChange={(e)=>setAnswers({...answers,[q.id]: Number(e.target.value)})} />
                <span>{opt}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {error && <p style={{color:'#b91c1c'}}>{error}</p>}
      <div style={{display:'flex',gap:12}}>
        <button className="btn" type="submit">{checkLabel}</button>
        {error && onRetry && <button className="btn-outline" type="button" onClick={onRetry}>{retryLabel}</button>}
      </div>
    </form>
  );
}
