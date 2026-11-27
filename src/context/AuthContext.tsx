import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'

interface AuthUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'username' | 'phone' | 'avatar_url'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, username, phone, avatar_url, created_at')
      .eq('id', uid)
      .single()
    return data as Profile | null
  }, [])

  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      const session = data.session
      if (!active) return
      if (session) {
        setUser({ id: session.user.id, email: session.user.email ?? '' })
        loadProfile(session.user.id).then((p) => {
          if (active) setProfile(p)
        })
      }
      if (active) setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUser({ id: session.user.id, email: session.user.email ?? '' })
        loadProfile(session.user.id).then(setProfile)
      } else {
        setUser(null)
        setProfile(null)
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }, [])

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
      })
      if (error) throw new Error(error.message)
    },
    [],
  )

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    const p = await loadProfile(user.id)
    setProfile(p)
  }, [user, loadProfile])

  const updateProfile = useCallback(
    async (patch: Partial<Pick<Profile, 'username' | 'phone' | 'avatar_url'>>) => {
      if (!user) throw new Error('No hay usuario autenticado')
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', user.id)
      if (error) throw new Error(error.message)
      const updated = await loadProfile(user.id)
      setProfile(updated)
    },
    [user, loadProfile],
  )

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [user, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
