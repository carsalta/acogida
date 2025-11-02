
import { useEffect, useState } from 'react';
const LS_KEY='appConfigOverrides';
export function useConfig(){
  const [cfg,setCfg]=useState(null);
  useEffect(()=>{ const load=async()=>{ try{ const r=await fetch(import.meta.env.BASE_URL + 'config.json',{cache:'no-store'}); const base=await r.json(); const overrides=JSON.parse(localStorage.getItem(LS_KEY)||'{}'); setCfg(mergeCfg(base, overrides)); }catch(e){ setCfg({ defaultLang:'es', enabledLangs:['es','en'], allowSeek:false, allowSubtitles:true, videos:{}, sites:{} }); } }; load(); },[]);
  const saveOverrides=(over)=>{ localStorage.setItem(LS_KEY, JSON.stringify(over)); setCfg(c=>mergeCfg(c||{}, over)); };
  const resetOverrides=()=>{ localStorage.removeItem(LS_KEY); location.reload(); };
  return { cfg, saveOverrides, resetOverrides };
}
function mergeCfg(a,b){
  const out = { ...a, ...b };
  out.brand = { ...(a?.brand||{}), ...(b?.brand||{}) };
  out.videos = { ...(a?.videos||{}), ...(b?.videos||{}) };
  out.sites  = {};
  const aSites = a?.sites||{}; const bSites=b?.sites||{};
  for (const k of new Set([...Object.keys(aSites), ...Object.keys(bSites)])){
    out.sites[k] = {
      ...(aSites[k]||{}), ...(bSites[k]||{}),
      brand: { ...(aSites[k]?.brand||{}), ...(bSites[k]?.brand||{}) },
      videos: { ...(aSites[k]?.videos||{}), ...(bSites[k]?.videos||{}) }
    };
  }
  return out;
}
