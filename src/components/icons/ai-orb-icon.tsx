import { forwardRef } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'

// Monochrome line version of the AI orb face, drawn on lucide's 24px grid so it sits
// with the other nav icons: a circle head and the two capsule eyes, in currentColor.
export const AIOrbIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, strokeWidth = 2, absoluteStrokeWidth, className, ...props }, ref) => {
    const stroke = absoluteStrokeWidth ? (Number(strokeWidth) * 24) / Number(size) : strokeWidth
    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={['lucide', className].filter(Boolean).join(' ')}
        aria-hidden="true"
        {...props}
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9 9.5v3" />
        <path d="M15 9.5v3" />
      </svg>
    )
  },
) as unknown as LucideIcon

AIOrbIcon.displayName = 'AIOrbIcon'

// Same orb, drawn to sit with the Phosphor nav icons: thinner line when idle,
// and a solid head with the eyes cut out when its page is active (weight="fill").
export function AIOrbNavIcon({ weight = 'regular', className }: { weight?: 'regular' | 'fill'; className?: string }) {
  if (weight === 'fill') {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M12 1.25a10.75 10.75 0 1 0 0 21.5 10.75 10.75 0 0 0 0-21.5ZM9 8.5a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Zm6 0a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1Z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9.75" />
      <path d="M9 9.5v3M15 9.5v3" />
    </svg>
  )
}
