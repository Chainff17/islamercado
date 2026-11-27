import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Listing } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { storageUrl } from '../lib/images'
import { PAYMENT_METHODS, PROVINCES, asCurrency, formatMoney } from '../lib/cuba'
import Price from '../components/Price'
import { CreditCard, MapPin, ShieldCheck } from 'lucide-react'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'

interface Line {
  listing: Listing
  quantity: number
}

export default function Checkout() {
  const { user, profile, loading: authLoading } = useAuth()
  const cart = useCart()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const itemId = params.get('item')
  const itemQty = Math.max(1, Number(params.get('qty') ?? '1') || 1)

  const [direct, setDirect] = useState<Listing | null>(null)
  const [loadingItem, setLoadingItem] = useState(!!itemId)
  const [payment, setPayment] = useState('transfermovil')
  const [form, setForm] = useState({ name: '', phone: '', province: 'La Habana', city: '', address: '', notes: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile) setForm((f) => ({ ...f, name: f.name || profile.username || '', phone: f.phone || profile.phone || '' }))
  }, [profile])

  useEffect(() => {
    if (!itemId) return
    setLoadingItem(true)
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('id', itemId)
      .maybeSingle()
      .then(({ data }) => {
        setDirect((data as Listing) ?? null)
        setLoadingItem(false)
      })
  }, [itemId])

  const lines: Line[] = useMemo(() => {
    if (itemId) return direct ? [{ listing: direct, quantity: itemQty }] : []
    return cart.items.filter((i) => i.listing).map((i) => ({ listing: i.listing!, quantity: i.quantity }))
  }, [itemId, direct, itemQty, cart.items])

  const totals: Record<string, number> = {}
  for (const l of lines) {
    const c = l.listing.currency || 'USD'
    totals[c] = (totals[c] ?? 0) + Number(l.listing.price_usd) * l.quantity
  }
  const groups = new Set(lines.map((l) => `${l.listing.seller_id}|${l.listing.currency}`)).size

  function upd<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!form.name.trim() || !form.phone.trim()) return setError('Indica nombre y teléfono de contacto.')
    if (!/^\+?[\d\s-]{8,15}$/.test(form.phone.trim())) return setError('Teléfono no válido. Ej: 5 123 4567')
    setSaving(true)
    const { data, error: err } = await supabase.rpc('place_order', {
      p_payment: payment,
      p_name: form.name,
      p_phone: form.phone,
      p_province: form.province,
      p_city: form.city,
      p_address: form.address,
      p_notes: form.notes,
      p_listing_id: itemId ?? null,
      p_qty: itemQty,
    })
    setSaving(false)
    if (err) return setError(err.message)
    await cart.refresh()
    const ids = (data as string[]) ?? []
    navigate(`/mis-compras?nuevo=${ids.length}`)
  }

  if (authLoading || loadingItem) return <LoadingBlock />
  if (!user)
    return <EmptyState title="Inicia sesión para comprar" action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>} />
  if (lines.length === 0)
    return <EmptyState title="No hay nada que comprar" message="Agrega productos al carrito primero." action={<Link to="/buscar" className="btn btn-primary">Explorar</Link>} />

  return (
    <div className="page">
      <h1 className="page-title">Finalizar compra</h1>
      <form className="cart-layout" onSubmit={onSubmit}>
        <div className="checkout-main">
          <section className="panel form">
            <h2 className="panel-title"><MapPin size={19} strokeWidth={1.7} /> ¿Dónde lo recibes?</h2>
            <div className="form-row">
              <label className="field"><span>Nombre de quien recibe *</span>
                <input value={form.name} onChange={(e) => upd('name', e.target.value)} required />
              </label>
              <label className="field"><span>Teléfono (Cuba) *</span>
                <input type="tel" value={form.phone} onChange={(e) => upd('phone', e.target.value)} placeholder="5 123 4567" required />
              </label>
            </div>
            <div className="form-row">
              <label className="field"><span>Provincia *</span>
                <select value={form.province} onChange={(e) => upd('province', e.target.value)}>
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label className="field"><span>Municipio</span>
                <input value={form.city} onChange={(e) => upd('city', e.target.value)} placeholder="Ej: Plaza de la Revolución" />
              </label>
            </div>
            <label className="field"><span>Dirección</span>
              <input value={form.address} onChange={(e) => upd('address', e.target.value)} placeholder="Calle, número, entre calles, reparto" />
            </label>
            <label className="field"><span>Notas para el vendedor</span>
              <textarea rows={2} value={form.notes} onChange={(e) => upd('notes', e.target.value)} placeholder="Horario de entrega, referencias…" />
            </label>
          </section>

          <section className="panel">
            <h2 className="panel-title"><CreditCard size={19} strokeWidth={1.7} /> ¿Cómo pagas?</h2>
            <div className="pay-grid">
              {PAYMENT_METHODS.map((m) => (
                <label key={m.id} className={`pay-option ${payment === m.id ? 'pay-on' : ''}`}>
                  <input type="radio" name="payment" value={m.id} checked={payment === m.id} onChange={() => setPayment(m.id)} />
                  <div><strong>{m.label}</strong><small>{m.hint}</small></div>
                </label>
              ))}
            </div>
            <p className="muted small">
              El pago se coordina directamente con el vendedor. Recomendamos pagar al recibir o tras confirmar por mensaje.
            </p>
          </section>
        </div>

        <aside className="panel cart-summary">
          <h3 className="panel-title">Resumen</h3>
          {lines.map((l) => (
            <div key={l.listing.id} className="sum-item">
              {l.listing.images?.[0] && <img src={storageUrl(l.listing.images[0], 120)} alt="" />}
              <div>
                <div className="small">{l.listing.title}</div>
                <div className="muted small">{l.quantity} × <Price value={l.listing.price_usd} currency={l.listing.currency} period={l.listing.price_period} size="sm" /></div>
              </div>
            </div>
          ))}
          <div className="sum-total">
            <span>Total</span>
            <span className="sum-amounts">
              {Object.keys(totals).map((c) => (
                <strong key={c}>{formatMoney(totals[c], asCurrency(c))}</strong>
              ))}
            </span>
          </div>
          {groups > 1 && <p className="hint">Se crearán {groups} pedidos (uno por vendedor y moneda).</p>}
          {error && <Alert kind="error">{error}</Alert>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={saving}>
            {saving ? 'Procesando…' : 'Confirmar compra'}
          </button>
          <p className="hint inline-icons"><ShieldCheck size={14} /> Puedes cancelar mientras el pedido esté pendiente.</p>
        </aside>
      </form>
    </div>
  )
}
