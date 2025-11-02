
import React, { useEffect, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';
export default function VideoGate({ src, tracks = [], allowSeek = false, allowSubtitles = true, onDone }){
  const wrapRef = useRef(null); const vidRef = useRef(null);
  const [watched, setWatched] = useState(0); const [ended, setEnded] = useState(false);
  useEffect(()=>{ if(src) logEvent('video_start',{src}); }, [src]);
  useEffect(()=>{ const v=vidRef.current; if(!v) return; const onTime=()=>setWatched(w=>Math.max(w,v.currentTime)); const onSeek=()=>{ if(!allowSeek && v.currentTime>watched+0.5) v.currentTime=Math.max(0,watched); }; const onEnded=()=>{ setEnded(true); onDone && onDone(); logEvent('video_done',{src}); }; v.addEventListener('timeupdate',onTime); v.addEventListener('seeking',onSeek); v.addEventListener('ended',onEnded); return ()=>{ v.removeEventListener('timeupdate',onTime); v.removeEventListener('seeking',onSeek); v.removeEventListener('ended',onEnded); }; },[allowSeek,watched,onDone,src]);
  useEffect(()=>{ const el=wrapRef.current; const v=vidRef.current; if(!el||!v) return; const compute=()=>{ const rect=el.getBoundingClientRect(); const viewport=window.innerHeight||document.documentElement.clientHeight; const margin=24; const maxH=Math.max(240, viewport-rect.top-margin); v.style.maxHeight=maxH+'px'; v.style.width='100%'; }; compute(); const ro=new ResizeObserver(compute); ro.observe(document.body); window.addEventListener('resize',compute); return ()=>{ try{ro.disconnect();}catch{} window.removeEventListener('resize',compute); }; },[]);
  const resolvedSrc = src && (src.startsWith('http')||src.startsWith('data:')? src : (src.startsWith('/')? (import.meta.env.BASE_URL + src.replace(/^\//,'')) : (import.meta.env.BASE_URL + src)));
  return (
    <div ref={wrapRef} style={{display:'grid',gap:12}}>
      <video ref={vidRef} src={resolvedSrc} controls className="video-responsive" style={{borderRadius:8,background:'#000'}} controlsList={allowSeek? 'nodownload' : 'nodownload noplaybackrate'}>
        {allowSubtitles && tracks.map(t => (
          <track key={t.src} kind="subtitles" src={t.src} srcLang={t.srclang} label={t.label} default={t.default||false} />
        ))}
      </video>
      {!ended && <p style={{fontSize:14,color:'#475569'}}>Reproduce el vídeo completo para continuar.</p>}
    </div>
  );
}
