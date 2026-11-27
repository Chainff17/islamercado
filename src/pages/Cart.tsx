import { Link, useNavigate } from 'react-router-dom'
import { ImageOff, MapPin, Minus, Plus, ShoppingBag, Trash2, Truck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { storageUrl } from '../lib/images'
import { formatMoney, asCurrency } from '../lib/cuba'
import Price from '../components/Price'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

export default function Cart() {
  const { user, loading: authLoading } = useAuth()
  const { items, loading, totals, count, setQty, remove } = useCart()
  const navigate = useNavigate()

  if (authLoading) return <LoadingBlock />
  if (!user)
    return (
      <EmptyState
        title="Tu carrito te espera"
        message="Entra en tu cuenta para guardar productos y comprar."
        action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>}
      />
    )
  if (loading && items.length === 0) return <LoadingBlock />
  if (items.length === 0)
    return (
      <EmptyState
        title="Tu carrito está vacío"
        message="Explora los anuncios y guarda aquí lo que quieras comprar."
        action={<Link to="/buscar" className="btn btn-primary">Ver anuncios</Link>}
      />
    )

  const unavailable = items.filter((i) => !i.listing || i.listing.status !== 'active' || i.quantity > i.listing.stock)
  const currencies = Object.keys(totals)

  return (
    <div className="page">
      <h1 className="page-title">
        <ShoppingBag size={26} strokeWidth={1.6} className="title-icon" /> Carrito <span className="muted">({count})</span>
      </h1>
      <div className="cart-layout">
        <div className="panel cart-list">
          {items.map((it) => {
            const l = it.listing
            if (!l)
              return (
                <div key={it.id} className="cart-row cart-row-bad">
                  <span className="cart-thumb"><ImageOff size={22} /></span>
                  <div className="cart-info">
                    <span className="cart-title">Producto no disponible</span>
                    <div className="text-danger small">
                      El vendedor pausó este anuncio o su plan venció. Quítalo para continuar.
                    </div>
                    <div className="cart-actions">
                      <button type="button" className="link-btn" onClick={() => remove(it.listing_id)}><Trash2 size={14} /> Quitar</button>
                    </div>
                  </div>
                </div>
              )
            const bad = l.status !== 'active' || it.quantity > l.stock
            return (
              <div key={it.id} className={`cart-row ${bad ? 'cart-row-bad' : ''}`}>
                <Link to={`/publicacion/${l.id}`} className="cart-thumb">
                  {l.images?.[0] ? <img src={storageUrl(l.images[0], 200)} alt="" /> : <ImageOff size={22} />}
                </Link>
                <div className="cart-info">
                  <Link to={`/publicacion/${l.id}`} className="cart-title">{l.title}</Link>
                  <div className="muted small inline-icons">
                    <MapPin size={13} /> {l.province}
                    {l.free_shipping && <span className="ok"><Truck size={13} /> Envío gratis</span>}
                  </div>
                  {bad && <div className="text-danger small">{l.status !== 'active' ? 'Ya no está disponible' : `Solo quedan ${l.stock}`}</div>}
                  <div className="cart-actions">
                    <button type="button" className="link-btn" onClick={() => remove(l.id)}><Trash2 size={14} /> Quitar</button>
                    <button type="button" className="link-btn" onClick={() => navigate(`/checkout?item=${l.id}&qty=${it.quantity}`)}>Comprar solo este</button>
                  </div>
                </div>
                <div className="qty-stepper">
                  <button type="button" onClick={() => setQty(l.id, it.quantity - 1)} aria-label="Uno menos"><Minus size={14} /></button>
                  <span>{it.quantity}</span>
                  <button type="button" onClick={() => setQty(l.id, it.quantity + 1)} disabled={it.quantity >= l.stock} aria-label="Uno más"><Plus size={14} /></button>
                </div>
                <div className="cart-price">
                  <Price value={Number(l.price_usd) * it.quantity} currency={l.currency} size="md" />
                </div>
              </div>
            )
          })}
        </div>

        <aside className="panel cart-summary">
          <h3 className="panel-title">Resumen</h3>
          <div className="sum-row"><span>Productos</span><span>{count}</span></div>
          <div className="sum-row"><span>Entrega</span><span>A coordinar</span></div>
          <div className="sum-total">
            <span>Total</span>
            <span className="sum-amounts">
              {currencies.map((c) => (
                <strong key={c}>{formatMoney(totals[c], asCurrency(c))}</strong>
              ))}
            </span>
          </div>
          {currencies.length > 1 && <p className="hint">Cada moneda se paga por separado al vendedor correspondiente.</p>}
          {unavailable.length > 0 && <Alert kind="error">Revisa los productos marcados antes de continuar.</Alert>}
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={unavailable.length > 0} onClick={() => navigate('/checkout')}>
            Continuar compra
          </button>
          <Link to="/buscar" className="btn btn-ghost btn-block">Seguir mirando</Link>
        </aside>
      </div>
    </div>
  )
}
