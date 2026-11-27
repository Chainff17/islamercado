import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  CornerDownLeft,
  Heart,
  LayoutGrid,
  LogOut,
  Map as MapIcon,
  MapPin,
  MessageCircle,
  Package,
  Plus,
  Receipt,
  Search,
  ShoppingBag,
  Store,
  TreePalm,
  User,
  Wifi,
  WifiOff,
  HelpCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { usePrefs } from '../context/PrefsContext'
import { useSeller } from '../context/SellerContext'
import { supabase } from '../lib/supabase'
import { PROVINCES } from '../lib/cuba'
import { categoryStyle } from '../lib/categoryStyle'
import type { Category } from '../lib/types'

function useDropdown() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname, search } = useLocation()
  useEffect(() => setOpen(false), [pathname, search])
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, ref }
}

interface Counts {
  messages: number
  sales: number
  questions: number
}

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { count: cartCount } = useCart()
  const { status: sellerStatus, plan, isAdmin, refresh: refreshSeller } = useSeller()
  const { province, setProvince, ahorro, toggleAhorro } = usePrefs()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [categories, setCategories] = useState<Category[]>([])
  const [counts, setCounts] = useState<Counts>({ messages: 0, sales: 0, questions: 0 })

  const cats = useDropdown()
  const bell = useDropdown()
  const account = useDropdown()

  useEffect(() => {
    supabase
      .from('categories')
      .select('id, slug, name, icon')
      .order('id')
      .then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (!user) {
      setCounts({ messages: 0, sales: 0, questions: 0 })
      return
    }
    let active = true
    async function load() {
      const [m, s, qq] = await Promise.all([
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('receiver_id', user!.id).is('read_at', null),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('seller_id', user!.id).eq('status', 'pending'),
        supabase
          .from('questions')
          .select('id, listings!inner(seller_id)', { count: 'exact', head: true })
          .eq('listings.seller_id', user!.id)
          .is('answer', null),
      ])
      if (active) setCounts({ messages: m.count ?? 0, sales: s.count ?? 0, questions: qq.count ?? 0 })
    }
    load()
    const t = setInterval(() => {
      load()
      refreshSeller()
    }, 30000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [user, refreshSeller])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    navigate(term ? `/buscar?q=${encodeURIComponent(term)}` : '/buscar')
  }

  const pendingReviews = isAdmin ? sellerStatus?.pending_reviews ?? 0 : 0
  const totalNotifs = counts.messages + counts.sales + counts.questions + pendingReviews
  const displayName = profile?.username || user?.email?.split('@')[0] || 'Mi cuenta'

  return (
    <header className="site-header">
      <div className="hdr-top">
        <div className="container hdr-top-inner">
          <Link to="/" className="logo" aria-label="IslaMercado, inicio">
            <span className="logo-mark">
              <TreePalm size={22} strokeWidth={1.8} />
            </span>
            <span className="logo-text">
              IslaMercado<span className="logo-dot">.</span>
            </span>
          </Link>

          <form className="hdr-search" onSubmit={onSearch} role="search">
            <Search size={18} className="hdr-search-icon" />
            <input
              type="search"
              placeholder="Busca productos, motorina, celular, casa…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar anuncios"
            />
            <button type="submit" className="hdr-search-kbd" aria-label="Buscar">
              <CornerDownLeft size={13} />
            </button>
          </form>

          <div className="hdr-actions">
            <button
              type="button"
              className={`pill-toggle ${ahorro ? 'is-on' : ''}`}
              onClick={toggleAhorro}
              title={ahorro ? 'Modo ahorro activado: imágenes ligeras' : 'Activar modo ahorro de datos'}
              aria-pressed={ahorro}
            >
              {ahorro ? <WifiOff size={15} /> : <Wifi size={15} />}
              <span>Ahorro</span>
            </button>

            <Link to="/carrito" className="icon-btn" title="Carrito" aria-label="Carrito">
              <ShoppingBag size={20} strokeWidth={1.7} />
              {cartCount > 0 && <span className="dot-badge">{cartCount}</span>}
            </Link>

            <div className="dropdown" ref={bell.ref}>
              <button
                type="button"
                className="icon-btn"
                aria-label="Notificaciones"
                aria-expanded={bell.open}
                onClick={() => (user ? bell.setOpen(!bell.open) : navigate('/entrar'))}
              >
                <Bell size={20} strokeWidth={1.7} />
                {totalNotifs > 0 && <span className="dot-badge">{totalNotifs}</span>}
              </button>
              {bell.open && (
                <div className="menu menu-right menu-notifs">
                  <div className="menu-title">Notificaciones</div>
                  <NotifItem to="/mensajes" icon={<MessageCircle size={17} />} label="Mensajes sin leer" n={counts.messages} />
                  <NotifItem to="/mis-ventas" icon={<Receipt size={17} />} label="Ventas por confirmar" n={counts.sales} />
                  <NotifItem to="/mis-publicaciones" icon={<HelpCircle size={17} />} label="Preguntas sin responder" n={counts.questions} />
                  {isAdmin && <NotifItem to="/admin" icon={<ShieldCheck size={17} />} label="Pagos de planes por aprobar" n={pendingReviews} />}
                  {totalNotifs === 0 && <p className="menu-empty">Estás al día. ¡Nada pendiente!</p>}
                </div>
              )}
            </div>

            {user ? (
              <div className="dropdown" ref={account.ref}>
                <button type="button" className="account-btn" onClick={() => account.setOpen(!account.open)} aria-expanded={account.open}>
                  <User size={19} strokeWidth={1.7} />
                  <span className="account-label">Mi cuenta</span>
                </button>
                {account.open && (
                  <div className="menu menu-right">
                    <div className="menu-user">
                      <strong>{displayName}</strong>
                      <span>{user.email}</span>
                    </div>
                    {isAdmin && (
                      <Link to="/admin" className="menu-item menu-admin">
                        <ShieldCheck size={16} /> Administración
                        {pendingReviews > 0 && <span className="menu-count">{pendingReviews}</span>}
                      </Link>
                    )}
                    <Link to="/planes" className="menu-item">
                      <Sparkles size={16} /> Mi plan
                      <span className={`menu-plan ${plan ? 'is-on' : ''}`}>{plan ? plan.name : sellerStatus?.pending ? 'En revisión' : 'Sin plan'}</span>
                    </Link>
                    <Link to="/perfil" className="menu-item"><User size={16} /> Mi perfil</Link>
                    <Link to="/mis-publicaciones" className="menu-item"><Package size={16} /> Mis anuncios</Link>
                    <Link to="/mis-compras" className="menu-item"><ShoppingBag size={16} /> Mis compras</Link>
                    <Link to="/mis-ventas" className="menu-item"><Store size={16} /> Mis ventas</Link>
                    <Link to="/mensajes" className="menu-item"><MessageCircle size={16} /> Mensajes</Link>
                    <Link to="/favoritos" className="menu-item"><Heart size={16} /> Favoritos</Link>
                    <button type="button" className="menu-item menu-danger" onClick={() => signOut().then(() => navigate('/')).catch(() => {})}>
                      <LogOut size={16} /> Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link to="/entrar" className="account-btn">
                <User size={19} strokeWidth={1.7} />
                <span className="account-label">Mi cuenta</span>
              </Link>
            )}

            <Link to="/publicar" className="btn btn-primary btn-publish">
              <Plus size={18} />
              <span>Publicar anuncio</span>
            </Link>
          </div>
        </div>
      </div>

      <nav className="hdr-sub" aria-label="Secciones">
        <div className="container hdr-sub-inner">
          <div className="dropdown" ref={cats.ref}>
            <button type="button" className="sub-cats" onClick={() => cats.setOpen(!cats.open)} aria-expanded={cats.open}>
              <LayoutGrid size={17} strokeWidth={1.8} />
              <span>Categorías</span>
              <ChevronDown size={15} className={cats.open ? 'rot' : ''} />
            </button>
            {cats.open && (
              <div className="menu menu-cats">
                {categories.map((c) => {
                  const st = categoryStyle(c.slug)
                  return (
                    <Link key={c.id} to={`/categoria/${c.slug}`} className="menu-cat">
                      <span className="menu-cat-icon" style={{ background: st.bg, color: st.ink }}>
                        <st.Icon size={17} strokeWidth={1.6} />
                      </span>
                      {c.name}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
          <span className="sub-sep" />
          <div className="sub-links">
            <NavLink to="/" end className="sub-link">Inicio</NavLink>
            <NavLink to="/buscar" className="sub-link">Anuncios recientes</NavLink>
            <NavLink to="/favoritos" className="sub-link"><Heart size={16} strokeWidth={1.8} /> Favoritos</NavLink>
            <NavLink to="/mapa" className="sub-link"><MapIcon size={16} strokeWidth={1.8} /> Mapa</NavLink>
          </div>
          <label className="sub-province" title="Mostrar anuncios de una provincia">
            <MapPin size={16} strokeWidth={1.8} />
            <select value={province} onChange={(e) => setProvince(e.target.value)} aria-label="Provincia">
              <option value="">Toda Cuba</option>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
      </nav>
    </header>
  )
}

function NotifItem({ to, icon, label, n }: { to: string; icon: ReactNode; label: string; n: number }) {
  return (
    <Link to={to} className={`menu-item ${n === 0 ? 'is-muted' : ''}`}>
      {icon}
      <span className="grow">{label}</span>
      {n > 0 && <span className="count-pill">{n}</span>}
    </Link>
  )
}
