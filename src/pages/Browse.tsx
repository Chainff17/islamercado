import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing, type SortKey } from '../lib/types'
import ListingCard from '../components/ListingCard'
import { EmptyState } from '../components/Pagination'
import { PROVINCES, RATES, asCurrency } from '../lib/cuba'
import { categoryStyle } from '../lib/categoryStyle'
import { usePrefs } from '../context/PrefsContext'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'recientes', label: 'Más recientes' },
  { key: 'mas-vistos', label: 'Más vistos' },
  { key: 'precio-asc', label: 'Menor precio' },
  { key: 'precio-desc', label: 'Mayor precio' },
]

/** Categorías virtuales que agrupan varias reales. */
const GROUPS: Record<string, { name: string; slugs: string[] }> = {
  tecnologia: { name: 'Tecnología', slugs: ['telefonia', 'electronica', 'computacion'] },
}

const PAGE_SIZE = 24

export default function Browse() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { province, setProvince } = usePrefs()

  const q = params.get('q') ?? ''
  const cond = params.get('cond') ?? ''
  const moneda = params.get('moneda') ?? ''
  const min = params.get('min') ?? ''
  const max = params.get('max') ?? ''
  const ofertas = params.get('ofertas') === '1'
  const cubano = params.get('cubano') === '1'
  const envio = params.get('envio') === '1'
  const sort = (params.get('sort') as SortKey) || 'recientes'
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1)

  const [categories, setCategories] = useState<Category[]>([])
  const [listings, setListings] = useState<Listing[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [minInput, setMinInput] = useState(min)
  const [maxInput, setMaxInput] = useState(max)

  // ?provincia=X en la URL (enlaces de la portada o el mapa) => preferencia global
  useEffect(() => {
    const p = params.get('provincia')
    if (p !== null) {
      setProvince(p)
      const next = new URLSearchParams(params)
      next.delete('provincia')
      setParams(next, { replace: true })
    }
  }, [params, setParams, setProvince])

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('id')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    setMinInput(min)
    setMaxInput(max)
  }, [min, max])

  const group = slug ? GROUPS[slug] : undefined
  const catIds = slug
    ? categories.filter((c) => (group ? group.slugs.includes(c.slug) : c.slug === slug)).map((c) => c.id)
    : []
  const catName = group?.name ?? categories.find((c) => c.slug === slug)?.name ?? ''
  const catReady = !slug || categories.length > 0

  useEffect(() => {
    if (!catReady) return
    let active = true
    setLoading(true)
    let query = supabase.from('listings').select(LISTING_SELECT, { count: 'exact' }).eq('status', 'active')

    const term = q.trim().replace(/[%,()*\\]/g, ' ').trim()
    if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`)
    if (slug) query = catIds.length ? query.in('category_id', catIds) : query.eq('category_id', -1)
    if (province) query = query.eq('province', province)
    if (cond) query = query.in('condition', cond === 'como_nuevo' ? ['como_nuevo', 'like-new'] : [cond])
    if (moneda) query = query.eq('currency', moneda)
    if (ofertas) query = query.not('original_price', 'is', null)
    if (cubano) query = query.eq('made_in_cuba', true)
    if (envio) query = query.eq('free_shipping', true)
    // El rango se expresa en la moneda elegida (USD por defecto) y se compara con el precio de referencia
    const rate = RATES[asCurrency(moneda || 'USD')]
    if (min) query = query.gte('price_ref', Number(min) / rate)
    if (max) query = query.lte('price_ref', Number(max) / rate)

    if (sort === 'mas-vistos') query = query.order('views', { ascending: false })
    else if (sort === 'precio-asc') query = query.order('price_ref', { ascending: true })
    else if (sort === 'precio-desc') query = query.order('price_ref', { ascending: false })
    else query = query.order('created_at', { ascending: false })

    const from = (page - 1) * PAGE_SIZE
    query.range(from, from + PAGE_SIZE - 1).then(({ data, count }) => {
      if (!active) return
      setListings((data ?? []) as Listing[])
      setTotal(count ?? 0)
      setLoading(false)
    })
    return () => {
      active = false
    }
    // catIds se deriva de slug + categories
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, slug, categories, province, cond, moneda, min, max, ofertas, cubano, envio, sort, page, catReady])

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === '') next.delete(k)
      else next.set(k, v)
    }
    if (!('page' in patch)) next.delete('page')
    setParams(next)
  }

  function onCategory(v: string) {
    const next = new URLSearchParams(params)
    next.delete('page')
    const qs = next.toString()
    navigate(`${v ? `/categoria/${v}` : '/buscar'}${qs ? `?${qs}` : ''}`)
  }

  function applyPrice(e: FormEvent) {
    e.preventDefault()
    update({ min: minInput || null, max: maxInput || null })
  }

  function clearAll() {
    setProvince('')
    navigate(q ? `/buscar?q=${encodeURIComponent(q)}` : '/buscar')
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const chips: { label: string; clear: () => void }[] = []
  if (province) chips.push({ label: province, clear: () => setProvince('') })
  if (cond) chips.push({ label: { nuevo: 'Nuevo', como_nuevo: 'Como nuevo', usado: 'Usado', mal: 'Para piezas' }[cond] ?? cond, clear: () => update({ cond: null }) })
  if (moneda) chips.push({ label: moneda, clear: () => update({ moneda: null }) })
  if (min || max) chips.push({ label: `${min || '0'} – ${max || '∞'} ${moneda || 'USD'}`, clear: () => update({ min: null, max: null }) })
  if (ofertas) chips.push({ label: 'Rebajados', clear: () => update({ ofertas: null }) })
  if (cubano) chips.push({ label: 'Hecho en Cuba', clear: () => update({ cubano: null }) })
  if (envio) chips.push({ label: 'Envío gratis', clear: () => update({ envio: null }) })

  const title = q ? `Resultados para «${q}»` : catName || (cubano ? 'Hecho en Cuba' : 'Anuncios recientes')
  const style = slug ? categoryStyle(group ? 'tecnologia' : slug) : null

  return (
    <div className="browse">
      <div className="browse-head">
        <div className="crumbs">
          <Link to="/">Inicio</Link> <span>/</span> {slug ? <Link to="/categorias">Categorías</Link> : 'Anuncios'}
          {catName && (
            <>
              <span>/</span> {catName}
            </>
          )}
        </div>
        <div className="browse-title-row">
          {style && (
            <span className="browse-cat-icon" style={{ background: style.bg, color: style.ink }}>
              <style.Icon size={24} strokeWidth={1.5} />
            </span>
          )}
          <div>
            <h1 className="page-title">{title}</h1>
            <p className="page-sub">
              {loading ? 'Buscando…' : `${total.toLocaleString('es')} anuncio${total === 1 ? '' : 's'}`} {province ? `en ${province}` : 'en toda Cuba'}
            </p>
          </div>
          <div className="section-tools">
            <button type="button" className="btn btn-light btn-sm only-mobile" onClick={() => setShowFilters((v) => !v)}>
              <SlidersHorizontal size={15} /> Filtros
            </button>
            <label className="select-pill">
              <ArrowUpDown size={15} strokeWidth={1.8} />
              <select value={sort} onChange={(e) => update({ sort: e.target.value })} aria-label="Ordenar">
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
              <ChevronDown size={14} />
            </label>
          </div>
        </div>
        {chips.length > 0 && (
          <div className="chips">
            {chips.map((c) => (
              <button key={c.label} type="button" className="chip" onClick={c.clear}>
                {c.label} <X size={13} />
              </button>
            ))}
            <button type="button" className="chip chip-ghost" onClick={clearAll}>Limpiar todo</button>
          </div>
        )}
      </div>

      <div className="browse-layout">
        <aside className={`filters panel ${showFilters ? 'is-open' : ''}`}>
          <div className="filter-group">
            <label htmlFor="f-cat">Categoría</label>
            <select id="f-cat" value={slug ?? ''} onChange={(e) => onCategory(e.target.value)}>
              <option value="">Todas</option>
              <option value="tecnologia">Tecnología (todo)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="f-prov">Provincia</label>
            <select id="f-prov" value={province} onChange={(e) => setProvince(e.target.value)}>
              <option value="">Toda Cuba</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label htmlFor="f-cond">Estado</label>
            <select id="f-cond" value={cond} onChange={(e) => update({ cond: e.target.value || null })}>
              <option value="">Cualquiera</option>
              <option value="nuevo">Nuevo</option>
              <option value="como_nuevo">Como nuevo</option>
              <option value="usado">Usado</option>
              <option value="mal">Para piezas</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Moneda</label>
            <div className="seg">
              {['', 'CUP', 'USD', 'MLC'].map((m) => (
                <button key={m || 'all'} type="button" className={moneda === m ? 'is-on' : ''} onClick={() => update({ moneda: m || null })}>
                  {m || 'Todas'}
                </button>
              ))}
            </div>
          </div>

          <form className="filter-group" onSubmit={applyPrice}>
            <label>Precio ({moneda || 'USD'})</label>
            <div className="price-row">
              <input type="number" min="0" inputMode="numeric" placeholder="Mín." value={minInput} onChange={(e) => setMinInput(e.target.value)} />
              <span>–</span>
              <input type="number" min="0" inputMode="numeric" placeholder="Máx." value={maxInput} onChange={(e) => setMaxInput(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-light btn-sm btn-block">Aplicar</button>
            {!moneda && <small className="hint">Los precios en CUP se comparan al cambio de 360 CUP por USD.</small>}
          </form>

          <div className="filter-group">
            <label>Más filtros</label>
            <label className="check">
              <input type="checkbox" checked={cubano} onChange={(e) => update({ cubano: e.target.checked ? '1' : null })} />
              <span>Hecho en Cuba</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={ofertas} onChange={(e) => update({ ofertas: e.target.checked ? '1' : null })} />
              <span>Precio rebajado</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={envio} onChange={(e) => update({ envio: e.target.checked ? '1' : null })} />
              <span>Envío gratis</span>
            </label>
          </div>
        </aside>

        <div className="browse-main">
          {loading ? (
            <div className="card-grid card-grid-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="lcard skeleton" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              title="No encontramos anuncios"
              message="Prueba con otras palabras, otra provincia o menos filtros."
              action={<button type="button" className="btn btn-light" onClick={clearAll}>Limpiar filtros</button>}
            />
          ) : (
            <>
              <div className="card-grid card-grid-3">
                {listings.map((l) => (
                  <ListingCard key={l.id} listing={l} />
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pager">
                  <button type="button" className="btn btn-light btn-sm" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                    Anterior
                  </button>
                  <span>Página {page} de {totalPages}</span>
                  <button type="button" className="btn btn-light btn-sm" disabled={page >= totalPages} onClick={() => update({ page: String(page + 1) })}>
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
