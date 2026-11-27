import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Configuración PÚBLICA del proyecto Supabase de islamercado ("chain", ref xaumytmotnokdqbnxjgx).
 *
 * La clave `anon` está pensada para usarse en el navegador: viaja dentro del JavaScript
 * publicado en cualquier caso, y la seguridad de los datos la garantizan las políticas RLS
 * de cada tabla. Se deja aquí como valor por defecto para que la compilación de GitHub Pages
 * (que no tiene acceso al `.env`, porque no se versiona) funcione igual que en local.
 *
 * ⚠️ NUNCA pongas aquí la clave `service_role` ni una `sb_secret_…`.
 *
 * Para usar otro proyecto, define VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en `.env`
 * o como variables del repositorio en GitHub (Settings → Secrets and variables → Actions → Variables).
 */
const PUBLIC_SUPABASE_URL = 'https://xaumytmotnokdqbnxjgx.supabase.co'
const PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhdW15dG1vdG5va2RxYm54amd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMTI1NjEsImV4cCI6MjExMDc4ODU2MX0.5TYJVNVvx2fh4wbZ47woGbkgPcK9i4zmBqGzjQ7dQBg'

/** Ignora valores vacíos o plantillas sin completar de .env.example */
function pick(value: string | undefined, fallback: string): string {
  const v = (value ?? '').trim()
  return v && !v.includes('REPLACE_WITH') ? v : fallback
}

const url = pick(import.meta.env.VITE_SUPABASE_URL, PUBLIC_SUPABASE_URL)
const anonKey = pick(import.meta.env.VITE_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_ANON_KEY)

export const supabase: SupabaseClient = createClient(url, anonKey)
