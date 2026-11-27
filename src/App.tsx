import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import { TreePalm } from 'lucide-react'
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
import Categories from './pages/Categories'
import { LoadingBlock } from './components/Pagination'

// El mapa (Leaflet) se descarga solo cuando se visita: ahorra datos en la portada.
const MapPage = lazy(() => import('./pages/MapPage'))

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
      <main className="main-content container">
        <Suspense fallback={<LoadingBlock />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/buscar" element={<Browse />} />
            <Route path="/categorias" element={<Categories />} />
            <Route path="/categoria/:slug" element={<Browse />} />
            <Route path="/mapa" element={<MapPage />} />
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
        </Suspense>
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div className="footer-brand">
            <Link to="/" className="logo logo-sm">
              <span className="logo-mark">
                <TreePalm size={18} strokeWidth={1.8} />
              </span>
              <span className="logo-text">
                IslaMercado<span className="logo-dot">.</span>
              </span>
            </Link>
            <p>Compra y vende con la gente de aquí. De Pinar del Río a Guantánamo, todo en un solo lugar.</p>
          </div>
          <nav>
            <strong>Comprar</strong>
            <Link to="/buscar">Anuncios recientes</Link>
            <Link to="/categorias">Categorías</Link>
            <Link to="/mapa">Mapa</Link>
            <Link to="/buscar?cubano=1">Hecho en Cuba</Link>
          </nav>
          <nav>
            <strong>Vender</strong>
            <Link to="/publicar">Publicar anuncio</Link>
            <Link to="/mis-publicaciones">Mis anuncios</Link>
            <Link to="/mis-ventas">Mis ventas</Link>
          </nav>
          <nav>
            <strong>Mi cuenta</strong>
            <Link to="/perfil">Perfil</Link>
            <Link to="/mis-compras">Mis compras</Link>
            <Link to="/mensajes">Mensajes</Link>
            <Link to="/favoritos">Favoritos</Link>
          </nav>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} IslaMercado · Hecho con cariño en Cuba</span>
          <span>Pagos: Transfermóvil · Zelle · efectivo CUP, USD o MLC</span>
        </div>
      </footer>
    </div>
  )
}
