import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Erreur 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page introuvable</h1>
      <p className="mt-4 text-muted-foreground">Cette page n’existe pas ou a été déplacée.</p>
      <Link to="/" className={buttonVariants({ className: 'mt-8' })}>Retour à l’accueil</Link>
    </main>
  )
}
