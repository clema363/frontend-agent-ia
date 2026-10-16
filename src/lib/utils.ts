export { cn } from "cn"

// Rounded percentage; 0 when there is nothing to count.
export function progressOf(done: number, total: number) {
  return total ? Math.round((done / total) * 100) : 0
}

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
const timeUnits: [Intl.RelativeTimeFormatUnit, number][] = [
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
]

// Relative time (2 hours ago, yesterday, etc.) from an ISO date.
export function timeAgo(iso: string) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of timeUnits) {
    if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit)
  }
  return 'just now'
}

// Closest scrolling ancestor: the page scroller of the app layout.
export function scrollParent(element: HTMLElement): HTMLElement {
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) return node
  }
  return document.scrollingElement as HTMLElement
}
