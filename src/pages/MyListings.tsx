import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, EyeOff, ImageOff, Sparkles, Star, TrendingUp } from 'lucide-react'
import { useSeller } from '../context/SellerContext'
import { daysLeft } from '../lib/plans'
import { formatDate } from '../lib/format'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Listing } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo } from '../lib/format'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

const STATUS_LABEL: Record<string, string> = { active: 'Activa', paused: 'Pausada', sold: 'Vendida', reserved: 'Reservada' }

export default function MyListings() {
  const { user, loading: authLoading } = useAuth()
  const { plan, isAdmin, canSell, status: sellerStatus, refresh: refreshSeller } = useSeller()
  const [items, setItems] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error: err } = await supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    setItems((data ?? []) as Listing[])
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  async function patch(id: string, values: Partial<Listing>) {
    setError('')
    const { error: err } = await supabase.from('listings').update(values).eq('id', id)
    if (err) return setError(err.message)
    load()
    refreshSeller()
  }

  async function del(id: string) {
    if (!window.confirm('¿Eliminar esta publicación definitivamente?')) return
    const { error: err } = await supabase.from('listings').delete().eq('id', id)
    if (err) return setError(err.message)
    load()
  }

  if (authLoading) return <LoadingBlock />
  if (!user) return <EmptyState title="Inicia sesión" action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>} />

  const totalViews = items.reduce((a, l) => a + (l.views ?? 0), 0)
  const activeCount = items.filter((l) => l.status === 'active').length
  const featuredCount = items.filter((l) => l.status === 'active' && l.featured).length
  const canFeature = isAdmin || (plan?.max_featured ?? 0) > 0
  const showStats = isAdmin || !!plan?.stats
  const top = showStats ? [...items].filter((l) => l.status === 'active').sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, 3) : []
  const sub = sellerStatus?.subscription

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <h1>Mis publicaciones</h1>
          <p className="page-sub">{items.length} publicaciones · {totalViews} visitas en total</p>
        </div>
        <Link to="/publicar" className="btn btn-primary">+ Publicar</Link>
      </div>
      {!isAdmin && (
        <div className={`panel plan-strip ${canSell ? '' : 'is-off'}`}>
          {canSell && plan && sub ? (
            <>
              <BadgeCheck size={20} className="plan-strip-icon" />
              <div className="plan-strip-info">
                <strong>Plan {plan.name}</strong>
                <span className="muted small">
                  {activeCount} de {plan.max_listings ?? '∞'} anuncios activos
                  {plan.max_featured > 0 ? ` · ${featuredCount} de ${plan.max_featured} destacados` : ''} · vence el {formatDate(sub.expires_at!)} ({daysLeft(sub.expires_at)} días)
                </span>
              </div>
              <Link to="/planes" className="btn btn-outline btn-sm">
                {daysLeft(sub.expires_at) <= 7 ? 'Renovar' : 'Mejorar plan'}
              </Link>
            </>
          ) : (
            <>
              <EyeOff size={20} className="plan-strip-icon" />
              <div className="plan-strip-info">
                <strong>{sellerStatus?.pending ? 'Tu plan está en revisión' : 'Tus anuncios no se ven en el sitio'}</strong>
                <span className="muted small">
                  {sellerStatus?.pending
                    ? 'En cuanto se apruebe el pago, tus anuncios activos vuelven a ser públicos.'
                    : 'Necesitas un plan activo para que el público vea tus anuncios. No se borra nada.'}
                </span>
              </div>
              <Link to="/planes" className="btn btn-primary btn-sm">
                <Sparkles size={15} /> Ver planes
              </Link>
            </>
          )}
        </div>
      )}
      {showStats && top.length > 0 && (
        <div className="stats-row mylist-stats">
          <div className="stat">
            <strong>{totalViews}</strong>
            <span>Visitas totales</span>
          </div>
          {top.map((l) => (
            <Link key={l.id} to={`/publicacion/${l.id}`} className="stat stat-link">
              <strong>
                <TrendingUp size={15} /> {l.views}
              </strong>
              <span>{l.title}</span>
            </Link>
          ))}
        </div>
      )}
      {error && <Alert kind="error">{error}</Alert>}
      {loading ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="No tienes publicaciones" message="Vende lo que ya no usas en minutos." action={<Link to="/publicar" className="btn btn-primary">Publicar ahora</Link>} />
      ) : (
        <div className="card mylist">
          {items.map((l) => (
            <div key={l.id} className="mylist-row">
              <Link to={`/publicacion/${l.id}`} className="cart-thumb">
                {l.images?.[0] ? <img src={storageUrl(l.images[0], 200)} alt="" /> : <ImageOff size={22} />}
              </Link>
              <div className="cart-info">
                <Link to={`/publicacion/${l.id}`} className="cart-title">{l.title}</Link>
                <div className="muted small">
                  {formatPrice(l.price_usd, l.currency, l.price_period)} · {l.price_period ? 'Alquiler' : `Stock ${l.stock}`} · {l.views} visitas · {timeAgo(l.created_at)}
                </div>
                {l.blocked_at ? (
                  <span className="status-pill st-blocked" title={l.blocked_reason ?? ''}>
                    Bloqueado: {l.blocked_reason || 'incumple las normas'}
                  </span>
                ) : (
                  <span className={`status-pill st-${l.status}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
                )}
                {l.featured && l.status === 'active' && (
                  <span className="status-pill st-featured">
                    <Star size={11} /> Destacado
                  </span>
                )}
              </div>
              <div className="mylist-actions">
                <Link to={`/editar/${l.id}`} className="btn btn-outline btn-sm">Editar</Link>
                {canFeature && l.status === 'active' && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(l.id, { featured: !l.featured })}>
                    {l.featured ? 'Quitar destacado' : 'Destacar'}
                  </button>
                )}
                {l.status === 'active' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(l.id, { status: 'paused' })}>Pausar</button>}
                {l.status === 'paused' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(l.id, { status: 'active' })}>Reactivar</button>}
                {l.status !== 'sold' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(l.id, { status: 'sold' })}>Marcar vendida</button>}
                {l.status === 'sold' && <button type="button" className="btn btn-ghost btn-sm" onClick={() => patch(l.id, { status: 'active', stock: Math.max(1, l.stock) })}>Volver a publicar</button>}
                <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => del(l.id)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
