import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

/**
 * Red de seguridad global: si algo falla al renderizar, muestra un aviso con opción de
 * recargar en lugar de dejar la página en blanco.
 * Usa estilos en línea para funcionar aunque falle la carga del CSS.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('IslaMercado: error no controlado', error, info.componentStack)
  }

  private reset = () => {
    try {
      // Limpia preferencias locales por si quedaron en un estado inválido tras una actualización
      localStorage.removeItem('im.province')
      localStorage.removeItem('im.ahorro')
    } catch {
      /* sin acceso a localStorage */
    }
    window.location.hash = '#/'
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          background: '#f6f0e6',
          color: '#2b2520',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: 'center',
            background: '#fffdf9',
            border: '1px solid #e7dccb',
            borderRadius: 16,
            padding: '32px 28px',
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Algo salió mal</div>
          <p style={{ margin: '0 0 20px', color: '#6b6158', lineHeight: 1.5 }}>
            IslaMercado tuvo un problema al cargar esta página. Prueba a recargar; si sigue pasando,
            revisa tu conexión.
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{
              background: '#b4532f',
              color: '#fff',
              border: 0,
              borderRadius: 10,
              padding: '11px 20px',
              fontWeight: 600,
              fontSize: 15,
              cursor: 'pointer',
            }}
          >
            Recargar IslaMercado
          </button>
          <pre
            style={{
              marginTop: 18,
              fontSize: 11,
              color: '#9a8f84',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
          </pre>
        </div>
      </div>
    )
  }
}
