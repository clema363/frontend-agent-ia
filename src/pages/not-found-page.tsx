import { Link } from 'react-router'
import { buttonVariants } from '@/components/ui/button-variants'

export function NotFoundPage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-4 text-muted-foreground">This page does not exist or has been moved.</p>
      <Link to="/" className={buttonVariants({ className: 'mt-8' })}>Back to home</Link>
    </main>
  )
}
