import { supabase } from './supabase'

const BUCKET = 'listing-images'

/**
 * Devuelve la URL pública de una imagen.
 * - URLs absolutas (http/https) se devuelven tal cual (Unsplash, etc.)
 * - Rutas locales del repo (/seed/..., /...) se devuelven tal cual (relativas)
 * - Resto: se asume path dentro del bucket de Supabase.
 */
export function storageUrl(path: string, width?: number): string {
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) {
    // Imágenes de Unsplash: pedimos el tamaño justo (y más ligero en modo ahorro)
    if (width && path.includes('images.unsplash.com')) {
      const saver = typeof document !== 'undefined' && document.documentElement.classList.contains('ahorro')
      const w = saver ? Math.min(width, 360) : width
      const q = saver ? 40 : 75
      return path.replace(/([?&])w=\d+/, `$1w=${w}`).replace(/([?&])q=\d+/, `$1q=${q}`)
    }
    return path
  }
  // Rutas locales del repo: se resuelven contra la base de Vite (funciona en GitHub Pages)
  if (path.startsWith('/seed/')) return `${import.meta.env.BASE_URL}${path.slice(1)}`
  if (path.startsWith('./seed/')) return `${import.meta.env.BASE_URL}${path.slice(2)}`
  if (path.startsWith('/')) return path
  const clean = path.replace(/^\/+/, '')
  return `${supabase.storage.from(BUCKET).getPublicUrl(clean).data.publicUrl}`
}

export async function uploadImage(file: File, ownerId: string): Promise<string> {
  const safeName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
  const path = `${ownerId}/${safeName}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  })
  if (error) throw new Error(error.message)
  return path
}

export function removeImage(path: string): Promise<void> {
  const clean = path.replace(/^\/+/, '')
  return supabase.storage.from(BUCKET).remove([clean]).then((r) => {
    if (r.error) throw new Error(r.error.message)
  })
}
