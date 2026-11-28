import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarPlus,
  Check,
  Eye,
  Inbox,
  MessageCircle,
  Search,
  Settings,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSeller } from '../context/SellerContext'
import {
  DURATIONS,
  SUB_STATUS_LABEL,
  daysLeft,
  effectiveStatus,
  methodLabel,
  receiptUrl,
  type AdminSubscriptionRow,
  type Plan,
} from '../lib/plans'
import { formatAmount, whatsappLink } from '../lib/cuba'
import { formatDate, timeAgo } from '../lib/format'
import { Alert, EmptyState, LoadingBlock } from '../components/Pagination'
import { MfaChallenge } from '../components/Security'
import { AuditTab, ReportsTab, UsersTab } from './AdminModeration'

type Tab = 'pending' | 'active' | 'history' | 'grant' | 'config' | 'reports' | 'users' | 'audit'
const TABS: Tab[] = ['pending', 'active', 'history', 'grant', 'config', 'reports', 'users', 'audit']

function money(n: number, cur: string) {
  return `${formatAmount(Number(n))} ${cur}`
}

export default function Admin() {
  const { user, loading: authLoading } = useAuth()
  const { isAdmin, adminRole, status, loading: sellerLoading, plans, refresh, reloadCatalog } = useSeller()
  const [params, setParams] = useSearchParams()
  const qTab = params.get('tab') as Tab | null
  const [tab, setTabState] = useState<Tab>(qTab && TABS.includes(qTab) ? qTab : 'pending')
  const setTab = useCallback(
    (t: Tab) => {
      setTabState(t)
      setParams(t === 'pending' ? {} : { tab: t }, { replace: true })
    },
    [setParams],
  )
  const openReports = status?.open_reports ?? 0
  const [rows, setRows] = useState<AdminSubscriptionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    const { data, error: err } = await supabase.rpc('admin_list_subscriptions', { p_status: null })
    if (err) setError(err.message)
    setRows(((data ?? []) as AdminSubscriptionRow[]).map((r) => ({ ...r, amount: Number(r.amount), active_listings: Number(r.active_listings) })))
    setLoading(false)
  }, [isAdmin])

  useEffect(() => {
    load()
  }, [load])

  const planName = useCallback((id: string) => plans.find((p) => p.id === id)?.name ?? id, [plans])

  const groups = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'pending')
    const active = rows
      .filter((r) => effectiveStatus(r) === 'active')
      .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime())
    const history = rows.filter((r) => r.status !== 'pending' && effectiveStatus(r) !== 'active')
    return { pending, active, history }
  }, [rows])

  const stats = useMemo(() => {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const income: Record<string, number> = {}
    for (const r of rows) {
      if (r.payment_method === 'admin' || !r.reviewed_at) continue
      if (r.status !== 'active' && !(r.status === 'cancelled' && r.starts_at)) continue
      if (new Date(r.reviewed_at) < monthStart) continue
      income[r.currency] = (income[r.currency] ?? 0) + r.amount
    }
    const soon = groups.active.filter((r) => daysLeft(r.expires_at) <= 7).length
    return { income, soon }
  }, [rows, groups.active])

  async function afterAction(msg: string) {
    setFlash(msg)
    setError('')
    await Promise.all([load(), refresh()])
    setTimeout(() => setFlash(''), 4000)
  }

  if (authLoading || sellerLoading) return <LoadingBlock />
  if (!user) return <EmptyState title="Inicia sesión" action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>} />
  if (adminRole && !isAdmin)
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <MfaChallenge onDone={() => refresh()} title="Confirma que eres tú">
            <p className="auth-sub">
              El panel de administración está protegido con verificación en 2 pasos. Escribe el código de 6 dígitos de tu app.
            </p>
          </MfaChallenge>
        </div>
      </div>
    )
  if (!isAdmin)
    return (
      <EmptyState
        title="Solo para administradores"
        message="Esta sección es para aprobar las suscripciones de los vendedores."
        action={<Link to="/" className="btn btn-primary">Volver al inicio</Link>}
      />
    )

  const incomeText = Object.entries(stats.income)
    .map(([c, v]) => money(v, c))
    .join(' · ')

  return (
    <div className="page admin-page">
      <div className="page-head page-head-row">
        <div>
          <h1 className="page-title">
            <ShieldCheck size={24} strokeWidth={1.6} className="title-icon" /> Administración
          </h1>
          <p className="page-sub">Aprueba pagos, gestiona planes y modera denuncias y usuarios.</p>
        </div>
        <Link to="/planes" className="btn btn-outline">
          Ver página de planes
        </Link>
      </div>

      {!status?.mfa_enrolled && (
        <Alert kind="error">
          <strong>Protege el panel:</strong> activa la verificación en 2 pasos en{' '}
          <Link to="/perfil">Mi perfil → Seguridad</Link>. Así nadie podrá aprobar pagos ni suspender usuarios aunque
          descubra tu contraseña.
        </Alert>
      )}

      <div className="stats-row admin-stats">
        <div className={`stat ${groups.pending.length ? 'stat-alert' : ''}`}>
          <strong>{groups.pending.length}</strong>
          <span>Pendientes de aprobar</span>
        </div>
        <div className="stat">
          <strong>{groups.active.length}</strong>
          <span>Vendedores con plan activo</span>
        </div>
        <div className="stat">
          <strong>{stats.soon}</strong>
          <span>Vencen en 7 días</span>
        </div>
        <div className="stat">
          <strong className="stat-money">{incomeText || '0'}</strong>
          <span>Cobrado este mes</span>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            ['pending', `Pendientes (${groups.pending.length})`],
            ['active', `Activas (${groups.active.length})`],
            ['history', 'Historial'],
            ['grant', 'Alta directa'],
            ['config', 'Planes y pagos'],
            ['reports', `Denuncias${openReports ? ` (${openReports})` : ''}`],
            ['users', 'Usuarios'],
            ['audit', 'Registro'],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
          <button key={id} type="button" className={`tab ${tab === id ? 'tab-on' : ''}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {flash && <Alert kind="success">{flash}</Alert>}
      {error && <Alert kind="error">{error}</Alert>}

      {tab === 'pending' &&
        (loading ? (
          <LoadingBlock />
        ) : groups.pending.length === 0 ? (
          <div className="panel admin-empty">
            <Inbox size={28} strokeWidth={1.4} />
            <p>No hay solicitudes pendientes. ¡Todo al día!</p>
          </div>
        ) : (
          <div className="admin-requests">
            {groups.pending.map((r) => (
              <PendingCard key={r.id} row={r} planName={planName(r.plan_id)} onDone={afterAction} onError={setError} />
            ))}
          </div>
        ))}

      {tab === 'active' &&
        (loading ? (
          <LoadingBlock />
        ) : groups.active.length === 0 ? (
          <div className="panel admin-empty">
            <p>No hay suscripciones activas.</p>
          </div>
        ) : (
          <div className="panel admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Plan</th>
                  <th>Vence</th>
                  <th>Anuncios</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {groups.active.map((r) => (
                  <ActiveRow key={r.id} row={r} plan={plans.find((p) => p.id === r.plan_id)} onDone={afterAction} onError={setError} />
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'history' &&
        (loading ? (
          <LoadingBlock />
        ) : groups.history.length === 0 ? (
          <div className="panel admin-empty">
            <p>Sin historial todavía.</p>
          </div>
        ) : (
          <div className="panel admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Vendedor</th>
                  <th>Plan</th>
                  <th>Importe</th>
                  <th>Estado</th>
                  <th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {groups.history.map((r) => {
                  const st = effectiveStatus(r)
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/vendedor/${r.user_id}`} className="strong-link">
                          {r.username || 'Usuario'}
                        </Link>
                        <div className="muted small">{formatDate(r.created_at)}</div>
                      </td>
                      <td>
                        {planName(r.plan_id)} · {r.months}m
                      </td>
                      <td>
                        {money(r.amount, r.currency)}
                        <div className="muted small">{methodLabel(r.payment_method)}</div>
                      </td>
                      <td>
                        <span className={`status-pill sub-${st}`}>{SUB_STATUS_LABEL[st] ?? st}</span>
                      </td>
                      <td className="muted small">{r.admin_note}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}

      {tab === 'reports' && <ReportsTab onDone={afterAction} onError={setError} />}
      {tab === 'users' && <UsersTab onDone={afterAction} onError={setError} />}
      {tab === 'audit' && <AuditTab onError={setError} />}

      {tab === 'grant' && <GrantForm plans={plans} onDone={afterAction} onError={setError} />}

      {tab === 'config' && (
        <ConfigPanel
          plans={plans}
          onSaved={async (msg) => {
            await reloadCatalog()
            afterAction(msg)
          }}
          onError={setError}
        />
      )}
    </div>
  )
}

// ── Solicitud pendiente ──────────────────────────────────────────────────
function PendingCard({
  row,
  planName,
  onDone,
  onError,
}: {
  row: AdminSubscriptionRow
  planName: string
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [busy, setBusy] = useState(false)
  const wa = whatsappLink(row.phone, `Hola ${row.username ?? ''}, te escribo de IslaMercado sobre tu plan ${planName}.`)

  async function review(approve: boolean) {
    if (!approve && !note.trim()) return onError('Escribe el motivo del rechazo para que el vendedor lo vea.')
    setBusy(true)
    const { error } = await supabase.rpc('admin_review_subscription', { p_id: row.id, p_approve: approve, p_note: note.trim() || null })
    setBusy(false)
    if (error) return onError(error.message)
    onDone(approve ? `Plan ${planName} activado para ${row.username ?? 'el vendedor'}.` : 'Solicitud rechazada.')
  }

  async function openReceipt() {
    if (!row.receipt_path) return
    const url = await receiptUrl(row.receipt_path)
    if (url) window.open(url, '_blank', 'noopener')
    else onError('No se pudo abrir el comprobante.')
  }

  return (
    <article className="panel request-card">
      <div className="request-head">
        <span className="avatar-lg">{(row.username || 'U').slice(0, 2).toUpperCase()}</span>
        <div className="request-who">
          <Link to={`/vendedor/${row.user_id}`} className="strong-link">
            {row.username || 'Usuario'}
          </Link>
          <span className="muted small">
            {row.email} · {row.active_listings} anuncios activos
          </span>
        </div>
        <span className="muted small">{timeAgo(row.created_at)}</span>
      </div>

      <dl className="request-data">
        <div>
          <dt>Plan</dt>
          <dd>
            {planName} · {row.months} {row.months === 1 ? 'mes' : 'meses'}
          </dd>
        </div>
        <div>
          <dt>Importe</dt>
          <dd className="request-amount">{money(row.amount, row.currency)}</dd>
        </div>
        <div>
          <dt>Método</dt>
          <dd>{methodLabel(row.payment_method)}</dd>
        </div>
        <div>
          <dt>N.º transacción</dt>
          <dd className="mono">{row.payment_reference || '—'}</dd>
        </div>
      </dl>
      {row.notes && <p className="request-note">“{row.notes}”</p>}

      <div className="request-tools">
        {row.receipt_path ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={openReceipt}>
            <Eye size={15} /> Ver comprobante
          </button>
        ) : (
          <span className="muted small">Sin comprobante adjunto</span>
        )}
        {wa && (
          <a className="btn btn-ghost btn-sm" href={wa} target="_blank" rel="noreferrer">
            <MessageCircle size={15} /> WhatsApp
          </a>
        )}
      </div>

      {mode === 'reject' ? (
        <div className="request-reject">
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo del rechazo (el vendedor lo verá). Ej: no encontramos la transferencia" autoFocus />
          <div className="request-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('idle')}>
              Volver
            </button>
            <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => review(false)}>
              <X size={15} /> Confirmar rechazo
            </button>
          </div>
        </div>
      ) : (
        <div className="request-actions">
          <input className="request-note-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Nota interna (opcional)" />
          <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setMode('reject')}>
            Rechazar
          </button>
          <button type="button" className="btn btn-olive btn-sm" disabled={busy} onClick={() => review(true)}>
            <Check size={15} /> {busy ? 'Aprobando…' : 'Aprobar pago'}
          </button>
        </div>
      )}
    </article>
  )
}

// ── Fila de suscripción activa ───────────────────────────────────────────
function ActiveRow({
  row,
  plan,
  onDone,
  onError,
}: {
  row: AdminSubscriptionRow
  plan: Plan | undefined
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const left = daysLeft(row.expires_at)

  async function act(action: 'extend' | 'cancel') {
    if (action === 'cancel' && !window.confirm(`¿Cancelar el plan de ${row.username}? Sus anuncios dejarán de verse.`)) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_update_subscription', { p_id: row.id, p_action: action, p_months: 1, p_note: null })
    setBusy(false)
    if (error) return onError(error.message)
    onDone(action === 'extend' ? `Plan de ${row.username} ampliado 1 mes.` : `Plan de ${row.username} cancelado.`)
  }

  return (
    <tr>
      <td>
        <Link to={`/vendedor/${row.user_id}`} className="strong-link">
          {row.username || 'Usuario'}
        </Link>
        <div className="muted small">{row.email}</div>
      </td>
      <td>{plan?.name ?? row.plan_id}</td>
      <td>
        {formatDate(row.expires_at!)}
        <div className={`small ${left <= 7 ? 'text-danger' : 'muted'}`}>{left} días</div>
      </td>
      <td>
        {row.active_listings}
        {plan?.max_listings ? ` / ${plan.max_listings}` : ''}
      </td>
      <td className="admin-row-actions">
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => act('extend')} title="Ampliar 1 mes sin cobro">
          <CalendarPlus size={15} /> +1 mes
        </button>
        <button type="button" className="btn btn-ghost btn-sm text-danger" disabled={busy} onClick={() => act('cancel')}>
          Cancelar
        </button>
      </td>
    </tr>
  )
}

// ── Alta directa ─────────────────────────────────────────────────────────
interface FoundUser {
  id: string
  username: string | null
  email: string | null
  plan_id: string | null
}

function GrantForm({ plans, onDone, onError }: { plans: Plan[]; onDone: (m: string) => void; onError: (m: string) => void }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoundUser[]>([])
  const [target, setTarget] = useState<FoundUser | null>(null)
  const [planId, setPlanId] = useState(plans[1]?.id ?? plans[0]?.id ?? '')
  const [months, setMonths] = useState(1)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function search(e?: FormEvent) {
    e?.preventDefault()
    const { data, error } = await supabase.rpc('admin_find_users', { p_q: q.trim() })
    if (error) return onError(error.message)
    setResults((data ?? []) as FoundUser[])
  }

  useEffect(() => {
    search()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function grant() {
    if (!target) return
    setBusy(true)
    const { error } = await supabase.rpc('admin_grant_subscription', {
      p_user: target.id,
      p_plan: planId,
      p_months: months,
      p_currency: 'USD',
      p_note: note.trim() || null,
    })
    setBusy(false)
    if (error) return onError(error.message)
    onDone(`Plan asignado a ${target.username ?? target.email}.`)
    setTarget(null)
    setNote('')
    search()
  }

  return (
    <div className="admin-grant">
      <div className="panel">
        <h2 className="panel-title">
          <UserPlus size={18} /> Buscar vendedor
        </h2>
        <p className="muted small">Úsalo si te pagaron en persona o quieres regalar un plan.</p>
        <form className="grant-search" onSubmit={search}>
          <Search size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Usuario o correo" />
          <button type="submit" className="btn btn-outline btn-sm">
            Buscar
          </button>
        </form>
        <div className="grant-results">
          {results.map((u) => (
            <button key={u.id} type="button" className={`grant-user ${target?.id === u.id ? 'is-on' : ''}`} onClick={() => setTarget(u)}>
              <span className="avatar-sm">{(u.username || u.email || 'U').slice(0, 2).toUpperCase()}</span>
              <span className="grant-user-info">
                <strong>{u.username || '—'}</strong>
                <span className="muted small">{u.email}</span>
              </span>
              {u.plan_id && <span className="status-pill sub-active">{plans.find((p) => p.id === u.plan_id)?.name ?? u.plan_id}</span>}
            </button>
          ))}
          {results.length === 0 && <p className="muted small">Sin resultados.</p>}
        </div>
      </div>

      <div className="panel">
        <h2 className="panel-title">Asignar plan</h2>
        {target ? (
          <>
            <p>
              Para <strong>{target.username || target.email}</strong>
              {target.plan_id && <span className="muted small"> · si cambia de plan, el actual se reemplaza</span>}
            </p>
            <label className="field">
              <span>Plan</span>
              <select value={planId} onChange={(e) => setPlanId(e.target.value)}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.price_usd} USD/mes
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Duración</span>
              <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d.months} value={d.months}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Nota (opcional)</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej: pagó 4.320 CUP en efectivo" />
            </label>
            <button type="button" className="btn btn-olive btn-block" disabled={busy} onClick={grant}>
              <Check size={16} /> {busy ? 'Asignando…' : 'Activar plan ahora'}
            </button>
          </>
        ) : (
          <p className="muted">Selecciona un usuario de la lista.</p>
        )}
      </div>
    </div>
  )
}

// ── Configuración de planes y datos de pago ──────────────────────────────
function ConfigPanel({ plans, onSaved, onError }: { plans: Plan[]; onSaved: (m: string) => void; onError: (m: string) => void }) {
  const { settings } = useSeller()
  const [draft, setDraft] = useState<Record<string, Plan>>({})
  const [instr, setInstr] = useState(settings.payment_instructions ?? '')
  const [rate, setRate] = useState(settings.cup_rate ?? '360')
  const [wa, setWa] = useState(settings.admin_whatsapp ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const d: Record<string, Plan> = {}
    for (const p of plans) d[p.id] = { ...p }
    setDraft(d)
  }, [plans])

  useEffect(() => {
    setInstr(settings.payment_instructions ?? '')
    setRate(settings.cup_rate ?? '360')
    setWa(settings.admin_whatsapp ?? '')
  }, [settings])

  function edit(id: string, patch: Partial<Plan>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }))
  }

  async function savePlans() {
    setBusy(true)
    for (const p of Object.values(draft)) {
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          price_usd: Number(p.price_usd),
          max_listings: p.max_listings ? Number(p.max_listings) : null,
          max_photos: Number(p.max_photos),
          max_featured: Number(p.max_featured),
          tagline: p.tagline,
          active: p.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', p.id)
      if (error) {
        setBusy(false)
        return onError(`${p.name}: ${error.message}`)
      }
    }
    setBusy(false)
    onSaved('Planes guardados.')
  }

  async function saveSettings() {
    const r = Number(rate)
    if (!r || r < 1) return onError('La tasa CUP debe ser un número mayor que 0.')
    setBusy(true)
    const { error } = await supabase.from('app_settings').upsert(
      [
        { key: 'payment_instructions', value: instr, updated_at: new Date().toISOString() },
        { key: 'cup_rate', value: String(r), updated_at: new Date().toISOString() },
        { key: 'admin_whatsapp', value: wa.trim(), updated_at: new Date().toISOString() },
      ],
      { onConflict: 'key' },
    )
    setBusy(false)
    if (error) return onError(error.message)
    onSaved('Datos de pago guardados.')
  }

  return (
    <div className="admin-config">
      <div className="panel">
        <h2 className="panel-title">
          <Settings size={18} /> Datos de pago
        </h2>
        <p className="muted small">Esto es lo que ven los vendedores al pagar. Pon tus números de tarjeta, Zelle, etc.</p>
        <label className="field">
          <span>Instrucciones de pago</span>
          <textarea rows={6} value={instr} onChange={(e) => setInstr(e.target.value)} />
        </label>
        <div className="form-row">
          <label className="field">
            <span>Tasa: 1 USD = ? CUP</span>
            <input type="number" min="1" value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <label className="field">
            <span>Tu WhatsApp (opcional)</span>
            <input type="tel" value={wa} onChange={(e) => setWa(e.target.value)} placeholder="53 5 123 4567" />
          </label>
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={saveSettings}>
          Guardar datos de pago
        </button>
      </div>

      <div className="panel">
        <h2 className="panel-title">Planes</h2>
        <p className="muted small">Los cambios de precio aplican a solicitudes nuevas. Deja «Anuncios» vacío para ilimitados.</p>
        <div className="plan-editor">
          {Object.values(draft)
            .sort((a, b) => a.sort - b.sort)
            .map((p) => (
              <div key={p.id} className="plan-editor-row">
                <div className="plan-editor-name">
                  <strong>{p.name}</strong>
                  <label className="check small">
                    <input type="checkbox" checked={p.active} onChange={(e) => edit(p.id, { active: e.target.checked })} /> Disponible
                  </label>
                </div>
                <label className="field">
                  <span>USD/mes</span>
                  <input type="number" min="0" step="0.5" value={p.price_usd} onChange={(e) => edit(p.id, { price_usd: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Anuncios</span>
                  <input
                    type="number"
                    min="1"
                    value={p.max_listings ?? ''}
                    placeholder="∞"
                    onChange={(e) => edit(p.id, { max_listings: e.target.value ? Number(e.target.value) : null })}
                  />
                </label>
                <label className="field">
                  <span>Fotos</span>
                  <input type="number" min="1" max="20" value={p.max_photos} onChange={(e) => edit(p.id, { max_photos: Number(e.target.value) })} />
                </label>
                <label className="field">
                  <span>Destacados</span>
                  <input type="number" min="0" value={p.max_featured} onChange={(e) => edit(p.id, { max_featured: Number(e.target.value) })} />
                </label>
              </div>
            ))}
        </div>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={savePlans}>
          Guardar planes
        </button>
      </div>
    </div>
  )
}
