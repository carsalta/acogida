
# Inducción v3.3.1 — Ready for GitHub Pages

## Pasos rápidos
1) **Cambia el base de Vite** en `vite.config.js`:
```js
export default defineConfig({ base: '/TU_REPO/' }) // ← pon el nombre de tu repo
```
2) **Commit & push** a `main`.
3) GitHub → **Settings → Pages** → Source: **GitHub Actions**.
4) Espera al workflow `Deploy to GitHub Pages`.
5) Tu URL: `https://TU_USUARIO.github.io/TU_REPO/`.

### Notas
- `config.json`, `sw.js`, `manifest` y los **assets** se resuelven con `import.meta.env.BASE_URL`.
- En `public/config.json` las rutas (vídeos, logos) van **sin barra inicial** (p. ej. `videos/...`, `brand/...`).
- Si pones una URL absoluta `https://...`, se respetará tal cual.
