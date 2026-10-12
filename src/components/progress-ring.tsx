import { cn } from '@/lib/utils'

type ProgressRingProps = {
  value: number
  size?: number
  className?: string
}

// Petit cercle de progression (0 à 100), comme les projets de Linear.
export function ProgressRing({ value, size = 16, className }: ProgressRingProps) {
  const stroke = 2
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(Math.max(value, 0), 100)

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn('-rotate-90 shrink-0', className)} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted-foreground/25" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        className={cn('transition-[stroke-dashoffset] duration-500', clamped === 100 ? 'stroke-green-600' : 'stroke-primary')}
      />
    </svg>
  )
}
