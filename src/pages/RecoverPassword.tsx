import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { Alert } from '../components/Pagination'
import { PasswordInput, PasswordStrength } from '../components/Security'
import { authErrorEs, checkPassword, maskEmail } from '../lib/authSecurity'

/** /recuperar — pide el correo y luego el código del correo + la contraseña nueva. */
export default function RecoverPassword() {
  const { requestPasswordReset, verifyRecoveryCode, updatePassword, notice, setNotice } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function sendEmail(e?: FormEvent) {
    e?.preventDefault()
    setError('')
    setInfo('')
    setNotice('')
    setBusy(true)
    try {
      await requestPasswordReset(email.trim().toLowerCase())
      setStep('code')
      setInfo(`Si existe una cuenta con ${maskEmail(email.trim())}, te llegará un correo con un enlace y un código.`)
    } catch (err) {
      setError(authErrorEs(err, 'No se pudo enviar el correo.'))
    } finally {
      setBusy(false)
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault()
    setError('')
    const check = checkPassword(pw, [email.split('@')[0]])
    if (!check.ok) return setError(`La contraseña no es segura: ${check.issues.join(', ').toLowerCase()}.`)
    if (pw !== confirm) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    try {
      await verifyRecoveryCode(email.trim().toLowerCase(), code)
      await updatePassword(pw)
      setNotice('Contraseña cambiada. Ya estás dentro con tu nueva contraseña.')
      navigate('/')
    } catch (err) {
      setError(authErrorEs(err, 'No se pudo cambiar la contraseña.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      {step === 'email' ? (
        <form className="auth-card" onSubmit={sendEmail}>
          <span className="auth-done-icon">
            <KeyRound size={28} strokeWidth={1.6} />
          </span>
          <h1>Recuperar contraseña</h1>
          <p className="auth-sub">Escribe el correo de tu cuenta y te enviaremos cómo crear una contraseña nueva.</p>
          {notice && <Alert kind="info">{notice}</Alert>}
          <label className="field">
            <span>Correo electrónico</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" autoComplete="email" required />
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Enviando…' : 'Enviar instrucciones'}
          </button>
          <p className="auth-foot">
            <Link to="/entrar">Volver a iniciar sesión</Link>
          </p>
        </form>
      ) : (
        <form className="auth-card" onSubmit={onReset}>
          <h1>Crea tu nueva contraseña</h1>
          {info && <Alert kind="success">{info}</Alert>}
          <p className="auth-sub">
            Abre el <strong>enlace</strong> del correo, o escribe aquí el <strong>código</strong> que aparece en él.
          </p>
          <label className="field">
            <span>Código del correo</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="12345678"
              className="otp-input"
              required
            />
          </label>
          <label className="field">
            <span>Contraseña nueva</span>
            <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
            <PasswordStrength password={pw} context={[email.split('@')[0]]} />
          </label>
          <label className="field">
            <span>Repite la contraseña</span>
            <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
          </label>
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || code.length < 6}>
            {busy ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
          <p className="auth-foot">
            ¿No llegó?{' '}
            <button type="button" className="link-btn" onClick={() => sendEmail()} disabled={busy}>
              Reenviar
            </button>{' '}
            · <button type="button" className="link-btn" onClick={() => setStep('email')}>Cambiar correo</button>
          </p>
        </form>
      )}
    </div>
  )
}

/** /restablecer — llegó desde el enlace del correo (sesión de recuperación) o desde el perfil. */
export function ResetPassword() {
  const { user, loading, updatePassword, setNotice, clearRecovery } = useAuth()
  const navigate = useNavigate()
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (!user)
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <h1>Enlace no válido</h1>
          <p className="auth-sub">El enlace venció o ya se usó. Pide uno nuevo.</p>
          <Link to="/recuperar" className="btn btn-primary btn-block">
            Recuperar contraseña
          </Link>
        </div>
      </div>
    )

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    const check = checkPassword(pw, [user!.email.split('@')[0]])
    if (!check.ok) return setError(`La contraseña no es segura: ${check.issues.join(', ').toLowerCase()}.`)
    if (pw !== confirm) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    try {
      await updatePassword(pw)
      setNotice('Contraseña cambiada correctamente.')
      navigate('/')
    } catch (err) {
      setError(authErrorEs(err, 'No se pudo cambiar la contraseña.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <h1>Nueva contraseña</h1>
        <p className="auth-sub">
          Cuenta: <strong>{user.email}</strong>
        </p>
        <label className="field">
          <span>Contraseña nueva</span>
          <PasswordInput value={pw} onChange={setPw} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
          <PasswordStrength password={pw} context={[user.email.split('@')[0]]} />
        </label>
        <label className="field">
          <span>Repite la contraseña</span>
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </label>
        {error && <Alert kind="error">{error}</Alert>}
        <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar contraseña'}
        </button>
        <p className="auth-foot">
          <Link to="/" onClick={clearRecovery}>
            Cancelar
          </Link>
        </p>
      </form>
    </div>
  )
}
