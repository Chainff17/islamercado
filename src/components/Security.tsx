import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { AlertTriangle, Eye, EyeOff, Flag, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { supabase, INITIAL_URL_HASH } from '../lib/supabase'
import { checkPassword } from '../lib/authSecurity'
import { useAuth } from '../context/AuthContext'
import { useSeller } from '../context/SellerContext'
import { Alert } from './Pagination'

/* ───────────────────────── Campo de contraseña con medidor ───────────────────────── */

export function PasswordInput({
  value,
  onChange,
  placeholder,
  autoComplete = 'current-password',
  required = true,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  autoComplete?: string
  required?: boolean
}) {
  const [show, setShow] = useState(false)
  return (
    <div className="pw-input">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? '••••••••'}
        autoComplete={autoComplete}
        required={required}
        maxLength={72}
      />
      <button type="button" className="pw-eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )
}

export function PasswordStrength({ password, context = [] }: { password: string; context?: string[] }) {
  if (!password) return <p className="pw-hint">Mínimo 8 caracteres, con letras y números.</p>
  const c = checkPassword(password, context)
  return (
    <div className="pw-strength">
      <div className="pw-bars" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < Math.max(1, c.score) ? `on s${c.score}` : ''} />
        ))}
      </div>
      <span className={`pw-label s${c.score}`}>{c.label}</span>
      {c.issues.length > 0 && <span className="pw-issues">{c.issues.join(' · ')}</span>}
    </div>
  )
}

/* ───────────────────────── Enlaces de correo (HashRouter) ───────────────────────── */

/**
 * Procesa el regreso desde los correos de Supabase. El cliente ya canjeó el token del hash;
 * aquí solo llevamos al usuario a la ruta correcta y mostramos un aviso.
 */
export function AuthLinkHandler() {
  const { loading, recovery, setNotice } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const done = useRef(false)

  useEffect(() => {
    if (loading || done.current) return
    const raw = INITIAL_URL_HASH.replace(/^#\/?/, '')
    if (!/(access_token|error_description|error_code)=/.test(raw)) return
    done.current = true
    const params = new URLSearchParams(raw)
    const err = params.get('error_description') || params.get('error')
    const type = params.get('type')
    if (err) {
      const expired = /expired|invalid/i.test(err) || params.get('error_code') === 'otp_expired'
      setNotice(expired ? 'El enlace del correo venció o ya se usó. Pide uno nuevo.' : 'No se pudo validar el enlace del correo.')
      navigate(type === 'recovery' ? '/recuperar' : '/entrar', { replace: true })
    } else if (type === 'recovery') {
      navigate('/restablecer', { replace: true })
    } else if (type === 'signup' || type === 'email' || type === 'invite') {
      setNotice('¡Correo confirmado! Tu cuenta ya está activa.')
      navigate('/', { replace: true })
    } else if (type === 'email_change') {
      setNotice('Tu nuevo correo quedó confirmado.')
      navigate('/perfil', { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [loading, navigate, setNotice])

  // Si llega el evento PASSWORD_RECOVERY por otra vía, llevar a la página de nueva contraseña
  useEffect(() => {
    if (recovery && pathname !== '/restablecer' && pathname !== '/recuperar') navigate('/restablecer', { replace: true })
  }, [recovery, pathname, navigate])

  return null
}

/** Avisos globales: correo confirmado, cuenta suspendida, admin sin 2FA… */
export function GlobalNotices() {
  const { notice, setNotice, user } = useAuth()
  const { status } = useSeller()
  const banned = user ? status?.banned : null
  return (
    <>
      {notice && (
        <div className="global-notice">
          <ShieldCheck size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
      )}
      {banned && (
        <div className="global-notice notice-danger">
          <ShieldAlert size={18} />
          <span>
            <strong>Tu cuenta está suspendida.</strong> Motivo: {banned.reason}. No puedes publicar, comprar ni enviar mensajes.
          </span>
        </div>
      )}
    </>
  )
}

/* ───────────────────────── Consejos de seguridad ───────────────────────── */

export function SafetyTips({ variant = 'listing' }: { variant?: 'listing' | 'checkout' }) {
  const tips =
    variant === 'checkout'
      ? [
          'Coordina la entrega por los mensajes de IslaMercado: así queda constancia.',
          'Si pagas por Transfermóvil o Zelle, guarda el comprobante y el número de transacción.',
          'Para artículos caros, prefiere “contra entrega” o ver el producto antes de pagar.',
          'Nunca compartas códigos que te lleguen por SMS ni tu PIN bancario.',
        ]
      : [
          'Desconfía de precios demasiado bajos o de vendedores con prisa.',
          'No pagues por adelantado a desconocidos: mejor en persona o contra entrega.',
          'Revisa el producto antes de pagar y queda en un lugar público y concurrido.',
          'Nadie de IslaMercado te pedirá tu contraseña ni códigos por WhatsApp.',
        ]
  return (
    <div className="safety-tips">
      <div className="safety-head">
        <ShieldCheck size={18} /> {variant === 'checkout' ? 'Compra con seguridad' : 'Consejos para comprar seguro'}
      </div>
      <ul>
        {tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  )
}

/* ───────────────────────── Denunciar ───────────────────────── */

export const REPORT_REASONS: Array<[string, string]> = [
  ['estafa', 'Posible estafa o fraude'],
  ['prohibido', 'Producto prohibido o ilegal'],
  ['falso', 'Información falsa o engañosa'],
  ['spam', 'Spam o anuncio repetido'],
  ['ofensivo', 'Contenido ofensivo'],
  ['otro', 'Otro motivo'],
]

export function reasonLabel(id: string) {
  return REPORT_REASONS.find(([k]) => k === id)?.[1] ?? id
}

export function ReportButton({
  listingId,
  userId,
  label = 'Denunciar',
  compact = false,
}: {
  listingId?: string
  userId?: string
  label?: string
  compact?: boolean
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  if (user && userId && user.id === userId) return null

  async function send() {
    setError('')
    if (!reason) return setError('Elige un motivo.')
    setSending(true)
    const { error: err } = await supabase.rpc('report_content', {
      p_listing: listingId ?? null,
      p_user: listingId ? null : userId ?? null,
      p_reason: reason,
      p_details: details.trim() || null,
    })
    setSending(false)
    if (err) return setError(err.message)
    setSent(true)
  }

  if (!open)
    return (
      <button type="button" className={`report-link ${compact ? 'compact' : ''}`} onClick={() => setOpen(true)}>
        <Flag size={14} /> {label}
      </button>
    )

  return (
    <div className="report-box">
      <div className="report-head">
        <strong>
          <Flag size={15} /> {listingId ? 'Denunciar este anuncio' : 'Denunciar a este usuario'}
        </strong>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Cerrar">
          <X size={16} />
        </button>
      </div>
      {!user ? (
        <p className="muted small">
          <Link to="/entrar">Inicia sesión</Link> para enviar una denuncia.
        </p>
      ) : sent ? (
        <Alert kind="success">Gracias. El equipo de IslaMercado revisará tu denuncia lo antes posible.</Alert>
      ) : (
        <>
          <div className="report-reasons">
            {REPORT_REASONS.map(([id, text]) => (
              <label key={id} className={`report-reason ${reason === id ? 'on' : ''}`}>
                <input type="radio" name="report-reason" value={id} checked={reason === id} onChange={() => setReason(id)} />
                {text}
              </label>
            ))}
          </div>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
            placeholder={reason === 'otro' ? 'Cuéntanos qué pasó (obligatorio)' : 'Detalles (opcional): qué pasó, cuándo, etc.'}
          />
          {error && <Alert kind="error">{error}</Alert>}
          <div className="report-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button type="button" className="btn btn-danger btn-sm" onClick={send} disabled={sending}>
              {sending ? 'Enviando…' : 'Enviar denuncia'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ───────────────────────── Verificación en 2 pasos (TOTP) ───────────────────────── */

interface Factor {
  id: string
  friendly_name?: string | null
  status: string
  created_at: string
}

export function TwoFactorPanel({ highlight = false }: { highlight?: boolean }) {
  const { refresh } = useSeller()
  const [factors, setFactors] = useState<Factor[] | null>(null)
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  async function load() {
    const { data, error: err } = await supabase.auth.mfa.listFactors()
    if (err) return setError(err.message)
    setFactors((data?.all ?? []).filter((f) => f.factor_type === 'totp') as Factor[])
  }
  useEffect(() => {
    load()
  }, [])

  async function start() {
    setError('')
    setOk('')
    setBusy(true)
    // Borra intentos sin terminar para no acumular factores "unverified"
    for (const f of factors ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `IslaMercado ${new Date().toLocaleDateString('es')}` })
    setBusy(false)
    if (err || !data) return setError(err?.message ?? 'No se pudo iniciar la configuración.')
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }

  async function confirm() {
    if (!enroll) return
    setError('')
    setBusy(true)
    const { error: err } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.replace(/\s/g, '') })
    setBusy(false)
    if (err) return setError('El código no es correcto. Revisa la hora del teléfono e inténtalo de nuevo.')
    setEnroll(null)
    setCode('')
    setOk('¡Listo! La verificación en 2 pasos está activada.')
    await load()
    await refresh()
  }

  async function remove(id: string) {
    if (!window.confirm('¿Desactivar la verificación en 2 pasos? Tu cuenta quedará menos protegida.')) return
    setError('')
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (err)
      return setError(
        /aal2/i.test(err.message) ? 'Para desactivarla, cierra sesión y vuelve a entrar usando tu código de 6 dígitos.' : err.message,
      )
    setOk('Verificación en 2 pasos desactivada.')
    await load()
    await refresh()
  }

  const verified = (factors ?? []).filter((f) => f.status === 'verified')

  return (
    <div className={`card security-card ${highlight && verified.length === 0 ? 'security-warn' : ''}`}>
      <h3 className="card-h">
        <ShieldCheck size={18} /> Verificación en 2 pasos
      </h3>
      <p className="muted small">
        Además de tu contraseña, te pediremos un código de 6 dígitos de una app como Google Authenticator, Microsoft
        Authenticator o Aegis. Así nadie puede entrar aunque descubra tu contraseña.
      </p>
      {highlight && verified.length === 0 && (
        <Alert kind="error">
          <AlertTriangle size={14} /> Eres administrador: activa la verificación en 2 pasos para proteger el panel.
        </Alert>
      )}
      {factors === null ? (
        <p className="muted small">Cargando…</p>
      ) : verified.length > 0 ? (
        <div className="mfa-on">
          <span className="status-pill st-active">Activada</span>
          {verified.map((f) => (
            <div key={f.id} className="mfa-row">
              <span>{f.friendly_name || 'App de autenticación'}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(f.id)}>
                Desactivar
              </button>
            </div>
          ))}
        </div>
      ) : enroll ? (
        <div className="mfa-enroll">
          <ol>
            <li>Abre tu app de autenticación y escanea este código QR.</li>
            <li>Escribe el código de 6 dígitos que aparece en la app.</li>
          </ol>
          <img src={enroll.qr} alt="Código QR para la app de autenticación" width={180} height={180} />
          <p className="muted small">
            ¿No puedes escanear? Introduce esta clave: <code className="mfa-secret">{enroll.secret}</code>
          </p>
          <div className="mfa-code-row">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="otp-input"
            />
            <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy || code.length !== 6}>
              Activar
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setEnroll(null)}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={start} disabled={busy}>
          {busy ? 'Preparando…' : 'Activar verificación en 2 pasos'}
        </button>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {ok && <Alert kind="success">{ok}</Alert>}
    </div>
  )
}

/** Pide el código TOTP para elevar la sesión (login o acceso al panel). */
export function MfaChallenge({ onDone, title, children }: { onDone: () => void; title?: string; children?: ReactNode }) {
  const { verifyMfa } = useAuth()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await verifyMfa(code)
      onDone()
    } catch {
      setError('El código no es correcto o ya venció. Usa el código actual de tu app.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mfa-challenge" onSubmit={submit}>
      <h2>
        <ShieldCheck size={20} /> {title ?? 'Verificación en 2 pasos'}
      </h2>
      {children ?? <p className="auth-sub">Abre tu app de autenticación y escribe el código de 6 dígitos.</p>}
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
        placeholder="123456"
        className="otp-input otp-lg"
      />
      {error && <Alert kind="error">{error}</Alert>}
      <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={busy || code.length !== 6}>
        {busy ? 'Verificando…' : 'Verificar'}
      </button>
    </form>
  )
}
