import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LISTING_SELECT, type Category, type Listing } from '../lib/types'
import { uploadImage, storageUrl } from '../lib/images'
import { LoadingBlock, EmptyState, Alert } from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { CURRENCIES, PROVINCES } from '../lib/cuba'

const EMPTY = {
  title: '',
  category_id: '',
  price_usd: '',
  original_price: '',
  currency: 'USD',
  stock: '1',
  condition: 'usado',
  province: 'La Habana',
  city: '',
  phone: '',
  negotiable: false,
  free_shipping: false,
  description: '',
}

export default function NewListing() {
  const { id: editId } = useParams<{ id: string }>()
  const { user, profile, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingEdit, setLoadingEdit] = useState(!!editId)
  const [form, setForm] = useState(EMPTY)

  useEffect(() => {
    supabase.from('categories').select('id, slug, name, icon').order('id').then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (!editId && profile?.phone) setForm((f) => ({ ...f, phone: f.phone || profile.phone || '' }))
  }, [profile, editId])

  useEffect(() => {
    if (!editId) {
      setForm(EMPTY)
      setImages([])
      setLoadingEdit(false)
      return
    }
    setLoadingEdit(true)
    supabase
      .from('listings')
      .select(LISTING_SELECT)
      .eq('id', editId)
      .maybeSingle()
      .then(({ data }) => {
        const l = data as Listing | null
        if (l) {
          setForm({
            title: l.title,
            category_id: String(l.category_id),
            price_usd: String(l.price_usd),
            original_price: l.original_price ? String(l.original_price) : '',
            currency: l.currency || 'USD',
            stock: String(l.stock ?? 1),
            condition: l.condition === 'like-new' ? 'como_nuevo' : l.condition,
            province: l.province,
            city: l.city ?? '',
            phone: l.phone ?? '',
            negotiable: l.negotiable,
            free_shipping: l.free_shipping,
            description: l.description ?? '',
          })
          setImages(l.images ?? [])
        }
        setLoadingEdit(false)
      })
  }, [editId])

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function onPickImages(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!user || files.length === 0) return
    const room = 8 - images.length
    if (room <= 0) return setError('Máximo 8 imágenes.')
    setUploading(true)
    setError('')
    const uploaded: string[] = []
    for (const file of files.slice(0, room)) {
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" supera 5 MB.`)
        continue
      }
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

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setError('')
    const title = form.title.trim()
    if (title.length < 5 || title.length > 120) return setError('El título debe tener entre 5 y 120 caracteres.')
    if (!form.category_id) return setError('Selecciona una categoría.')
    const price = Number(form.price_usd)
    if (!form.price_usd || isNaN(price) || price < 0) return setError('Ingresa un precio válido.')
    const original = form.original_price ? Number(form.original_price) : null
    if (original !== null && (isNaN(original) || original <= price)) return setError('El precio anterior debe ser mayor que el precio actual.')
    const stock = Math.max(0, Math.floor(Number(form.stock) || 0))
    if (stock < 1) return setError('El stock debe ser al menos 1.')

    const payload = {
      category_id: Number(form.category_id),
      title,
      description: form.description.trim(),
      price_usd: price,
      original_price: original,
      currency: form.currency,
      stock,
      negotiable: form.negotiable,
      free_shipping: form.free_shipping,
      condition: form.condition,
      province: form.province,
      city: form.city.trim() || null,
      images,
      phone: form.phone.trim() || null,
    }

    setSaving(true)
    const res = editId
      ? await supabase.from('listings').update(payload).eq('id', editId).select('id').single()
      : await supabase.from('listings').insert({ ...payload, seller_id: user.id, status: 'active' }).select('id').single()
    setSaving(false)
    if (res.error) return setError(res.error.message)
    navigate(`/publicacion/${res.data.id}`)
  }

  if (authLoading || loadingEdit) return <LoadingBlock />
  if (!user)
    return (
      <EmptyState
        title="Inicia sesión para vender"
        message="Necesitas una cuenta para publicar un artículo en Isla Mercado."
        action={<Link to="/entrar" className="btn btn-primary">Entrar</Link>}
      />
    )

  return (
    <div className="page new-listing">
      <div className="page-head">
        <h1>{editId ? 'Editar publicación' : '¿Qué vas a vender?'}</h1>
        <p className="page-sub">Publicar es gratis. Buenas fotos y una descripción clara venden más rápido.</p>
      </div>

      <form className="form card" onSubmit={onSubmit}>
        <label className="field">
          <span>Título *</span>
          <input type="text" value={form.title} maxLength={120} onChange={(e) => update('title', e.target.value)} placeholder='Ej: Smart TV Samsung 43" 4K con control' required />
          <small className="muted">{form.title.length}/120 · Incluye marca, modelo y características</small>
        </label>

        <div className="form-row">
          <label className="field">
            <span>Categoría *</span>
            <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)} required>
              <option value="">Seleccionar…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Condición</span>
            <select value={form.condition} onChange={(e) => update('condition', e.target.value)}>
              <option value="nuevo">Nuevo</option>
              <option value="como_nuevo">Como nuevo</option>
              <option value="usado">Usado</option>
              <option value="mal">En mal estado / para piezas</option>
            </select>
          </label>
        </div>

        <div className="form-row form-row-3">
          <label className="field">
            <span>Precio *</span>
            <input type="number" min="0" step="0.01" value={form.price_usd} onChange={(e) => update('price_usd', e.target.value)} placeholder="120" required />
          </label>
          <label className="field">
            <span>Moneda</span>
            <select value={form.currency} onChange={(e) => update('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Precio anterior (oferta)</span>
            <input type="number" min="0" step="0.01" value={form.original_price} onChange={(e) => update('original_price', e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        <div className="form-row form-row-3">
          <label className="field">
            <span>Stock disponible *</span>
            <input type="number" min="1" step="1" value={form.stock} onChange={(e) => update('stock', e.target.value)} required />
          </label>
          <label className="field">
            <span>Provincia *</span>
            <select value={form.province} onChange={(e) => update('province', e.target.value)}>
              {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Municipio</span>
            <input type="text" value={form.city} onChange={(e) => update('city', e.target.value)} placeholder="Ej: Plaza de la Revolución" />
          </label>
        </div>

        <label className="field">
          <span>Teléfono / WhatsApp</span>
          <input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="5 123 4567" />
        </label>

        <div className="checks">
          <label className="checkbox-field">
            <input type="checkbox" checked={form.negotiable} onChange={(e) => update('negotiable', e.target.checked)} />
            <span>Precio negociable</span>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={form.free_shipping} onChange={(e) => update('free_shipping', e.target.checked)} />
            <span>Ofrezco envío gratis</span>
          </label>
        </div>

        <label className="field">
          <span>Descripción</span>
          <textarea rows={6} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Estado, tiempo de uso, qué incluye, garantía, formas de pago y entrega…" />
        </label>

        <div className="field">
          <span>Fotos ({images.length}/8) · la primera será la portada</span>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickImages} style={{ display: 'none' }} />
          <div className="image-preview">
            {images.map((img, i) => (
              <div key={img + i} className="image-preview-item">
                <img src={storageUrl(img)} alt={`Imagen ${i + 1}`} />
                {i === 0 && <span className="cover-tag">Portada</span>}
                <button type="button" onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))} className="img-remove">✕</button>
              </div>
            ))}
            {images.length < 8 && (
              <button type="button" className="image-add" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo…' : '＋ Añadir fotos'}
              </button>
            )}
          </div>
        </div>

        {error && <Alert kind="error">{error}</Alert>}

        <div className="form-actions">
          <button type="submit" className="btn btn-primary btn-lg" disabled={saving || uploading}>
            {saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Publicar artículo'}
          </button>
          <Link to={editId ? '/mis-publicaciones' : '/'} className="btn btn-ghost">Cancelar</Link>
        </div>
      </form>
    </div>
  )
}
