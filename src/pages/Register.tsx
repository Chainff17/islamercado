import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/Pagination'

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres.')
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.')

    setLoading(true)
    try {
      await signUp(form.email.trim(), form.password, form.username.trim() || form.email.split('@')[0])
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Crear cuenta</h1>
        <p className="auth-sub">Regístrate para publicar y contactar con vendedores.</p>

        <label className="field">
          <span>Nombre de usuario</span>
          <input
            type="text"
            value={form.username}
            onChange={(e) => update('username', e.target.value)}
            placeholder="mario"
            required
          />
        </label>

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            placeholder="tu@correo.com"
            required
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => update('password', e.target.value)}
            placeholder="Mínimo 6 caracteres"
            required
          />
        </label>

        <label className="field">
          <span>Confirmar contraseña</span>
          <input
            type="password"
            value={form.confirm}
            onChange={(e) => update('confirm', e.target.value)}
            placeholder="••••••••"
            required
          />
        </label>

        {error && <Alert kind="error">{error}</Alert>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Creando…' : 'Crear cuenta'}
        </button>

        <p className="auth-foot">
          ¿Ya tienes cuenta? <Link to="/entrar">Inicia sesión</Link>
        </p>
      </form>
    </div>
  )
}
