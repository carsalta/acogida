// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

function abs(p) {
    if (!p) return '';
    if (p.startsWith('http') || p.startsWith('data:')) return p;
    return (import.meta.env.BASE_URL || '/') + p.replace(/^\//, '');
}

export default function VideoGate({
    src,
    tracks = [],
    allowSeek = false,
    allowSubtitles = true,
    onDone = () => { }
}) {
    const url = useMemo(() => (typeof src === 'string' ? src : ''), [src]);
    const isYouTube = /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(url);
    const [ready, setReady] = useState(false);
    const videoRef = useRef(null);

    // ---- HTML5 <video> (MP4) ----
    useEffect(() => {
        if (isYouTube) return;
        const v = videoRef.current;
        if (!v) return;
        const onLoaded = () => setReady(true);
        const onEnded = () => onDone();
        v.addEventListener('loadedmetadata', onLoaded);
        v.addEventListener('ended', onEnded);
        // Bloquear seek si no está permitido
        if (!allowSeek) {
            let last = 0;
            const onTimeUpdate = () => { if (v.currentTime > last + 1) v.currentTime = last; else last = v.currentTime; };
            v.addEventListener('timeupdate', onTimeUpdate);
            return () => {
                v.removeEventListener('timeupdate', onTimeUpdate);
                v.removeEventListener('loadedmetadata', onLoaded);
                v.removeEventListener('ended', onEnded);
            };
        }
        return () => {
            v.removeEventListener('loadedmetadata', onLoaded);
            v.removeEventListener('ended', onEnded);
        };
    }, [isYouTube, allowSeek, onDone]);

    // ---- YouTube <iframe> ----
    // Para simplicidad (sin cargar IFrame API), dejamos un botón "Marcar visto".
    // Si prefieres gating estricto con la API, te preparo otra versión con enablejsapi.
    if (isYouTube) {
        const ytSrc = url.includes('enablejsapi=1')
            ? url
            : (url + (url.includes('?') ? '&' : '?') + 'rel=0&modestbranding=1&playsinline=1');

        return (
            <div>
                <div className="video-shell">
                    <div className="iframe-box">
                        <iframe
                            title="training-video"
                            src={ytSrc}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                        />
                    </div>
                </div>

                <div className="video-controls">
                    <button className="btn btn-outline" onClick={onDone}>
                        ✓ Marcar visto
                    </button>
                </div>
            </div>
        );
    }

    // ---- Player MP4 ----
    const mp4 = abs(url);
    return (
        <div>
            <video
                ref={videoRef}
                className="video-responsive"
                controls
                controlsList={allowSeek ? 'nodownload' : 'nodownload noplaybackrate'}
                style={{ width: '100%', background: '#000', borderRadius: 8 }}
            >
                <source src={mp4} type="video/mp4" />
                {allowSubtitles && tracks.map((t, i) => (
                    <track key={i} src={t.src} kind="subtitles" srcLang={t.srclang} label={t.label} default={t.default} />
                ))}
                Tu navegador no soporta la reproducción de vídeo.
            </video>

            {!ready && <div style={{ marginTop: 8, color: '#64748b', fontSize: 14 }}>Cargando vídeo…</div>}
        </div>
    );
}