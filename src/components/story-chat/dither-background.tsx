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

// Paints the source picture once: a diagonal aurora band in shades of blue
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
  ctx.filter = 'blur(60px)'
  // Descends from the top left to the right edge, like a horizon seen from orbit.
  // Kept high and thin so it sits behind the title and composer, not the whole screen.
  ctx.translate(width * 0.5, height * 0.3)
  ctx.rotate(0.3)
  const band = 380
  const gradient = ctx.createLinearGradient(0, -band / 2, 0, band / 2)
  // Blue only, to match the app's accent: navy edges, bright core, a pale highlight in the middle.
  const stops: [number, string][] = dark
    ? [
        [0, 'rgba(9,9,11,0)'],
        [0.18, '#172554'],
        [0.34, '#1d4ed8'],
        [0.46, '#60a5fa'],
        [0.52, '#dbeafe'],
        [0.6, '#3b82f6'],
        [0.76, '#1e3a8a'],
        [1, 'rgba(9,9,11,0)'],
      ]
    : [
        [0, 'rgba(250,250,250,0)'],
        [0.2, '#dbeafe'],
        [0.38, '#93c5fd'],
        [0.5, '#ffffff'],
        [0.62, '#60a5fa'],
        [0.78, '#bfdbfe'],
        [1, 'rgba(250,250,250,0)'],
      ]
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  ctx.fillStyle = gradient
  ctx.fillRect(-width * 1.2, -band / 2, width * 2.4, band)
  ctx.restore()

  // Faint colored speckle everywhere: once dithered it gives the grainy night-sky texture
  // instead of flat black around the band.
  const image = ctx.getImageData(0, 0, width, height)
  const pixels = image.data
  for (let i = 0; i < pixels.length; i += 4) {
    const grain = Math.random()
    if (grain > 0.9) {
      const strength = (grain - 0.9) * (dark ? 200 : -90)
      pixels[i] += strength * 0.35
      pixels[i + 1] += strength * 0.55
      pixels[i + 2] += strength
    }
  }
  ctx.putImageData(image, 0, 0)

  return canvas.toDataURL('image/png')
}

// Dithered aurora backdrop (Devin-like), full bleed behind the welcome screen.
// Content on top uses the `glass` panels so it stays readable.
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
        colorSteps={4}
        fit="cover"
        style={{ width: '100%', height: '100%' }}
      />
      {/* Fades out from mid-screen so the cards sit on the plain page. */}
      <div className="absolute inset-0 bg-linear-to-b from-transparent from-35% to-background to-80%" />
    </div>
  )
}
