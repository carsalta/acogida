
import es from './data/content.es.json';
import en from './data/content.en.json';
import fr from './data/content.fr.json';
import de from './data/content.de.json';
import pt from './data/content.pt.json';
const dict = { es, en, fr, de, pt };
function deepMerge(a,b){ if(!b) return a; if(Array.isArray(a)&&Array.isArray(b)) return b; if(typeof a==='object'&&typeof b==='object'){ const o={...a}; for(const k of Object.keys(b)) o[k]=deepMerge(a?.[k], b[k]); return o; } return b ?? a; }
function readOverrides(){ try{const raw=localStorage.getItem('contentOverrides'); return raw? JSON.parse(raw):{}; }catch{ return {}; } }
export const getContent=(lang)=>{ const ov=readOverrides(); const base=dict[lang] ?? dict.es; return deepMerge(base, ov?.[lang]); };
export const saveContentOverrides=(over)=>{ const cur=readOverrides(); localStorage.setItem('contentOverrides', JSON.stringify({...cur, ...over})); };
export const clearContentOverrides=()=> localStorage.removeItem('contentOverrides');
