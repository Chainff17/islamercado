import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header'
import Home from './pages/Home'
import Browse from './pages/Browse'
import ListingDetail from './pages/ListingDetail'
import SellerProfile from './pages/SellerProfile'
import Messages from './pages/Messages'
import Favorites from './pages/Favorites'
import NewListing from './pages/NewListing'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import NotFound from './pages/NotFound'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <div className="app">
      <ScrollToTop />
      <Header />
      <main className="container main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/buscar" element={<Browse />} />
          <Route path="/categoria/:slug" element={<Browse />} />
          <Route path="/publicacion/:id" element={<ListingDetail />} />
          <Route path="/vendedor/:id" element={<SellerProfile />} />
          <Route path="/mensajes" element={<Messages />} />
          <Route path="/mensajes/:listingId" element={<Messages />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/publicar" element={<NewListing />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="container">
          <div className="footer-inner">
            <div>
              <div className="footer-brand">🏝️ Isla Mercado</div>
              <p>El mercado de segunda mano de Cuba. Compra, vende y conversa con vendedores de todo el país.</p>
            </div>
            <div className="footer-links">
              <Link to="/">Inicio</Link>
              <Link to="/buscar">Buscar</Link>
              <Link to="/publicar">Publicar</Link>
              <Link to="/mensajes">Mensajes</Link>
              <Link to="/favoritos">Favoritos</Link>
            </div>
          </div>
          <div className="footer-copy">
            © {new Date().getFullYear()} Isla Mercado · Hecho en Cuba 🇨🇺
          </div>
        </div>
      </footer>
    </div>
  )
}
