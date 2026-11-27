import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing, type Profile, type Question, type Review } from '../lib/types'
import { storageUrl } from '../lib/images'
import { timeAgo, discountPct, conditionLabel, formatDate } from '../lib/format'
import { asCurrency, convert, formatMoney, whatsappLink } from '../lib/cuba'
import Price from '../components/Price'
import { useFavorites } from '../context/FavoritesContext'
import { Eye, Heart, Leaf, MapPin, MessageCircle, Phone, ShieldCheck, ShoppingBag, Sparkles, Tag, Truck, Handshake, Clock, ChevronRight } from 'lucide-react'
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
  const fav = useFavorites()

  const [listing, setListing] = useState<Listing | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [sellerSales, setSellerSales] = useState(0)
  const [reviews, setReviews] = useState<Review[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [related, setRelated] = useState<Listing[]>([])
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
    if (!listing) return
    const ok = await fav.toggle(listing.id)
    if (!ok) navigate('/entrar')
  }

  async function addToCart() {
    if (!requireLogin() || !listing) return
    setBusy(true)
    setError('')
    try {
      await cart.add(listing.id, qty)
      setNotice('Agregado al carrito')
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
  const cur = asCurrency(listing.currency)
  const isFavorite = fav.isFavorite(listing.id)
  const isRental = !!listing.price_period
  const avg = avgRating(reviews)
  const wa = whatsappLink(listing.phone || seller?.phone, `Hola, me interesa "${listing.title}" en Isla Mercado`)

  return (
    <div className="detail-page">
      <nav className="crumbs">
        <Link to="/">Inicio</Link> <span>/</span>{' '}
        {category ? <Link to={`/categoria/${category.slug}`}>{category.name}</Link> : 'Anuncios'} <span>/</span>{' '}
        <span className="crumb-current">{listing.title}</span>
      </nav>

      <div className="detail-top">
        <div className="gallery panel">
          <div className="gallery-main">
            {images.length > 0 ? (
              <img src={storageUrl(images[activeImage], 1200)} alt={listing.title} />
            ) : (
              <div className="gallery-empty">Sin fotos</div>
            )}
            <button
              type="button"
              className={`heart-btn heart-lg ${isFavorite ? 'is-on' : ''}`}
              onClick={toggleFavorite}
              aria-label={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            >
              <Heart size={20} strokeWidth={1.8} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`thumb ${i === activeImage ? 'thumb-active' : ''}`}
                  onClick={() => setActiveImage(i)}
                  aria-label={`Foto ${i + 1}`}
                >
                  <img src={storageUrl(img, 160)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="buy-box panel">
          <div className="buy-tags">
            {isRental && <span className="tag tag-static"><Tag size={12} /> Alquiler</span>}
            {listing.featured && <span className="tag tag-static"><Sparkles size={12} /> Destacado</span>}
            {listing.made_in_cuba && <span className="tag tag-static"><Leaf size={12} /> Hecho en Cuba</span>}
            <span className="tag tag-static tag-plain">{conditionLabel(listing.condition)}</span>
          </div>
          <h1 className="detail-title">{listing.title}</h1>
          <div className="detail-meta">
            <span><MapPin size={14} /> {listing.city && listing.city !== listing.province ? `${listing.city}, ` : ''}{listing.province}</span>
            <span><Clock size={14} /> {timeAgo(listing.created_at)}</span>
            <span><Eye size={14} /> {listing.views ?? 0} visitas</span>
          </div>

          <div className="detail-price-block">
            {listing.original_price && (
              <div className="old-price">
                {formatMoney(Number(listing.original_price), cur)} {pct && <span className="off">−{pct}%</span>}
              </div>
            )}
            <Price value={listing.price_usd} currency={cur} period={listing.price_period} size="xl" />
            <div className="price-alt">
              {cur === 'CUP'
                ? `≈ ${formatMoney(convert(Number(listing.price_usd), 'CUP', 'USD'), 'USD')}`
                : `≈ ${formatMoney(convert(Number(listing.price_usd), cur, 'CUP'), 'CUP')}`}
              {listing.negotiable && <span className="negotiable"><Handshake size={14} /> Negociable</span>}
            </div>
          </div>

          <div className="ship-line">
            <Truck size={17} strokeWidth={1.7} />
            {listing.free_shipping ? <span><strong>Envío gratis</strong> a toda Cuba</span> : <span>Entrega a coordinar con el vendedor</span>}
          </div>

          {available ? (
            <>
              {!isRental && (
                <div className="stock-row">
                  <span>{listing.stock === 1 ? 'Última unidad' : `${listing.stock} disponibles`}</span>
                  {listing.stock > 1 && (
                    <label className="qty-select">
                      Cantidad
                      <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                        {Array.from({ length: Math.min(listing.stock, 10) }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
              )}
              {isOwner ? (
                <Alert kind="info">Este es tu anuncio. <Link to={`/editar/${listing.id}`}>Editarlo</Link> · <Link to="/mis-publicaciones">Mis anuncios</Link></Alert>
              ) : (
                <div className="buy-actions">
                  <button type="button" className="btn btn-primary btn-lg btn-block" onClick={buyNow}>
                    {isRental ? 'Solicitar alquiler' : 'Comprar ahora'}
                  </button>
                  {!isRental && (
                    <button type="button" className="btn btn-light btn-lg btn-block" onClick={addToCart} disabled={busy}>
                      <ShoppingBag size={17} /> Agregar al carrito
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <Alert kind="info">
              {listing.status === 'sold' ? 'Este artículo ya se vendió.' : 'Este anuncio está pausado por el vendedor.'}
            </Alert>
          )}

          {notice && (
            <Alert kind="success">
              {notice} · <Link to="/carrito">Ver carrito</Link>
            </Alert>
          )}
          {error && <Alert kind="error">{error}</Alert>}

          <ul className="guarantees">
            <li><ShieldCheck size={16} /> Puedes cancelar mientras el pedido esté pendiente.</li>
            <li><MessageCircle size={16} /> Habla con el vendedor antes de pagar.</li>
          </ul>
        </div>
      </div>

      <div className="detail-grid">
        <div className="detail-left">
          <section className="panel">
            <h2 className="panel-title">Descripción</h2>
            <p className="detail-desc">{listing.description || 'El vendedor no añadió descripción.'}</p>
          </section>

          <section className="panel">
            <h2 className="panel-title">Preguntas al vendedor</h2>
            {!isOwner && (
              <form className="ask-form" onSubmit={askQuestion}>
                <input
                  type="text"
                  placeholder={user ? '¿Hace envíos a Matanzas? ¿Acepta Transfermóvil?' : 'Entra para hacer una pregunta'}
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
              <p className="muted">Nadie ha preguntado todavía.</p>
            ) : (
              <ul className="qa-list">
                {questions.map((qq) => (
                  <li key={qq.id}>
                    <p className="qa-q">{qq.question} <small className="muted">· {formatDate(qq.created_at)}</small></p>
                    {qq.answer ? (
                      <p className="qa-a">{qq.answer} <small className="muted">· {qq.answered_at ? formatDate(qq.answered_at) : ''}</small></p>
                    ) : isOwner ? (
                      <div className="ask-form">
                        <input
                          type="text"
                          placeholder="Escribe tu respuesta…"
                          value={answers[qq.id] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [qq.id]: e.target.value }))}
                        />
                        <button type="button" className="btn btn-light btn-sm" onClick={() => answerQuestion(qq.id)}>
                          Responder
                        </button>
                      </div>
                    ) : (
                      <p className="qa-a muted">Esperando respuesta</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <h2 className="panel-title">Opiniones del vendedor</h2>
            {reviews.length === 0 ? (
              <p className="muted">Este vendedor aún no tiene opiniones.</p>
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
            <div className="panel seller-card">
              <Link to={`/vendedor/${seller.id}`} className="seller-row">
                <span className="avatar-lg">{(seller.username || 'V').slice(0, 2).toUpperCase()}</span>
                <span className="grow">
                  <span className="seller-name">{seller.username || 'Vendedor'}</span>
                  <span className="muted small">{sellerSales} anuncios · desde {formatDate(seller.created_at)}</span>
                </span>
                <ChevronRight size={18} className="muted" />
              </Link>
              <div className="seller-rating">
                <Stars value={avg} size="sm" />
                <span>{reviews.length ? `${avg.toFixed(1)} · ${reviews.length} opinión${reviews.length === 1 ? '' : 'es'}` : 'Sin opiniones'}</span>
              </div>
              {wa && !isOwner && (
                <a href={wa} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-block">
                  <MessageCircle size={17} /> Escribir por WhatsApp
                </a>
              )}
              {listing.phone && !isOwner && (
                <a href={`tel:${listing.phone}`} className="btn btn-light btn-block"><Phone size={16} /> {listing.phone}</a>
              )}
            </div>
          )}

          {!isOwner && (
            <div className="panel">
              <h3 className="panel-title">Mensaje al vendedor</h3>
              {user ? (
                <form className="msg-form" onSubmit={sendMessage}>
                  <textarea rows={3} placeholder="Hola, ¿todavía está disponible?" value={body} onChange={(e) => setBody(e.target.value)} required />
                  <button type="submit" className="btn btn-primary" disabled={busy}>Enviar mensaje</button>
                </form>
              ) : (
                <Link to="/entrar" className="btn btn-primary btn-block">Entra para escribir</Link>
              )}
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">También te puede interesar</h2>
          </div>
          <div className="card-grid">
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
