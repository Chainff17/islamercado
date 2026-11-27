import { supabase } from './supabase'

const BUCKET = 'listing-images'

/**
 * Devuelve la URL pública de una imagen del bucket de Supabase.
 * Si ya es una URL absoluta (http/https) la devuelve tal cual.
 */
export function storageUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const clean = path.replace(/^\/+/, '')
  return `${supabase.storage.from(BUCKET).getPublicUrl(clean).data.publicUrl}`
}

/**
 * Carga una imagen subida localmente al bucket y devuelve la ruta
 * almacenada en la tabla (el path dentro del bucket).
 */
export async function uploadImage(
  file: File,
  ownerId: string,
): Promise<string> {
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
