import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, ListingWithRelations } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { EmptyState, LoadingBlock } from '../components/Pagination'

type SortKey = 'recientes' | 'precio-asc' | 'precio-desc' | 'mas-vistos'

export default function Browse() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get('q') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [listings, setListings] = useState<ListingWithRelations[]>([])
  const [loading, setLoading] = useState(true)

  const [categorySel, setCategorySel] = useState<string>(slug ?? 'todas')
  const [sort, setSort] = useState<SortKey>('recientes')

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('name')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (slug) setCategorySel(slug)
  }, [slug])

  useEffect(() => {
    setLoading(true);
    (async () => {
      let query = supabase
        .from('listings')
        .select(
          'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at, category:categories(id,slug,name,icon), seller:profiles(id,username,phone,avatar_url)'
        )
        .eq('status', 'active')

      if (categorySel && categorySel !== 'todas') {
        const cat = categories.find((c) => c.slug === categorySel)
        if (cat) query = query.eq('category_id', cat.id)
      }
      if (q.trim()) {
        query = query.ilike('title', `%${q.trim()}%`)
      }

      if (sort === 'precio-asc') query = query.order('price_usd', { ascending: true })
      else if (sort === 'precio-desc') query = query.order('price_usd', { ascending: false })
      else if (sort === 'mas-vistos') query = query.order('views', { ascending: false })
      else query = query.order('created_at', { ascending: false })

      query = query.limit(100)
      const { data, error } = await query
      if (error) console.error(error)
      setListings((data as unknown as ListingWithRelations[]) ?? [])
      setLoading(false)
    })()
  }, [categorySel, q, sort, slug, categories])

  const filteredTitle = useMemo(() => {
    if (q.trim()) return `Resultados para «${q.trim()}»`
    if (categorySel && categorySel !== 'todas') {
      return categories.find((c) => c.slug === categorySel)?.name ?? 'Categoría'
    }
    return 'Todos los artículos'
  }, [q, categorySel, categories])

  return (
    <div className="browse">
      <div className="section-head">
        <h2>{filteredTitle}</h2>
        <span className="result-count">{listings.length} resultados</span>
      </div>

      <div className="browse-toolbar">
        <div className="filter-group">
          <label htmlFor="cat">Categoría</label>
          <select
            id="cat"
            value={categorySel}
            onChange={(e) => {
              setCategorySel(e.target.value)
              if (e.target.value !== 'todas') {
                setSearchParams(q ? { q } : {})
              }
            }}
          >
            <option value="todas">Todas</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label htmlFor="sort">Ordenar</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="recientes">Más recientes</option>
            <option value="mas-vistos">Más vistos</option>
            <option value="precio-asc">Precio: menor a mayor</option>
            <option value="precio-desc">Precio: mayor a menor</option>
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : listings.length === 0 ? (
        <EmptyState
          icon="📭"
          title="No hay resultados"
          message="Prueba con otra búsqueda o categoría."
          action={
            <button
              className="btn btn-primary"
              onClick={() => {
                setCategorySel('todas')
                setSearchParams({})
              }}
            >
              Limpiar filtros
            </button>
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
