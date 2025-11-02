import React from 'react';

export default function SmartVideo({ url, title = 'Vídeo' }) {
    if (!url) return <p>No se ha encontrado el vídeo.</p>;

    const isYouTube = /youtube\.com\/embed|youtu\.be/i.test(url);

    if (isYouTube) {
        return (
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                <iframe
                    src={url}
                    title={title}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                />
            </div>
        );
    }

    return (
        <video
            className="video-responsive"
            src={url}
            controls
            preload="metadata"
            playsInline
            style={{ width: '100%', maxHeight: 'calc(100vh - 220px)' }}
        >
            Tu navegador no soporta vídeo HTML5.
        </video>
    );
}