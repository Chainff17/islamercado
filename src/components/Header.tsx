import { useState, type FormEvent } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { initials } from '../lib/format'

export default function Header() {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  function onSearch(e: FormEvent) {
    e.preventDefault()
    navigate(`/buscar?q=${encodeURIComponent(q.trim())}`)
  }

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">🛒</span>
          <span className="brand-name">Isla Mercado</span>
        </Link>

        <form className="search-bar" onSubmit={onSearch} role="search">
          <input
            type="search"
            placeholder="Buscar artículos…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar"
          />
          <button type="submit" className="btn btn-primary search-btn">
            Buscar
          </button>
        </form>

        <nav className="header-nav">
          <NavLink to="/buscar" className="nav-link">
            Explorar
          </NavLink>
          <NavLink to="/publicar" className="nav-link nav-cta">
            Publicar
          </NavLink>

          {user ? (
            <div className="user-menu">
              <NavLink to="/favoritos" className="nav-link">
                Favoritos
              </NavLink>
              <NavLink to="/mensajes" className="nav-link">
                Mensajes
              </NavLink>
              <NavLink to="/perfil" className="user-chip" title={profile?.username || user.email}>
                <span className="avatar-mini">{initials(profile?.username || user.email)}</span>
                <span className="user-chip-name">{profile?.username || 'Mi perfil'}</span>
              </NavLink>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => signOut().catch(() => {})}
              >
                Salir
              </button>
            </div>
          ) : (
            <div className="user-menu">
              <NavLink to="/entrar" className="nav-link">
                Entrar
              </NavLink>
              <NavLink to="/registro" className="btn btn-primary">
                Regístrate
              </NavLink>
            </div>
          )}
        </nav>
      </div>
    </header>
  )
}
