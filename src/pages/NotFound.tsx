import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="state-block">
      <div className="state-icon">🏝️</div>
      <h2>Página no encontrada</h2>
      <p>La página que buscas no existe o fue movida.</p>
      <Link to="/" className="btn btn-primary">
        Volver al inicio
      </Link>
    </div>
  )
}
