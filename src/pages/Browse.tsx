import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing, type SortKey } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { LoadingBlock, EmptyState } from '../components/Pagination'
import { PROVINCES } from '../lib/cuba'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'relevancia', label: 'Más relevantes' },
  { key: 'recientes', label: 'Más recientes' },
  { key: 'mas-vistos', label: 'Más vistos' },
  { key: 'precio-asc', label: 'Precio: menor a mayor' },
  { key: 'precio-desc', label: 'Precio: mayor a menor' },
]

const PAGE_SIZE = 24

export default function Browse() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const q = params.get('q') ?? ''
  const provincia = params.get('provincia') ?? ''
  const cond = params.get('cond') ?? ''
  const min = params.get('min') ?? ''
  const max = params.get('max') ?? ''
  const ofertas = params.get('ofertas') === '1'
  const sort = (params.get('sort') as SortKey) || 'recientes'
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)
  const catParam = params.get('cat') ?? ''

  const [categories, setCategories] = useState<Category[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [catId, setCatId] = useState<number | null>(null)
  const [catName, setCatName] = useState('')

  const [minInput, setMinInput] = useState(min)
  const [maxInput, setMaxInput] = useState(max)

  useEffect(() => {
    supabase.from('categories').select('id, slug, name, icon').order('id').then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    const targetSlug = slug || catParam || ''
    if (!targetSlug) {
      setCatId(null)
      setCatName('')
      return
    }
    supabase.from('categories').select('id, name').eq('slug', targetSlug).single().then(({ data }) => {
      if (data) {
        setCatId(data.id)
        setCatName(data.name)
      } else {
        setCatId(null)
        setCatName('')
      }
    })
  }, [slug, catParam])

  useEffect(() => {
    let active = true
    setLoading(true)
    async function load() {
      let query = supabase
        .from('listings')
        .select(LISTING_SELECT, { count: 'exact' })
        .eq('status', 'active')

      const term = q.trim().replace(/[%,()*\\]/g, ' ').trim()
      if (term) {
        // Busca en título y descripción
        query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
      }
      if (catId !== null) query = query.eq('category_id', catId)
      if (provincia) query = query.eq('province', provincia)
      if (cond) query = query.eq('condition', cond)
      if (ofertas) query = query.not('original_price', 'is', null)
      if (min) query = query.gte('price_usd', Number(min))
      if (max) query = query.lte('price_usd', Number(max))

      let orderCol = 'created_at'
      let orderAsc = false
      if (sort === 'mas-vistos') { orderCol = 'views'; orderAsc = false }
      else if (sort === 'precio-asc') { orderCol = 'price_usd'; orderAsc = true }
      else if (sort === 'precio-desc') { orderCol = 'price_usd'; orderAsc = false }
      else if (sort === 'relevancia') { orderCol = 'views'; orderAsc = false }

      const from = (page - 1) * PAGE_SIZE
      const { data, count } = await query.order(orderCol, { ascending: orderAsc }).range(from, from + PAGE_SIZE - 1)
      if (!active) return
      setListings((data ?? []) as Listing[])
      setTotal(count ?? 0)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [q, catId, provincia, cond, min, max, ofertas, sort, page])

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }

  function onCategory(e: ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value
    if (slug) {
      // Estamos en /categoria/:slug: pasamos a /buscar conservando los demás filtros
      const next = new URLSearchParams(params)
      next.delete('page')
      if (v) next.set('cat', v)
      else next.delete('cat')
      navigate(`/buscar?${next.toString()}`)
    } else {
      update({ cat: v || null })
    }
  }

  function applyPrice(e: FormEvent) {
    e.preventDefault()
    update({ min: minInput || null, max: maxInput || null })
  }

  function clearAll() {
    setParams({})
    setMinInput('')
    setMaxInput('')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const activeCatSlug = slug || catParam

  return (
    <div className="browse-layout">
      <aside className="filters card">
        <div className="filters-head">
          <h3>Filtros</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { clearAll(); if (slug) navigate('/buscar') }}>Limpiar</button>
        </div>

        <div className="filter-group">
          <label>Categoría</label>
          <select value={activeCatSlug} onChange={onCategory}>
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Provincia</label>
          <select value={provincia} onChange={(e) => update({ provincia: e.target.value || null })}>
            <option value="">Toda Cuba</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Condición</label>
          <select value={cond} onChange={(e) => update({ cond: e.target.value || null })}>
            <option value="">Todas</option>
            <option value="nuevo">Nuevo</option>
            <option value="como_nuevo">Como nuevo</option>
            <option value="usado">Usado</option>
            <option value="mal">En mal estado</option>
          </select>
        </div>

        <form className="filter-group" onSubmit={applyPrice}>
          <label>Precio (USD)</label>
          <div className="price-row">
            <input type="number" min="0" placeholder="Min" value={minInput} onChange={(e) => setMinInput(e.target.value)} />
            <span>–</span>
            <input type="number" min="0" placeholder="Max" value={maxInput} onChange={(e) => setMaxInput(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-outline btn-sm btn-block">Aplicar</button>
        </form>

        <div className="filter-group">
          <label className="checkbox-field">
            <input type="checkbox" checked={ofertas} onChange={(e) => update({ ofertas: e.target.checked ? '1' : null })} />
            <span>Solo ofertas ⚡</span>
          </label>
        </div>

        <div className="filter-group">
          <label>Ordenar</label>
          <select value={sort} onChange={(e) => update({ sort: e.target.value })}>
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>{s.label}</option>
            ))}
          </select>
        </div>
      </aside>

      <div className="browse-main">
        <div className="page-head">
          <h1>
            {q ? `Resultados para “${q}”` : catName ? catName : ofertas ? '⚡ Ofertas del día' : provincia ? `En ${provincia}` : 'Explorar artículos'}
          </h1>
          <p className="page-sub">{total} artículo(s) encontrado(s) en toda Cuba</p>
        </div>

        {loading ? (
          <LoadingBlock />
        ) : listings.length === 0 ? (
          <EmptyState
            title="No encontramos artículos"
            message="Prueba cambiar la búsqueda o los filtros."
            action={<button type="button" className="btn btn-outline" onClick={() => { clearAll(); if (slug) navigate('/buscar') }}>Limpiar filtros</button>}
          />
        ) : (
          <>
            <div className="listing-grid">
              {listings.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
            {totalPages > 1 && (
              <div className="pagination">
                <button type="button" className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>← Anterior</button>
                <span>Página {page} de {totalPages}</span>
                <button type="button" className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>Siguiente →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
