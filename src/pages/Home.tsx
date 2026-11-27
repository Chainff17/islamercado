import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  LayoutGrid,
  Leaf,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Camera,
  Handshake,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Smartphone,
  Banknote,
  Truck,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Listing } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { EmptyState } from '../components/Pagination'
import { usePrefs } from '../context/PrefsContext'
import { categoryStyle, FEATURED_CATEGORIES } from '../lib/categoryStyle'

type HomeSort = 'recientes' | 'mas-vistos' | 'precio-asc' | 'precio-desc'

const SORT_LABEL: Record<HomeSort, string> = {
  recientes: 'Más recientes',
  'mas-vistos': 'Más vistos',
  'precio-asc': 'Menor precio',
  'precio-desc': 'Mayor precio',
}

function applySort<T extends { order: (c: string, o: { ascending: boolean }) => T }>(q: T, sort: HomeSort): T {
  if (sort === 'mas-vistos') return q.order('views', { ascending: false })
  if (sort === 'precio-asc') return q.order('price_ref', { ascending: true })
  if (sort === 'precio-desc') return q.order('price_ref', { ascending: false })
  return q.order('created_at', { ascending: false })
}

export default function Home() {
  const { province, ahorro } = usePrefs()
  const [sort, setSort] = useState<HomeSort>('recientes')
  const [recent, setRecent] = useState<Listing[]>([])
  const [cuban, setCuban] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    let q = supabase.from('listings').select(LISTING_SELECT).eq('status', 'active')
    if (province) q = q.eq('province', province)
    applySort(q, sort)
      .limit(8)
      .then(({ data }) => {
        if (!active) return
        setRecent((data ?? []) as Listing[])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [province, sort])

  useEffect(() => {
    let q = supabase.from('listings').select(LISTING_SELECT).eq('status', 'active').eq('made_in_cuba', true)
    if (province) q = q.eq('province', province)
    q.order('views', { ascending: false })
      .limit(4)
      .then(({ data }) => setCuban((data ?? []) as Listing[]))
  }, [province])

  const more = new URLSearchParams()
  if (sort !== 'recientes') more.set('sort', sort)

  return (
    <div className="home">
      <section className={`hero ${ahorro ? 'hero-lite' : ''}`}>
        <div className="hero-copy">
          <span className="eyebrow">
            <Sun size={15} strokeWidth={1.8} /> De Cuba, para Cuba
          </span>
          <h1 className="hero-title">
            Tu isla, <em>tu mercado.</em>
          </h1>
          <p className="hero-sub">
            Compra y vende con la gente de aquí.
            <br />
            Todo lo que necesitas, en un solo lugar.
          </p>
          <div className="hero-actions">
            <Link to="/buscar" className="btn btn-olive btn-lg">
              Explorar anuncios <ArrowRight size={17} />
            </Link>
            <Link to="/mapa" className="btn btn-light btn-lg">
              <MapIcon size={17} strokeWidth={1.8} /> Ver mapa
            </Link>
          </div>
        </div>
        {!ahorro && (
          <div className="hero-art" aria-hidden="true">
            <img src={`${import.meta.env.BASE_URL}hero-habana.jpg`} alt="" fetchPriority="high" />
          </div>
        )}
        <svg className="hero-stamp" viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <path id="stamp-arc" d="M50,50 m-34,0 a34,34 0 1,1 68,0 a34,34 0 1,1 -68,0" />
          </defs>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="2.5 2.5" />
          <circle cx="50" cy="50" r="27" fill="none" stroke="currentColor" strokeWidth="1.2" />
          <text fontSize="10.5" letterSpacing="2.4" fill="currentColor" fontWeight="600">
            <textPath href="#stamp-arc">HECHO EN CUBA · HECHO EN CUBA ·</textPath>
          </text>
          <text x="50" y="56" textAnchor="middle" fontSize="17" fill="currentColor" fontStyle="italic" fontFamily="Fraunces Variable, serif">Cuba</text>
        </svg>
        <span className="hero-place">
          <MapPin size={12} strokeWidth={2} /> La Habana, Cuba
        </span>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Explora por categoría</h2>
          <Link to="/categorias" className="link-arrow">
            Ver todas <ArrowRight size={16} />
          </Link>
        </div>
        <div className="cat-tiles">
          {FEATURED_CATEGORIES.map((c) => {
            const st = categoryStyle(c.slug)
            return (
              <Link
                key={c.slug}
                to={c.to}
                className="cat-tile"
                style={{ background: st.bg, borderColor: st.border }}
              >
                <st.Icon size={30} strokeWidth={1.4} color={st.ink} />
                <span>{c.label}</span>
              </Link>
            )
          })}
          <Link to="/categorias" className="cat-tile" style={{ background: '#EFECE6', borderColor: '#DED8CD' }}>
            <LayoutGrid size={30} strokeWidth={1.4} color="#6B5E4A" />
            <span>Más categorías</span>
          </Link>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">
            <span className="live-dot" /> Anuncios recientes
            {province && <span className="title-chip">en {province}</span>}
          </h2>
          <div className="section-tools">
            <Link to={`/buscar${more.toString() ? `?${more}` : ''}`} className="btn btn-light btn-sm">
              <SlidersHorizontal size={15} strokeWidth={1.8} /> Filtros
            </Link>
            <label className="select-pill">
              <ArrowUpDown size={15} strokeWidth={1.8} />
              <select value={sort} onChange={(e) => setSort(e.target.value as HomeSort)} aria-label="Ordenar">
                {(Object.keys(SORT_LABEL) as HomeSort[]).map((k) => (
                  <option key={k} value={k}>{SORT_LABEL[k]}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>

        {loading ? (
          <div className="card-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="lcard skeleton" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title={province ? `Aún no hay anuncios en ${province}` : 'Aún no hay anuncios'}
            message="Sé el primero en publicar y llega a compradores de tu zona."
            action={<Link to="/publicar" className="btn btn-primary">Publicar anuncio</Link>}
          />
        ) : (
          <>
            <div className="card-grid">
              {recent.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            <div className="center-row">
              <Link to={`/buscar${more.toString() ? `?${more}` : ''}`} className="btn btn-light">
                Ver más anuncios <ArrowRight size={16} />
              </Link>
            </div>
          </>
        )}
      </section>

      {cuban.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">
              <Leaf size={22} strokeWidth={1.6} className="title-icon" /> Hecho en Cuba
            </h2>
            <Link to="/buscar?cubano=1" className="link-arrow">
              Ver todo <ArrowRight size={16} />
            </Link>
          </div>
          <div className="card-grid">
            {cuban.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </section>
      )}

      <section className="section how">
        <h2 className="section-title">Así de fácil</h2>
        <div className="how-grid">
          <div className="how-step">
            <span className="how-icon"><Camera size={22} strokeWidth={1.6} /></span>
            <h3>Publica gratis</h3>
            <p>Saca fotos con tu móvil, pon el precio en CUP, USD o MLC y listo.</p>
          </div>
          <div className="how-step">
            <span className="how-icon"><MessageCircle size={22} strokeWidth={1.6} /></span>
            <h3>Conversa</h3>
            <p>Pregunta, negocia y coordina por mensajes o WhatsApp, sin intermediarios.</p>
          </div>
          <div className="how-step">
            <span className="how-icon"><Handshake size={22} strokeWidth={1.6} /></span>
            <h3>Cierra el trato</h3>
            <p>Paga contra entrega o por Transfermóvil y califica al vendedor.</p>
          </div>
        </div>
        <div className="trust-row">
          <span><Truck size={16} strokeWidth={1.7} /> Entrega en las 16 provincias</span>
          <span><Smartphone size={16} strokeWidth={1.7} /> Transfermóvil y Zelle</span>
          <span><Banknote size={16} strokeWidth={1.7} /> CUP · USD · MLC</span>
          <span><ShieldCheck size={16} strokeWidth={1.7} /> Vendedores con reseñas</span>
        </div>
      </section>

      <section className="sell-band">
        <div>
          <h2>¿Tienes algo que ya no usas?</h2>
          <p>Véndelo hoy a alguien de tu barrio. Publicar es gratis y toma dos minutos.</p>
        </div>
        <Link to="/publicar" className="btn btn-primary btn-lg">
          Publicar anuncio <ArrowRight size={17} />
        </Link>
      </section>
    </div>
  )
}
