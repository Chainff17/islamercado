import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { Category } from '../lib/types'
import { Alert, EmptyState, LoadingBlock } from '../components/Pagination'

const PROVINCES = [
  'La Habana',
  'Santiago de Cuba',
  'Holguín',
  'Camagüey',
  'Cienfuegos',
  'Villa Clara',
  'Matanzas',
  'Pinar del Río',
  'Isla de la Juventud',
  'Granma',
  'Las Tunas',
  'Sancti Spíritus',
  'Ciego de Ávila',
]

const CONDITIONS = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'como_nuevo', label: 'Como nuevo' },
  { value: 'usado', label: 'Usado' },
  { value: 'defectuoso', label: 'Con defectos' },
]

export default function NewListing() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    price_usd: '',
    condition: 'usado',
    province: 'La Habana',
    city: '',
    negotiable: false,
    phone: '',
  })
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('name')
      .then(({ data }) => {
        setCategories(data ?? [])
        setLoading(false)
      })
  }, [])

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }))

  const onFiles = async (files: FileList | null) => {
    if (!files || !user) return
    setUploading(true)
    const newFiles = Array.from(files)
    const uploaded: string[] = []
    for (const file of newFiles) {
      const path = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      const { error } = await supabase.storage
        .from('listing-images')
        .upload(path, file, { contentType: file.type })
      if (error) {
        setError(`Error al subir imagen: ${error.message}`)
        setUploading(false)
        return
      }
      const { data } = supabase.storage.from('listing-images').getPublicUrl(path)
      uploaded.push(data.publicUrl)
    }
    setImages((prev) => [...prev, ...uploaded])
    setUploading(false)
  }

  const removeImage = (i: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!user) return
    if (!form.title.trim() || !form.description.trim() || !form.category_id || !form.price_usd) {
      setError('Completa los campos obligatorios: título, descripción, categoría y precio.')
      return
    }
    const price = parseFloat(form.price_usd)
    if (Number.isNaN(price) || price < 0) {
      setError('El precio debe ser un número válido mayor o igual a 0.')
      return
    }

    setSubmitting(true)
    const { error: err } = await supabase.from('listings').insert({
      seller_id: user.id,
      category_id: parseInt(form.category_id, 10),
      title: form.title.trim(),
      description: form.description.trim(),
      price_usd: price,
      negotiable: form.negotiable,
      condition: form.condition,
      province: form.province,
      city: form.city.trim() || null,
      phone: form.phone.trim() || null,
      images,
      status: 'active',
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setSuccess('Publicación creada con éxito. ¡Listo para vender!')
    setTimeout(() => navigate('/'), 1500)
  }

  if (authLoading) return <LoadingBlock />
  if (!user) {
    return (
      <EmptyState
        icon="🔐"
        title="Inicia sesión para publicar"
        message="Debes estar registrado para publicar artículos en Isla Mercado."
        action={
          <button className="btn btn-primary" onClick={() => navigate('/entrar')}>
            Ingresar
          </button>
        }
      />
    )
  }
  if (loading) return <LoadingBlock />

  return (
    <div className="form-page">
      <div className="section-head">
        <h2>Publicar un artículo</h2>
      </div>
      {error && <Alert kind="error">{error}</Alert>}
      {success && <Alert kind="success">{success}</Alert>}
      <form className="form" onSubmit={submit}>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="title">Título *</label>
            <input
              id="title"
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Ej.: TV LED 43 pulgadas Smart"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="category">Categoría *</label>
            <select
              id="category"
              value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="price">Precio (USD) *</label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={form.price_usd}
              onChange={(e) => set('price_usd', e.target.value)}
              placeholder="210.00"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="condition">Estado</label>
            <select
              id="condition"
              value={form.condition}
              onChange={(e) => set('condition', e.target.value)}
            >
              {CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="province">Provincia *</label>
            <select
              id="province"
              value={form.province}
              onChange={(e) => set('province', e.target.value)}
            >
              {PROVINCES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="city">Ciudad / Reparto</label>
            <input
              id="city"
              type="text"
              value={form.city}
              onChange={(e) => set('city', e.target.value)}
              placeholder="Ej.: Vedado, Playa…"
            />
          </div>
          <div className="field">
            <label htmlFor="phone">Teléfono de contacto</label>
            <input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="Ej.: 5351234567"
            />
          </div>
          <div className="field field-check">
            <label>
              <input
                type="checkbox"
                checked={form.negotiable}
                onChange={(e) => set('negotiable', e.target.checked)}
              />
              El precio es negociable
            </label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="desc">Descripción *</label>
          <textarea
            id="desc"
            rows={5}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Describe el artículo, estado, características y condiciones de entrega…"
            required
          />
        </div>

        <div className="field">
          <label>Imágenes</label>
          <div className="image-uploader">
            {images.map((img, i) => (
              <div key={i} className="image-preview">
                <img src={img} alt={`Subida ${i + 1}`} />
                <button type="button" className="image-remove" onClick={() => removeImage(i)}>
                  ✕
                </button>
              </div>
            ))}
            <label className="image-add">
              {uploading ? 'Subiendo…' : '+ Agregar imagen'}
              <input
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => onFiles(e.target.files)}
              />
            </label>
          </div>
          <p className="muted">Las imágenes se suben al bucket <code>listing-images</code> bajo tu carpeta de usuario.</p>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? 'Publicando…' : 'Publicar artículo'}
          </button>
        </div>
      </form>
    </div>
  )
}
