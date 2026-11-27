import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="not-found">
      <div className="not-found-code">404</div>
      <h1>Página no encontrada</h1>
      <p>La página que buscas no existe o fue movida.</p>
      <Link to="/" className="btn btn-primary btn-lg">
        Volver al inicio
      </Link>
    </div>
  )
}
