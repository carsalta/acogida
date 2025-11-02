// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

// ---------- Helpers YouTube ----------
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

// ---------- Componente ----------
export default function VideoGate({
    src,
    tracks = [],
    allowSeek = false,
    allowSubtitles = true,
    onDone,
}) {
    useEffect(() => { if (src) logEvent('video_start', { src }); }, [src]);

    const youTubeId = getYouTubeId(src);
    const isYouTube = !!youTubeId;

    // ===================== YOUTUBE =====================
    const ytPlayerRef = useRef(null);
    const ytBoxRef = useRef(null);
    const [ytReady, setYtReady] = useState(false);
    const [ytPlaying, setYtPlaying] = useState(false);
    const [ytEnded, setYtEnded] = useState(false);
    const [ytCaptions, setYtCaptions] = useState(!!allowSubtitles);

    const uiLang = (navigator.language || 'es').slice(0, 2);

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

            ytPlayerRef.current = new YT.Player(playerDomId, {
                videoId: youTubeId,
                playerVars: {
                    controls: allowSeek ? 1 : 0,         // habilita barra si permites seek
                    modestbranding: 1,
                    rel: 0,
                    disablekb: allowSeek ? 0 : 1,     // si no hay seek, desactiva atajos
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
    }, [isYouTube, youTubeId, playerDomId, allowSubtitles, uiLang, onDone, src]);

    const ytPlay = () => { try { ytPlayerRef.current?.playVideo(); } catch { } };
    const ytPause = () => { try { ytPlayerRef.current?.pauseVideo(); } catch { } };
    const ytToggle = () => (ytPlaying ? ytPause() : ytPlay());

    const ytToggleCaptions = () => {
        // Intentamos activar/desactivar captions vía API (si hay pista en el vídeo)
        try {
            const on = !ytCaptions;
            setYtCaptions(on);
            if (on) {
                ytPlayerRef.current?.setOption('captions', 'track', { languageCode: uiLang });
                ytPlayerRef.current?.setOption('captions', 'reload', true);
            } else {
                ytPlayerRef.current?.setOption('captions', 'track', {}); // mejor esfuerzo para ocultarlas
                ytPlayerRef.current?.setOption('captions', 'reload', true);
            }
        } catch { }
    };

    const ytFullscreen = () => {
        const el = ytBoxRef.current;
        if (!el) return;
        const rfs = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
        rfs?.call(el);
    };

    if (isYouTube) {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Tamaño limitado y centrado */}
                <div className="video-shell">
                    {/* Caja 16:9 */}
                    <div className="iframe-box" style={{ position: 'relative' }}>
                        {/* 1) Aquí la IFrame API inyecta el <iframe> y ocupa todo */}
                        <div
                            id={playerDomId}
                            aria-label="YouTube player"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />

                        {/* 2) Overlay de Play (solo cuando NO está reproduciendo) */}
                        {!ytPlaying && (
                            <div
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: 'grid', placeItems: 'center',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.15))',
                                    zIndex: 2
                                }}
                            >
                                <button
                                    onClick={ytPlay}
                                    disabled={!ytReady}
                                    className="btn"
                                    style={{ padding: '12px 20px', fontWeight: 700 }}
                                    title={ytReady ? 'Reproducir' : 'Cargando…'}
                                >
                                    ▶ Reproducir
                                </button>
                            </div>
                        )}

                        {/* 3) 👇 ESCUDO ANTICLICS: va DENTRO de .iframe-box y por ENCIMA del iframe */}
                        {ytPlaying && !allowSeek && (
                            <div
                                aria-hidden
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    zIndex: 3,
                                    pointerEvents: 'auto',   // captura clics para que NO lleguen al iframe
                                    background: 'transparent'
                                }}
                            />
                        )}
                    </div>
                    {/* ----------------- Controles propios ----------------- */}
                    <div className="video-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button className="btn btn-outline" onClick={ytToggle}>
                            {ytPlaying ? 'Pausa ▌▌' : 'Play ▶'}
                        </button>

                        {allowSubtitles && (
                            <button className="btn btn-outline" onClick={ytToggleCaptions} title="Subtítulos">
                                {ytCaptions ? 'Subtítulos: ON' : 'Subtítulos: OFF'}
                            </button>
                        )}

                        <button className="btn btn-outline" onClick={ytFullscreen} title="Pantalla completa">
                            ⛶ Pantalla completa
                        </button>
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

    // ===================== MP4 (HTML5 <video>) =====================
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

    const resolvedSrc = src && ((src.startsWith('http') || src.startsWith('data:'))
        ? src
        : (src.startsWith('/')
            ? (import.meta.env.BASE_URL + src.replace(/^\//, ''))
            : (import.meta.env.BASE_URL + src)));

    const mp4Fullscreen = () => {
        const v = vidRef.current; if (!v) return;
        (v.requestFullscreen || v.webkitRequestFullscreen || v.msRequestFullscreen)?.call(v);
    };

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

                {/* Botón de pantalla completa para MP4 (además del nativo) */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-outline" onClick={mp4Fullscreen}>⛶ Pantalla completa</button>
                </div>
            </div>

            {!ended && (
                <p style={{ fontSize: 14, color: '#475569' }}>
                    Reproduce el vídeo completo para continuar.
                </p>
            )}
        </div>
    );
}
``