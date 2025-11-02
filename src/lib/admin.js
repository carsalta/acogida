
const KEY='isAdmin';
export function isAdmin(){ return sessionStorage.getItem(KEY)==='1'; }
export async function ensureAdmin(){ if (isAdmin()) return true; let codeFromConfig=null; try{ const r=await fetch(import.meta.env.BASE_URL + 'config.json',{cache:'no-store'}); const cfg=await r.json(); codeFromConfig=cfg.adminCode||null; } catch{} const expected=codeFromConfig || 'admin123'; const code=prompt('Introduce el código de administrador'); if (code && code===expected){ sessionStorage.setItem(KEY,'1'); return true; } alert('Código incorrecto'); return false; }
export function signOutAdmin(){ sessionStorage.removeItem(KEY); location.reload(); }
