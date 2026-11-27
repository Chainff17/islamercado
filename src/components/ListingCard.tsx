import { Link } from 'react-router-dom'
import type { Listing } from '../lib/types'
import { storageUrl } from '../lib/images'
import { formatPrice, timeAgo, discountPct, conditionLabel } from '../lib/format'
import { convert, formatMoney } from '../lib/cuba'

interface Props {
  listing: Listing
}

export default function ListingCard({ listing }: Props) {
  const cover = listing.images?.[0] ? storageUrl(listing.images[0]) : ''
  const pct = discountPct(Number(listing.price_usd), listing.original_price)
  const sold = listing.status === 'sold'
  const cup = convert(Number(listing.price_usd), (listing.currency as 'USD' | 'CUP' | 'MLC') || 'USD', 'CUP')

  return (
    <Link to={`/publicacion/${listing.id}`} className={`listing-card ${sold ? 'is-sold' : ''}`}>
      <div className="card-cover">
        {cover ? (
          <img src={cover} alt={listing.title} loading="lazy" />
        ) : (
          <div className="card-cover-empty">📦</div>
        )}
        <div className="card-badges">
          {sold && <span className="badge badge-sold">VENDIDO</span>}
          {pct && !sold && <span className="badge badge-off">-{pct}%</span>}
          {listing.free_shipping && !sold && <span className="badge badge-ship">Envío gratis</span>}
        </div>
        {listing.stock <= 3 && listing.stock > 0 && !sold && (
          <span className="card-stock">¡Quedan {listing.stock}!</span>
        )}
      </div>

      <div className="card-body">
        <h3 className="card-title">{listing.title}</h3>
        <div className="card-price-row">
          <span className="card-price">{formatPrice(listing.price_usd, listing.currency)}</span>
          {listing.original_price && (
            <span className="card-old">{formatPrice(listing.original_price, listing.currency)}</span>
          )}
        </div>
        <div className="card-cup">≈ {formatMoney(cup, 'CUP')}</div>
        <div className="card-install">en 3 cuotas sin interés</div>
        <div className="card-meta">
          <span className="card-location">📍 {listing.province}</span>
          <span className="card-views">👁 {listing.views ?? 0}</span>
        </div>
        <div className="card-foot">
          <span className="badge badge-condition">{conditionLabel(listing.condition)}</span>
          {listing.negotiable && <span className="badge badge-negotiable">Negociable</span>}
          <span className="card-time">{timeAgo(listing.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
