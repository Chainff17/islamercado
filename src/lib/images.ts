/**
 * Resuelve la URL de una imagen de listing.
 * - Si ya es URL absoluta (storage de Supabase) la devuelve tal cual.
 * - Si es una ruta relativa (p. ej. '/seed/tv43.jpg') la resolvemos contra
 *   el base del despliegue (base: './' funciona en raíz y en subpath).
 */
export function imageUrl(path: string | null | undefined): string {
  if (!path) return ''
  const base = import.meta.env.BASE_URL || '/'
  if (/^https?:\/\//i.test(path)) return path
  return base + path.replace(/^\/+/, '')
}
