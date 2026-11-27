# islamercado

**Isla Mercado** — marketplace cubano para publicar y buscar artículos usados, con
chat entre comprador y vendedor, favoritos y reseñas.

## Diseño

Interfaz cálida inspirada en La Habana: fondo crema, terracota (`#b4532f`) como color
principal, verde oliva para acciones secundarias, mosaicos de categoría en tonos pastel y
titulares en **Fraunces** (serif) con texto en **DM Sans**. Iconos de `lucide-react`.

- **Cabecera**: logo de palma, buscador, píldora **Ahorro** (modo bajo consumo de datos: imágenes
  ligeras y sin ilustraciones), carrito, notificaciones, *Mi cuenta* y **Publicar anuncio**.
- **Sub-navegación**: Categorías ▾, Inicio, Anuncios recientes, Favoritos, **Mapa** y selector
  de provincia (*Toda Cuba* o una de las 16), que filtra todo el sitio y se recuerda en el navegador.

## Funcionalidades (estilo Mercado Libre, hecho para Cuba 🇨🇺)

- **Home**: hero *"Tu isla, tu mercado."*, *Explora por categoría*, *Anuncios recientes*
  (con filtros y orden), sección **Hecho en Cuba** y "Así de fácil".
- **Anuncios**: precios en la moneda del vendedor (`18.500 CUP`, `320 USD / mes`), sello
  **Hecho en Cuba** y **alquileres** con precio por mes/semana/día/noche/hora.
- **Mapa** (`/mapa`): anuncios por provincia sobre un mapa de Cuba (Leaflet).
- **Categorías** (`/categorias`): todas las categorías con su número de anuncios.
- **Búsqueda y filtros**: texto (título + descripción), categoría, **16 provincias**, condición,
  rango de precio, solo ofertas, orden y paginación.
- **Ficha de producto**: galería, precio con descuento y equivalencia en **CUP/MLC**, stock,
  selector de cantidad, **Comprar ahora**, **Agregar al carrito**, envío gratis,
  **Preguntas y respuestas**, reputación del vendedor, WhatsApp (+53), relacionados.
- **Carrito** persistente en Supabase (por usuario) con control de stock.
- **Checkout**: datos de entrega (provincia/municipio/dirección), métodos de pago cubanos
  (Transfermóvil, Zelle, efectivo CUP/USD/MLC, contra entrega). Se crea **un pedido por vendedor y
  moneda**, con totales separados por moneda; se descuenta stock (salvo en alquileres) y se notifica al vendedor por mensaje (RPC `place_order`).
- **Mis compras / Mis ventas**: estados *Pendiente → Confirmado → En camino → Entregado* o
  *Cancelado* (restaura stock), contacto por WhatsApp y calificación del vendedor al recibir.
- **Mis publicaciones**: editar, pausar, reactivar, marcar vendida, eliminar.
- **Publicar**: venta o alquiler (con periodo), moneda (USD/CUP/MLC), precio anterior (oferta),
  stock, negociable, envío gratis, *Hecho en Cuba* y hasta 8 fotos.
- **Mensajes**, **Favoritos**, **perfil de vendedor**, **Auth** por email.
- Responsive, en español, `HashRouter` para que las rutas profundas funcionen en GitHub Pages.

## Stack

- **React 18 + Vite + TypeScript**
- **react-router-dom v6** (SPA con rutas)
- **@supabase/supabase-js** (data, auth y storage)
- **lucide-react**, **Leaflet** (mapa, cargado bajo demanda), **@fontsource-variable** (Fraunces, DM Sans)
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
- `cart_items`, `orders`, `order_items`, `questions` (marketplace estilo Mercado Libre)
- Todas con **RLS** activa. Los pedidos solo se crean/modifican vía RPC `SECURITY DEFINER`.
- **RPC**: `place_order(...)` (checkout atómico: valida stock, crea pedidos por vendedor,
  descuenta stock, notifica y vacía el carrito) y `update_order_status(p_order, p_status)`.
- Migraciones SQL versionadas en `supabase/migrations/`.
- **Storage**: bucket público `listing-images` (lectura abierta; subida/borrado restringidos
  al folder del usuario autenticado).
- **RPC**: `increment_listing_views(p_id uuid)` — incrementa `listings.views` al entrar a
  una publicación.
- **Trigger**: `handle_new_user()` crea automáticamente el perfil al registrarse.

### Configuración de Auth

- `site_url`: `https://chainff17.github.io/islamercado/`
- Redirectos permitidos: la URL de producción (`/islamercado` y `/*`) y la del Gestor.
- Registro con email enabled, `mailer_autoconfirm=true`, refresh token rotación.
