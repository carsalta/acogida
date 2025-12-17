// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    const version = Date.now(); // cache-buster único por build

    return {
        plugins: [
            react(),
            {
                name: 'html-cache-buster',
                transformIndexHtml(html) {
                    return html.replace(
                        /(src|href)="([^"]+\.(js|css))"/g,
                        (m, attr, url) => `${attr}="${url}?v=${version}"`
                    );
                }
            }
        ],
        base: '/acogida/', // ajusta si tu GitHub Pages está en /acogida/
        build: {
            outDir: 'docs',
            assetsDir: 'assets',
            emptyOutDir: true,
            sourcemap: false
        },
        css: {
            postcss: {
                plugins: []
            }
        },
        server: {
            headers: {
                'Cache-Control': 'no-store'
            }
        }
    }
})