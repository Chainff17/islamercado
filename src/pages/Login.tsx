import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/Pagination'
import { MfaChallenge, PasswordInput } from '../components/Security'
import { authErrorEs } from '../lib/authSecurity'

export default function Login() {
  const { signIn, resendConfirmation, notice, setNotice } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [unconfirmed, setUnconfirmed] = useState(false)
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [mfa, setMfa] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setInfo('')
    setUnconfirmed(false)
    setNotice('')
    setLoading(true)
    try {
      const { mfaRequired } = await signIn(email.trim(), password)
      if (mfaRequired) setMfa(true)
      else navigate('/')
    } catch (err) {
      const raw = err instanceof Error ? err.message : ''
      setUnconfirmed(/email not confirmed/i.test(raw))
      setError(authErrorEs(err, 'No se pudo iniciar sesión.'))
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setError('')
    try {
      await resendConfirmation(email.trim())
      setUnconfirmed(false)
      setInfo('Te enviamos un nuevo enlace de confirmación. Revisa tu correo (y la carpeta de spam).')
    } catch (err) {
      setError(authErrorEs(err))
    }
  }

  if (mfa)
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <MfaChallenge onDone={() => navigate('/')} />
          <p className="auth-foot">
            ¿Perdiste el acceso a tu app? Escribe al administrador para recuperar tu cuenta.
          </p>
        </div>
      </div>
    )

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Iniciar sesión</h1>
        <p className="auth-sub">Accede a tus publicaciones, mensajes y favoritos.</p>

        {notice && <Alert kind="info">{notice}</Alert>}

        <label className="field">
          <span>Correo electrónico</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="field">
          <span className="field-row">
            Contraseña
            <Link to="/recuperar" className="field-link">
              ¿La olvidaste?
            </Link>
          </span>
          <PasswordInput value={password} onChange={setPassword} />
        </label>

        {error && (
          <Alert kind="error">
            {error}
            {unconfirmed && (
              <>
                {' '}
                <button type="button" className="link-btn" onClick={resend}>
                  Reenviar correo de confirmación
                </button>
              </>
            )}
          </Alert>
        )}
        {info && <Alert kind="success">{info}</Alert>}

        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
          {loading ? 'Ingresando…' : 'Iniciar sesión'}
        </button>

        <p className="auth-foot">
          ¿No tienes cuenta? <Link to="/registro">Regístrate aquí</Link>
        </p>
      </form>
    </div>
  )
}
