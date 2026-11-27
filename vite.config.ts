import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' permite desplegar tanto en raíz como en un subpath
// (p. ej. https://chainff17.github.io/islamercado/) sin romper las rutas.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0',
    // Permite hosts de preview (e2b, túneles) además de localhost
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
})
