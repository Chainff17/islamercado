import { useEffect, useState } from 'react'

/** Indicador de carga en bloque. */
export function LoadingBlock({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="state-block">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  )
}

/** Estado vacío con mensaje y llamada a la acción. */
export function EmptyState({
  icon = '🔍',
  title,
  message,
  action,
}: {
  icon?: string
  title: string
  message?: string
  action?: React.ReactNode
}) {
  return (
    <div className="state-block">
      <div className="state-icon">{icon}</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

/** Alerta de error/exito en bloque. */
export function Alert({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`alert alert-${kind}`}>{children}</div>
}

/** Hook pequeño para re-render tras cambios externos (p. ej. navigation). */
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
