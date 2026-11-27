import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { supabase } from '../lib/supabase'
import { initials } from '../lib/format'

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const { count } = useCart()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) {
      setUnread(0)
      return
    }
    let active = true
    async function load() {
      const { count: c } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', user!.id)
        .is('read_at', null)
      if (active) setUnread(c ?? 0)
    }
    load()
    const t = setInterval(load, 20000)
    return () => {
      active = false
      clearInterval(t)
    }
  }, [user])

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(`/buscar?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="ml-header">
      <div className="ml-header-top">
        <div className="header-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">🏝️</span>
            <span className="brand-name">
              Isla<span className="brand-accent">Mercado</span>
            </span>
            <span className="brand-flag" title="Cuba">🇨🇺</span>
          </Link>

          <form className="search-bar" onSubmit={onSearch} role="search">
            <input
              type="search"
              placeholder="Buscar en toda Cuba: iPhone, moto, nevera, arroz…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Buscar"
            />
            <button type="submit" className="btn btn-search" aria-label="Buscar">
              🔍
            </button>
          </form>

          <nav className="header-nav">
            <NavLink to="/buscar" className="nav-link">
              Explorar
            </NavLink>
            <NavLink to="/publicar" className="nav-link nav-sell">
              Vender
            </NavLink>
            <NavLink to="/carrito" className="nav-icon" title="Carrito">
              🛒
              {count > 0 && <span className="nav-badge">{count}</span>}
            </NavLink>
            {user ? (
              <>
                <NavLink to="/mensajes" className="nav-icon" title="Mensajes">
                  💬
                  {unread > 0 && <span className="nav-badge">{unread}</span>}
                </NavLink>
                <NavLink to="/favoritos" className="nav-icon" title="Favoritos">
                  ⭐
                </NavLink>
                <NavLink to="/perfil" className="user-chip" title={profile?.username || user.email}>
                  <span className="avatar-mini">{initials(profile?.username || user.email)}</span>
                  <span className="user-chip-name">{profile?.username || 'Mi cuenta'}</span>
                </NavLink>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => signOut().catch(() => {})}
                >
                  Salir
                </button>
              </>
            ) : (
              <>
                <NavLink to="/entrar" className="nav-link">
                  Entrar
                </NavLink>
                <NavLink to="/registro" className="btn btn-dark btn-sm">
                  Regístrate
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </div>
      <div className="ml-header-sub">
        <div className="header-inner sub-inner">
          <span className="ship-to">📍 Enviar a: <strong>La Habana</strong></span>
          <span className="sub-sep">·</span>
          <NavLink to="/buscar" className="sub-link">🚚 Envío a toda Cuba</NavLink>
          <NavLink to="/buscar?ofertas=1" className="sub-link">⚡ Ofertas del día</NavLink>
          <NavLink to="/mis-compras" className="sub-link">Mis compras</NavLink>
          <NavLink to="/mis-ventas" className="sub-link">Mis ventas</NavLink>
          <NavLink to="/mis-publicaciones" className="sub-link">Mis publicaciones</NavLink>
          <span className="sub-right">Compra protegida · Pago contra entrega</span>
        </div>
      </div>
    </header>
  )
}
