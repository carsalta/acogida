
// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';

// ---------- Detección de iOS (incl. iPadOS con Safari) ----------
const isIOS = (() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua);
    const iPadOS13Plus = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return iOS || iPadOS13Plus;
})();

// ---------- Helpers Fullscreen (cross‑browser / iOS) ----------
function enterFullscreen(el) {
    if (!el) return false;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (typeof req === 'function') {
        try { req.call(el); return true; } catch { /* ignore */ }
    }
    // iOS Safari: API específica de <video>
    if (el.tagName === 'VIDEO' && typeof el.webkitEnterFullscreen === 'function') {
        try { el.webkitEnterFullscreen(); return true; } catch { /* ignore */ }
    }
    return false;
}

// ---------- YouTube helpers ----------
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

// ---------------------- Componente ----------------------
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
                    // ⚠️ En iOS mostramos controles nativos para disponer de su botón de pantalla completa
                    controls: isIOS ? 1 : 0,
                    modestbranding: 1,
                    rel: 0,
                    disablekb: 1,
                    fs: 1,
                    playsinline: 1,  // evita auto-fullscreen en iOS si no queremos
                    iv_load_policy: 3,
                    hl: uiLang,
                    cc_lang_pref: uiLang,
                    cc_load_policy: allowSubtitles ? 1 : 0,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        setYtReady(true);
                        // Asegurar permisos de fullscreen en el iframe
                        try {
                            const iframe = ytPlayerRef.current?.getIframe?.();
                            if (iframe) {
                                iframe.setAttribute('allowfullscreen', 'true');
                                const currentAllow = iframe.getAttribute('allow') || '';
                                const needed = 'fullscreen; autoplay; encrypted-media; picture-in-picture';
                                if (!currentAllow.includes('fullscreen')) {
                                    iframe.setAttribute('allow', `${needed}${currentAllow ? '; ' + currentAllow : ''}`);
                                }
                            }
                        } catch { /* ignore */ }
                    },
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
            try { ytPlayerRef.current?.destroy?.(); } catch { /* ignore */ }
        };
    }, [isYouTube, youTubeId, playerDomId, allowSubtitles, uiLang, onDone, src]);

    const ytPlay = () => { try { ytPlayerRef.current?.playVideo(); } catch { } };
    const ytPause = () => { try { ytPlayerRef.current?.pauseVideo(); } catch { } };
    const ytToggle = () => (ytPlaying ? ytPause() : ytPlay());

    const ytToggleCaptions = () => {
        try {
            const on = !ytCaptions;
            setYtCaptions(on);
            if (on) {
                ytPlayerRef.current?.setOption('captions', 'track', { languageCode: uiLang });
                ytPlayerRef.current?.setOption('captions', 'reload', true);
            } else {
                ytPlayerRef.current?.setOption('captions', 'track', {});
                ytPlayerRef.current?.setOption('captions', 'reload', true);
            }
        } catch { /* ignore */ }
    };

    const openYouTubeExtern = () => {
        if (!youTubeId) return;
        // Abre en app/navegador de YouTube con fullscreen permitido
        window.open(`https://www.youtube.com/watch?v=${youTubeId}&autoplay=1&fs=1`, '_blank', 'noopener,noreferrer');
    };

    const ytFullscreen = () => {
        // 1) Intentar fullscreen al propio iframe
        try {
            const iframe = ytPlayerRef.current?.getIframe?.();
            if (iframe) {
                iframe.setAttribute('allowfullscreen', 'true');
                const allow = iframe.getAttribute('allow') || '';
                if (!allow.includes('fullscreen')) {
                    iframe.setAttribute('allow', `fullscreen; ${allow}`);
                }
                if (enterFullscreen(iframe)) return;
            }
        } catch { /* ignore */ }
        // 2) Fallback: contenedor
        if (enterFullscreen(ytBoxRef.current)) return;
        // 3) iOS: algunos WebKit no permiten fullscreen programático en iframe → abrir en YouTube
        if (isIOS) openYouTubeExtern();
    };

    if (isYouTube) {
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                {/* Caja 16:9 */}
                <div className="video-shell">
                    <div ref={ytBoxRef} className="iframe-box" style={{ position: 'relative' }}>
                        <div
                            id={playerDomId}
                            aria-label="YouTube player"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />
                        {/* Overlay inicial (solo si ocultamos controles); en iOS usamos controles nativos */}
                        {!isIOS && !ytPlaying && (
                            <div
                                style={{
                                    position: 'absolute', inset: 0,
                                    display: 'grid', placeItems: 'center',
                                    background: 'linear-gradient(transparent, rgba(0,0,0,0.15))'
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
                        {/* Escudo anti‑clics durante reproducción (sólo cuando ocultamos controles) */}
                        {!isIOS && ytPlaying && (
                            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} />
                        )}
                    </div>

                    {/* Controles propios (seguimos mostrándolos; en iOS también tendrás los nativos) */}
                    <div className="video-controls" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 }}>
                        <button className="btn btn-outline" onClick={ytToggle}>
                            {ytPlaying ? 'Pausa ⏸' : 'Play ▶'}
                        </button>
                        {allowSubtitles && (
                            <button className="btn btn-outline" onClick={ytToggleCaptions} title="Subtítulos">
                                {ytCaptions ? 'Subtítulos: ON' : 'Subtítulos: OFF'}
                            </button>
                        )}
                        <button className="btn btn-outline" onClick={ytFullscreen} title="Pantalla completa">
                            ⛶ Pantalla completa
                        </button>
                        {/* Fallback visible en iOS por claridad */}
                        {isIOS && (
                            <button className="btn btn-outline" onClick={openYouTubeExtern} title="Abrir en YouTube">
                                ↗ Abrir en YouTube
                            </button>
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
        const onSeek = () => { if (!allowSeek && v.currentTime > watched + 0.5) v.currentTime = Math.max(0, watched); };
        const onEnded = () => { setEnded(true); onDone && onDone(); logEvent('video_done', { src }); };
        v.addEventListener('timeupdate', onTime);
        v.addEventListener('seeking', onSeek);
        v.addEventListener('ended', onEnded);
        return () => {
            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('seeking', onSeek);
            v.removeEventListener('ended', onEnded);
        };
    }, [allowSeek, watched, onDone, src]);

    // Ajuste de altura responsivo
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
            ? (import.meta.env.BASE_URL + src.replace(/^\/+/, ''))
            : (import.meta.env.BASE_URL + src)));

    const mp4Fullscreen = () => {
        const v = vidRef.current; if (!v) return;
        // iOS: primero intentamos fullscreen nativo del <video>, luego contenedor
        if (!enterFullscreen(v)) enterFullscreen(wrapRef.current);
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
                    {(allowSubtitles && (tracks ?? [])).map((t) => (
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
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                    <button className="btn btn-outline" onClick={mp4Fullscreen} title="Pantalla completa">
                        ⛶ Pantalla completa
                    </button>
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