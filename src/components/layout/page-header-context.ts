import { createContext } from 'react'

// La navigation est rendue dans le cadre fixe, hors de la zone de défilement.
export const PageHeaderContext = createContext<HTMLDivElement | null>(null)
