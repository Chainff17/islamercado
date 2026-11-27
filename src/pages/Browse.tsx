import { useEffect, useState, type ChangeEvent } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category, Listing, SortKey } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState } from '../components/Pagination'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'mas-vistos', label: 'Más vistos' },
  { key: 'precio-asc', label: 'Precio: menor a mayor' },
  { key: 'precio-desc', label: 'Precio: mayor a menor' },
]

export default function Browse() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()

  const q = params.get('q') ?? ''
  const categorySlug = slug ?? ''
  const [sort, setSort] = useState<SortKey>('recientes')

  const [categories, setCategories] = useState<Category[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('id')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (!categorySlug) return
    let active = true
    setLoading(true)

    supabase
      .from('categories')
      .select('id')
      .eq('slug', categorySlug)
      .single()
      .then(({ data }) => {
        if (!active) return
        const catId = data?.id
        loadListings(catId)
      })

    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, q, sort])

  useEffect(() => {
    if (categorySlug) return
    setLoading(true)
    loadListings(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySlug, q, sort])

  async function loadListings(catId: number | null) {
    const query = supabase
      .from('listings')
      .select(
        'id, seller_id, category_id, title, description, price_usd, negotiable, condition, province, city, images, phone, status, views, created_at, updated_at',
      )
      .eq('status', 'active')

    if (q.trim()) query.ilike('title', `%${q.trim()}%`)
    if (catId !== null) query.eq('category_id', catId)

    let orderCol = 'created_at'
    let orderAsc = false
    if (sort === 'mas-vistos') {
      orderCol = 'views'
      orderAsc = false
    } else if (sort === 'precio-asc') {
      orderCol = 'price_usd'
      orderAsc = true
    } else if (sort === 'precio-desc') {
      orderCol = 'price_usd'
      orderAsc = false
    }
    query.order(orderCol, { ascending: orderAsc }).limit(60)

    const { data } = await query
    setListings((data ?? []) as Listing[])
    setLoading(false)
  }

  function onCategoryChange(e: ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const next = new URLSearchParams(params)
    if (value) next.set('cat', value)
    else next.delete('cat')
    setParams(next)
  }

  const selectedCat = params.get('cat') ?? ''

  return (
    <div className="browse">
      <div className="page-head">
        <h1>{q ? `Resultados para “${q}”` : categorySlug ? 'Categoría' : 'Explorar artículos'}</h1>
        <div className="browse-controls">
          <select value={selectedCat} onChange={onCategoryChange}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <LoadingBlock />
      ) : listings.length === 0 ? (
        <EmptyState
          title="No encontramos artículos"
          message="Probá cambiar la búsqueda o el filtro de categoría."
          action={
            <Link to="/buscar" className="btn btn-outline">
              Limpiar filtros
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
