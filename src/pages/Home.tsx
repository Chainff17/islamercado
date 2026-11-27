import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState } from '../components/Pagination'
import { PROVINCES } from '../lib/cuba'

export default function Home() {
  const [categories, setCategories] = useState<Category[]>([])
  const [topListings, setTopListings] = useState<Listing[]>([])
  const [deals, setDeals] = useState<Listing[]>([])
  const [recent, setRecent] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const [cats, top, deal, rec] = await Promise.all([
        supabase.from('categories').select('id, slug, name, icon').order('id'),
        supabase.from('listings').select(LISTING_SELECT).eq('status', 'active').order('views', { ascending: false }).limit(8),
        supabase.from('listings').select(LISTING_SELECT).eq('status', 'active').not('original_price', 'is', null).order('views', { ascending: false }).limit(8),
        supabase.from('listings').select(LISTING_SELECT).eq('status', 'active').order('created_at', { ascending: false }).limit(8),
      ])
      if (!active) return
      if (cats.data) setCategories(cats.data)
      if (top.data) setTopListings(top.data as Listing[])
      if (deal.data) setDeals(deal.data as Listing[])
      if (rec.data) setRecent(rec.data as Listing[])
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return (
    <div className="home">
      <section className="hero hero-ml">
        <div className="hero-inner">
          <span className="hero-kicker">🇨🇺 Hecho para Cuba · Compra protegida</span>
          <h1>Compra y vende en toda Cuba, como en Mercado Libre</h1>
          <p>
            Publica gratis, paga con Transfermóvil, Zelle o contra entrega y recibe en tu provincia.
            Miles de artículos de segunda mano y nuevos, de La Habana a Guantánamo.
          </p>
          <div className="hero-actions">
            <Link to="/buscar" className="btn btn-primary btn-lg">
              Explorar artículos
            </Link>
            <Link to="/publicar" className="btn btn-dark btn-lg">
              Vender ahora
            </Link>
          </div>
          <div className="hero-stats">
            <span>🚚 Envío a 16 provincias</span>
            <span>💳 Transfermóvil · Zelle · MLC</span>
            <span>🛡️ Compra protegida</span>
          </div>
        </div>
      </section>

      <section className="benefits">
        <div className="benefit"><span className="b-icon">🚚</span><div><strong>Envío a toda Cuba</strong><small>Entrega en 24–72 h según provincia</small></div></div>
        <div className="benefit"><span className="b-icon">💵</span><div><strong>Pago contra entrega</strong><small>Pagas cuando recibes tu pedido</small></div></div>
        <div className="benefit"><span className="b-icon">📱</span><div><strong>Transfermóvil y Zelle</strong><small>Sin tarjetas, sin complicaciones</small></div></div>
        <div className="benefit"><span className="b-icon">⭐</span><div><strong>Vendedores calificados</strong><small>Reseñas reales de compradores</small></div></div>
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

      {deals.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">⚡ Ofertas del día</h2>
            <Link to="/buscar?ofertas=1" className="section-link">Ver todas →</Link>
          </div>
          <div className="listing-grid">
            {deals.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">🔥 Más vendidos</h2>
          <Link to="/buscar?sort=mas-vistos" className="section-link">Ver todo →</Link>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : topListings.length === 0 ? (
          <EmptyState
            title="Aún no hay publicaciones"
            message="Sé el primero en publicar un artículo en Isla Mercado."
            action={<Link to="/publicar" className="btn btn-primary">Publicar</Link>}
          />
        ) : (
          <div className="listing-grid">
            {topListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">🆕 Recién publicados</h2>
          <Link to="/buscar?sort=recientes" className="section-link">Ver todo →</Link>
        </div>
        {loading ? (
          <LoadingBlock />
        ) : (
          <div className="listing-grid">
            {recent.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      <section className="section">
        <h2 className="section-title">📍 Compra por provincia</h2>
        <div className="province-grid">
          {PROVINCES.map((p) => (
            <Link key={p} to={`/buscar?provincia=${encodeURIComponent(p)}`} className="province-chip">
              📍 {p}
            </Link>
          ))}
        </div>
      </section>

      <section className="cta-band">
        <h2>¿Tienes algo para vender?</h2>
        <p>Publica en 2 minutos, sin comisión el primer mes. Tu artículo llega a miles de cubanos.</p>
        <Link to="/publicar" className="btn btn-primary btn-lg">Publicar gratis</Link>
      </section>
    </div>
  )
}
