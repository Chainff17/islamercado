import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Listing, Profile, Review } from '../lib/types'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo } from '../lib/format'
import { Stars, ReviewItem } from '../components/Stars'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [listing, setListing] = useState<Listing | null>(null)
  const [seller, setSeller] = useState<Profile | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [activeImage, setActiveImage] = useState(0)
  const [body, setBody] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    supabase
      .from('listings')
      .select(
        'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at',
      )
      .eq('id', id)
      .single()
      .then(async ({ data, error: err }) => {
        if (!active) return
        if (err) {
          setLoading(false)
          return
        }
        const l = data as Listing
        setListing(l)
        setActiveImage(0)

        // Vendedor
        supabase
          .from('profiles')
          .select('id, username, phone, avatar_url, created_at')
          .eq('id', l.seller_id)
          .single()
          .then(({ data: s }) => active && setSeller(s as Profile))

        // Reseñas
        supabase
          .from('reviews')
          .select('id, author_id, seller_id, rating, comment, created_at, updated_at')
          .eq('seller_id', l.seller_id)
          .order('created_at', { ascending: false })
          .then(({ data: rv }) => active && setReviews((rv ?? []) as Review[]))

        // Vistas
        supabase.rpc('increment_listing_views', { p_id: l.id }).then(() => {})

        // Favorito
        if (user) {
          supabase
            .from('favorites')
            .select('listing_id')
            .eq('user_id', user.id)
            .eq('listing_id', l.id)
            .single()
            .then(({ data: fav }) => active && setIsFavorite(!!fav))
        }
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, user])

  async function toggleFavorite() {
    if (!user || !listing) return
    setError('')
    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listing.id)
      setIsFavorite(false)
    } else {
      await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listing.id })
      setIsFavorite(true)
    }
  }

  async function sendMessage(e: FormEvent) {
    e.preventDefault()
    if (!user || !listing || !body.trim()) return
    setSending(true)
    setError('')
    try {
      await supabase.from('messages').insert({
        listing_id: listing.id,
        sender_id: user.id,
        receiver_id: listing.seller_id,
        body: body.trim(),
      })
      setBody('')
      navigate(`/mensajes?to=${listing.seller_id}&listingId=${listing.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje')
    } finally {
      setSending(false)
    }
  }

  if (loading) return <LoadingBlock />
  if (!listing)
    return (
      <EmptyState
        title="Publicación no encontrada"
        message="La publicación que buscas no existe o ya no está disponible."
        action={
          <Link to="/buscar" className="btn btn-outline">
            Volver a explorar
          </Link>
        }
      />
    )

  const images = listing.images ?? []

  return (
    <div className="listing-detail">
      <div className="detail-main">
        <div className="gallery">
          <div className="gallery-main">
            {images.length > 0 ? (
              <img src={storageUrl(images[activeImage])} alt={listing.title} />
            ) : (
              <div className="gallery-empty">📦</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="gallery-thumbs">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  className={`thumb ${i === activeImage ? 'thumb-active' : ''}`}
                  onClick={() => setActiveImage(i)}
                >
                  <img src={storageUrl(img)} alt={`${listing.title} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-badges">
            {listing.condition && <span className="badge badge-condition">{listing.condition}</span>}
            {listing.negotiable && <span className="badge badge-negotiable">Negociable</span>}
            <span className="badge badge-views">👁 {listing.views ?? 0} vistas</span>
          </div>
          <h1 className="detail-title">{listing.title}</h1>
          <div className="detail-price">{formatPrice(listing.price_usd)}</div>
          <div className="detail-meta">
            📍 {listing.province}
            {listing.city ? `, ${listing.city}` : ''}
            <span className="dot">·</span>
            {timeAgo(listing.created_at)}
          </div>

          {listing.description && (
            <div className="detail-desc">
              <h3>Descripción</h3>
              <p>{listing.description}</p>
            </div>
          )}

          {listing.phone && (
            <div className="detail-phone">
              <span className="detail-phone-label">Teléfono del vendedor:</span>
              <a href={`tel:${listing.phone}`}>{listing.phone}</a>
            </div>
          )}

          {user ? (
            <button
              type="button"
              className={`btn ${isFavorite ? 'btn-favorite-on' : 'btn-outline'} btn-lg`}
              onClick={toggleFavorite}
            >
              {isFavorite ? '★ En favoritos' : '☆ Agregar a favoritos'}
            </button>
          ) : (
            <Link to="/entrar" className="btn btn-outline btn-lg">
              Inicia sesión para guardar
            </Link>
          )}
        </div>
      </div>

      <aside className="detail-side">
        <div className="card">
          <h3 className="card-h">Contactar al vendedor</h3>
          <p className="card-sub">
            Escríbele a{seller ? ` ${seller.username || 'el vendedor'}` : ' el vendedor'} sobre esta
            publicación.
          </p>
          {user ? (
            <form className="msg-form" onSubmit={sendMessage}>
              <textarea
                rows={4}
                placeholder="Escribe tu mensaje…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={sending}>
                {sending ? 'Enviando…' : 'Enviar mensaje'}
              </button>
              {error && <Alert kind="error">{error}</Alert>}
            </form>
          ) : (
            <Link to="/entrar" className="btn btn-primary btn-block">
              Inicia sesión para escribir
            </Link>
          )}
        </div>

        {seller && (
          <Link to={`/vendedor/${seller.id}`} className="card seller-card">
            <h3 className="card-h">Sobre el vendedor</h3>
            <div className="seller-row">
              <span className="avatar-lg">{(seller.username || 'V').slice(0, 2).toUpperCase()}</span>
              <div>
                <div className="seller-name">{seller.username || 'Vendedor'}</div>
                <div className="seller-rating">
                  <Stars value={avgRating(reviews)} size="sm" />
                  <span>{reviews.length} reseña(s)</span>
                </div>
              </div>
            </div>
          </Link>
        )}

        <div className="card">
          <h3 className="card-h">Reseñas</h3>
          {reviews.length === 0 ? (
            <p className="card-sub">Aún no hay reseñas para este vendedor.</p>
          ) : (
            <div className="review-list">
              {reviews.map((r) => (
                <ReviewItem key={r.id} rating={r.rating} comment={r.comment} createdAt={r.created_at} />
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

function avgRating(reviews: Review[]): number {
  if (reviews.length === 0) return 0
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0)
  return sum / reviews.length
}
