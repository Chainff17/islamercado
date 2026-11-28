import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Heart, KeyRound, MessageCircle, Package, Plus, ShoppingBag, ShoppingCart, Store } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useSeller } from '../context/SellerContext'
import { PasswordInput, PasswordStrength, TwoFactorPanel } from '../components/Security'
import { authErrorEs, checkPassword } from '../lib/authSecurity'

/** Cambiar contraseña desde el perfil (pide la actual si la sesión no está verificada con 2FA). */
function ChangePassword({ email }: { email: string }) {
  const { updatePassword } = useAuth()
  const { status } = useSeller()
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')
  const needsCurrent = !status?.mfa_enrolled

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setOk('')
    const check = checkPassword(pw, [email.split('@')[0]])
    if (!check.ok) return setError(`La contraseña no es segura: ${check.issues.join(', ').toLowerCase()}.`)
    if (pw !== confirm) return setError('Las contraseñas no coinciden.')
    if (needsCurrent && pw === cur) return setError('La nueva contraseña debe ser distinta de la actual.')
    setBusy(true)
    try {
      if (needsCurrent) {
        const { error: e1 } = await supabase.auth.signInWithPassword({ email, password: cur })
        if (e1) throw new Error(/invalid login/i.test(e1.message) ? 'La contraseña actual no es correcta.' : e1.message)
      }
      await updatePassword(pw)
      setOk('Contraseña actualizada.')
      setCur('')
      setPw('')
      setConfirm('')
      setOpen(false)
    } catch (err) {
      setError(authErrorEs(err, 'No se pudo cambiar la contraseña.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="card security-card">
      <h3 className="card-h">
        <KeyRound size={18} /> Contraseña
      </h3>
      {ok && <Alert kind="success">{ok}</Alert>}
      {!open ? (
        <button type="button" className="btn btn-outline" onClick={() => setOpen(true)}>
          Cambiar contraseña
        </button>
      ) : (
        <form className="form" onSubmit={submit}>
          {needsCurrent && (
            <label className="field">
              <span>Contraseña actual</span>
              <PasswordInput value={cur} onChange={setCur} />
            </label>
          )}
          <label className="field">
            <span>Contraseña nueva</span>
            <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
            <PasswordStrength password={pw} context={[email.split('@')[0]]} />
          </label>
          <label className="field">
            <span>Repite la contraseña nueva</span>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? 'Guardando…' : 'Guardar'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function Profile() {
  const { user, profile, loading, updateProfile, signOut } = useAuth()
  const { status } = useSeller()
  const [saved, setSaved] = useState(false)
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [counts, setCounts] = useState<{ listings: number; favorites: number } | null>(null)

  useEffect(() => {
    if (profile) {
      setForm({ username: profile.username ?? '', phone: profile.phone ?? '' })
    }
  }, [profile])

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('listings').select('id').eq('seller_id', user.id).eq('status', 'active'),
      supabase.from('favorites').select('listing_id').eq('user_id', user.id),
    ]).then(([l, f]) => {
      setCounts({ listings: (l.data ?? []).length, favorites: (f.data ?? []).length })
    })
  }, [user])

  if (loading) return <LoadingBlock />

  if (!user)
    return (
      <EmptyState
        title="Inicia sesión para ver tu perfil"
        action={
          <Link to="/entrar" className="btn btn-primary">
            Entrar
          </Link>
        }
      />
    )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaved(false)
    const phone = form.phone.trim()
    if (phone && !/^\+?[0-9 ()-]{6,20}$/.test(phone)) {
      setError('El teléfono no es válido. Usa solo números, por ejemplo +53 5 1234567.')
      return
    }
    setSaving(true)
    try {
      await updateProfile({
        username: form.username.trim() || null,
        phone: form.phone.trim() || null,
      })
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar.')
    } finally {
      setSaving(false)
    }
  }

  async function onLogout() {
    await signOut().catch(() => {})
    navigate('/')
  }

  return (
    <div className="page profile">
      <div className="page-head">
        <h1>Mi perfil</h1>
      </div>

      <div className="profile-grid">
        <form className="form card" onSubmit={onSubmit}>
          <div className="profile-summary">
            <span className="avatar-xl">{initials(profile?.username || user.email)}</span>
            <div>
              <div className="profile-email">{user.email}</div>
              {counts && (
                <div className="profile-counts">
                  <span>{counts.listings} publicaciones</span>
                  <span className="dot">·</span>
                  <span>{counts.favorites} favoritos</span>
                </div>
              )}
            </div>
          </div>

          <label className="field">
            <span>Nombre de usuario</span>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
              placeholder="Tu nombre público"
            />
          </label>

          <label className="field">
            <span>Teléfono</span>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              placeholder="+53 7 xxx xxxx"
            />
          </label>

          {error && <Alert kind="error">{error}</Alert>}
          {saved && <Alert kind="success">Cambios guardados.</Alert>}

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onLogout}>
              Cerrar sesión
            </button>
          </div>
        </form>

        <div className="profile-links card">
          <h3 className="card-h">Mis zonas</h3>
          <Link to="/publicar" className="profile-link">
            <Plus size={18} className="pl-icon" /> Publicar anuncio
          </Link>
          <Link to="/mis-publicaciones" className="profile-link">
            <Package size={18} className="pl-icon" /> Mis anuncios
          </Link>
          <Link to="/mis-compras" className="profile-link">
            <ShoppingBag size={18} className="pl-icon" /> Mis compras
          </Link>
          <Link to="/mis-ventas" className="profile-link">
            <Store size={18} className="pl-icon" /> Mis ventas
          </Link>
          <Link to="/carrito" className="profile-link">
            <ShoppingCart size={18} className="pl-icon" /> Mi carrito
          </Link>
          <Link to="/mensajes" className="profile-link">
            <MessageCircle size={18} className="pl-icon" /> Mensajes
          </Link>
          <Link to="/favoritos" className="profile-link">
            <Heart size={18} className="pl-icon" /> Favoritos
          </Link>
        </div>
      </div>

      <h2 className="section-h security-h">Seguridad de la cuenta</h2>
      <div className="security-grid">
        <ChangePassword email={user.email} />
        <TwoFactorPanel highlight={!!status?.admin_role} />
      </div>
    </div>
  )
}
