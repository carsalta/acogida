
const KEY='events';
export function logEvent(type, payload={}){ try{ const ev=JSON.parse(localStorage.getItem(KEY)||'[]'); ev.push({ type, payload, ts: Date.now() }); localStorage.setItem(KEY, JSON.stringify(ev)); }catch{} }
export function getEvents(){ try{ return JSON.parse(localStorage.getItem(KEY)||'[]'); }catch{ return []; } }
export function clearEvents(){ localStorage.removeItem(KEY); }
export function getMetrics(){ const ev=getEvents(); const issued=ev.filter(e=>e.type==='cert_issued').length; const quizPass=ev.filter(e=>e.type==='quiz_pass').length; const quizFail=ev.filter(e=>e.type==='quiz_fail').length; const byDay={}; ev.forEach(e=>{ const d=new Date(e.ts).toISOString().slice(0,10); byDay[d]=(byDay[d]||0)+(e.type==='cert_issued'?1:0); }); return { issued, quizPass, quizFail, byDay }; }
