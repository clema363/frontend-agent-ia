import { createContext } from 'react'

// Render navigation in the fixed frame, outside the scrollable area.
export const PageHeaderContext = createContext<HTMLDivElement | null>(null)
