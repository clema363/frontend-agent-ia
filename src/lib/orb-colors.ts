import { useSyncExternalStore } from 'react'

// App-wide colours of the AI orb, picked in the AI Lab and kept in localStorage.
// Every AIOrbFace reads them, so a change shows up everywhere at once.

export type OrbColors = { body: string; bodyEdge: string; feature: string }

export const defaultOrbColors: OrbColors = { body: '#d65fe0', bodyEdge: '#fbf3fb', feature: '#24212f' }

export const orbPresets: { id: string; label: string; colors: OrbColors }[] = [
  { id: 'smooth', label: 'Smooth', colors: defaultOrbColors },
  { id: 'atlas', label: 'Atlas', colors: { body: '#3b82f6', bodyEdge: '#eff6ff', feature: '#0f172a' } },
  { id: 'mint', label: 'Menthe', colors: { body: '#10b981', bodyEdge: '#ecfdf5', feature: '#052e16' } },
  { id: 'sunset', label: 'Sunset', colors: { body: '#f97316', bodyEdge: '#fff7ed', feature: '#431407' } },
  { id: 'lemon', label: 'Citron', colors: { body: '#eab308', bodyEdge: '#fefce8', feature: '#1c1917' } },
  { id: 'night', label: 'Nuit', colors: { body: '#4f46e5', bodyEdge: '#1e1b4b', feature: '#f8fafc' } },
]

const KEY = 'atlas.orbColors'
const listeners = new Set<() => void>()
let cache: OrbColors | null = null

function read(): OrbColors | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...defaultOrbColors, ...(JSON.parse(raw) as Partial<OrbColors>) } : null
  } catch {
    return null
  }
}
cache = read()

export function setOrbColors(colors: OrbColors | null) {
  cache = colors
  if (colors) localStorage.setItem(KEY, JSON.stringify(colors))
  else localStorage.removeItem(KEY)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return
    cache = read()
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

// null while the user keeps SmoothUI's default palette.
export function useOrbColors() {
  return useSyncExternalStore(subscribe, () => cache, () => null)
}
