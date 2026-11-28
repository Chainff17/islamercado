import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Listing, Profile, Review } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { Stars, ReviewItem } from '../components/Stars'
import { LoadingBlock, EmptyState } from '../components/Pagination'
import { ReportButton } from '../components/Security'
import { PlanBadge, useSellerBadges } from '../components/PlanBadge'

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()
  const [seller, setSeller] = useState<Profile | null>(null)
  const badges = useSellerBadges([id])
  const [listings, setListings] = useState<Listing[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    Promise.all([
      supabase
        .from('profiles')
        .select('id, username, phone, avatar_url, created_at')
        .eq('id', id)
        .single(),
      supabase
        .from('listings')
        .select(
          'id, seller_id, category_id, title, description, price_usd, currency, negotiable, condition, province, city, images, phone, status, views, stock, original_price, free_shipping, featured, made_in_cuba, price_period, created_at, updated_at',
        )
        .eq('seller_id', id)
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
      supabase
        .from('reviews')
        .select('id, author_id, seller_id, rating, comment, created_at, updated_at')
        .eq('seller_id', id)
        .order('created_at', { ascending: false }),
    ]).then(([s, l, r]) => {
      if (!active) return
      setSeller(s.data as Profile)
      setListings((l.data ?? []) as Listing[])
      setReviews((r.data ?? []) as Review[])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [id])

  if (loading) return <LoadingBlock />
  if (!seller)
    return (
      <EmptyState
        title="Vendedor no encontrado"
        action={
          <Link to="/buscar" className="btn btn-outline">
            Volver
          </Link>
        }
      />
    )

  const avg =
    reviews.length > 0 ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0

  return (
    <div className="seller-profile">
      <div className="seller-header card">
        <span className="avatar-xl">
          {(seller.username || 'V').slice(0, 2).toUpperCase()}
        </span>
        <div className="seller-header-info">
          <h1>
            {seller.username || 'Vendedor'} <PlanBadge badge={badges[seller.id]} />
          </h1>
          <div className="seller-header-meta">
            <Stars value={avg} size="md" />
            <span className="dot">·</span>
            <span>{reviews.length} reseña(s)</span>
            <span className="dot">·</span>
            <span>{listings.length} publicación(es)</span>
          </div>
          {seller.phone && <p className="seller-phone"><Phone size={15} /> {seller.phone}</p>}
        </div>
        <div className="seller-header-report">
          <ReportButton userId={seller.id} label="Denunciar vendedor" compact />
        </div>
      </div>

      <section className="section">
        <h2 className="section-title">Publicaciones</h2>
        {listings.length === 0 ? (
          <EmptyState title="Este vendedor no tiene publicaciones activas" />
        ) : (
          <div className="listing-grid">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">Reseñas</h2>
        {reviews.length === 0 ? (
          <EmptyState title="Sin reseñas aún" />
        ) : (
          <div className="review-list">
            {reviews.map((r) => (
              <ReviewItem key={r.id} rating={r.rating} comment={r.comment} createdAt={r.created_at} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
