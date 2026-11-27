import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Preferencias del visitante guardadas en el dispositivo:
 * - province: provincia elegida en "Toda Cuba" ('' = toda Cuba)
 * - ahorro: modo ahorro de datos (imágenes ligeras, sin ilustraciones grandes)
 */
interface PrefsValue {
  province: string
  setProvince: (p: string) => void
  ahorro: boolean
  toggleAhorro: () => void
}

const PrefsContext = createContext<PrefsValue | null>(null)

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* almacenamiento no disponible */
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [province, setProvinceState] = useState(() => read('im.province', ''))
  const [ahorro, setAhorro] = useState(() => read('im.ahorro', '0') === '1')

  useEffect(() => {
    document.documentElement.classList.toggle('ahorro', ahorro)
  }, [ahorro])

  const setProvince = useCallback((p: string) => {
    setProvinceState(p)
    write('im.province', p)
  }, [])

  const toggleAhorro = useCallback(() => {
    setAhorro((v) => {
      write('im.ahorro', v ? '0' : '1')
      return !v
    })
  }, [])

  const value = useMemo(() => ({ province, setProvince, ahorro, toggleAhorro }), [province, setProvince, ahorro, toggleAhorro])
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs debe usarse dentro de PrefsProvider')
  return ctx
}
