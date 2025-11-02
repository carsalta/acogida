// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

// ------------------------- Helpers YouTube -------------------------
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

// Carga única de la IFrame API
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

// --------------------------- Componente ----------------------------
export default function VideoGate({
    src,
    tracks = [],
    allowSeek = false,
    allowSubtitles = true,
    onDone,
}) {
    // log start
    useEffect(() => { if (src) logEvent('video_start', { src }); }, [src]);

    const youTubeId = getYouTubeId(src);
    const isYouTube = !!youTubeId;

    // ====================== Rama YouTube ======================
    const ytPlayerRef = useRef(null);
    const [ytReady, setYtReady] = useState(false);
    const [ytPlaying, setYtPlaying] = useState(false);
    const [ytEnded, setYtEnded] = useState(false);

    // ID estable para contenedor donde la API inyecta el iframe
    const playerDomId = useMemo(
        () => 'yt-' + Math.random().toString(36).slice(2),
        [youTubeId]
    );

    useEffect(() => { setYtEnded(false); setYtPlaying(false); }, [youTubeId]);

    useEffect(() => {
        if (!isYouTube) return;

        let disposed = false;
        (async () => {
            const YT = await ensureYouTubeAPI();
            if (disposed) return;

            // Sin controles, branding mínimo, sin atajos teclado
            ytPlayerRef.current = new YT.Player(playerDomId, {
                videoId: youTubeId,
                playerVars: {
                    controls: 0,          // sin barra de controles de YouTube
                    modestbranding: 1,    // reduce la marca
                    rel: 0,               // relacionados del mismo canal
                    disablekb: 1,         // sin atajos de teclado
                    fs: 1,
                    playsinline: 1,
                    iv_load_policy: 3,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => setYtReady(true),
                    onStateChange: (e) => {
                        const S = window.YT.PlayerState;
                        if (e.data === S.PLAYING) setYtPlaying(true);
                        if (e.data === S.PAUSED) setYtPlaying(false);
                        if (e.data === S.ENDED) {
                            setYtPlaying(false);
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
    }, [isYouTube, youTubeId, playerDomId, onDone, src]);

    const handlePlay = () => {
        try { ytPlayerRef.current?.playVideo(); } catch { }
    };

    if (isYouTube) {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Limita ancho y centra */}
                <div className="video-shell">
                    {/* Caja 16:9 con altura limitada por CSS */}
                    <div className="iframe-box" style={{ position: 'relative' }}>
                        {/* El iframe real se inyecta aquí y ocupa todo el contenedor */}
                        <div
                            id={playerDomId}
                            aria-label="YouTube player"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />

                        {/* Overlay de Play propio para evitar interacción con UI de YouTube */}
                        {!ytPlaying && (
                            <div
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: 'grid', placeItems: 'center',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.15))'
                                }}
                            >
                                <button
                                    onClick={handlePlay}
                                    disabled={!ytReady}
                                    style={{
                                        appearance: 'none',
                                        padding: '12px 20px',
                                        borderRadius: 999,
                                        border: 0,
                                        fontWeight: 700,
                                        color: '#fff',
                                        background: 'var(--brand, #0ea5e9)',
                                        cursor: ytReady ? 'pointer' : 'not-allowed',
                                        boxShadow: '0 4px 14px rgba(0,0,0,0.2)'
                                    }}
                                    title={ytReady ? 'Reproducir' : 'Cargando…'}
                                >
                                    ▶ Reproducir
                                </button>
                            </div>
                        )}

                        {/* Escudo de clics transparente mientras reproduce:
                evita que cualquier clic abra YouTube o pause el vídeo. */}
                        {ytPlaying && (
                            <div
                                aria-hidden
                                style={{
                                    position: 'absolute', inset: 0,
                                    // captura eventos para que no se pueda clicar el logo
                                    pointerEvents: 'auto'
                                }}
                            />
                        )}
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

    // ====================== Rama MP4 (HTML5 <video>) ======================
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

    // Ajuste de altura como tu versión original
    useEffect(() => {
        const el = wrapRef.current; const v = vidRef.current;
        if (!el || !v) return;
        const compute = () => {
            const rect = el.getBoundingClientRect();
            const viewport = window.innerHeight || document.documentElement.clientHeight;
            const margin = 24;
            const maxH = Math.max(240, viewport - rect.top - margin);
            v.style.maxHeight = maxH + 'px';
            v.style.width = '100%';
        };
        compute();
        const ro = new ResizeObserver(compute);
        ro.observe(document.body);
        window.addEventListener('resize', compute);
        return () => { try { ro.disconnect(); } catch { } window.removeEventListener('resize', compute); };
    }, []);

    // Resolver rutas relativas con BASE_URL
    const resolvedSrc = src && ((src.startsWith('http') || src.startsWith('data:'))
        ? src
        : (src.startsWith('/')
            ? (import.meta.env.BASE_URL + src.replace(/^\//, ''))
            : (import.meta.env.BASE_URL + src)));

    return (
        <div ref={wrapRef} style={{ display: 'grid', gap: 12 }}>
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