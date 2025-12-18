
// src/main.jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';

// Registra el Service Worker solo en producción
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        const swUrl = import.meta.env.BASE_URL + 'sw.js'; // e.g. /acogida/sw.js

        navigator.serviceWorker.register(swUrl)
            .then((reg) => {
                // (Opcional) Forzar comprobación inmediata de actualizaciones del SW
                if (typeof reg.update === 'function') reg.update();

                // 🔔 Si el SW nos avisa de nueva versión, recargamos la página
                navigator.serviceWorker.addEventListener('message', (evt) => {
                    if (evt?.data?.type === 'NEW_VERSION') {
                        window.location.reload();
                    }
                });

                // 🔔 Si cambia el controlador (nuevo SW toma control), recarga una sola vez
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                    if (!window.__reloadedBySW) {
                        window.__reloadedBySW = true;
                        window.location.reload();
                    }
                });
            })
            .catch(() => {
                // Puedes loguear si quieres: console.warn('[SW] register error', err);
            });
    });
}

const container = document.getElementById('root');
createRoot(container).render(
    <React.StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </React.StrictMode>
)