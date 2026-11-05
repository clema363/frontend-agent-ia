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
