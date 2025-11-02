// vite.config.js (versión que ignora configs externas)
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    base: '/acogida/',
    css: {
        postcss: {
            plugins: []   // 👈 no cargará configs globales
        }
    }
})