// Datos y utilidades específicas para Cuba: provincias, monedas y pagos.
export const PROVINCES = [
  'Pinar del Río',
  'Artemisa',
  'La Habana',
  'Mayabeque',
  'Matanzas',
  'Cienfuegos',
  'Villa Clara',
  'Sancti Spíritus',
  'Ciego de Ávila',
  'Camagüey',
  'Las Tunas',
  'Granma',
  'Holguín',
  'Santiago de Cuba',
  'Guantánamo',
  'Isla de la Juventud',
] as const

export type Currency = 'USD' | 'CUP' | 'MLC'

export const CURRENCIES: { code: Currency; label: string; symbol: string }[] = [
  { code: 'USD', label: 'USD (dólar)', symbol: '$' },
  { code: 'CUP', label: 'CUP (peso cubano)', symbol: '$' },
  { code: 'MLC', label: 'MLC (moneda libre)', symbol: '$' },
]

// Tasas de referencia (editables). 1 USD ≈ 360 CUP, 1 USD ≈ 1 MLC.
export const RATES: Record<Currency, number> = {
  USD: 1,
  CUP: 360,
  MLC: 1,
}

export function convert(amount: number, from: Currency, to: Currency): number {
  if (from === to) return amount
  const usd = amount / RATES[from]
  return usd * RATES[to]
}

/** Formato cubano: 18.500 · 1.250,50 (punto de miles, coma decimal). */
export function formatAmount(amount: number): string {
  const n = Number(amount) || 0
  const whole = Math.abs(n - Math.round(n)) < 0.005
  const fixed = whole ? String(Math.round(n)) : n.toFixed(2)
  const [int, dec] = fixed.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return dec ? `${grouped},${dec}` : grouped
}

export function formatMoney(amount: number, currency: Currency): string {
  return `${formatAmount(amount)} ${currency}`
}

export const PERIODS: { id: string; label: string }[] = [
  { id: 'mes', label: 'por mes' },
  { id: 'semana', label: 'por semana' },
  { id: 'dia', label: 'por día' },
  { id: 'noche', label: 'por noche' },
  { id: 'hora', label: 'por hora' },
]

export function asCurrency(c: string | null | undefined): Currency {
  return c === 'CUP' || c === 'MLC' ? c : 'USD'
}

/** Centro aproximado de cada provincia (para el mapa). */
export const PROVINCE_COORDS: Record<string, [number, number]> = {
  'Pinar del Río': [22.4175, -83.6981],
  Artemisa: [22.8136, -82.7633],
  'La Habana': [23.1136, -82.3666],
  Mayabeque: [22.9617, -82.1511],
  Matanzas: [23.0411, -81.5775],
  Cienfuegos: [22.1461, -80.4356],
  'Villa Clara': [22.4069, -79.9647],
  'Sancti Spíritus': [21.9297, -79.4425],
  'Ciego de Ávila': [21.84, -78.7619],
  Camagüey: [21.3808, -77.9169],
  'Las Tunas': [20.9617, -76.9511],
  Granma: [20.3792, -76.6433],
  Holguín: [20.8872, -76.2631],
  'Santiago de Cuba': [20.0247, -75.8219],
  Guantánamo: [20.1444, -75.2092],
  'Isla de la Juventud': [21.8833, -82.8],
}

export const PAYMENT_METHODS: { id: string; label: string; hint: string }[] = [
  { id: 'transfermovil', label: 'Transfermóvil', hint: 'Transferencia bancaria nacional' },
  { id: 'zelle', label: 'Zelle', hint: 'Desde el exterior (EE. UU.)' },
  { id: 'efectivo_cup', label: 'Efectivo CUP', hint: 'Peso cubano en mano' },
  { id: 'efectivo_usd', label: 'Efectivo USD', hint: 'Dólares en mano' },
  { id: 'efectivo_mlc', label: 'Efectivo MLC', hint: 'Moneda libre convertible' },
  { id: 'contra_entrega', label: 'Pago contra entrega', hint: 'Pagas al recibir el producto' },
]

export function paymentLabel(id: string): string {
  return PAYMENT_METHODS.find((p) => p.id === id)?.label ?? id
}

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendiente', color: '#b45309' },
  confirmed: { label: 'Confirmado', color: '#1d4ed8' },
  shipped: { label: 'En camino', color: '#7c3aed' },
  delivered: { label: 'Entregado', color: '#0f7a5a' },
  cancelled: { label: 'Cancelado', color: '#b91c1c' },
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null
  const full = digits.startsWith('53') ? digits : `53${digits.replace(/^0+/, '')}`
  const msg = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${full}${msg}`
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').replace(/^53/, '').slice(-10)
}
