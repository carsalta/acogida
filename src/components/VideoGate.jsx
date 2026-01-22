
// src/components/VideoGate.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { logEvent } from '../lib/analytics';


// ---------- Detección móvil (sin navigator.platform) ----------
const isMobileDevice = (() => {
    // Entornos SSR/test
    if (typeof navigator === 'undefined') return false;

    const ua = navigator.userAgent || '';
    const ch = navigator.userAgentData; // Client Hints (Chromium)

    // 1) Client Hints (si existen): fiable en Chromium
    const byCH = !!(ch && typeof ch.mobile === 'boolean' && ch.mobile);

    // 2) User‑Agent clásico: Android + iOS
    const isAndroid = /Android/i.test(ua);
    const isIOS = /iPhone|iPad|iPod/i.test(ua);

    // 3) iPadOS 13+ (Safari “se hace pasar” por Mac): “Macintosh” + pantalla táctil
    const isIPadOS13Plus = /Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1;

    // 4) Heurística de entrada “gruesa” (útil en tablets/phones)
    const byPointer = typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(pointer: coarse)').matches;

    return Boolean(byCH || isAndroid || isIOS || isIPadOS13Plus || byPointer);
})();


// ---------- Fullscreen helpers ----------
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
    src,            // URL principal (YouTube o MP4)
    mobileSrc,      // URL MP4 para móvil (forzado)
    tracks = [],
    allowSeek = false,
    allowSubtitles = true,
    onDone,
}) {
    useEffect(() => { if (src) logEvent('video_start', { src }); }, [src]);

    // Si es móvil y tenemos MP4 alternativo => usarlo
    const effectiveSrc = (isMobileDevice && mobileSrc) ? mobileSrc : src;

    const youTubeId = getYouTubeId(effectiveSrc);
    const isYouTube = !!youTubeId;

    // ===================== YOUTUBE (solo en escritorio) =====================
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
        if (!isYouTube) return;         // Si no es YouTube, no inicializar API
        if (isMobileDevice) return;     // En móvil no usamos YouTube nunca
        let disposed = false;

        (async () => {
            const YT = await ensureYouTubeAPI();
            if (disposed) return;

            ytPlayerRef.current = new YT.Player(playerDomId, {
                videoId: youTubeId,
                playerVars: {
                    controls: 0,               // UI propia (en escritorio)
                    modestbranding: 1,
                    rel: 0,
                    disablekb: 1,
                    fs: 1,
                    playsinline: 1,
                    iv_load_policy: 3,
                    hl: uiLang,
                    cc_lang_pref: uiLang,
                    cc_load_policy: allowSubtitles ? 1 : 0,
                    origin: window.location.origin,
                },
                events: {
                    onReady: () => {
                        setYtReady(true);
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
                            logEvent('video_done', { src: effectiveSrc });
                        }
                    },
                },
            });
        })();

        return () => {
            disposed = true;
            try { ytPlayerRef.current?.destroy?.(); } catch { /* ignore */ }
        };
    }, [isYouTube, youTubeId, playerDomId, allowSubtitles, uiLang, onDone, effectiveSrc]);

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
    const ytFullscreen = () => {
        try {
            const iframe = ytPlayerRef.current?.getIframe?.();
            if (iframe && enterFullscreen(iframe)) return;
        } catch { /* ignore */ }
        enterFullscreen(ytBoxRef.current);
    };

    if (isYouTube && !isMobileDevice) {
        // YouTube solo en ESCRITORIO
        return (
            <div style={{ display: 'grid', gap: 12 }}>
                <div className="video-shell">
                    <div ref={ytBoxRef} className="iframe-box" style={{ position: 'relative' }}>
                        <div
                            id={playerDomId}
                            aria-label="YouTube player"
                            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                        />
                        {!ytPlaying && (
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
                        {ytPlaying && (
                            <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }} />
                        )}
                    </div>

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

    useEffect(() => { setWatched(0); setEnded(false); }, [effectiveSrc]);

    useEffect(() => {
        const v = vidRef.current;
        if (!v) return;
        const onTime = () => setWatched((w) => Math.max(w, v.currentTime));
        const onSeek = () => { if (!allowSeek && v.currentTime > watched + 0.5) v.currentTime = Math.max(0, watched); };
        const onEnded = () => { setEnded(true); onDone && onDone(); logEvent('video_done', { src: effectiveSrc }); };
        v.addEventListener('timeupdate', onTime);
        v.addEventListener('seeking', onSeek);
        v.addEventListener('ended', onEnded);
        return () => {
            v.removeEventListener('timeupdate', onTime);
            v.removeEventListener('seeking', onSeek);
            v.removeEventListener('ended', onEnded);
        };
    }, [allowSeek, watched, onDone, effectiveSrc]);

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

    const resolvedSrc = effectiveSrc && ((effectiveSrc.startsWith('http') || effectiveSrc.startsWith('data:'))
        ? effectiveSrc
        : (effectiveSrc.startsWith('/')
            ? (import.meta.env.BASE_URL + effectiveSrc.replace(/^\/+/, ''))
            : (import.meta.env.BASE_URL + effectiveSrc)));

    const mp4Fullscreen = () => {
        const v = vidRef.current; if (!v) return;
        // iOS: primero native video fullscreen; si no, el contenedor
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
