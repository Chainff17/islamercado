import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Content-Security-Policy solo en el build de producción (en desarrollo Vite necesita
 * scripts en línea para el refresco en caliente). Bloquea scripts de terceros inyectados
 * (XSS), limita las conexiones a Supabase y prohíbe <object>/<iframe>.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'none'",
].join('; ')

function securityHeaders(): Plugin {
  return {
    name: 'islamercado-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta name="referrer"',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer"`,
      )
    },
  }
}

// base: './' permite desplegar tanto en raíz como en un subpath
// (p. ej. https://chainff17.github.io/islamercado/) sin romper las rutas.
export default defineConfig({
  plugins: [react(), securityHeaders()],
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
