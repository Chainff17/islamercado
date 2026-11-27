import { useState, type ReactNode } from 'react'

export function LoadingBlock({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="state-block loading-block">
      <div className="spinner" />
      <p>{message}</p>
    </div>
  )
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string
  message?: string
  action?: ReactNode
}) {
  return (
    <div className="state-block empty-state">
      <div className="empty-icon">📭</div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  )
}

export function Alert({
  kind = 'error',
  children,
}: {
  kind?: 'error' | 'success' | 'info'
  children: ReactNode
}) {
  return <div className={`alert alert-${kind}`}>{children}</div>
}

/** Hook para evitar renderizados previos al montaje (evita warnings de React Router). */
export function useMounted() {
  const [mounted, setMounted] = useState(true)
  if (!mounted) {
    setMounted(true)
  }
  return mounted
}
