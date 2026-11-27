import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import '@fontsource-variable/fraunces/wght.css'
import '@fontsource-variable/fraunces/wght-italic.css'
import '@fontsource-variable/dm-sans/wght.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { CartProvider } from './context/CartContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { PrefsProvider } from './context/PrefsContext'
import './styles.css'

// HashRouter: las rutas profundas funcionan en GitHub Pages (subruta /islamercado/)
// sin depender de redirecciones 404 del servidor.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <PrefsProvider>
        <AuthProvider>
          <FavoritesProvider>
            <CartProvider>
              <App />
            </CartProvider>
          </FavoritesProvider>
        </AuthProvider>
      </PrefsProvider>
    </HashRouter>
  </React.StrictMode>,
)
