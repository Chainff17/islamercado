import { Link } from 'react-router-dom'
import type { ListingWithRelations } from '../lib/types'
import { conditionLabel } from '../lib/types'
import { formatPrice, formatNumber, timeAgo } from '../lib/format'
import { imageUrl } from '../lib/images'

export default function ListingCard({ listing }: { listing: ListingWithRelations }) {
  const cover = listing.images?.[0] ?? ''
  return (
    <Link to={`/publicacion/${listing.id}`} className="card listing-card">
      <div className="card-media">
        {cover ? (
          <img src={imageUrl(cover)} alt={listing.title} loading="lazy" />
        ) : (
          <div className="card-placeholder">🏷️</div>
        )}
        <span className={`badge badge-condition badge-${listing.condition}`}>
          {conditionLabel(listing.condition)}
        </span>
        {listing.negotiable && <span className="badge badge-negotiable">Negociable</span>}
      </div>
      <div className="card-body">
        <h3 className="card-title">{listing.title}</h3>
        <div className="card-price">{formatPrice(listing.price_usd)}</div>
        <div className="card-meta">
          <span>📍 {listing.province}{listing.city ? ` · ${listing.city}` : ''}</span>
        </div>
        <div className="card-meta card-meta-muted">
          <span>{formatNumber(listing.views)} vistas</span>
          <span>· {timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
