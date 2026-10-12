export { cn } from "cn"

// Pourcentage arrondi, 0 quand il n'y a rien à compter.
export function progressOf(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

// « 2 hours ago », « yesterday »… à partir d'une date ISO.
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of timeUnits) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}
