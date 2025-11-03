// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/acogida/',                 // 👈 coincide con la URL del repo
    css: {
        postcss: {
            plugins: []                    // no cargar configs globales
        }
    },
    build: {
        outDir: 'docs',                  // 👈 Pages servirá esta carpeta
        emptyOutDir: true
    }
})
   