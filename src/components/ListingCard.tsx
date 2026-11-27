import { Link } from 'react-router-dom'
import type { Listing } from '../lib/types'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo } from '../lib/format'

interface Props {
  listing: Listing
}

export default function ListingCard({ listing }: Props) {
  const cover = listing.images?.[0] ? storageUrl(listing.images[0]) : ''

  return (
    <Link to={`/publicacion/${listing.id}`} className="listing-card">
      <div className="card-cover">
        {cover ? (
          <img src={cover} alt={listing.title} loading="lazy" />
        ) : (
          <div className="card-cover-empty">📦</div>
        )}
        <div className="card-badges">
          {listing.condition && <span className="badge badge-condition">{listing.condition}</span>}
          {listing.negotiable && <span className="badge badge-negotiable">Negociable</span>}
        </div>
      </div>

      <div className="card-body">
        <h3 className="card-title">{listing.title}</h3>
        <div className="card-price">{formatPrice(listing.price_usd)}</div>
        <div className="card-meta">
          <span className="card-location">📍 {listing.province}{listing.city ? `, ${listing.city}` : ''}</span>
          <span className="card-views">👁 {listing.views ?? 0}</span>
        </div>
        <div className="card-time">{timeAgo(listing.created_at)}</div>
      </div>
    </Link>
  )
}
