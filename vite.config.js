// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // GitHub Pages project site: https://username.github.io/acogida/
    base: '/acogida/',
    build: {
        outDir: 'docs',     // ⬅️  genera directamente en docs/
        assetsDir: 'assets',
        emptyOutDir: true,  // limpia docs/ antes de generar
        sourcemap: false
    },
    css: {
        postcss: {
            plugins: []       // tu preferencia de ignorar configs externas
        }
    }
});