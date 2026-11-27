import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

export default function Profile() {
  const { user, profile, loading, updateProfile, signOut } = useAuth()
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
    setSaving(true)
    try {
      await updateProfile({
        username: form.username.trim() || null,
        phone: form.phone.trim() || null,
      })
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
            <span className="pl-icon">📝</span> Publicar un artículo
          </Link>
          <Link to="/mis-publicaciones" className="profile-link">
            <span className="pl-icon">📋</span> Mis publicaciones
          </Link>
          <Link to="/mis-compras" className="profile-link">
            <span className="pl-icon">🛍️</span> Mis compras
          </Link>
          <Link to="/mis-ventas" className="profile-link">
            <span className="pl-icon">💰</span> Mis ventas
          </Link>
          <Link to="/carrito" className="profile-link">
            <span className="pl-icon">🛒</span> Mi carrito
          </Link>
          <Link to="/mensajes" className="profile-link">
            <span className="pl-icon">💬</span> Mis mensajes
          </Link>
          <Link to="/favoritos" className="profile-link">
            <span className="pl-icon">⭐</span> Mis favoritos
          </Link>
        </div>
      </div>
    </div>
  )
}
