import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { storageUrl } from '../lib/images'
import { formatPrice } from '../lib/format'
import { convert, formatMoney } from '../lib/cuba'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

export default function Cart() {
  const { user, loading: authLoading } = useAuth()
  const { items, loading, total, count, setQty, remove } = useCart()
  const navigate = useNavigate()

  if (authLoading) return <LoadingBlock />
  if (!user)
    return (
      <EmptyState
        title="Tu carrito te espera"
        message="Inicia sesión para agregar productos y comprar en toda Cuba."
        action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>}
      />
    )
  if (loading && items.length === 0) return <LoadingBlock />
  if (items.length === 0)
    return (
      <EmptyState
        title="Tu carrito está vacío"
        message="Explora miles de artículos y agrega los que te gusten."
        action={<Link to="/buscar" className="btn btn-primary">Descubrir productos</Link>}
      />
    )

  const unavailable = items.filter((i) => !i.listing || i.listing.status !== 'active' || i.quantity > i.listing.stock)
  const freeShip = items.every((i) => i.listing?.free_shipping)

  return (
    <div className="page cart-page">
      <h1>Carrito ({count})</h1>
      <div className="cart-layout">
        <div className="card cart-list">
          {items.map((it) => {
            const l = it.listing
            if (!l) return null
            const bad = l.status !== 'active' || it.quantity > l.stock
            return (
              <div key={it.id} className={`cart-row ${bad ? 'cart-row-bad' : ''}`}>
                <Link to={`/publicacion/${l.id}`} className="cart-thumb">
                  {l.images?.[0] ? <img src={storageUrl(l.images[0])} alt={l.title} /> : <span>📦</span>}
                </Link>
                <div className="cart-info">
                  <Link to={`/publicacion/${l.id}`} className="cart-title">{l.title}</Link>
                  <div className="muted small">📍 {l.province} {l.free_shipping && <span className="ship-free">· Envío gratis</span>}</div>
                  {bad && <div className="text-danger small">{l.status !== 'active' ? 'No disponible' : `Solo quedan ${l.stock}`}</div>}
                  <div className="cart-actions">
                    <button type="button" className="btn btn-link btn-sm" onClick={() => remove(l.id)}>Eliminar</button>
                    <button type="button" className="btn btn-link btn-sm" onClick={() => navigate(`/checkout?item=${l.id}&qty=${it.quantity}`)}>Comprar ahora</button>
                  </div>
                </div>
                <div className="qty-stepper">
                  <button type="button" onClick={() => setQty(l.id, it.quantity - 1)} aria-label="Menos">−</button>
                  <span>{it.quantity}</span>
                  <button type="button" onClick={() => setQty(l.id, it.quantity + 1)} disabled={it.quantity >= l.stock} aria-label="Más">+</button>
                </div>
                <div className="cart-price">{formatPrice(Number(l.price_usd) * it.quantity, l.currency)}</div>
              </div>
            )
          })}
        </div>

        <aside className="card cart-summary">
          <h3 className="card-h">Resumen de compra</h3>
          <div className="sum-row"><span>Productos ({count})</span><span>{formatPrice(total)}</span></div>
          <div className="sum-row"><span>Envío</span><span className={freeShip ? 'ship-free' : ''}>{freeShip ? 'Gratis' : 'A coordinar'}</span></div>
          <div className="sum-row sum-total"><span>Total</span><span>{formatPrice(total)}</span></div>
          <div className="muted small">≈ {formatMoney(convert(total, 'USD', 'CUP'), 'CUP')}</div>
          {unavailable.length > 0 && <Alert kind="error">Revisa los productos marcados antes de continuar.</Alert>}
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={unavailable.length > 0}
            onClick={() => navigate('/checkout')}
          >
            Continuar compra
          </button>
        </aside>
      </div>
    </div>
  )
}
