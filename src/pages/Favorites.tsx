import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { ListingWithRelations } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { EmptyState, LoadingBlock } from '../components/Pagination'

export default function Favorites() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    (async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('listing_id')
        .eq('user_id', user.id)
      if (error) {
        console.error(error)
        setLoading(false)
        return
      }
      const ids = (data as { listing_id: string }[]).map((f) => f.listing_id)
      if (ids.length === 0) {
        setListings([])
        setLoading(false)
        return
      }
      const { data: ls } = await supabase
        .from('listings')
        .select(
          'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at, category:categories(id,slug,name,icon), seller:profiles(id,username,phone,avatar_url)'
        )
        .in('id', ids)
      setListings((ls as unknown as ListingWithRelations[]) ?? [])
      setLoading(false)
    })()
  }, [user])

  if (authLoading) return <LoadingBlock />
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="Inicia sesión para ver tus favoritos"
        action={
          <button className="btn btn-primary" onClick={() => navigate('/entrar')}>
            Ingresar
          </button>
        }
      />
    )
  }
  if (loading) return <LoadingBlock />

  return (
    <div className="favorites">
      <div className="section-head">
        <h2>Mis favoritos</h2>
        <span className="result-count">{listings.length} artículos</span>
      </div>
      {listings.length === 0 ? (
        <EmptyState
          icon="🤍"
          title="Aún no tienes favoritos"
          message="Explora las publicaciones y agregua tus favoritos para encontrarlas aquí."
          action={
            <Link to="/buscar" className="btn btn-primary">
              Explorar publicaciones
            </Link>
          }
        />
      ) : (
        <div className="listing-grid">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      )}
    </div>
  )
}
