import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { ListingWithRelations, Profile, Review } from '../lib/types'
import ListingCard from '../components/ListingCard'
import Stars, { ReviewItem } from '../components/Stars'
import { EmptyState, LoadingBlock } from '../components/Pagination'

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    (async () => {
      const [pRes, lRes, rRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, phone, avatar_url, created_at')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('listings')
          .select(
            'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at, category:categories(id,slug,name,icon), seller:profiles(id,username,phone,avatar_url)'
          )
          .eq('seller_id', id)
          .order('created_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('id, author_id, seller_id, rating, comment, created_at, updated_at')
          .eq('seller_id', id)
          .order('created_at', { ascending: false }),
      ])
      setProfile((pRes.data as Profile) ?? null)
      setListings((lRes.data as unknown as ListingWithRelations[]) ?? [])
      setReviews(rRes.data ?? [])
      setLoading(false)
    })()
  }, [id])

  if (loading) return <LoadingBlock />
  if (!profile) {
    return (
      <EmptyState
        icon="👤"
        title="Vendedor no encontrado"
        action={
          <Link to="/buscar" className="btn btn-primary">
            Volver a buscar
          </Link>
        }
      />
    )
  }

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0

  return (
    <div className="seller-page">
      <div className="seller-banner">
        <span className="avatar avatar-xl">{profile.username?.charAt(0).toUpperCase() ?? '👤'}</span>
        <div>
          <h1>{profile.username ?? 'Vendedor'}</h1>
          <div className="seller-sub">
            {listings.length} publicaciones · {reviews.length} reseñas
            {avg > 0 && (
              <>
                · <Stars value={Math.round(avg)} size="sm" />
                <span className="muted">({avg.toFixed(1)})</span>
              </>
            )}
          </div>
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <h2>Publicaciones de {profile.username}</h2>
        </div>
        {listings.length === 0 ? (
          <EmptyState icon="📦" title="Sin publicaciones activas" />
        ) : (
          <div className="listing-grid">
            {listings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Reseñas</h2>
        </div>
        {reviews.length === 0 ? (
          <EmptyState icon="⭐" title="Sin reseñas todavía" />
        ) : (
          <div className="review-list">
            {reviews.map((r) => (
              <ReviewItem key={r.id} review={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
