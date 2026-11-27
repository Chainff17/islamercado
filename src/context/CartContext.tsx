import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type CartItem, type Listing } from '../lib/types'
import { useAuth } from './AuthContext'

interface CartContextValue {
  items: CartItem[]
  loading: boolean
  count: number
  total: number
  add: (listingId: string, qty?: number) => Promise<void>
  remove: (listingId: string) => Promise<void>
  setQty: (listingId: string, qty: number) => Promise<void>
  clear: () => Promise<void>
  refresh: () => Promise<void>
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('cart_items')
      .select(`id, user_id, listing_id, quantity, created_at, listings (${LISTING_SELECT})`)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    const rows = (data ?? []) as unknown as Array<CartItem & { listings: Listing | null }>
    setItems(
      rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        listing_id: r.listing_id,
        quantity: r.quantity,
        created_at: r.created_at,
        listing: r.listings ?? undefined,
      })),
    )
    setLoading(false)
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  const add = useCallback(
    async (listingId: string, qty = 1) => {
      if (!user) throw new Error('Inicia sesión para agregar al carrito')
      const existing = items.find((i) => i.listing_id === listingId)
      if (existing) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + qty })
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({ user_id: user.id, listing_id: listingId, quantity: qty })
        if (error) throw new Error(error.message)
      }
      await refresh()
    },
    [user, items, refresh],
  )

  const remove = useCallback(
    async (listingId: string) => {
      if (!user) return
      await supabase.from('cart_items').delete().eq('user_id', user.id).eq('listing_id', listingId)
      await refresh()
    },
    [user, refresh],
  )

  const setQty = useCallback(
    async (listingId: string, qty: number) => {
      if (!user) return
      if (qty <= 0) {
        await remove(listingId)
        return
      }
      await supabase
        .from('cart_items')
        .update({ quantity: qty })
        .eq('user_id', user.id)
        .eq('listing_id', listingId)
      await refresh()
    },
    [user, remove, refresh],
  )

  const clear = useCallback(async () => {
    if (!user) return
    await supabase.from('cart_items').delete().eq('user_id', user.id)
    await refresh()
  }, [user, refresh])

  const count = useMemo(() => items.reduce((a, i) => a + i.quantity, 0), [items])
  const total = useMemo(
    () => items.reduce((a, i) => a + Number(i.listing?.price_usd ?? 0) * i.quantity, 0),
    [items],
  )

  const value = useMemo(
    () => ({ items, loading, count, total, add, remove, setQty, clear, refresh }),
    [items, loading, count, total, add, remove, setQty, clear, refresh],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider')
  return ctx
}
