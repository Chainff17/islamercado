import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Ban, CheckCircle2, Flag, History, Lock, RotateCcw, Search, ShieldOff, Unlock, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDate, timeAgo } from '../lib/format'
import { Alert, LoadingBlock } from '../components/Pagination'
import { reasonLabel } from '../components/Security'

type Notify = (msg: string) => void | Promise<void>

interface ReportRow {
  id: string
  created_at: string
  reason: string
  details: string | null
  status: 'open' | 'resolved' | 'dismissed'
  admin_note: string | null
  resolved_at: string | null
  reporter_id: string
  reporter_username: string | null
  reported_user_id: string
  reported_username: string | null
  reported_banned: boolean
  listing_id: string | null
  listing_title: string | null
  listing_blocked: boolean | null
  open_against_user: number
}

interface UserRow {
  id: string
  username: string | null
  email: string | null
  phone: string | null
  created_at: string
  email_confirmed: boolean
  last_sign_in_at: string | null
  plan_id: string | null
  active_listings: number
  open_reports: number
  banned: boolean
  ban_reason: string | null
  is_admin: boolean
}

interface AuditRow {
  id: number
  created_at: string
  admin_username: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
}

const REPORT_STATUS: Record<string, string> = { open: 'Abierta', resolved: 'Resuelta', dismissed: 'Descartada' }

function ask(question: string, def = ''): string | null {
  const v = window.prompt(question, def)
  if (v === null) return null
  return v.trim()
}

/* ───────────────────────── Acciones compartidas ───────────────────────── */

async function banUser(id: string, name: string | null, onDone: Notify, onError: (m: string) => void) {
  const reason = ask(`Motivo de la suspensión de ${name || 'este usuario'} (lo verá el usuario):`, 'Incumplimiento de las normas')
  if (!reason) return
  const { error } = await supabase.rpc('admin_ban_user', { p_user: id, p_reason: reason })
  if (error) return onError(error.message)
  await onDone(`${name || 'Usuario'} suspendido. Ya no puede entrar, publicar, comprar ni escribir.`)
}

async function unbanUser(id: string, name: string | null, onDone: Notify, onError: (m: string) => void) {
  if (!window.confirm(`¿Reactivar la cuenta de ${name || 'este usuario'}?`)) return
  const { error } = await supabase.rpc('admin_unban_user', { p_user: id })
  if (error) return onError(error.message)
  await onDone(`${name || 'Usuario'} reactivado.`)
}

async function blockListing(id: string, title: string | null, onDone: Notify, onError: (m: string) => void) {
  const reason = ask(`Motivo del bloqueo de "${title ?? 'anuncio'}" (lo verá el vendedor):`, 'Incumple las normas de publicación')
  if (!reason) return
  const { error } = await supabase.rpc('admin_block_listing', { p_listing: id, p_reason: reason })
  if (error) return onError(error.message)
  await onDone('Anuncio bloqueado: ya no aparece en búsquedas.')
}

async function unblockListing(id: string, onDone: Notify, onError: (m: string) => void) {
  const { error } = await supabase.rpc('admin_unblock_listing', { p_listing: id })
  if (error) return onError(error.message)
  await onDone('Anuncio desbloqueado.')
}

/* ───────────────────────── Denuncias ───────────────────────── */

export function ReportsTab({ onDone, onError }: { onDone: Notify; onError: (m: string) => void }) {
  const [status, setStatus] = useState<string>('open')
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status === 'all' ? null : status })
    if (error) onError(error.message)
    setRows((data ?? []) as ReportRow[])
    setLoading(false)
  }, [status, onError])

  useEffect(() => {
    load()
  }, [load])

  const done = async (msg: string) => {
    await load()
    await onDone(msg)
  }

  async function resolve(r: ReportRow, st: 'resolved' | 'dismissed' | 'open') {
    let note: string | null = ''
    if (st !== 'open') {
      note = ask(st === 'resolved' ? 'Nota interna (qué hiciste):' : 'Motivo para descartar (opcional):', r.admin_note ?? '')
      if (note === null) return
    }
    const { error } = await supabase.rpc('admin_resolve_report', { p_id: r.id, p_status: st, p_note: note || null })
    if (error) return onError(error.message)
    await done(st === 'open' ? 'Denuncia reabierta.' : st === 'resolved' ? 'Denuncia resuelta.' : 'Denuncia descartada.')
  }

  return (
    <div className="mod-wrap">
      <div className="chips mod-filter">
        {[
          ['open', 'Abiertas'],
          ['resolved', 'Resueltas'],
          ['dismissed', 'Descartadas'],
          ['all', 'Todas'],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`chip ${status === id ? 'chip-on' : 'chip-ghost'}`} onClick={() => setStatus(id)}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="panel admin-empty">
          <Flag size={28} strokeWidth={1.4} />
          <p>{status === 'open' ? 'No hay denuncias abiertas. ¡Comunidad tranquila!' : 'No hay denuncias en esta lista.'}</p>
        </div>
      ) : (
        <div className="mod-list">
          {rows.map((r) => (
            <div key={r.id} className={`panel mod-card ${r.status !== 'open' ? 'is-closed' : ''}`}>
              <div className="mod-card-head">
                <span className={`mod-reason r-${r.reason}`}>{reasonLabel(r.reason)}</span>
                <span className={`status-pill rep-${r.status}`}>{REPORT_STATUS[r.status]}</span>
                <span className="muted small">{timeAgo(r.created_at)}</span>
              </div>
              <div className="mod-target">
                <div>
                  <span className="muted small">Denunciado</span>
                  <Link to={`/vendedor/${r.reported_user_id}`} className="strong-link">
                    {r.reported_username || 'Usuario'}
                  </Link>
                  {r.reported_banned && <span className="status-pill st-blocked">Suspendido</span>}
                  {r.open_against_user > 1 && <span className="status-pill st-warn">{r.open_against_user} denuncias abiertas</span>}
                </div>
                {r.listing_id && (
                  <div>
                    <span className="muted small">Anuncio</span>
                    <Link to={`/publicacion/${r.listing_id}`} className="strong-link">
                      {r.listing_title || 'Anuncio eliminado'}
                    </Link>
                    {r.listing_blocked && <span className="status-pill st-blocked">Bloqueado</span>}
                  </div>
                )}
                <div>
                  <span className="muted small">Denunció</span>
                  <Link to={`/vendedor/${r.reporter_id}`}>{r.reporter_username || 'Usuario'}</Link>
                </div>
              </div>
              {r.details && <p className="mod-details">“{r.details}”</p>}
              {r.admin_note && <p className="muted small">Nota: {r.admin_note}</p>}
              <div className="admin-row-actions mod-actions">
                {r.listing_id &&
                  r.listing_title &&
                  (r.listing_blocked ? (
                    <button type="button" className="btn btn-light btn-sm" onClick={() => unblockListing(r.listing_id!, done, onError)}>
                      <Unlock size={14} /> Desbloquear anuncio
                    </button>
                  ) : (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => blockListing(r.listing_id!, r.listing_title, done, onError)}>
                      <Lock size={14} /> Bloquear anuncio
                    </button>
                  ))}
                {r.reported_banned ? (
                  <button type="button" className="btn btn-light btn-sm" onClick={() => unbanUser(r.reported_user_id, r.reported_username, done, onError)}>
                    <ShieldOff size={14} /> Reactivar usuario
                  </button>
                ) : (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => banUser(r.reported_user_id, r.reported_username, done, onError)}>
                    <Ban size={14} /> Suspender usuario
                  </button>
                )}
                {r.status === 'open' ? (
                  <>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => resolve(r, 'resolved')}>
                      <CheckCircle2 size={14} /> Resolver
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => resolve(r, 'dismissed')}>
                      <XCircle size={14} /> Descartar
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => resolve(r, 'open')}>
                    <RotateCcw size={14} /> Reabrir
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Usuarios ───────────────────────── */

export function UsersTab({ onDone, onError }: { onDone: Notify; onError: (m: string) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(
    async (term: string) => {
      setLoading(true)
      const { data, error } = await supabase.rpc('admin_list_users', { p_q: term || null })
      if (error) onError(error.message)
      setRows((data ?? []) as UserRow[])
      setLoading(false)
    },
    [onError],
  )

  useEffect(() => {
    load('')
  }, [load])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    load(q.trim())
  }

  const done = async (msg: string) => {
    await load(q.trim())
    await onDone(msg)
  }

  return (
    <div className="mod-wrap">
      <form className="admin-search" onSubmit={onSearch}>
        <Search size={16} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre de usuario o correo" />
        <button type="submit" className="btn btn-primary btn-sm">
          Buscar
        </button>
      </form>
      {loading ? (
        <LoadingBlock />
      ) : rows.length === 0 ? (
        <div className="panel admin-empty">
          <p>No se encontraron usuarios.</p>
        </div>
      ) : (
        <div className="panel admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Plan</th>
                <th>Anuncios</th>
                <th>Denuncias</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link to={`/vendedor/${u.id}`} className="strong-link">
                      {u.username || 'Usuario'}
                    </Link>
                    <div className="muted small">
                      {u.email}
                      {!u.email_confirmed && <span className="status-pill st-warn">Sin confirmar</span>}
                    </div>
                    <div className="muted small">
                      Alta {formatDate(u.created_at)}
                      {u.last_sign_in_at ? ` · último acceso ${timeAgo(u.last_sign_in_at)}` : ''}
                    </div>
                  </td>
                  <td>{u.is_admin ? <strong>Admin</strong> : u.plan_id ? u.plan_id : <span className="muted">—</span>}</td>
                  <td>{Number(u.active_listings)}</td>
                  <td>{Number(u.open_reports) > 0 ? <span className="status-pill st-warn">{Number(u.open_reports)}</span> : '0'}</td>
                  <td>
                    {u.banned ? (
                      <span className="status-pill st-blocked" title={u.ban_reason ?? ''}>
                        Suspendido
                      </span>
                    ) : (
                      <span className="status-pill st-active">Activo</span>
                    )}
                    {u.banned && u.ban_reason && <div className="muted small">{u.ban_reason}</div>}
                  </td>
                  <td>
                    {!u.is_admin &&
                      (u.banned ? (
                        <button type="button" className="btn btn-light btn-sm" onClick={() => unbanUser(u.id, u.username, done, onError)}>
                          Reactivar
                        </button>
                      ) : (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => banUser(u.id, u.username, done, onError)}>
                          Suspender
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ───────────────────────── Registro de acciones ───────────────────────── */

const ACTION_LABEL: Record<string, string> = {
  user_banned: 'Suspendió a un usuario',
  user_unbanned: 'Reactivó a un usuario',
  listing_blocked: 'Bloqueó un anuncio',
  listing_unblocked: 'Desbloqueó un anuncio',
  report_resolved: 'Resolvió una denuncia',
  report_dismissed: 'Descartó una denuncia',
  report_open: 'Reabrió una denuncia',
  subscription_active: 'Activó una suscripción',
  subscription_rejected: 'Rechazó una suscripción',
  subscription_cancelled: 'Canceló una suscripción',
  setting_changed: 'Cambió un ajuste de pagos',
  plan_changed: 'Modificó un plan',
}

function describe(a: AuditRow): string {
  const d = a.details ?? {}
  const parts: string[] = []
  if (typeof d.title === 'string') parts.push(`“${d.title}”`)
  if (typeof d.reason === 'string') parts.push(`motivo: ${d.reason}`)
  if (typeof d.plan === 'string') parts.push(`plan ${d.plan}`)
  if (d.amount != null && d.currency) parts.push(`${d.amount} ${d.currency}`)
  if (a.action === 'setting_changed' && a.target_id) parts.push(`${a.target_id} = ${String(d.value ?? '')}`)
  if (a.action === 'plan_changed' && a.target_id) parts.push(`${a.target_id}: $${d.price_usd}`)
  if (typeof d.note === 'string' && d.note) parts.push(`nota: ${d.note}`)
  return parts.join(' · ')
}

export function AuditTab({ onError }: { onError: (m: string) => void }) {
  const [rows, setRows] = useState<AuditRow[] | null>(null)
  useEffect(() => {
    supabase.rpc('admin_list_audit', { p_limit: 200 }).then(({ data, error }) => {
      if (error) onError(error.message)
      setRows((data ?? []) as AuditRow[])
    })
  }, [onError])

  if (!rows) return <LoadingBlock />
  if (rows.length === 0)
    return (
      <div className="panel admin-empty">
        <History size={28} strokeWidth={1.4} />
        <p>Todavía no hay acciones registradas.</p>
      </div>
    )
  return (
    <div className="panel audit-list">
      <Alert kind="info">Cada acción de administración queda registrada aquí y no se puede borrar desde la web.</Alert>
      {rows.map((a) => (
        <div key={a.id} className="audit-row">
          <span className="audit-when" title={new Date(a.created_at).toLocaleString('es')}>
            {timeAgo(a.created_at)}
          </span>
          <span className="audit-what">
            <strong>{a.admin_username || 'Admin'}</strong> {(ACTION_LABEL[a.action] ?? a.action).toLowerCase()}
            {describe(a) && <span className="muted"> — {describe(a)}</span>}
          </span>
        </div>
      ))}
    </div>
  )
}
