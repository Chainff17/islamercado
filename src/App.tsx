import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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
    <div className="app-shell">
      <ScrollToTop />
      <Header />
      <main className="main-content">
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
      <footer className="app-footer">
        <div className="footer-inner">
          <span>Isla Mercado · Mercado de segunda mano en Cuba</span>
          <span className="footer-note">Hecho con ❤️ para el mercado cubano</span>
        </div>
      </footer>
    </div>
  )
}
