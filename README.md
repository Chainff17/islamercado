# islamercado

**Isla Mercado** — marketplace cubano para publicar y buscar artículos usados, con
chat entre comprador y vendedor, favoritos y reseñas.

## Funcionalidades

- **Home**: hero, acceso rápido por categorías y publicaciones más visitadas.
- **Búsqueda y filtros**: por categoría, texto (`?q=`) y orden (recientes, más vistos, precio).
- **Detalle de publicación**: galería de imágenes, datos del vendedor, contactar por mensaje,
  marcar como favorito y ver reseñas.
- **Mensajes**: conversación por publicación, lista agrupada, marcar como leída.
- **Vendedor**: perfil con su promedio de reseñas y sus publicaciones.
- **Publicar artículo**: formulario completo con subida de imágenes al bucket `listing-images`.
- **Auth**: registro e ingreso con email (Supabase Auth), perfil editable (usuario/teléfono).
- **Favoritos**: guarda las publicaciones que más te gusten.
- Responsive, en español, con imágenes de ejemplo incluidas.

## Stack

- **React 18 + Vite + TypeScript**
- **react-router-dom v6** (SPA con rutas)
- **@supabase/supabase-js** (data, auth y storage)
- **Supabase** (Postgres 17) — base de datos, auth y almacenamiento de imágenes

## Desarrollo local

```bash
npm install
cp .env.example .env    # y completar con las claves de Supabase
npm run dev             # servidor en http://localhost:5173
npm run build           # compila a dist/ (tsc + vite build)
npm run preview         # preview del build
```

## Despliegue (GitHub Pages)

El proyecto está configurado para desplegarse automáticamente a GitHub Pages:

- `.github/workflows/deploy.yml` — al recibir un push a `main`, compila (`npm run build`)
  y publica `dist/` en GitHub Pages.
- **URL de producción**: `https://chainff17.github.io/islamercado/`
- `vite.config.ts` usa `base: './'` para servir desde el subpath `/islamercado/`.
- `scripts/postbuild.mjs` genera `dist/404.html`, que redirige al root y permite que
  las rutas del SPA (ej. `/publicacion/<id>`) funcionen en Pages.

Para desplegar: subir el trabajo a `main` (por push o PR). El workflow hace el resto.

## Supabase

La configuración oficial de Supabase de **este repositorio** (islamercado) está en:

- **`supabase.config.json`** — datos del proyecto (ref, región, URLs).
- **`.env`** — variables `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (no versionadas).
- **`.env.example`** — plantilla para clonar/cambiar de máquina.

### Proyecto correspondiente

| Campo | Valor |
| --- | --- |
| Proyecto | `chain` |
| Ref | `xaumytmotnokdqbnxjgx` |
| Región | `us-west-2` |
| API URL | `https://xaumytmotnokdqbnxjgx.supabase.co` |
| Base de datos | `db.xaumytmotnokdqbnxjgx.supabase.co` (Postgres 17) |

> ⚠️ **Este Supabase es distinto al del "Gestor de Transferencias y pagos".**
> Cada proyecto tiene su propio `project_ref`, sus propias API keys y sus propias tablas.
> Nunca uses las claves ni las tablas del Gestor (gestor_snapshots, gestor_preferencias, etc.)
> para islamercado, ni viceversa. Para trabajar en islamercado, usa siempre los valores de
> `supabase.config.json` y `.env` de este repositorio.

### Tablas principales

- `categories`, `listings`, `profiles`, `reviews`, `messages`, `favorites`
- Todas con **RLS** activa.
- **Storage**: bucket público `listing-images` (lectura abierta; subida/borrado restringidos
  al folder del usuario autenticado).
- **RPC**: `increment_listing_views(p_id uuid)` — incrementa `listings.views` al entrar a
  una publicación.
- **Trigger**: `handle_new_user()` crea automáticamente el perfil al registrarse.

### Configuración de Auth

- `site_url`: `https://chainff17.github.io/islamercado/`
- Redirectos permitidos: la URL de producción (`/islamercado` y `/*`) y la del Gestor.
- Registro con email enabled, `mailer_autoconfirm=true`, refresh token rotación.
