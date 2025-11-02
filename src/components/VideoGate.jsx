// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

// --- Detectar YouTube -------------------------------------------------------
function getYouTubeId(url = '') {
    if (!url) return null;
    const u = String(url);
    let m = u.match(/youtube\.com\/embed\/([^?&/]+)/i);
    if (m) return m[1];
    m = u.match(/youtu\.be\/([^?&/]+)/i);
    if (m) return m[1];
    m = u.match(/[?&]v=([^?&/]+)/i);
    if (m) return m[1];
    return null;
}

// Cargar IFrame API una sola vez
let ytReadyPromise = null;
function ensureYouTubeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!ytReadyPromise) {
        ytReadyPromise = new Promise((resolve) => {
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(s);
            window.onYouTubeIframeAPIReady = () => resolve(window.YT);
        });
    }
    return ytReadyPromise;
}

export default function VideoGate({
    src,
    tracks = [],
    allowSeek = false,
    allowSubtitles = true,
    onDone,
}) {
    // Log de inicio cada vez que cambia la fuente
    useEffect(() => { if (src) logEvent('video_start', { src }); }, [src]);

    const youTubeId = getYouTubeId(src);
    const isYouTube = !!youTubeId;

    // ====================== Rama YouTube ======================================
    const ytPlayerRef = useRef(null);
    const [ytEnded, setYtEnded] = useState(false);

    // ID estable para el contenedor del player (donde la API inyecta el iframe)
    const playerDomId = useMemo(
        () => 'yt-' + Math.random().toString(36).slice(2),
        [youTubeId]
    );

    useEffect(() => { setYtEnded(false); }, [youTubeId]);

    useEffect(() => {
        if (!isYouTube) return;

        let disposed = false;
        (async () => {
            const YT = await ensureYouTubeAPI();
            if (disposed) return;

            // Si no permites seek, ocultamos controles para reducir saltos
            const controls = allowSeek ? 1 : 0;

            ytPlayerRef.current = new YT.Player(playerDomId, {
                videoId: youTubeId,
                playerVars: {
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    controls,
                    fs: 1,
                    origin: window.location.origin,
                },
                events: {
                    onStateChange: (e) => {
                        if (e.data === window.YT.PlayerState.ENDED) {
                            setYtEnded(true);
                            onDone && onDone();
                            logEvent('video_done', { src });
                        }
                    },
                },
            });
        })();

        return () => {
            disposed = true;
            try { ytPlayerRef.current?.destroy?.(); } catch { }
        };
    }, [isYouTube, youTubeId, playerDomId, allowSeek, onDone, src]);

    if (isYouTube) {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Limita ancho y centra */}
                <div className="video-shell">
                    {/* Caja 16:9, altura limitada por CSS */}
                    <div className="iframe-box">
                        {/* La IFrame API insertará aquí el <iframe> ocupando todo */}
                        <div
                            id={playerDomId}
                            aria-label="YouTube player"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />
                    </div>
                </div>

                {!ytEnded && (
                    <p style={{ fontSize: 14, color: '#475569' }}>
                        Reproduce el vídeo completo para continuar.
                    </p>
                )}
            </div>
        );
    }

    // ====================== Rama MP4 (HTML5 <video>) ==========================
    const wrapRef = useRef(null);
    const vidRef = useRef(null);
    const [watched, setWatched] = useState(0);
    const [ended, setEnded] = useState(false);

    useEffect(() => { setWatched(0); setEnded(false); }, [src]);

    useEffect(() => {
        const v = vidRef.current;
        if (!v) return;

        const onTime = () => setWatched((w) => Math.max(w, v.currentTime));
        const onSeek = () => {
            if (!allowSeek && v.currentTime > watched + 0.5) {
                v.currentTime = Math.max(0, watched);
            }
        };
        const onEnded = () => {
            setEnded(true);
            onDone && onDone();
            logEvent('video_done', { src });
        };

        v.addEventListener('timeupdate', onTime);
        v.addEventListener('seeking', onSeek);
        v.addEventListener('ended', onEnded);

        return () => {
            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('seeking', onSeek);
            v.removeEventListener('ended', onEnded);
        };
    }, [allowSeek, watched, onDone, src]);

    // Resolver rutas relativas con BASE_URL (igual que tu lógica)
    const resolvedSrc = src && ((src.startsWith('http') || src.startsWith('data:'))
        ? src
        : (src.startsWith('/')
            ? (import.meta.env.BASE_URL + src.replace(/^\//, ''))
            : (import.meta.env.BASE_URL + src)));

    return (
        <div ref={wrapRef} style={{ display: 'grid', gap: 12 }}>
            {/* Limita ancho y centra */}
            <div className="video-shell">
                <video
                    ref={vidRef}
                    src={resolvedSrc}
                    controls
                    className="video-responsive"
                    style={{ borderRadius: 8, background: '#000' }}
                    controlsList={allowSeek ? 'nodownload' : 'nodownload noplaybackrate'}
                    preload="metadata"
                    playsInline
                >
                    {allowSubtitles && (tracks || []).map((t) => (
                        <track
                            key={t.src}
                            kind="subtitles"
                            src={t.src}
                            srcLang={t.srclang}
                            label={t.label}
                            default={t.default || false}
                        />
                    ))}
                </video>
            </div>

            {!ended && (
                <p style={{ fontSize: 14, color: '#475569' }}>
                    Reproduce el vídeo completo para continuar.
                </p>
            )}
        </div>
    );
}