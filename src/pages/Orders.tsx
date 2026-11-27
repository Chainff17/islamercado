import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Order, OrderItem } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { storageUrl } from '../lib/images'
import { formatDate, formatPrice } from '../lib/format'
import { ORDER_STATUS, paymentLabel, whatsappLink } from '../lib/cuba'
import { Stars } from '../components/Stars'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

type Mode = 'compras' | 'ventas'

export default function Orders({ mode }: { mode: Mode }) {
  const { user, loading: authLoading } = useAuth()
  const [params] = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [reviewFor, setReviewFor] = useState<string | null>(null)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reviewed, setReviewed] = useState<Set<string>>(new Set())
  const isSales = mode === 'ventas'

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const col = isSales ? 'seller_id' : 'buyer_id'
    const { data, error: err } = await supabase
      .from('orders')
      .select('*, order_items (*)')
      .eq(col, user.id)
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    const rows = ((data ?? []) as Array<Order & { order_items: OrderItem[] }>).map((o) => ({ ...o, items: o.order_items }))
    setOrders(rows)
    const otherIds = Array.from(new Set(rows.map((o) => (isSales ? o.buyer_id : o.seller_id))))
    if (otherIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, username').in('id', otherIds)
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.username ?? 'Usuario'])))
    }
    if (!isSales) {
      const { data: rv } = await supabase.from('reviews').select('seller_id').eq('author_id', user.id)
      setReviewed(new Set((rv ?? []).map((r) => r.seller_id)))
    }
    setLoading(false)
  }, [user, isSales])

  useEffect(() => {
    load()
  }, [load])

  async function setStatus(id: string, status: string) {
    if (status === 'cancelled' && !window.confirm('¿Seguro que quieres cancelar este pedido?')) return
    setError('')
    const { error: err } = await supabase.rpc('update_order_status', { p_order: id, p_status: status })
    if (err) return setError(err.message)
    load()
  }

  async function submitReview(sellerId: string) {
    if (!user) return
    const { error: err } = await supabase
      .from('reviews')
      .upsert({ author_id: user.id, seller_id: sellerId, rating, comment: comment.trim() }, { onConflict: 'author_id,seller_id' })
    if (err) return setError(err.message)
    setReviewFor(null)
    setComment('')
    setRating(5)
    setReviewed((s) => new Set(s).add(sellerId))
  }

  if (authLoading) return <LoadingBlock />
  if (!user) return <EmptyState title="Inicia sesión" action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>} />

  const shown = filter ? orders.filter((o) => o.status === filter) : orders
  const revenue = orders.filter((o) => o.status === 'delivered').reduce((a, o) => a + Number(o.total), 0)
  const pending = orders.filter((o) => o.status === 'pending').length

  return (
    <div className="page orders-page">
      <div className="page-head">
        <h1>{isSales ? 'Mis ventas' : 'Mis compras'}</h1>
        {isSales && (
          <div className="stats-row">
            <div className="stat"><strong>{orders.length}</strong><span>Pedidos</span></div>
            <div className="stat"><strong>{pending}</strong><span>Por confirmar</span></div>
            <div className="stat"><strong>{formatPrice(revenue)}</strong><span>Vendido (entregado)</span></div>
          </div>
        )}
      </div>

      {params.get('nuevo') && !isSales && (
        <Alert kind="success">🎉 ¡Compra realizada! El vendedor recibió tu pedido y un mensaje. Te contactará para coordinar pago y entrega.</Alert>
      )}
      {error && <Alert kind="error">{error}</Alert>}

      <div className="tabs">
        {[['', 'Todos'], ...Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label])].map(([k, label]) => (
          <button key={k} type="button" className={`tab ${filter === k ? 'tab-on' : ''}`} onClick={() => setFilter(k)}>{label}</button>
        ))}
      </div>

      {loading ? (
        <LoadingBlock />
      ) : shown.length === 0 ? (
        <EmptyState
          title={isSales ? 'Aún no tienes ventas' : 'Aún no has comprado nada'}
          message={isSales ? 'Publica artículos para empezar a vender.' : 'Explora el mercado y encuentra lo que necesitas.'}
          action={<Link to={isSales ? '/publicar' : '/buscar'} className="btn btn-primary">{isSales ? 'Publicar' : 'Explorar'}</Link>}
        />
      ) : (
        <div className="order-list">
          {shown.map((o) => {
            const st = ORDER_STATUS[o.status] ?? { label: o.status, color: '#555' }
            const otherId = isSales ? o.buyer_id : o.seller_id
            const firstListing = o.items?.find((i) => i.listing_id)?.listing_id
            const wa = isSales ? whatsappLink(o.delivery_phone, `Hola ${o.delivery_name ?? ''}, sobre tu pedido en Isla Mercado`) : null
            return (
              <div key={o.id} className="card order-card">
                <div className="order-head">
                  <div>
                    <span className="order-status" style={{ color: st.color, borderColor: st.color }}>{st.label}</span>
                    <span className="muted small"> Pedido #{o.id.slice(0, 8).toUpperCase()} · {formatDate(o.created_at)}</span>
                  </div>
                  <strong>{formatPrice(o.total, o.currency)}</strong>
                </div>
                {o.items?.map((it) => (
                  <div key={it.id} className="order-item">
                    {it.image ? <img src={storageUrl(it.image)} alt="" /> : <span className="order-noimg">📦</span>}
                    <div>
                      {it.listing_id ? <Link to={`/publicacion/${it.listing_id}`}>{it.title}</Link> : it.title}
                      <div className="muted small">{it.quantity} × {formatPrice(it.price)}</div>
                    </div>
                  </div>
                ))}
                <div className="order-meta small">
                  <span>{isSales ? '👤 Comprador' : '🏪 Vendedor'}: <Link to={`/vendedor/${otherId}`}>{names[otherId] ?? '…'}</Link></span>
                  <span>💳 {paymentLabel(o.payment_method)}</span>
                  <span>📍 {o.delivery_province}{o.delivery_city ? `, ${o.delivery_city}` : ''}</span>
                  {isSales && <span>📞 {o.delivery_name} · {o.delivery_phone}</span>}
                  {isSales && o.delivery_address && <span>🏠 {o.delivery_address}</span>}
                  {o.notes && <span>📝 {o.notes}</span>}
                </div>
                <div className="order-actions">
                  {firstListing && <Link to={`/mensajes/${firstListing}`} className="btn btn-outline btn-sm">💬 Mensajes</Link>}
                  {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">WhatsApp</a>}
                  {isSales && o.status === 'pending' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(o.id, 'confirmed')}>Confirmar</button>}
                  {isSales && o.status === 'confirmed' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(o.id, 'shipped')}>Marcar enviado</button>}
                  {isSales && o.status === 'shipped' && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(o.id, 'delivered')}>Marcar entregado</button>}
                  {!isSales && ['confirmed', 'shipped'].includes(o.status) && <button type="button" className="btn btn-primary btn-sm" onClick={() => setStatus(o.id, 'delivered')}>Ya lo recibí</button>}
                  {((isSales && !['delivered', 'cancelled'].includes(o.status)) || (!isSales && o.status === 'pending')) && (
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setStatus(o.id, 'cancelled')}>Cancelar</button>
                  )}
                  {!isSales && o.status === 'delivered' && !reviewed.has(o.seller_id) && (
                    <button type="button" className="btn btn-soft btn-sm" onClick={() => setReviewFor(o.id)}>⭐ Calificar vendedor</button>
                  )}
                </div>
                {reviewFor === o.id && (
                  <div className="review-form">
                    <Stars value={rating} onChange={setRating} />
                    <textarea rows={2} maxLength={1000} placeholder="¿Cómo fue tu experiencia?" value={comment} onChange={(e) => setComment(e.target.value)} />
                    <div className="order-actions">
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => submitReview(o.seller_id)}>Enviar opinión</button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReviewFor(null)}>Cancelar</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
