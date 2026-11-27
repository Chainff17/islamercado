import { supabase } from './supabase'

/** Plan de vendedor (tabla subscription_plans) */
export interface Plan {
  id: string
  name: string
  tagline: string | null
  price_usd: number
  /** null = ilimitados */
  max_listings: number | null
  max_photos: number
  max_featured: number
  badge: 'verificado' | 'tienda' | null
  stats: boolean
  perks: string[]
  highlight: boolean
  sort: number
  active: boolean
}

export type SubscriptionStatus = 'pending' | 'active' | 'rejected' | 'cancelled'

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  months: number
  amount: number
  currency: 'USD' | 'CUP' | 'MLC'
  payment_method: string
  payment_reference: string | null
  receipt_path: string | null
  notes: string | null
  status: SubscriptionStatus
  admin_note: string | null
  reviewed_at: string | null
  starts_at: string | null
  expires_at: string | null
  created_at: string
}

/** Respuesta de la RPC my_seller_status() */
export interface SellerStatus {
  is_admin: boolean
  subscription: Subscription | null
  pending: Subscription | null
  last: Subscription | null
  active_listings: number
  featured_listings: number
  pending_reviews: number
}

/** Fila de admin_list_subscriptions() */
export interface AdminSubscriptionRow extends Subscription {
  username: string | null
  email: string | null
  phone: string | null
  active_listings: number
}

export const PLAN_SELECT =
  'id, name, tagline, price_usd, max_listings, max_photos, max_featured, badge, stats, perks, highlight, sort, active'

/** Duraciones con descuento (deben coincidir con subscription_price() en la BD) */
export const DURATIONS = [
  { months: 1, label: '1 mes', discount: 0 },
  { months: 3, label: '3 meses', discount: 0.1 },
  { months: 6, label: '6 meses', discount: 0.15 },
  { months: 12, label: '12 meses', discount: 0.25 },
] as const

export const SUB_PAYMENT_METHODS = [
  { id: 'transfermovil', label: 'Transfermóvil', needsRef: true },
  { id: 'enzona', label: 'EnZona', needsRef: true },
  { id: 'zelle', label: 'Zelle', needsRef: true },
  { id: 'efectivo', label: 'Efectivo (en persona)', needsRef: false },
] as const

export const SUB_STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente de aprobación',
  active: 'Activa',
  rejected: 'Rechazada',
  cancelled: 'Cancelada',
  expired: 'Vencida',
}

export const DEFAULT_CUP_RATE = 360

/** Importe de una suscripción (mismo cálculo que el servidor; el servidor manda) */
export function planAmount(plan: Pick<Plan, 'price_usd'>, months: number, currency: string, cupRate = DEFAULT_CUP_RATE): number {
  const d = DURATIONS.find((x) => x.months === months)?.discount ?? 0
  const usd = Math.round(Number(plan.price_usd) * months * (1 - d) * 100) / 100
  return currency === 'CUP' ? Math.round(usd * cupRate) : usd
}

export function methodLabel(id: string): string {
  if (id === 'admin') return 'Alta del administrador'
  return SUB_PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id
}

/** Estado efectivo (una activa con fecha pasada se muestra como vencida) */
export function effectiveStatus(s: Pick<Subscription, 'status' | 'expires_at'>): string {
  if (s.status === 'active' && s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) return 'expired'
  return s.status
}

export function daysLeft(expires: string | null | undefined): number {
  if (!expires) return 0
  return Math.max(0, Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000))
}

export async function fetchPlans(): Promise<Plan[]> {
  const { data, error } = await supabase.from('subscription_plans').select(PLAN_SELECT).order('sort')
  if (error) throw new Error(error.message)
  return (data ?? []).map((p) => ({ ...p, price_usd: Number(p.price_usd), perks: p.perks ?? [] })) as Plan[]
}

export async function fetchSettings(): Promise<Record<string, string>> {
  const { data } = await supabase.from('app_settings').select('key, value')
  const out: Record<string, string> = {}
  for (const r of data ?? []) out[r.key] = r.value
  return out
}

// ── Comprobantes de pago (bucket privado payment-receipts) ─────────────────
const RECEIPTS = 'payment-receipts'

export async function uploadReceipt(file: File, userId: string): Promise<string> {
  if (file.size > 5 * 1024 * 1024) throw new Error('El comprobante supera 5 MB.')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const path = `${userId}/${Date.now()}.${ext || 'jpg'}`
  const { error } = await supabase.storage.from(RECEIPTS).upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  return path
}

/** URL temporal (10 min) para ver un comprobante privado */
export async function receiptUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(RECEIPTS).createSignedUrl(path, 600)
  return data?.signedUrl ?? null
}

/** Ventajas generadas a partir de los límites reales del plan (siempre al día si el admin los cambia) */
export function planPerks(p: Plan): string[] {
  const out = [
    p.max_listings ? `Hasta ${p.max_listings} anuncios activos` : 'Anuncios ilimitados',
    `${p.max_photos} fotos por anuncio`,
  ]
  if (p.max_featured > 0) out.push(`${p.max_featured} ${p.max_featured === 1 ? 'anuncio destacado' : 'anuncios destacados'} a la vez`)
  if (p.badge === 'verificado') out.push('Insignia «Vendedor verificado»')
  if (p.badge === 'tienda') out.push('Insignia «Tienda oficial»', 'Aparece en «Tiendas oficiales» de la portada')
  if (p.stats) out.push('Estadísticas de visitas por anuncio')
  out.push('Ventas con carrito, pedidos y WhatsApp')
  return out
}
