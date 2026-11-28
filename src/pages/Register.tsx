import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/Pagination'
import { PasswordInput, PasswordStrength } from '../components/Security'
import { authErrorEs, checkPassword, maskEmail } from '../lib/authSecurity'

const RESERVED = /^(admin|administra|islamercado|isla_mercado|soporte|moderador|staff|oficial)/i

export default function Register() {
  const { signUp, resendConfirmation } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm: '', terms: false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [resent, setResent] = useState('')

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const username = form.username.trim()
    const email = form.email.trim().toLowerCase()
    if (username.length < 3) return setError('El nombre de usuario debe tener al menos 3 caracteres.')
    if (!/^[\p{L}\p{N} ._-]+$/u.test(username)) return setError('El nombre de usuario solo puede tener letras, números, espacios, puntos, guiones.')
    if (RESERVED.test(username)) return setError('Ese nombre de usuario está reservado. Elige otro.')
    const pw = checkPassword(form.password, [username, email.split('@')[0]])
    if (!pw.ok) return setError(`La contraseña no es segura: ${pw.issues.join(', ').toLowerCase()}.`)
    if (form.password !== form.confirm) return setError('Las contraseñas no coinciden.')
    if (!form.terms) return setError('Debes aceptar las normas de la comunidad.')

    setLoading(true)
    try {
      const { needsConfirmation } = await signUp(email, form.password, username)
      if (needsConfirmation) setSentTo(email)
      else navigate('/')
    } catch (err) {
      setError(authErrorEs(err, 'No se pudo crear la cuenta.'))
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setResent('')
    setError('')
    try {
      await resendConfirmation(sentTo)
      setResent('Listo, te enviamos otro correo.')
    } catch (err) {
      setError(authErrorEs(err))
    }
  }

  if (sentTo)
    return (
      <div className="auth-wrap">
        <div className="auth-card auth-done">
          <span className="auth-done-icon">
            <MailCheck size={30} strokeWidth={1.6} />
          </span>
          <h1>Confirma tu correo</h1>
          <p className="auth-sub">
            Te enviamos un enlace a <strong>{maskEmail(sentTo)}</strong>. Ábrelo para activar tu cuenta y después inicia
            sesión.
          </p>
          <ul className="auth-checklist">
            <li>Revisa también la carpeta de <strong>spam</strong> o “promociones”.</li>
            <li>El enlace vence en 1 hora.</li>
            <li>Si ya tenías cuenta con este correo, inicia sesión o recupera tu contraseña.</li>
          </ul>
          {resent && <Alert kind="success">{resent}</Alert>}
          {error && <Alert kind="error">{error}</Alert>}
          <button type="button" className="btn btn-outline btn-block" onClick={resend}>
            Reenviar correo
          </button>
          <Link to="/entrar" className="btn btn-primary btn-block">
            Ir a iniciar sesión
          </Link>
        </div>
      </div>
    )

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
            autoComplete="username"
            maxLength={40}
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
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span>Contraseña</span>
          <PasswordInput
            value={form.password}
            onChange={(v) => update('password', v)}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />
          <PasswordStrength password={form.password} context={[form.username, form.email.split('@')[0]]} />
        </label>

        <label className="field">
          <span>Confirmar contraseña</span>
          <PasswordInput value={form.confirm} onChange={(v) => update('confirm', v)} autoComplete="new-password" />
        </label>

        <label className="check-row">
          <input type="checkbox" checked={form.terms} onChange={(e) => update('terms', e.target.checked)} />
          <span>
            Acepto las normas: no publicar productos prohibidos, no estafar ni hacer spam. Las cuentas que las incumplan
            serán suspendidas.
          </span>
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
