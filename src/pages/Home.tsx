import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, ListingWithRelations } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { EmptyState, LoadingBlock } from '../components/Pagination'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [catRes, listRes] = await Promise.all([
        supabase.from('categories').select('id, slug, name, icon').order('name'),
        supabase
          .from('listings')
          .select(
            'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at, category:categories(id,slug,name,icon), seller:profiles(id,username,phone,avatar_url)'
          )
          .eq('status', 'active')
          .order('views', { ascending: false })
          .limit(8)
      ])
      if (catRes.error) console.error(catRes.error)
      if (listRes.error) console.error(listRes.error)
      setCategories(catRes.data ?? [])
      setListings(listRes.data as unknown as ListingWithRelations[])
      setLoading(false)
    })()
  }, [])

  return (
    <div className="home">
      <section className="hero">
        <div className="hero-content">
          <h1>El mercado de segunda mano de Cuba</h1>
          <p>
            Compra y vende artículos de todos los rincones de la isla. Paneles solares, electrodomésticos,
             bicicletas, ropa y mucho más — con contacto directo entre compradores y vendedores.
          </p>
          <div className="hero-actions">
            <Link to="/buscar" className="btn btn-primary btn-lg">
              Explorar ofertas
            </Link>
            <Link to="/publicar" className="btn btn-outline btn-lg">
              Publicar un artículo
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Categorías</h2>
        </div>
        <div className="category-grid">
          {categories.map((c) => (
            <Link key={c.id} to={`/categoria/${c.slug}`} className="category-card">
              <span className="category-icon">{c.icon || '🏷️'}</span>
              <span className="category-name">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Más visitados</h2>
          <Link to="/buscar" className="link-more">
            Ver todo →
          </Link>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : listings.length === 0 ? (
          <EmptyState
            icon="📦"
            title="Aún no hay publicaciones"
            message="Sé el primero en publicar un artículo en Isla Mercado."
            action={
              <Link to="/publicar" className="btn btn-primary">
                Publicar artículo
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
      </section>
    </div>
  )
}
