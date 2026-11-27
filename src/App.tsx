import { useEffect } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
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
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Orders from './pages/Orders'
import MyListings from './pages/MyListings'

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
          <Route path="/editar/:id" element={<NewListing />} />
          <Route path="/carrito" element={<Cart />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/mis-compras" element={<Orders mode="compras" />} />
          <Route path="/mis-ventas" element={<Orders mode="ventas" />} />
          <Route path="/mis-publicaciones" element={<MyListings />} />
          <Route path="/entrar" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/perfil" element={<Profile />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <div className="footer-inner footer-grid">
          <div>
            <strong>🏝️ Isla Mercado 🇨🇺</strong>
            <p className="footer-note">El mercado online del pueblo cubano. Compra y vende de Pinar del Río a Guantánamo.</p>
          </div>
          <div>
            <strong>Comprar</strong>
            <Link to="/buscar">Explorar</Link>
            <Link to="/buscar?ofertas=1">Ofertas</Link>
            <Link to="/carrito">Carrito</Link>
            <Link to="/mis-compras">Mis compras</Link>
          </div>
          <div>
            <strong>Vender</strong>
            <Link to="/publicar">Publicar gratis</Link>
            <Link to="/mis-publicaciones">Mis publicaciones</Link>
            <Link to="/mis-ventas">Mis ventas</Link>
          </div>
          <div>
            <strong>Pagos aceptados</strong>
            <span className="footer-note">Transfermóvil · Zelle · CUP · USD · MLC · Contra entrega</span>
          </div>
        </div>
        <div className="footer-bottom">© {new Date().getFullYear()} Isla Mercado · Hecho con ❤️ para Cuba</div>
      </footer>
    </div>
  )
}
