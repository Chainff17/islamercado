import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Category } from '../lib/types'
import { uploadImage, storageUrl } from '../lib/images'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'

export default function NewListing() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    category_id: '',
    price_usd: '',
    condition: 'usado',
    province: '',
    city: '',
    phone: '',
    negotiable: false,
    description: '',
  })

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('id')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!user || files.length === 0) return
    setUploading(true)
    setError('')
    const uploaded: string[] = []
    for (const file of files.slice(0, 8)) {
      try {
        uploaded.push(await uploadImage(file, user.id))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al subir la imagen')
        break
      }
    }
    setImages((prev) => [...prev, ...uploaded])
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')

    if (!form.title.trim()) return setError('El título es obligatorio.')
    if (!form.category_id) return setError('Selecciona una categoría.')
    const price = Number(form.price_usd)
    if (!form.price_usd || isNaN(price) || price < 0)
      return setError('Ingresa un precio válido.')
    if (!form.province.trim()) return setError('La provincia es obligatoria.')

    setSaving(true)
    const { error: err } = await supabase.from('listings').insert({
      seller_id: user.id,
      category_id: Number(form.category_id),
      title: form.title.trim(),
      description: form.description.trim(),
      price_usd: price,
      negotiable: form.negotiable,
      condition: form.condition,
      province: form.province.trim(),
      city: form.city.trim() || null,
      images,
      phone: form.phone.trim() || null,
      status: 'active',
    })
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/')
  }

  if (authLoading) return <LoadingBlock />
  if (!user)
    return (
      <EmptyState
        title="Inicia sesión para publicar"
        message="Necesitas una cuenta para publicar un artículo en Isla Mercado."
        action={
          <Link to="/entrar" className="btn btn-primary">
            Entrar
          </Link>
        }
      />
    )

  return (
    <div className="page new-listing">
      <div className="page-head">
        <h1>Publicar un artículo</h1>
        <p className="page-sub">Completa los datos y añade fotos. Tu publicación aparecerá en el mercado.</p>
      </div>

      <form className="form card" onSubmit={onSubmit}>
        <div className="form-row">
          <label className="field">
            <span>Título *</span>
            <input
              type="text"
              value={form.title}
              onChange={(e) => update('title', e.target.value)}
              placeholder={`Ej: Televisor Smart TV 43"`}
              required
            />
          </label>
          <label className="field">
            <span>Categoría *</span>
            <select
              value={form.category_id}
              onChange={(e) => update('category_id', e.target.value)}
              required
            >
              <option value="">Seleccionar…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Precio (USD) *</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.price_usd}
              onChange={(e) => update('price_usd', e.target.value)}
              placeholder="120.00"
              required
            />
          </label>
          <label className="field">
            <span>Condición</span>
            <select value={form.condition} onChange={(e) => update('condition', e.target.value)}>
              <option value="nuevo">Nuevo</option>
              <option value="like-new">Como nuevo</option>
              <option value="usado">Usado</option>
              <option value="mal">En mal estado</option>
            </select>
          </label>
        </div>

        <div className="form-row">
          <label className="field">
            <span>Provincia *</span>
            <input
              type="text"
              value={form.province}
              onChange={(e) => update('province', e.target.value)}
              placeholder="Ej: La Habana"
              required
            />
          </label>
          <label className="field">
            <span>Ciudad / Municipio</span>
            <input
              type="text"
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              placeholder="Ej: Plaza de la Revolución"
            />
          </label>
        </div>

        <label className="field">
          <span>Teléfono de contacto</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+53 7 xxx xxxx"
          />
        </label>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={form.negotiable}
            onChange={(e) => update('negotiable', e.target.checked)}
          />
          <span>Precio negociable</span>
        </label>

        <label className="field">
          <span>Descripción</span>
          <textarea
            rows={5}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Describe el estado, características y cualquier detalle relevante…"
          />
        </label>

        <div className="field">
          <span>Imágenes (máximo 8)</span>
          <div className="image-picker">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPickImages}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Subiendo…' : 'Añadir imágenes'}
            </button>
          </div>
          {images.length > 0 && (
            <div className="image-preview">
              {images.map((img, i) => (
                <div key={i} className="image-preview-item">
                  <img src={storageUrl(img)} alt={`Imagen ${i + 1}`} />
                  <button type="button" onClick={() => removeImage(i)} className="img-remove">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving}>
            {saving ? 'Publicando…' : 'Publicar artículo'}
          </button>
          <Link to="/" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  )
}
