import { useEffect, useMemo, useState } from 'react'
import { ImageDithering } from '@paper-design/shaders-react'
import { cn } from '@/lib/utils'

// Follows the `dark` class the theme provider puts on <html>.
function useIsDark() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  useEffect(() => {
    const root = document.documentElement
    const observer = new MutationObserver(() => setDark(root.classList.contains('dark')))
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])
  return dark
}

// Paints the source picture once: a diagonal aurora band (deep blue → white → orange → red)
// on the page background. The shader then turns it into the pixel dither.
function paintAurora(dark: boolean) {
  const width = 1600
  const height = 1000
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  ctx.fillStyle = dark ? '#09090b' : '#fafafa'
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.filter = 'blur(70px)'
  ctx.translate(width * 0.55, height * 0.32)
  ctx.rotate(-0.42)
  const band = 520
  const gradient = ctx.createLinearGradient(0, -band / 2, 0, band / 2)
  const stops: [number, string][] = dark
    ? [
        [0, 'rgba(9,9,11,0)'],
        [0.18, '#1e3a8a'],
        [0.36, '#3b82f6'],
        [0.48, '#bfdbfe'],
        [0.53, '#fef3c7'],
        [0.6, '#f97316'],
        [0.74, '#b91c1c'],
        [1, 'rgba(9,9,11,0)'],
      ]
    : [
        [0, 'rgba(250,250,250,0)'],
        [0.2, '#bfdbfe'],
        [0.38, '#60a5fa'],
        [0.5, '#ffffff'],
        [0.6, '#fdba74'],
        [0.76, '#f87171'],
        [1, 'rgba(250,250,250,0)'],
      ]
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(-width * 1.2, -band / 2, width * 2.4, band)
  ctx.restore()

  return canvas.toDataURL('image/png')
}

// Dithered aurora backdrop of the story chat welcome screen, faded into the page on every side
// so the composer and cards stay readable.
export function DitherBackground({ className }: { className?: string }) {
  const dark = useIsDark()
  const image = useMemo(() => paintAurora(dark), [dark])
  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <ImageDithering
        image={image}
        originalColors
        type="4x4"
        size={2}
        colorSteps={3}
        fit="cover"
        style={{ width: '100%', height: '100%' }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--background)_85%)]" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-linear-to-t from-background to-transparent" />
    </div>
  )
}
