import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, MapPin } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { PROVINCES, PROVINCE_COORDS } from '../lib/cuba'
import { usePrefs } from '../context/PrefsContext'

export default function MapPage() {
  const navigate = useNavigate()
  const { province, setProvince } = usePrefs()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loaded, setLoaded] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    supabase
      .from('listings')
      .select('province')
      .eq('status', 'active')
      .limit(10000)
      .then(({ data }) => {
        const m: Record<string, number> = {}
        for (const r of data ?? []) m[r.province as string] = (m[r.province as string] ?? 0) + 1
        setCounts(m)
        setLoaded(true)
      })
  }, [])

  // Crear el mapa una sola vez
  useEffect(() => {
    if (!box.current || map.current) return
    const m = L.map(box.current, {
      center: [21.6, -79.5],
      zoom: 6,
      minZoom: 5,
      maxZoom: 12,
      zoomControl: true,
      scrollWheelZoom: false,
      maxBounds: [
        [18.5, -86.5],
        [24.5, -72.5],
      ],
    })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [])

  // Pintar marcadores con el número de anuncios por provincia
  useEffect(() => {
    const lg = layer.current
    if (!lg || !loaded) return
    lg.clearLayers()
    for (const p of PROVINCES) {
      const n = counts[p] ?? 0
      const coords = PROVINCE_COORDS[p]
      if (!coords) continue
      const size = n === 0 ? 30 : Math.min(58, 34 + n * 3)
      const icon = L.divIcon({
        className: '',
        html: `<div class="map-pin ${n === 0 ? 'is-empty' : ''} ${province === p ? 'is-active' : ''}" style="width:${size}px;height:${size}px">${n}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      })
      const mk = L.marker(coords, { icon, title: `${p}: ${n} anuncios`, keyboard: true })
      mk.on('click', () => {
        setProvince(p)
        navigate('/buscar')
      })
      mk.bindTooltip(`<strong>${p}</strong><br/>${n} anuncio${n === 1 ? '' : 's'}`, { direction: 'top', offset: [0, -size / 2] })
      lg.addLayer(mk)
    }
  }, [counts, loaded, province, navigate, setProvince])

  const total = useMemo(() => Object.values(counts).reduce((a, b) => a + b, 0), [counts])
  const ranked = useMemo(() => [...PROVINCES].sort((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0)), [counts])

  function go(p: string) {
    setProvince(p)
    navigate('/buscar')
  }

  return (
    <div className="page map-page">
      <div className="crumbs">
        <Link to="/">Inicio</Link> <span>/</span> Mapa
      </div>
      <h1 className="page-title">Anuncios en el mapa</h1>
      <p className="page-sub">{total} anuncios activos en las 16 provincias. Toca una provincia para ver lo que se vende allí.</p>

      <div className="map-layout">
        <div className="map-box panel" ref={box} />
        <aside className="panel map-list">
          <button type="button" className={`map-row ${province === '' ? 'is-on' : ''}`} onClick={() => go('')}>
            <MapPin size={16} strokeWidth={1.8} />
            <span className="grow">Toda Cuba</span>
            <strong>{total}</strong>
            <ArrowRight size={15} />
          </button>
          {ranked.map((p) => (
            <button key={p} type="button" className={`map-row ${province === p ? 'is-on' : ''}`} onClick={() => go(p)}>
              <MapPin size={16} strokeWidth={1.8} />
              <span className="grow">{p}</span>
              <strong>{counts[p] ?? 0}</strong>
              <ArrowRight size={15} />
            </button>
          ))}
        </aside>
      </div>
    </div>
  )
}
