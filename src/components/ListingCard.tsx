import { Link, useNavigate } from 'react-router-dom'
import { Heart, Leaf, MapPin, Sparkles, Tag, Percent, ImageOff } from 'lucide-react'
import type { Listing } from '../lib/types'
import { storageUrl } from '../lib/images'
import { timeAgo, discountPct } from '../lib/format'
import { useFavorites } from '../context/FavoritesContext'
import Price from './Price'

interface Props {
  listing: Listing
}

function cardTag(l: Listing) {
  if (l.status === 'sold') return { cls: 'tag-dark', Icon: Tag, label: 'Vendido' }
  if (l.price_period) return { cls: '', Icon: Tag, label: 'Alquiler' }
  if (l.featured) return { cls: '', Icon: Sparkles, label: 'Destacado' }
  if (l.made_in_cuba) return { cls: '', Icon: Leaf, label: 'Hecho en Cuba' }
  const pct = discountPct(Number(l.price_usd), l.original_price)
  if (pct) return { cls: 'tag-deal', Icon: Percent, label: `${pct}% menos` }
  return null
}

export default function ListingCard({ listing }: Props) {
  const navigate = useNavigate()
  const fav = useFavorites()
  const cover = listing.images?.[0] ? storageUrl(listing.images[0], 600) : ''
  const tag = cardTag(listing)
  const isFav = fav.isFavorite(listing.id)
  const place = listing.city && listing.city !== listing.province ? `${listing.city}, ${listing.province}` : listing.province

  async function onHeart() {
    const ok = await fav.toggle(listing.id)
    if (!ok) navigate('/entrar')
  }

  return (
    <article className={`lcard ${listing.status === 'sold' ? 'is-sold' : ''}`}>
      <Link to={`/publicacion/${listing.id}`} className="lcard-link">
        <div className="lcard-media">
          {cover ? (
            <img src={cover} alt={listing.title} loading="lazy" decoding="async" />
          ) : (
            <div className="lcard-noimg">
              <ImageOff size={28} strokeWidth={1.4} />
            </div>
          )}
          {tag && (
            <span className={`tag ${tag.cls}`}>
              <tag.Icon size={12} strokeWidth={2} />
              {tag.label}
            </span>
          )}
        </div>
        <div className="lcard-body">
          <Price value={listing.price_usd} currency={listing.currency} period={listing.price_period} size="lg" />
          <h3 className="lcard-title">{listing.title}</h3>
          <div className="lcard-meta">
            <span className="lcard-place">
              <MapPin size={13} strokeWidth={1.8} />
              {place}
            </span>
            <span className="lcard-time">{timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </Link>
      <button
        type="button"
        className={`heart-btn ${isFav ? 'is-on' : ''}`}
        onClick={onHeart}
        aria-label={isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        aria-pressed={isFav}
      >
        <Heart size={18} strokeWidth={1.8} fill={isFav ? 'currentColor' : 'none'} />
      </button>
    </article>
  )
}
