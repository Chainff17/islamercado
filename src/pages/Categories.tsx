import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'
import { categoryStyle } from '../lib/categoryStyle'
import { LoadingBlock } from '../components/Pagination'
import { usePrefs } from '../context/PrefsContext'

export default function Categories() {
  const { province } = usePrefs()
  const [cats, setCats] = useState<Category[]>([])
  const [counts, setCounts] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let q = supabase.from('listings').select('category_id').eq('status', 'active').limit(5000)
    if (province) q = q.eq('province', province)
    Promise.all([supabase.from('categories').select('id, slug, name, icon').order('name'), q]).then(([c, l]) => {
      if (!active) return
      setCats(c.data ?? [])
      const m: Record<number, number> = {}
      for (const r of l.data ?? []) m[r.category_id as number] = (m[r.category_id as number] ?? 0) + 1
      setCounts(m)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [province])

  return (
    <div className="page">
      <div className="crumbs">
        <Link to="/">Inicio</Link> <span>/</span> Categorías
      </div>
      <h1 className="page-title">Todas las categorías</h1>
      <p className="page-sub">{province ? `Anuncios en ${province}` : 'Anuncios en toda Cuba'}</p>
      {loading ? (
        <LoadingBlock />
      ) : (
        <div className="cat-list">
          {cats.map((c) => {
            const st = categoryStyle(c.slug)
            const n = counts[c.id] ?? 0
            return (
              <Link key={c.id} to={`/categoria/${c.slug}`} className="cat-row" style={{ borderColor: st.border }}>
                <span className="cat-row-icon" style={{ background: st.bg, color: st.ink }}>
                  <st.Icon size={24} strokeWidth={1.5} />
                </span>
                <span className="cat-row-text">
                  <strong>{c.name}</strong>
                  <small>{n === 0 ? 'Sin anuncios todavía' : `${n} anuncio${n === 1 ? '' : 's'}`}</small>
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
