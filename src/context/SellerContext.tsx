import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { fetchPlans, fetchSettings, DEFAULT_CUP_RATE, type Plan, type SellerStatus } from '../lib/plans'
import { useAuth } from './AuthContext'

/**
 * Estado de vendedor del usuario actual: plan vigente, solicitud pendiente, uso de su plan
 * y si es administrador. Lo comparten la cabecera, Publicar, Mis anuncios, Planes y Admin.
 */
interface SellerValue {
  loading: boolean
  plans: Plan[]
  settings: Record<string, string>
  cupRate: number
  status: SellerStatus | null
  /** Plan vigente (null si no tiene) */
  plan: Plan | null
  isAdmin: boolean
  /** Es administrador aunque falte verificar el 2FA en esta sesión */
  adminRole: boolean
  /** Cuenta suspendida */
  banned: boolean
  /** Puede publicar: admin o plan vigente */
  canSell: boolean
  refresh: () => Promise<void>
  reloadCatalog: () => Promise<void>
}

const SellerContext = createContext<SellerValue | null>(null)

export function SellerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<SellerStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadCatalog = useCallback(async () => {
    const [p, s] = await Promise.all([fetchPlans().catch(() => [] as Plan[]), fetchSettings().catch(() => ({}))])
    setPlans(p)
    setSettings(s)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(null)
      setLoading(false)
      return
    }
    const { data, error } = await supabase.rpc('my_seller_status')
    if (!error && data) setStatus(data as SellerStatus)
    setLoading(false)
  }, [user])

  useEffect(() => {
    reloadCatalog()
  }, [reloadCatalog])

  useEffect(() => {
    setLoading(true)
    refresh()
  }, [refresh])

  const value = useMemo<SellerValue>(() => {
    const plan = status?.subscription ? plans.find((p) => p.id === status.subscription!.plan_id) ?? null : null
    const isAdmin = !!status?.is_admin
    const adminRole = isAdmin || !!status?.admin_role
    const banned = !!status?.banned
    const rate = Number(settings.cup_rate) || DEFAULT_CUP_RATE
    return {
      loading,
      plans,
      settings,
      cupRate: rate,
      status,
      plan,
      isAdmin,
      adminRole,
      banned,
      canSell: !banned && (adminRole || !!plan),
      refresh,
      reloadCatalog,
    }
  }, [loading, plans, settings, status, refresh, reloadCatalog])

  return <SellerContext.Provider value={value}>{children}</SellerContext.Provider>
}

export function useSeller(): SellerValue {
  const ctx = useContext(SellerContext)
  if (!ctx) throw new Error('useSeller debe usarse dentro de SellerProvider')
  return ctx
}
