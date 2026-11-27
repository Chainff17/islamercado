import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Header() {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q.trim()) params.set('q', q.trim())
    navigate(`/buscar${params.toString() ? `?${params}` : ''}`)
  }

  const onLogout = async () => {
    await signOut()
    navigate('/')
  }

  const initial = user?.username?.charAt(0).toUpperCase() ?? ''

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="brand">
          <span className="brand-icon">🏝️</span>
          <span className="brand-text">
            Isla<strong>Mercado</strong>
          </span>
        </Link>

        <form className="search" onSubmit={onSearch} role="search">
          <input
            type="search"
            placeholder="Buscar productos, servicios…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Buscar en Isla Mercado"
          />
          <button type="submit" className="btn btn-primary">
            Buscar
          </button>
        </form>

        <nav className="nav-actions">
          <Link to="/publicar" className="nav-link">
            Publicar
          </Link>
          {user ? (
            <>
              <Link to="/favoritos" className="nav-link">
                Favoritos
              </Link>
              <Link to="/mensajes" className="nav-link">
                Mensajes
              </Link>
              <Link to="/perfil" className="user-chip" title={user.username ?? 'Mi perfil'}>
                <span className="avatar">{initial || '👤'}</span>
                <span className="user-name">{user.username ?? 'Mi cuenta'}</span>
              </Link>
              <button className="nav-link" onClick={onLogout}>
                Salir
              </button>
            </>
          ) : (
            !loading && (
              <>
                <Link to="/entrar" className="nav-link">
                  Ingresar
                </Link>
                <Link to="/registro" className="btn btn-primary btn-sm">
                  Regístrate
                </Link>
              </>
            )
          )}
        </nav>
      </div>
    </header>
  )
}
