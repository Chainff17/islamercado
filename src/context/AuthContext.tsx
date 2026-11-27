import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthState {
  user: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (
    email: string,
    password: string,
    options?: { username?: string }
  ) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (data: { username?: string; phone?: string; avatar_url?: string }) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, phone, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return null
  return data as Profile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      const sessionUser = data.session?.user ?? null
      if (!sessionUser) {
        setLoading(false)
        return
      }
      fetchProfile(sessionUser.id).then((p) => {
        if (!active) return
        setUser(p)
        setLoading(false)
      })
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null
      if (!sessionUser) {
        setUser(null)
        setLoading(false)
        return
      }
      fetchProfile(sessionUser.id).then((p) => setUser(p))
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) {
      const { data } = await supabase.auth.getSession()
      if (data.session) setUser(await fetchProfile(data.session.user.id))
    }
    return { error: error?.message ?? null }
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, options?: { username?: string }) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username: options?.username || email.split('@')[0] },
        },
      })
      return { error: error?.message ?? null }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
  }, [])

  const updateProfile = useCallback(
    async (data: { username?: string; phone?: string; avatar_url?: string }) => {
      if (!user) return { error: 'No hay usuario autenticado' }
      const payload: Record<string, string> = {}
      if (data.username !== undefined) payload.username = data.username
      if (data.phone !== undefined) payload.phone = data.phone
      if (data.avatar_url !== undefined) payload.avatar_url = data.avatar_url
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
      if (!error) setUser({ ...user, ...payload })
      return { error: error?.message ?? null }
    },
    [user]
  )

  const value = useMemo(
    () => ({ user, loading, signIn, signUp, signOut, updateProfile }),
    [user, loading, signIn, signUp, signOut, updateProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
