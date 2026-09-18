import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const read = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const write = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private windows and blocked site data both throw. Reading stays usable.
  }
}

export const useTheme = (): { theme: Theme; toggleTheme: () => void } => {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const current = document.documentElement.dataset.theme

    setTheme(current === 'dark' ? 'dark' : 'light')
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'

      document.documentElement.dataset.theme = next
      write('ldb-theme', next)

      return next
    })
  }, [])

  return { theme, toggleTheme }
}

export const useBionic = (): { bionic: boolean; toggleBionic: () => void } => {
  const [bionic, setBionic] = useState(false)

  useEffect(() => {
    setBionic(read('ldb-bionic') === 'on')
  }, [])

  const toggleBionic = useCallback(() => {
    setBionic((prev) => {
      write('ldb-bionic', prev ? 'off' : 'on')

      return !prev
    })
  }, [])

  return { bionic, toggleBionic }
}

const WIDTHS = ['64ch', '72ch', '84ch'] as const

export type WidthStep = 0 | 1 | 2

export const useReadingWidth = (): { width: WidthStep; cycleWidth: () => void } => {
  const [width, setWidth] = useState<WidthStep>(1)

  useEffect(() => {
    const stored = Number(read('ldb-width'))
    const next = (stored === 0 || stored === 1 || stored === 2 ? stored : 1) as WidthStep

    setWidth(next)
    document.documentElement.style.setProperty('--reading-width', WIDTHS[next])
  }, [])

  const cycleWidth = useCallback(() => {
    setWidth((prev) => {
      const next = ((prev + 1) % 3) as WidthStep

      document.documentElement.style.setProperty('--reading-width', WIDTHS[next])
      write('ldb-width', String(next))

      return next
    })
  }, [])

  return { width, cycleWidth }
}
