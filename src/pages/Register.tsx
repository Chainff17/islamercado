import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/Pagination'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setSubmitting(true)
    const { error: err } = await signUp(email, password, { username: username || undefined })
    setSubmitting(false)
    if (err) {
      setError(err)
      return
    }
    setSuccess('Cuenta creada. Ya puedes ingresar con tu correo y contraseña.')
    setTimeout(() => navigate('/entrar'), 1500)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Crear cuenta</h1>
        <p className="muted">Regístrate para comprar, vender y conversar en Isla Mercado.</p>
        {error && <Alert kind="error">{error}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}
        <form className="form" onSubmit={submit}>
          <div className="field">
            <label htmlFor="reg-email">Correo</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tú@correo.com"
              required
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="reg-username">Nombre de usuario</label>
            <input
              id="reg-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="maria_habana"
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label htmlFor="reg-password">Contraseña</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
              autoComplete="new-password"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
        <p className="auth-foot">
          ¿Ya tienes cuenta? <Link to="/entrar">Ingresar</Link>
        </p>
      </div>
    </div>
  )
}
