import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert, EmptyState, LoadingBlock } from '../components/Pagination'

export default function Profile() {
  const { user, loading, updateProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState(user?.username ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <LoadingBlock />
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="Inicia sesión para ver tu perfil"
        action={
          <button className="btn btn-primary" onClick={() => navigate('/entrar')}>
            Ingresar
          </button>
        }
      />
    )
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)
    const { error: err } = await updateProfile({ username: username.trim(), phone: phone.trim() })
    setSaving(false)
    if (err) {
      setError(err)
      return
    }
    setSuccess('Perfil actualizado correctamente.')
  }

  return (
    <div className="form-page">
      <div className="section-head">
        <h2>Mi perfil</h2>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}

      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <span className="avatar avatar-xl">{user.username?.charAt(0).toUpperCase() ?? '👤'}</span>
        </div>
        <form className="form" onSubmit={save}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="p-username">Nombre de usuario</label>
              <input
                id="p-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="maria_habana"
              />
            </div>
            <div className="field">
              <label htmlFor="p-phone">Teléfono</label>
              <input
                id="p-phone"
                type="tel"
                value={phone ?? ''}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="5351234567"
              />
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            <button
              type="button"
              className="btn btn-outline"
              onClick={async () => {
                await signOut()
                navigate('/')
              }}
            >
              Salir de la cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
