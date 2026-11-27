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
  },
  preview: {
    host: '0.0.0.0',
    // Permite los hosts de preview de la plataforma y el local
    allow: ['4173-i1r45o4kvej8fdgsivgr8.e2b.app', 'localhost', '127.0.0.1'],
  },
})
