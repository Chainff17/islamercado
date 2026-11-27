import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, Listing } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState } from '../components/Pagination'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [topListings, setTopListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [cats, listings] = await Promise.all([
        supabase.from('categories').select('id, slug, name, icon').order('id'),
        supabase
          .from('listings')
          .select('id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at')
          .eq('status', 'active')
          .order('views', { ascending: false })
          .limit(8),
      ])
      if (!active) return
      if (cats.data) setCategories(cats.data)
      if (listings.data) setTopListings(listings.data as Listing[])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-inner">
          <h1>Tu mercado de segunda mano en Cuba</h1>
          <p>
            Compra y vende artículos usados, conversa con vendedores y publica tus cosas
            en un solo lugar.
          </p>
          <div className="hero-actions">
            <Link to="/buscar" className="btn btn-primary btn-lg">
              Explorar artículos
            </Link>
            <Link to="/publicar" className="btn btn-outline btn-lg">
              Publicar un artículo
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Categorías</h2>
        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="category-grid">
            {categories.map((c) => (
              <Link key={c.id} to={`/categoria/${c.slug}`} className="category-card">
                <span className="category-icon">{c.icon || '📦'}</span>
                <span className="category-name">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Más visitados</h2>
          <Link to="/buscar" className="section-link">
            Ver todo →
          </Link>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : topListings.length === 0 ? (
          <EmptyState
            title="Aún no hay publicaciones"
            message="Sé el primero en publicar un artículo en Isla Mercado."
            action={
              <Link to="/publicar" className="btn btn-primary">
                Publicar
              </Link>
            }
          />
        ) : (
          <div className="listing-grid">
            {topListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
