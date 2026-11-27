import { useEffect, useState } from 'react'
import { BadgeCheck, Store } from 'lucide-react'
import { supabase } from '../lib/supabase'

export type SellerBadge = 'verificado' | 'tienda'

/** Insignia pública del vendedor según su plan */
export function PlanBadge({ badge, size = 'md' }: { badge: SellerBadge | null | undefined; size?: 'sm' | 'md' }) {
  if (!badge) return null
  const isStore = badge === 'tienda'
  const Icon = isStore ? Store : BadgeCheck
  return (
    <span className={`plan-badge plan-badge-${badge} plan-badge-${size}`} title={isStore ? 'Tienda oficial con plan Tienda' : 'Vendedor verificado con plan Negocio'}>
      <Icon size={size === 'sm' ? 12 : 14} strokeWidth={2} />
      {isStore ? 'Tienda oficial' : 'Verificado'}
    </span>
  )
}

/** Carga las insignias de una lista de vendedores (una sola llamada) */
export function useSellerBadges(ids: Array<string | null | undefined>): Record<string, SellerBadge> {
  const [map, setMap] = useState<Record<string, SellerBadge>>({})
  const key = Array.from(new Set(ids.filter(Boolean) as string[])).sort().join(',')
  useEffect(() => {
    if (!key) {
      setMap({})
      return
    }
    let active = true
    supabase.rpc('get_seller_badges', { p_ids: key.split(',') }).then(({ data }) => {
      if (!active) return
      const out: Record<string, SellerBadge> = {}
      for (const r of (data ?? []) as Array<{ user_id: string; badge: SellerBadge }>) out[r.user_id] = r.badge
      setMap(out)
    })
    return () => {
      active = false
    }
  }, [key])
  return map
}
