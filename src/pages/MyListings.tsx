import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Listing } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo } from '../lib/format'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

const STATUS_LABEL: Record<string, string> = { active: 'Activa', paused: 'Pausada', sold: 'Vendida', reserved: 'Reservada' }

export default function MyListings() {
  const { user, loading: authLoading } = useAuth()
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

  return (
    <div className="page">
      <div className="page-head page-head-row">
        <div>
          <h1>Mis publicaciones</h1>
          <p className="page-sub">{items.length} publicaciones · {totalViews} visitas en total</p>
        </div>
        <Link to="/publicar" className="btn btn-primary">+ Publicar</Link>
      </div>
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
                {l.images?.[0] ? <img src={storageUrl(l.images[0])} alt="" /> : <span>📦</span>}
              </Link>
              <div className="cart-info">
                <Link to={`/publicacion/${l.id}`} className="cart-title">{l.title}</Link>
                <div className="muted small">
                  {formatPrice(l.price_usd, l.currency)} · Stock {l.stock} · 👁 {l.views} · {timeAgo(l.created_at)}
                </div>
                <span className={`status-pill st-${l.status}`}>{STATUS_LABEL[l.status] ?? l.status}</span>
              </div>
              <div className="mylist-actions">
                <Link to={`/editar/${l.id}`} className="btn btn-outline btn-sm">Editar</Link>
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
