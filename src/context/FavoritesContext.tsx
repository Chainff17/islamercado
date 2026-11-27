import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

interface FavoritesValue {
  ids: Set<string>
  isFavorite: (listingId: string) => boolean
  /** Devuelve false si no hay sesión (para redirigir a /entrar). */
  toggle: (listingId: string) => Promise<boolean>
}

const FavoritesContext = createContext<FavoritesValue | null>(null)

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [ids, setIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!user) {
      setIds(new Set())
      return
    }
    let active = true
    supabase
      .from('favorites')
      .select('listing_id')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (active) setIds(new Set((data ?? []).map((f) => f.listing_id as string)))
      })
    return () => {
      active = false
    }
  }, [user])

  const isFavorite = useCallback((id: string) => ids.has(id), [ids])

  const toggle = useCallback(
    async (listingId: string) => {
      if (!user) return false
      const had = ids.has(listingId)
      // Actualización optimista
      setIds((prev) => {
        const next = new Set(prev)
        if (had) next.delete(listingId)
        else next.add(listingId)
        return next
      })
      const { error } = had
        ? await supabase.from('favorites').delete().eq('user_id', user.id).eq('listing_id', listingId)
        : await supabase.from('favorites').insert({ user_id: user.id, listing_id: listingId })
      if (error) {
        setIds((prev) => {
          const next = new Set(prev)
          if (had) next.add(listingId)
          else next.delete(listingId)
          return next
        })
      }
      return true
    },
    [user, ids],
  )

  const value = useMemo(() => ({ ids, isFavorite, toggle }), [ids, isFavorite, toggle])
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}

export function useFavorites(): FavoritesValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites debe usarse dentro de FavoritesProvider')
  return ctx
}
