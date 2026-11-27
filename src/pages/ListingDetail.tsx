import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ListingWithRelations, Review } from '../lib/types'
import { conditionLabel } from '../lib/types'
import { formatPrice, formatNumber, timeAgo } from '../lib/format'
import { imageUrl } from '../lib/images'
import Stars, { ReviewItem } from '../components/Stars'
import { Alert, EmptyState, LoadingBlock } from '../components/Pagination'

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [listing, setListing] = useState<ListingWithRelations | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isFavorite, setIsFavorite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [imgIndex, setImgIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!id) return
    (async () => {
      setLoading(true)
      setError(null)
      const { data, error: err } = await supabase
        .from('listings')
        .select(
          'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at, category:categories(id,slug,name,icon), seller:profiles(id,username,phone,avatar_url)'
        )
        .eq('id', id)
        .maybeSingle()
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      if (!data) {
        setError('Esta publicación no existe o ya no está disponible.')
        setLoading(false)
        return
      }
      const l = data as unknown as ListingWithRelations
      setListing(l)
      setImgIndex(0)

      const revRes = await supabase
        .from('reviews')
        .select('id, author_id, seller_id, rating, comment, created_at, updated_at')
        .eq('seller_id', l.seller_id)
        .order('created_at', { ascending: false })
      setReviews(revRes.data ?? [])

      if (user) {
        const favRes = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.id)
          .eq('listing_id', l.id)
          .maybeSingle()
        setIsFavorite(!!favRes.data)
      }

      // Incrementar vistas mediante RPC SECURITY DEFINER (autorizado para anon/authenticated)
      try {
        await supabase.rpc('increment_listing_views', { p_id: l.id })
      } catch {
        /* no crítico: la vista solo no se incrementa */
      }

      setLoading(false)
    })()
  }, [id, user])

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/entrar')
      return
    }
    if (isFavorite) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listing!.id)
      setIsFavorite(false)
    } else {
      await supabase
        .from('favorites')
        .insert({ user_id: user.id, listing_id: listing!.id })
      setIsFavorite(true)
    }
  }

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (!msg.trim()) return
    navigate(`/mensajes/${listing!.id}?to=${listing!.seller_id}&text=${encodeURIComponent(msg.trim())}`)
  }

  const avgRating = reviews.length
    ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
    : 0

  if (loading) return <LoadingBlock />
  if (error || !listing) {
    return (
      <EmptyState
        icon="🚫"
        title="Publicación no disponible"
        message={error ?? 'La publicación que buscas ya no existe.'}
        action={
          <Link to="/buscar" className="btn btn-primary">
            Volver a buscar
          </Link>
        }
      />
    )
  }

  const isOwn = user?.id === listing.seller_id

  return (
    <div className="detail">
      <div className="detail-grid">
        <div className="detail-media">
          <div className="gallery-main">
            {listing.images.length > 0 ? (
              <img src={imageUrl(listing.images[imgIndex])} alt={listing.title} />
            ) : (
              <div className="card-placeholder big">🏷️</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="gallery-thumbs">
              {listing.images.map((img, i) => (
                <button
                  key={i}
                  className={`thumb ${i === imgIndex ? 'thumb-active' : ''}`}
                  onClick={() => setImgIndex(i)}
                  aria-label={`Imagen ${i + 1}`}
                >
                  <img src={imageUrl(img)} alt={`${listing.title} ${i + 1}`} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1>{listing.title}</h1>
          <div className="detail-badges">
            <span className={`badge badge-condition badge-${listing.condition}`}>
              {conditionLabel(listing.condition)}
            </span>
            {listing.negotiable && <span className="badge badge-negotiable">Negociable</span>}
            {listing.status !== 'active' && (
              <span className="badge badge-archived">Archivado</span>
            )}
          </div>

          <div className="detail-price">{formatPrice(listing.price_usd)}</div>

          <div className="detail-meta">
            <span>📍 {listing.province}{listing.city ? ` · ${listing.city}` : ''}</span>
            <span>👁️ {formatNumber(listing.views + 1)} vistas</span>
            <span>🕒 {timeAgo(listing.created_at)}</span>
          </div>

          <div className="detail-section">
            <h3>Descripción</h3>
            <p className="detail-desc">{listing.description}</p>
          </div>

          {listing.phone && (
            <div className="detail-section">
              <h3>Contacto del vendedor</h3>
              <a href={`tel:${listing.phone}`} className="detail-phone">
                📞 {listing.phone}
              </a>
            </div>
          )}

          <div className="detail-actions">
            <button
              className={`btn ${isFavorite ? 'btn-outline' : 'btn-primary'}`}
              onClick={toggleFavorite}
              disabled={authLoading}
            >
              {isFavorite ? '❤️ En favoritos' : '🤍 Agregar a favoritos'}
            </button>
            {isOwn ? (
              <span className="own-note">Esta publicación es tuya.</span>
            ) : (
              <a
                href={`/mensajes/${listing.id}?to=${listing.seller_id}`}
                className="btn btn-outline"
                onClick={(e) => {
                  e.preventDefault()
                  navigate(`/mensajes/${listing.id}?to=${listing.seller_id}`)
                }}
              >
                ✉️ Contactar con el vendedor
              </a>
            )}
          </div>

          {!isOwn && (
            <form className="detail-msg" onSubmit={sendMessage}>
              <textarea
                placeholder="Escribe un mensaje para el vendedor…"
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                rows={3}
              />
              <button type="submit" className="btn btn-primary" disabled={!msg.trim()}>
                Enviar mensaje
              </button>
            </form>
          )}

          {error && <Alert kind="error">{error}</Alert>}
        </div>
      </div>

      <section className="detail-bottom">
        <div className="seller-card">
          <Link to={`/vendedor/${listing.seller_id}`} className="seller-link">
            <span className="avatar avatar-lg">
              {listing.seller?.username?.charAt(0).toUpperCase() ?? '👤'}
            </span>
            <div>
              <div className="seller-name">{listing.seller?.username ?? 'Vendedor'}</div>
              <div className="seller-sub">
                {reviews.length} reseñas
                {avgRating > 0 && (
                  <>
                    · <Stars value={Math.round(avgRating)} size="sm" />
                  </>
                )}
              </div>
            </div>
          </Link>
          <Link to={`/vendedor/${listing.seller_id}`} className="btn btn-outline btn-sm">
            Ver perfil del vendedor
          </Link>
        </div>

        <div className="reviews">
          <h3>Reseñas del vendedor</h3>
          {reviews.length === 0 ? (
            <p className="muted">Aún no hay reseñas.</p>
          ) : (
            <div className="review-list">
              {reviews.map((r) => (
                <ReviewItem key={r.id} review={r} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
