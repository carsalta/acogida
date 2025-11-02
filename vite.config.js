
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// ⚠️ Cambia '/TU_REPO/' por el nombre EXACTO de tu repo con barras.
export default defineConfig({
  plugins: [react()],
  base: '/TU_REPO/',
});
