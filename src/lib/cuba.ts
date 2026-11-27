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

export function formatMoney(amount: number, currency: Currency): string {
  const v = Number(amount).toLocaleString('es-CU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (currency === 'CUP') return `$${v} CUP`
  if (currency === 'MLC') return `$${v} MLC`
  return `$${v} USD`
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
