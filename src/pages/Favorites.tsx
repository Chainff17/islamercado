import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Listing } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'

export default function Favorites() {
  const { user } = useAuth()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    supabase
      .from('favorites')
      .select('listing_id, listings ( id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        const rows = (data ?? []) as unknown as Array<{
          listing_id: string
          listings: Listing | null
        }>
        const favs = rows
          .map((r) => r.listings)
          .filter((l): l is Listing => !!l)
        setListings(favs)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [user])

  if (loading) return <LoadingBlock />

  if (!user)
    return (
      <EmptyState
        title="Inicia sesión para ver tus favoritos"
        action={
          <Link to="/entrar" className="btn btn-primary">
            Entrar
          </Link>
        }
      />
    )

  return (
    <div className="page">
      <div className="page-head">
        <h1>Mis favoritos</h1>
      </div>
      {listings.length === 0 ? (
        <EmptyState
          title="Aún no tienes favoritos"
          message="Guarda los artículos que te gusten para encontrarlos aquí."
          action={
            <Link to="/buscar" className="btn btn-primary">
              Explorar artículos
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
