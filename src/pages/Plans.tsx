import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  BadgeCheck,
  CalendarClock,
  Check,
  CircleAlert,
  Clock,
  FileUp,
  Hourglass,
  Paperclip,
  ShieldCheck,
  Sparkles,
  Store,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSeller } from '../context/SellerContext'
import {
  DURATIONS,
  SUB_PAYMENT_METHODS,
  SUB_STATUS_LABEL,
  daysLeft,
  effectiveStatus,
  methodLabel,
  planAmount,
  planPerks,
  uploadReceipt,
  type Plan,
  type Subscription,
} from '../lib/plans'
import { formatAmount } from '../lib/cuba'
import { formatDate } from '../lib/format'
import { Alert, LoadingBlock } from '../components/Pagination'
import { PlanBadge } from '../components/PlanBadge'

type Cur = 'USD' | 'CUP' | 'MLC'

function money(n: number, cur: string) {
  return `${formatAmount(n)} ${cur}`
}

function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 12
  return (
    <div className="usage">
      <div className="usage-head">
        <span>{label}</span>
        <strong>
          {used} / {max ?? '∞'}
        </strong>
      </div>
      <div className="usage-track">
        <div className={`usage-fill ${max && used >= max ? 'is-full' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function Plans() {
  const { user } = useAuth()
  const { plans, settings, cupRate, status, plan: currentPlan, isAdmin, loading, refresh } = useSeller()
  const [params, setParams] = useSearchParams()
  const [months, setMonths] = useState<number>(1)
  const [currency, setCurrency] = useState<Cur>('USD')
  const [selected, setSelected] = useState<string>(params.get('plan') ?? '')
  const [history, setHistory] = useState<Subscription[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  const [method, setMethod] = useState<string>('transfermovil')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')

  const activePlans = useMemo(() => plans.filter((p) => p.active), [plans])
  const chosen = activePlans.find((p) => p.id === selected) ?? null
  const sub = status?.subscription ?? null
  const pending = status?.pending ?? null
  const last = status?.last ?? null

  useEffect(() => {
    if (!user) return setHistory([])
    supabase
      .from('seller_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setHistory((data ?? []) as Subscription[]))
  }, [user, status])

  function choose(p: Plan) {
    setSelected(p.id)
    setError('')
    setOkMsg('')
    setParams(p.id ? { plan: p.id } : {}, { replace: true })
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!user || !chosen) return
    setError('')
    const needsRef = SUB_PAYMENT_METHODS.find((m) => m.id === method)?.needsRef
    if (needsRef && !reference.trim() && !file) return setError('Añade el número de transacción o una foto del comprobante.')
    setSending(true)
    try {
      let receipt: string | null = null
      if (file) receipt = await uploadReceipt(file, user.id)
      const { error: err } = await supabase.rpc('request_subscription', {
        p_plan: chosen.id,
        p_months: months,
        p_currency: currency,
        p_method: method,
        p_reference: reference.trim() || null,
        p_receipt: receipt,
        p_notes: notes.trim() || null,
      })
      if (err) throw new Error(err.message)
      setOkMsg('¡Solicitud enviada! El administrador revisará tu pago y activará tu plan. Te avisamos aquí mismo.')
      setReference('')
      setNotes('')
      setFile(null)
      setSelected('')
      setParams({}, { replace: true })
      await refresh()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar la solicitud')
    } finally {
      setSending(false)
    }
  }

  async function cancelPending() {
    if (!pending || !window.confirm('¿Cancelar tu solicitud pendiente?')) return
    const { error: err } = await supabase.rpc('cancel_subscription_request', { p_id: pending.id })
    if (err) return setError(err.message)
    refresh()
  }

  if (loading && user) return <LoadingBlock />

  const total = chosen ? planAmount(chosen, months, currency, cupRate) : 0
  const instructions = settings.payment_instructions?.trim()
  const adminWa = (settings.admin_whatsapp || '').replace(/\D/g, '')

  return (
    <div className="page plans-page">
      <div className="plans-hero">
        <span className="kicker">
          <Sparkles size={14} /> Planes para vendedores
        </span>
        <h1>
          Vende más con <em>tu plan.</em>
        </h1>
        <p>Para publicar en IslaMercado necesitas un plan activo. Comprar sigue siendo gratis para todos.</p>
      </div>

      {okMsg && <Alert kind="success">{okMsg}</Alert>}

      {/* Estado actual */}
      {user && (sub || pending || isAdmin || (last && last.status === 'rejected')) && (
        <div className="plan-status-grid">
          {isAdmin && (
            <div className="panel plan-status">
              <ShieldCheck size={22} className="plan-status-icon is-olive" />
              <div>
                <strong>Eres administrador</strong>
                <p className="muted small">Puedes publicar sin plan y aprobar las suscripciones.</p>
              </div>
              <Link to="/admin" className="btn btn-olive btn-sm">
                Ir al panel
              </Link>
            </div>
          )}
          {sub && currentPlan && (
            <div className="panel plan-status plan-status-active">
              <BadgeCheck size={22} className="plan-status-icon is-ok" />
              <div className="plan-status-body">
                <div className="plan-status-title">
                  <strong>Plan {currentPlan.name}</strong> <PlanBadge badge={currentPlan.badge} size="sm" />
                </div>
                <p className="muted small">
                  Vence el {formatDate(sub.expires_at!)} · quedan {daysLeft(sub.expires_at)} días
                </p>
                <UsageBar label="Anuncios activos" used={status?.active_listings ?? 0} max={currentPlan.max_listings} />
                {currentPlan.max_featured > 0 && (
                  <UsageBar label="Destacados" used={status?.featured_listings ?? 0} max={currentPlan.max_featured} />
                )}
              </div>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => choose(currentPlan)}>
                Renovar
              </button>
            </div>
          )}
          {pending && (
            <div className="panel plan-status plan-status-pending">
              <Hourglass size={22} className="plan-status-icon is-warn" />
              <div className="plan-status-body">
                <strong>Solicitud en revisión</strong>
                <p className="muted small">
                  Plan {plans.find((p) => p.id === pending.plan_id)?.name ?? pending.plan_id} · {pending.months}{' '}
                  {pending.months === 1 ? 'mes' : 'meses'} · {money(pending.amount, pending.currency)} por {methodLabel(pending.payment_method)} · enviada{' '}
                  {formatDate(pending.created_at)}
                </p>
                {adminWa && (
                  <a className="small link" href={`https://wa.me/${adminWa}`} target="_blank" rel="noreferrer">
                    ¿Urge? Escribe al administrador por WhatsApp
                  </a>
                )}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={cancelPending}>
                Cancelar
              </button>
            </div>
          )}
          {!pending && last && last.status === 'rejected' && (
            <div className="panel plan-status plan-status-rejected">
              <CircleAlert size={22} className="plan-status-icon is-danger" />
              <div className="plan-status-body">
                <strong>Tu última solicitud fue rechazada</strong>
                <p className="muted small">Motivo: {last.admin_note || 'sin especificar'}. Puedes enviar una nueva cuando quieras.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selector de duración y moneda */}
      <div className="plans-controls">
        <div className="seg seg-pills" role="radiogroup" aria-label="Duración">
          {DURATIONS.map((d) => (
            <button key={d.months} type="button" role="radio" aria-checked={months === d.months} className={months === d.months ? 'is-on' : ''} onClick={() => setMonths(d.months)}>
              {d.label}
              {d.discount > 0 && <span className="seg-off">−{Math.round(d.discount * 100)}%</span>}
            </button>
          ))}
        </div>
        <div className="seg seg-pills seg-sm" role="radiogroup" aria-label="Moneda">
          {(['USD', 'CUP', 'MLC'] as Cur[]).map((c) => (
            <button key={c} type="button" role="radio" aria-checked={currency === c} className={currency === c ? 'is-on' : ''} onClick={() => setCurrency(c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Tarjetas de planes */}
      <div className="plan-grid">
        {activePlans.map((p) => {
          const perMonth = planAmount(p, months, currency, cupRate) / months
          const isCurrent = currentPlan?.id === p.id
          const Icon = p.badge === 'tienda' ? Store : p.badge === 'verificado' ? BadgeCheck : Sparkles
          return (
            <article key={p.id} className={`plan-card ${p.highlight ? 'is-highlight' : ''} ${selected === p.id ? 'is-selected' : ''}`}>
              {p.highlight && <span className="plan-ribbon">Más elegido</span>}
              <div className={`plan-icon plan-icon-${p.id}`}>
                <Icon size={22} strokeWidth={1.7} />
              </div>
              <h2>{p.name}</h2>
              <p className="plan-tagline">{p.tagline}</p>
              <div className="plan-price">
                <strong>{formatAmount(currency === 'CUP' ? Math.round(perMonth) : Math.round(perMonth * 100) / 100)}</strong>
                <span>{currency} / mes</span>
              </div>
              <p className="plan-total muted small">
                {months > 1 ? `${money(planAmount(p, months, currency, cupRate), currency)} por ${months} meses` : 'Se paga mes a mes'}
              </p>
              <ul className="plan-perks">
                {planPerks(p).map((perk) => (
                  <li key={perk}>
                    <Check size={15} strokeWidth={2.4} /> {perk}
                  </li>
                ))}
              </ul>
              {user ? (
                <button
                  type="button"
                  className={`btn btn-block ${p.highlight ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => choose(p)}
                  disabled={!!pending}
                  title={pending ? 'Ya tienes una solicitud en revisión' : undefined}
                >
                  {isCurrent ? 'Renovar plan' : currentPlan ? `Cambiar a ${p.name}` : `Elegir ${p.name}`}
                </button>
              ) : (
                <Link to="/entrar" className={`btn btn-block ${p.highlight ? 'btn-primary' : 'btn-outline'}`}>
                  Entra para elegir
                </Link>
              )}
              {isCurrent && <span className="plan-current">Tu plan actual</span>}
            </article>
          )
        })}
      </div>

      {/* Formulario de pago */}
      {user && chosen && !pending && (
        <form ref={formRef} className="panel plan-checkout" onSubmit={submit}>
          <div className="plan-checkout-head">
            <div>
              <h2 className="panel-title">Pagar plan {chosen.name}</h2>
              <p className="muted small">
                {months} {months === 1 ? 'mes' : 'meses'} ·{' '}
                {currentPlan && currentPlan.id !== chosen.id
                  ? 'el cambio de plan empieza el día que se apruebe'
                  : currentPlan
                    ? 'se suma al tiempo que te queda'
                    : 'empieza el día que se apruebe'}
              </p>
            </div>
            <div className="plan-checkout-total">
              <span className="muted small">Total a pagar</span>
              <strong>{money(total, currency)}</strong>
            </div>
            <button type="button" className="icon-btn" aria-label="Cerrar" onClick={() => setSelected('')}>
              <X size={18} />
            </button>
          </div>

          <div className="plan-checkout-grid">
            <div className="pay-instructions">
              <h3>1. Paga al administrador</h3>
              <pre>{instructions || 'El administrador aún no ha configurado los datos de pago.'}</pre>
              <p className="muted small">
                Importe exacto: <strong>{money(total, currency)}</strong>. Pon tu usuario en el concepto para identificar el pago.
              </p>
            </div>

            <div className="pay-form">
              <h3>2. Envía el comprobante</h3>
              <label className="field">
                <span>Método de pago</span>
                <select value={method} onChange={(e) => setMethod(e.target.value)}>
                  {SUB_PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>N.º de transacción {method === 'efectivo' ? '(opcional)' : ''}</span>
                <input type="text" value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Ej: TMV 8F3K2L9" />
              </label>
              <div className="field">
                <span>Foto o PDF del comprobante</span>
                <label className="file-drop">
                  <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                  {file ? (
                    <>
                      <Paperclip size={16} /> {file.name}
                    </>
                  ) : (
                    <>
                      <FileUp size={16} /> Seleccionar archivo (máx. 5 MB)
                    </>
                  )}
                </label>
              </div>
              <label className="field">
                <span>Nota para el administrador (opcional)</span>
                <textarea rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ej: pagué desde la tarjeta de mi hermano" />
              </label>
              {error && <Alert kind="error">{error}</Alert>}
              <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar para aprobación'}
              </button>
            </div>
          </div>
        </form>
      )}
      {error && !chosen && <Alert kind="error">{error}</Alert>}

      {/* Cómo funciona */}
      <div className="plans-how">
        <div>
          <span className="how-num">1</span>
          <strong>Elige tu plan</strong>
          <p>Escoge cuántos meses y en qué moneda prefieres pagar.</p>
        </div>
        <div>
          <span className="how-num">2</span>
          <strong>Paga y envía el comprobante</strong>
          <p>Transfermóvil, EnZona, Zelle o efectivo. Sube la captura o el número de transacción.</p>
        </div>
        <div>
          <span className="how-num">3</span>
          <strong>Te aprobamos y a vender</strong>
          <p>El administrador verifica el pago y tu plan se activa al momento.</p>
        </div>
        <div>
          <span className="how-num">
            <CalendarClock size={16} />
          </span>
          <strong>¿Y si vence?</strong>
          <p>Tus anuncios se ocultan, pero no se borran. Vuelven a verse al renovar.</p>
        </div>
      </div>

      {/* Historial */}
      {user && history.length > 0 && (
        <section className="section">
          <h2 className="section-title">Historial de pagos</h2>
          <div className="panel sub-history">
            {history.map((h) => {
              const st = effectiveStatus(h)
              return (
                <div key={h.id} className="sub-row">
                  <div>
                    <strong>{plans.find((p) => p.id === h.plan_id)?.name ?? h.plan_id}</strong>{' '}
                    <span className="muted small">
                      · {h.months} {h.months === 1 ? 'mes' : 'meses'} · {money(h.amount, h.currency)} · {methodLabel(h.payment_method)}
                    </span>
                    <div className="muted small">
                      <Clock size={12} /> {formatDate(h.created_at)}
                      {h.expires_at && h.status === 'active' ? ` · hasta ${formatDate(h.expires_at)}` : ''}
                      {h.admin_note ? ` · ${h.admin_note}` : ''}
                    </div>
                  </div>
                  <span className={`status-pill sub-${st}`}>{SUB_STATUS_LABEL[st] ?? st}</span>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
