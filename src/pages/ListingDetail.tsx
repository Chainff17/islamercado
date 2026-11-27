import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing, type Profile, type Question, type Review } from '../lib/types'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo, discountPct, conditionLabel, formatDate } from '../lib/format'
import { convert, formatMoney, whatsappLink, type Currency } from '../lib/cuba'
import { Stars, ReviewItem } from '../components/Stars'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const cart = useCart()

  const [listing, setListing] = useState<Listing | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [sellerSales, setSellerSales] = useState(0)
  const [reviews, setReviews] = useState<Review[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [related, setRelated] = useState<Listing[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [qty, setQty] = useState(1)
  const [body, setBody] = useState('')
  const [question, setQuestion] = useState('')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  async function loadQuestions(listingId: string) {
    const { data } = await supabase
      .from('questions')
      .select('id, listing_id, asker_id, question, answer, answered_at, created_at')
      .eq('listing_id', listingId)
      .order('created_at', { ascending: false })
    setQuestions((data ?? []) as Question[])
  }

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    setQty(1)
    setNotice('')
    setError('')
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('id', id)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!active) return
        if (!data) {
          setListing(null)
          setLoading(false)
          return
        }
        const l = data as Listing
        setListing(l)
        setActiveImage(0)
        setLoading(false)

        const [sel, rv, cat, rel, sales] = await Promise.all([
          supabase.from('profiles').select('id, username, phone, avatar_url, created_at').eq('id', l.seller_id).maybeSingle(),
          supabase.from('reviews').select('id, author_id, seller_id, rating, comment, created_at, updated_at').eq('seller_id', l.seller_id).order('created_at', { ascending: false }),
          supabase.from('categories').select('id, slug, name, icon').eq('id', l.category_id).maybeSingle(),
          supabase.from('listings').select(LISTING_SELECT).eq('status', 'active').eq('category_id', l.category_id).neq('id', l.id).order('views', { ascending: false }).limit(4),
          supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', l.seller_id),
        ])
        if (!active) return
        setSeller(sel.data as Profile | null)
        setReviews((rv.data ?? []) as Review[])
        setCategory(cat.data as Category | null)
        setRelated((rel.data ?? []) as Listing[])
        setSellerSales(sales.count ?? 0)
        loadQuestions(l.id)

        supabase.rpc('increment_listing_views', { p_id: l.id }).then(() => {})

        if (user) {
          supabase
            .from('favorites')
            .select('listing_id')
            .eq('user_id', user.id)
            .eq('listing_id', l.id)
            .maybeSingle()
            .then(({ data: fav }) => active && setIsFavorite(!!fav))
        }
      })
    return () => {
      active = false
    }
  }, [id, user])

  function requireLogin(): boolean {
    if (!user) {
      navigate('/entrar')
      return false
    }
    return true
  }

  async function toggleFavorite() {
    if (!requireLogin() || !listing) return
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', user!.id).eq('listing_id', listing.id)
      setIsFavorite(false)
    } else {
      await supabase.from('favorites').insert({ user_id: user!.id, listing_id: listing.id })
      setIsFavorite(true)
    }
  }

  async function addToCart() {
    if (!requireLogin() || !listing) return
    setBusy(true)
    setError('')
    try {
      await cart.add(listing.id, qty)
      setNotice('✓ Agregado al carrito')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar al carrito')
    } finally {
      setBusy(false)
    }
  }

  function buyNow() {
    if (!requireLogin() || !listing) return
    navigate(`/checkout?item=${listing.id}&qty=${qty}`)
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    if (!requireLogin() || !listing || !body.trim()) return
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('messages').insert({
      listing_id: listing.id,
      sender_id: user!.id,
      receiver_id: listing.seller_id,
      body: body.trim(),
    })
    setBusy(false)
    if (err) return setError(err.message)
    setBody('')
    navigate(`/mensajes/${listing.id}`)
  }

  async function askQuestion(e: FormEvent) {
    e.preventDefault()
    if (!requireLogin() || !listing || !question.trim()) return
    setBusy(true)
    const { error: err } = await supabase
      .from('questions')
      .insert({ listing_id: listing.id, asker_id: user!.id, question: question.trim() })
    setBusy(false)
    if (err) return setError(err.message)
    setQuestion('')
    loadQuestions(listing.id)
  }

  async function answerQuestion(qid: string) {
    const text = (answers[qid] ?? '').trim()
    if (!text || !listing) return
    const { error: err } = await supabase
      .from('questions')
      .update({ answer: text, answered_at: new Date().toISOString() })
      .eq('id', qid)
    if (err) return setError(err.message)
    setAnswers((a) => ({ ...a, [qid]: '' }))
    loadQuestions(listing.id)
  }

  if (loading) return <LoadingBlock />
  if (!listing)
    return (
      <EmptyState
        title="Publicación no encontrada"
        message="La publicación que buscas no existe o ya no está disponible."
        action={<Link to="/buscar" className="btn btn-outline">Volver a explorar</Link>}
      />
    )

  const images = listing.images ?? []
  const isOwner = user?.id === listing.seller_id
  const available = listing.status === 'active' && listing.stock > 0
  const pct = discountPct(Number(listing.price_usd), listing.original_price)
  const cur = (listing.currency || 'USD') as Currency
  const avg = avgRating(reviews)
  const wa = whatsappLink(listing.phone || seller?.phone, `Hola, me interesa "${listing.title}" en Isla Mercado`)

  return (
    <div className="detail-page">
      <nav className="breadcrumb">
        <Link to="/">Inicio</Link> ›{' '}
        {category ? <Link to={`/categoria/${category.slug}`}>{category.name}</Link> : 'Artículos'} ›{' '}
        <span>{listing.title}</span>
      </nav>

      <div className="listing-detail card">
        <div className="gallery">
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`thumb ${i === activeImage ? 'thumb-active' : ''}`}
                  onMouseEnter={() => setActiveImage(i)}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={storageUrl(img)} alt={`${listing.title} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
          <div className="gallery-main">
            {images.length > 0 ? (
              <img src={storageUrl(images[activeImage])} alt={listing.title} />
            ) : (
              <div className="gallery-empty">📦</div>
            )}
          </div>
        </div>

        <div className="buy-box">
          <div className="buy-sub">
            {conditionLabel(listing.condition)} · {listing.views ?? 0} vistas · {timeAgo(listing.created_at)}
          </div>
          <h1 className="detail-title">{listing.title}</h1>
          {reviews.length > 0 && (
            <div className="seller-rating">
              <Stars value={avg} size="sm" /> <span>{avg.toFixed(1)} ({reviews.length})</span>
            </div>
          )}

          {listing.original_price && <div className="old-price">{formatPrice(listing.original_price, cur)}</div>}
          <div className="detail-price-row">
            <span className="detail-price">{formatPrice(listing.price_usd, cur)}</span>
            {pct && <span className="off-pill">{pct}% OFF</span>}
          </div>
          <div className="price-alt">
            ≈ {formatMoney(convert(Number(listing.price_usd), cur, 'CUP'), 'CUP')} · ≈{' '}
            {formatMoney(convert(Number(listing.price_usd), cur, 'MLC'), 'MLC')}
          </div>
          <div className="installments">Paga con Transfermóvil, Zelle o contra entrega</div>

          <div className="ship-box">
            {listing.free_shipping ? (
              <p className="ship-free">🚚 <strong>Envío gratis</strong> a toda Cuba</p>
            ) : (
              <p>🚚 Envío a coordinar con el vendedor</p>
            )}
            <p className="muted">📍 Sale desde {listing.city ? `${listing.city}, ` : ''}{listing.province}</p>
          </div>

          {available ? (
            <>
              <div className="stock-line">
                <strong>Stock disponible</strong>
                <span className="muted"> ({listing.stock} disponible{listing.stock !== 1 ? 's' : ''})</span>
              </div>
              {listing.stock > 1 && (
                <label className="qty-select">
                  Cantidad:
                  <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                    {Array.from({ length: Math.min(listing.stock, 10) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} unidad{n > 1 ? 'es' : ''}</option>
                    ))}
                  </select>
                </label>
              )}
              {isOwner ? (
                <Alert kind="info">Esta es tu publicación. <Link to="/mis-publicaciones">Gestionarla</Link></Alert>
              ) : (
                <div className="buy-actions">
                  <button type="button" className="btn btn-primary btn-lg btn-block" onClick={buyNow}>
                    Comprar ahora
                  </button>
                  <button type="button" className="btn btn-soft btn-lg btn-block" onClick={addToCart} disabled={busy}>
                    Agregar al carrito
                  </button>
                </div>
              )}
            </>
          ) : (
            <Alert kind="info">
              {listing.status === 'sold' ? 'Este artículo ya fue vendido.' : 'Esta publicación está pausada.'}
            </Alert>
          )}

          {notice && (
            <Alert kind="success">
              {notice} · <Link to="/carrito">Ver carrito</Link>
            </Alert>
          )}
          {error && <Alert kind="error">{error}</Alert>}

          <button type="button" className={`btn btn-link ${isFavorite ? 'fav-on' : ''}`} onClick={toggleFavorite}>
            {isFavorite ? '♥ En favoritos' : '♡ Agregar a favoritos'}
          </button>

          <ul className="guarantees">
            <li>🛡️ <strong>Compra protegida:</strong> si no recibes el producto, cancelas el pedido.</li>
            <li>💬 Habla con el vendedor antes de pagar.</li>
            {listing.negotiable && <li>🤝 Precio negociable.</li>}
          </ul>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-left">
          <section className="card">
            <h2 className="card-h">Descripción</h2>
            <p className="detail-desc">{listing.description || 'Sin descripción.'}</p>
          </section>

          <section className="card">
            <h2 className="card-h">Preguntas y respuestas</h2>
            {!isOwner && (
              <form className="ask-form" onSubmit={askQuestion}>
                <input
                  type="text"
                  placeholder={user ? 'Escribe tu pregunta… ¿Hace envíos a Matanzas?' : 'Inicia sesión para preguntar'}
                  value={question}
                  maxLength={500}
                  onChange={(e) => setQuestion(e.target.value)}
                  onFocus={() => !user && navigate('/entrar')}
                />
                <button type="submit" className="btn btn-primary" disabled={busy || !question.trim()}>
                  Preguntar
                </button>
              </form>
            )}
            {questions.length === 0 ? (
              <p className="muted">Nadie ha preguntado todavía. ¡Sé el primero!</p>
            ) : (
              <ul className="qa-list">
                {questions.map((qq) => (
                  <li key={qq.id}>
                    <p className="qa-q">{qq.question} <small className="muted">· {formatDate(qq.created_at)}</small></p>
                    {qq.answer ? (
                      <p className="qa-a">↳ {qq.answer} <small className="muted">· {qq.answered_at ? formatDate(qq.answered_at) : ''}</small></p>
                    ) : isOwner ? (
                      <div className="ask-form">
                        <input
                          type="text"
                          placeholder="Responder…"
                          value={answers[qq.id] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [qq.id]: e.target.value }))}
                        />
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => answerQuestion(qq.id)}>
                          Responder
                        </button>
                      </div>
                    ) : (
                      <p className="qa-a muted">↳ Esperando respuesta del vendedor</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2 className="card-h">Opiniones sobre el vendedor</h2>
            {reviews.length === 0 ? (
              <p className="muted">Aún no hay reseñas para este vendedor.</p>
            ) : (
              <div className="review-list">
                {reviews.slice(0, 5).map((r) => (
                  <ReviewItem key={r.id} rating={r.rating} comment={r.comment} createdAt={r.created_at} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-side">
          {seller && (
            <div className="card seller-card">
              <h3 className="card-h">Información del vendedor</h3>
              <Link to={`/vendedor/${seller.id}`} className="seller-row">
                <span className="avatar-lg">{(seller.username || 'V').slice(0, 2).toUpperCase()}</span>
                <div>
                  <div className="seller-name">{seller.username || 'Vendedor'}</div>
                  <div className="muted small">{sellerSales} publicaciones · desde {formatDate(seller.created_at)}</div>
                </div>
              </Link>
              <div className="rep-bar">
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className={`rep-seg rep-${n} ${avg >= n - 0.5 && reviews.length ? 'on' : ''}`} />
                ))}
              </div>
              {wa && !isOwner && (
                <a href={wa} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-block">
                  WhatsApp al vendedor
                </a>
              )}
              {listing.phone && !isOwner && (
                <a href={`tel:${listing.phone}`} className="btn btn-outline btn-block">📞 {listing.phone}</a>
              )}
            </div>
          )}

          {!isOwner && (
            <div className="card">
              <h3 className="card-h">Mensaje privado</h3>
              {user ? (
                <form className="msg-form" onSubmit={sendMessage}>
                  <textarea
                    rows={3}
                    placeholder="Hola, ¿sigue disponible?"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    required
                  />
                  <button type="submit" className="btn btn-primary" disabled={busy}>
                    Enviar mensaje
                  </button>
                </form>
              ) : (
                <Link to="/entrar" className="btn btn-primary btn-block">Inicia sesión para escribir</Link>
              )}
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section">
          <h2 className="section-title">Productos relacionados</h2>
          <div className="listing-grid">
            {related.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function avgRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  return reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
}
