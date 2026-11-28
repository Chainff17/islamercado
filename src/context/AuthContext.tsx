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
import { authRedirectUrl } from '../lib/authSecurity'

interface AuthUser {
  id: string
  email: string
}

interface AuthContextValue {
  user: AuthUser | null
  profile: Profile | null
  loading: boolean
  /** mfaRequired = la cuenta tiene verificación en 2 pasos y falta introducir el código */
  signIn: (email: string, password: string) => Promise<{ mfaRequired: boolean }>
  /** needsConfirmation = hay que confirmar el correo antes de entrar */
  signUp: (email: string, password: string, username: string) => Promise<{ needsConfirmation: boolean }>
  resendConfirmation: (email: string) => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  verifyRecoveryCode: (email: string, code: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  /** Verifica el código TOTP del primer factor y eleva la sesión a AAL2 */
  verifyMfa: (code: string) => Promise<void>
  /** La sesión entró desde un enlace de recuperación de contraseña */
  recovery: boolean
  clearRecovery: () => void
  /** Aviso global (p. ej. "correo confirmado") */
  notice: string
  setNotice: (msg: string) => void
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (patch: Partial<Pick<Profile, 'username' | 'phone' | 'avatar_url'>>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [recovery, setRecovery] = useState(false)
  const [notice, setNotice] = useState('')

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
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
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
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    return { mfaRequired: !!aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2' }
  }, [])

  const verifyMfa = useCallback(async (code: string) => {
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) throw new Error(error.message)
    const factor = data.totp.find((f) => f.status === 'verified')
    if (!factor) throw new Error('No tienes la verificación en 2 pasos configurada.')
    const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: code.replace(/\s/g, '') })
    if (vErr) throw new Error(vErr.message)
  }, [])

  const resendConfirmation = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: authRedirectUrl() } })
    if (error) throw new Error(error.message)
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() })
    if (error) throw new Error(error.message)
  }, [])

  const verifyRecoveryCode = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code.replace(/\s/g, ''), type: 'recovery' })
    if (error) throw new Error(error.message)
    setRecovery(true)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    setRecovery(false)
  }, [])

  const clearRecovery = useCallback(() => setRecovery(false), [])

  const signUp = useCallback(
    async (email: string, password: string, username: string) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username }, emailRedirectTo: authRedirectUrl() },
      })
      if (error) throw new Error(error.message)
      // Con confirmación obligatoria Supabase no devuelve sesión. Si el correo ya existía,
      // devuelve un usuario sin identidades (para no revelar qué correos están registrados).
      return { needsConfirmation: !data.session }
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
      resendConfirmation,
      requestPasswordReset,
      verifyRecoveryCode,
      updatePassword,
      verifyMfa,
      recovery,
      clearRecovery,
      notice,
      setNotice,
    }),
    [user, profile, loading, signIn, signUp, signOut, refreshProfile, updateProfile, resendConfirmation,
     requestPasswordReset, verifyRecoveryCode, updatePassword, verifyMfa, recovery, clearRecovery, notice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
