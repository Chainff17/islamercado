// Script de postbuild: genera un 404.html con redirección SPA para GitHub Pages.
// Se copia a dist/ para que cualquier ruta profunda recargue la app.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist404 = join(root, 'dist', '404.html')

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./" />
    <title>Isla Mercado</title>
    <script>
      // Redirección SPA: cualquier ruta inexistente en GitHub Pages vuelve al inicio de la app.
      window.location.replace('./')
    </script>
  </head>
  <body>
    Redirigiendo a Isla Mercado… <a href="./">Ir al inicio</a>
  </body>
</html>
`

if (existsSync(dirname(dist404))) {
  writeFileSync(dist404, html, 'utf8')
  console.log('✓ dist/404.html generado (redirección SPA para GitHub Pages)')
} else {
  console.warn('⚠ dist/ no existe; se omite la generación de 404.html')
}
