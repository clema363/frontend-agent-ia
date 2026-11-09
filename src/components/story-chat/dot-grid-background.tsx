import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

const GAP = 22 // distance between dots, in CSS pixels
const DOT = 1 // dot radius at rest
const HALO = 180 // radius of the halo around the cursor

// Linear/Vercel-like backdrop: a faint grid of dots that light up in blue around the cursor.
// The canvas only redraws while the halo moves or fades, so it costs nothing when the mouse is still.
// It listens on the window because the layer itself lets clicks through (pointer-events: none).
export function DotGridBackground({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let width = 0
    let height = 0
    let frame = 0
    // Where the halo is drawn, where the cursor is, and how visible the halo is (0 → 1).
    const halo = { x: 0, y: 0, strength: 0 }
    const target = { x: 0, y: 0, strength: 0 }

    function resize() {
      const ratio = window.devicePixelRatio || 1
      width = canvas!.clientWidth
      height = canvas!.clientHeight
      canvas!.width = Math.round(width * ratio)
      canvas!.height = Math.round(height * ratio)
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw()
    }

    function draw() {
      const dark = document.documentElement.classList.contains('dark')
      const base = dark ? '255,255,255' : '9,9,11'
      const accent = dark ? '96,165,250' : '37,99,235' // blue-400 / blue-600
      const rest = dark ? 0.11 : 0.13
      ctx!.clearRect(0, 0, width, height)
      // Centre the grid so the margins are even on both sides.
      const offsetX = (width % GAP) / 2
      const offsetY = (height % GAP) / 2
      for (let y = offsetY; y < height; y += GAP) {
        for (let x = offsetX; x < width; x += GAP) {
          const distance = Math.hypot(x - halo.x, y - halo.y)
          // Smooth falloff: full at the cursor, nothing past the halo radius.
          const t = halo.strength * Math.max(0, 1 - distance / HALO) ** 2
          if (t > 0.01) {
            ctx!.fillStyle = `rgba(${accent},${rest + t * 0.75})`
            ctx!.beginPath()
            ctx!.arc(x, y, DOT + t * 0.6, 0, Math.PI * 2)
            ctx!.fill()
          } else {
            ctx!.fillStyle = `rgba(${base},${rest})`
            ctx!.fillRect(x - DOT, y - DOT, DOT * 2, DOT * 2)
          }
        }
      }
    }

    // Eases the halo towards the cursor; stops once it has caught up.
    function tick() {
      const ease = reduceMotion ? 1 : 0.16
      halo.x += (target.x - halo.x) * ease
      halo.y += (target.y - halo.y) * ease
      halo.strength += (target.strength - halo.strength) * (reduceMotion ? 1 : 0.08)
      draw()
      const moving = Math.abs(target.x - halo.x) > 0.3 || Math.abs(target.y - halo.y) > 0.3 || Math.abs(target.strength - halo.strength) > 0.005
      frame = moving ? requestAnimationFrame(tick) : 0
    }
    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick)
    }

    function onMove(event: PointerEvent) {
      const rect = canvas!.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
      // First entry: start the halo under the cursor instead of sliding in from a corner.
      if (inside && target.strength === 0 && halo.strength < 0.05) {
        halo.x = x
        halo.y = y
      }
      target.x = x
      target.y = y
      target.strength = inside ? 1 : 0
      wake()
    }
    function onLeave() {
      target.strength = 0
      wake()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    // Redraw in the right colors when the theme changes.
    const themeObserver = new MutationObserver(draw)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* The dots fade out towards the edges and the bottom of the page. */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 size-full [mask-image:radial-gradient(ellipse_80%_75%_at_50%_35%,black_40%,transparent_100%)]"
      />
    </div>
  )
}
