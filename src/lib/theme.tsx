import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { KanbanColumnId } from '@/lib/domain'

export type ThemeMode = 'light' | 'dark' | 'system'

export type Theme = {
  mode: ThemeMode
  // Fond de chaque colonne du Kanban. Colonne absente = gris neutre par défaut.
  kanbanColumns: Partial<Record<KanbanColumnId, string>>
}

export const kanbanPresets = ['#64748b', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6']

const storageKey = 'atlas-theme'
const defaultTheme: Theme = { mode: 'system', kanbanColumns: {} }

// Préférence propre à l'appareil : lue en local pour être appliquée avant le premier rendu.
function loadTheme(): Theme {
  try {
    return { ...defaultTheme, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') }
  } catch {
    return defaultTheme
  }
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(theme: Theme) {
  const root = document.documentElement
  root.classList.toggle('dark', theme.mode === 'dark' || (theme.mode === 'system' && darkQuery.matches))
}

// Teinte transparente : la même couleur reste lisible en mode clair comme en mode sombre.
export function kanbanColumnStyle(color: string | undefined) {
  return color ? { backgroundColor: `color-mix(in oklch, ${color} 16%, transparent)` } : undefined
}

applyTheme(loadTheme())

type ThemeContextValue = { theme: Theme; setTheme: (changes: Partial<Theme>) => void }

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState(loadTheme)

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(storageKey, JSON.stringify(theme))
    if (theme.mode !== 'system') return
    const onChange = () => applyTheme(theme)
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [theme])

  const setTheme = (changes: Partial<Theme>) => setThemeState((current) => ({ ...current, ...changes }))

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside ThemeProvider')
  return context
}
